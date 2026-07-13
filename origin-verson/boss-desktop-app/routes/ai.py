"""
AI 相关路由：代理、简历分析、简历优化、面试模拟、配置管理
"""
import json
import re
import os
from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, AIConfig, Resume, InterestedJob, InterviewSession
from utils.auth import login_required
from utils.crypto import encrypt_key, decrypt_key
from utils.rate_limit import rate_limit
from utils.ai_prompts import (
    build_generate_resume_prompt,
    build_score_resume_prompt,
    build_optimize_section_prompt,
    build_jd_match_prompt,
)
from routes.resumes import _structured_to_text
import requests

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


def get_default_ai_config():
    config = AIConfig.query.filter_by(is_default=True, is_active=True).first()
    if not config:
        config = AIConfig.query.filter_by(is_active=True).first()
    return config


def _api_key(config):
    """获取解密后的 API Key"""
    return decrypt_key(config.api_key) if config and config.api_key else ''


def mask_api_key(key):
    if not key or len(key) < 10:
        return key
    return key[:6] + '****' + key[-4:]


@ai_bp.route('/config', methods=['GET'])
@login_required
def get_ai_config():
    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': '未配置 AI，请先在桌面端设置'}), 404
    return jsonify({
        'success': True,
        'data': {'api_url': config.api_url, 'model': config.model}
    })


@ai_bp.route('/settings', methods=['GET'])
@login_required
def get_ai_settings():
    config = get_default_ai_config()
    if config:
        raw_key = decrypt_key(config.api_key) or ''
        return jsonify({
            'success': True,
            'data': {
                'api_url': config.api_url,
                'model': config.model,
                'api_key': raw_key,
                'has_api_key': bool(raw_key),
                'api_key_preview': mask_api_key(raw_key) if raw_key else '',
            }
        })
    return jsonify({
        'success': True,
        'data': {
            'api_url': 'https://api.siliconflow.cn/v1',
            'model': 'deepseek-ai/DeepSeek-V3.2',
            'api_key': '',
            'has_api_key': False,
            'api_key_preview': '',
        }
    })


@ai_bp.route('/settings', methods=['POST'])
@login_required
@rate_limit(max_requests=20, window_seconds=300)
def save_ai_settings():
    data = request.get_json() or {}
    api_key = data.get('api_key', '').strip()
    model = data.get('model', 'deepseek-ai/DeepSeek-V3.2').strip()
    api_url = data.get('api_url', 'https://api.siliconflow.cn/v1').strip()

    if not api_key:
        return jsonify({'success': False, 'error': 'API Key 不能为空'}), 400

    config = AIConfig.query.filter_by(is_default=True).first()
    if not config:
        config = AIConfig(
            config_name='default',
            api_url=api_url,
            api_key=encrypt_key(api_key),
            model=model,
            is_active=True,
            is_default=True,
        )
        db.session.add(config)
    else:
        config.api_key = encrypt_key(api_key)
        config.model = model
        config.api_url = api_url

    db.session.commit()
    return jsonify({'success': True, 'data': {'message': 'AI 设置已保存'}})


@ai_bp.route('/test', methods=['POST'])
@login_required
@rate_limit(max_requests=10, window_seconds=300)
def test_ai_connection():
    data = request.get_json() or {}
    api_key = data.get('api_key', '').strip()
    api_url = data.get('api_url', 'https://api.siliconflow.cn/v1').strip()
    model = data.get('model', 'deepseek-ai/DeepSeek-V3.2').strip()

    if not api_key:
        return jsonify({'success': False, 'error': '请先输入 API Key'}), 400

    try:
        endpoint = api_url.rstrip('/')
        if not endpoint.endswith('/chat/completions'):
            endpoint += '/chat/completions'

        resp = requests.post(
            endpoint,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={'model': model, 'messages': [{'role': 'user', 'content': 'Hi'}], 'max_tokens': 10},
            timeout=15,
        )
        if resp.ok:
            return jsonify({'success': True, 'data': {'message': '连接成功！API Key 有效'}})
        error_msg = f'连接失败 (HTTP {resp.status_code})'
        try:
            err = resp.json()
            if 'error' in err:
                error_msg = err['error'].get('message', error_msg)
        except Exception:
            pass
        return jsonify({'success': False, 'error': error_msg})
    except requests.Timeout:
        return jsonify({'success': False, 'error': '连接超时，请检查网络'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': '连接失败，请检查网络和 API 地址'}), 500


@ai_bp.route('/proxy', methods=['POST'])
@login_required
@rate_limit(max_requests=60, window_seconds=60)
def ai_proxy():
    """通用 AI 代理 — 前端传 messages，后端注入 Key 转发"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '请求数据为空'}), 400

    model = (data.get('model') or '').strip()
    messages = data.get('messages')
    temperature = data.get('temperature', 0.3)
    max_tokens = data.get('max_tokens', 4000)

    if not messages or not isinstance(messages, list) or len(messages) == 0:
        return jsonify({'success': False, 'error': 'messages 参数不能为空'}), 400

    config = get_default_ai_config()
    if not config or not _api_key(config):
        return jsonify({'success': False, 'error': 'AI 服务未配置，请在桌面端设置 AI Key'}), 500

    if not model:
        model = config.model

    try:
        endpoint = config.api_url.rstrip('/')
        if not endpoint.endswith('/chat/completions'):
            endpoint += '/chat/completions'

        resp = requests.post(
            endpoint,
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': model, 'messages': messages, 'temperature': temperature, 'max_tokens': max_tokens},
            timeout=120,
        )

        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败 (HTTP {resp.status_code})'}), 502

        result = resp.json()
        return jsonify({'success': True, 'data': result})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception:
        return jsonify({'success': False, 'error': 'AI 代理请求失败'}), 500


@ai_bp.route('/analyze', methods=['POST'])
@login_required
def analyze_resume():
    """简历分析 — 六维度评分"""
    data = request.get_json()
    resume_text = data.get('resume_text', '')
    if not resume_text:
        return jsonify({'success': False, 'error': '简历内容不能为空'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = _build_analysis_prompt(resume_text)
    try:
        endpoint = config.api_url.rstrip('/')
        if not endpoint.endswith('/chat/completions'):
            endpoint += '/chat/completions'
        resp = requests.post(
            endpoint,
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位资深 HR 专家，擅长简历筛选和人才评估。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.3, 'max_tokens': 3000},
            timeout=120,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        analysis = _parse_ai_json(ai_response)
        return jsonify({'success': True, 'data': analysis})
    except Exception as e:
        return jsonify({'success': False, 'error': '分析失败，请稍后重试'}), 500


@ai_bp.route('/rewrite', methods=['POST'])
@login_required
def rewrite_resume():
    """简历优化 — 严禁编造"""
    data = request.get_json()
    resume_text = data.get('resume_text', '')
    analysis = data.get('analysis', {})
    if not resume_text:
        return jsonify({'success': False, 'error': '简历内容不能为空'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = _build_rewrite_prompt(resume_text, analysis)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位顶尖简历优化专家。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.2, 'max_tokens': 4000},
            timeout=120,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: {resp.status_code}'}), 500

        result = resp.json()
        return jsonify({'success': True, 'data': {'rewritten_resume': result['choices'][0]['message']['content']}})
    except Exception as e:
        return jsonify({'success': False, 'error': '优化失败，请稍后重试'}), 500


def _build_analysis_prompt(resume_text):
    return f"""# Role
你是一位拥有10年以上经验的资深技术HR，精通简历筛选和人才评估。

【重要评估原则】
注：候选人的过往经历中，如果包含实习经历，但该实习期间具备独立主导项目、跨部门协同或显著业绩产出（如研发了一套工具并实现提效83%、独立负责某条业务线增长等），请务必将其视同正式工作的实战经验进行客观评估，不要因为"实习"标签而降低"工作经历与项目经验"维度的评分。

## 简历内容
{resume_text[:4000]}

## 六维度评分体系（总分100分）
1. 教育背景与资质 - 15分
2. 专业技能与技术栈 - 25分
3. 工作经历与项目经验 - 30分
4. 职业发展与稳定性 - 15分
5. 软技能与综合素质 - 10分
6. 简历质量与呈现 - 5分

## 重要约束
- 每个维度的score绝对不能超过其max_score
- overall_score必须等于六个维度score的总和
- 评分要有区分度，避免所有简历都是80-85分

## 输出格式（纯JSON，不要加```json标记，不要任何Markdown包裹）
{{
  "candidate_name": "姓名",
  "overall_score": 85,
  "dimensions": {{
    "education": {{"score": 13, "max_score": 15, "analysis": "分析"}},
    "technical_skills": {{"score": 22, "max_score": 25, "analysis": "分析"}},
    "experience": {{"score": 26, "max_score": 30, "analysis": "分析"}},
    "career_progression": {{"score": 12, "max_score": 15, "analysis": "分析"}},
    "soft_skills": {{"score": 8, "max_score": 10, "analysis": "分析"}},
    "resume_quality": {{"score": 4, "max_score": 5, "analysis": "分析"}}
  }},
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["短板1", "短板2"],
  "resume_optimization_suggestions": ["建议1", "建议2"],
  "interview_focus_questions": ["问题1", "问题2"],
  "pre_match_analysis": "基于该简历，候选人最适合的行业、公司规模、岗位类型分析（80字以内）",
  "icebreaker_suggestion": "基于简历最亮眼1-2个亮点生成的20-30字破冰招呼语核心框架"
}}

（若输出超时或过长，请优先保证 strengths、weaknesses、pre_match_analysis 和 icebreaker_suggestion 的完整输出。）"""


def _build_rewrite_prompt(resume_text, analysis):
    strengths = '\n'.join(f"- {s}" for s in analysis.get('strengths', []))
    weaknesses = '\n'.join(f"- {s}" for s in analysis.get('weaknesses', []))
    return f"""# Role
你是一位严谨的简历表达优化专家。你只优化表达方式，绝不编造任何信息。

## 核心约束（违反任何一条即为不合格）
1. 不添加原简历中不存在的公司、项目、职位、学历、证书
2. 不添加原简历中未提及的技能、工具、技术栈
3. 不编造任何数字、百分比、金额、团队规模等量化数据
4. 不推测或假设候选人的经历细节
5. 原文缺数据的地方，标注"📝 建议补充：描述具体成果"，不替用户填写

## 允许的优化
- 弱动词替换为强动词（"做了"→"实现了"，"参与"→"负责XX模块"但要合理）
- 口语化表达改写为专业表达
- 结构重组（STAR法则、时间倒序、标题层级）
- 冗长描述精简化

## 原简历
{resume_text[:3000]}

## 分析结果
- 综合评分：{analysis.get('overall_score', 0)}分

## 核心优势
{strengths}

## 明显短板
{weaknesses}

请直接输出优化后的简历内容（Markdown格式）。"""


@ai_bp.route('/generate-greeting', methods=['POST'])
@login_required
def generate_greeting():
    """生成 JD 定制招呼语 — 带缓存，支持有/无简历降级"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '请求数据为空'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    job_id = data.get('job_id') or ''
    jd_text = (data.get('jd_text') or '').strip()
    resume_text = (data.get('resume_text') or '').strip()
    company_name = (data.get('company_name') or '').strip()
    job_name = (data.get('job_name') or '').strip()

    # 查数据库获取 JD（如果没传但给了 job_id）
    job = None
    if job_id:
        job = InterestedJob.query.filter_by(job_id=str(job_id), user_id=request.current_user.id).first()
        if job and job.custom_greeting:
            return jsonify({
                'success': True,
                'data': {'greeting': job.custom_greeting, 'cached': True, 'grade': 'full' if resume_text else 'degraded'},
            })
        if job and not jd_text:
            jd_text = (job.jd or '') + ' ' + (job.job_responsibilities or '') + ' ' + (job.job_requirements or '')
            company_name = company_name or job.company_name
            job_name = job_name or job.job_name

    if not jd_text or len(jd_text) < 20:
        return jsonify({'success': False, 'error': 'JD 内容不足，无法生成'}), 400

    truncated_jd = jd_text[:2000]

    # 全量 or 降级
    if resume_text and len(resume_text) > 10:
        truncated_resume = resume_text[:3000]
        grade = 'full'
        system_prompt = (
            '你是求职者本人，在BOSS直聘给HR发招呼语。\n'
            '【硬格式】1.开头前15字必须是"熟悉XXX、XXX"（填该岗位JD要求且你简历具备的核心技能1-2个）。'
            '2.紧接着"做过XXX"说明简历里与该岗位相关的具体项目/经历。'
            '3.全文80-120字，真诚自然。\n'
            '【严禁】任何注释、说明、引导语、括号备注、字数统计、"好的"、"以下是"。回复会原样发给HR。'
        )
        user_prompt = (
            f'我的简历：{truncated_resume}\n\n'
            f'目标岗位：{job_name or ""}（{company_name or ""}）\n'
            f'该岗位JD：{truncated_jd}\n\n'
            f'请按格式生成招呼语，开头必须"熟悉…"，直接输出招呼语本身，不要任何多余内容。'
        )
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ]
    else:
        grade = 'degraded'
        system_prompt = (
            '你是求职者本人，在BOSS直聘给HR发招呼语。\n'
            '【硬格式】开头展示对该岗位JD要求的理解（如"我了解贵岗位需要XXX"），'
            '接着简要说明自己相关背景或经验，全文60-100字，真诚自然。\n'
            '【严禁】任何注释、说明、引导语、括号备注、字数统计、"好的"、"以下是"。回复会原样发给HR。'
        )
        user_prompt = (
            f'岗位：{company_name} - {job_name}\n'
            f'JD：{truncated_jd}\n\n'
            f'请按格式生成招呼语，直接输出招呼语本身，不要任何多余内容。'
        )
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ]

    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={
                'model': config.model,
                'messages': messages,
                'temperature': 0.8,
                'max_tokens': 300,
            },
            timeout=30,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 调用失败: {resp.status_code}'}), 500

        greeting = resp.json()['choices'][0]['message']['content'].strip()
        # 清理 AI 常见废话前缀
        import re as _re
        greeting = _re.sub(r'^(好的|以下是[^。，]*?)[，,。]?\s*', '', greeting)
        greeting = _re.sub(r'^(招呼语|为您生成).*?[:：]\s*', '', greeting)
        greeting = greeting.replace('<', '').replace('>', '').replace('\n', ' ').replace('`', '').strip()

        if not greeting or len(greeting) < 10:
            return jsonify({'success': False, 'error': 'AI 返回内容过短'}), 500

        # 缓存到数据库
        if job:
            job.custom_greeting = greeting
            db.session.commit()

        return jsonify({
            'success': True,
            'data': {'greeting': greeting, 'cached': False, 'grade': grade},
        })
    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': '生成失败，请稍后重试'}), 500


INTERVIEW_PHASES = ['opening', 'technical', 'experience', 'behavioral', 'reverse', 'closing']


@ai_bp.route('/interview', methods=['POST'])
@login_required
def interview():
    """面试模拟 — 根据 JD + 简历，AI 扮演 HR 分阶段提问

    支持两种模式（互斥）：
      新模式（推荐）：直接传入 jd_text / job_title / company_name / resume_text
      旧模式（兼容）：传入 job_id / resume_id，从数据库读取
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '请求数据为空'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    user_message = data.get('user_message') or ''
    session_id = data.get('session_id')

    # ── 获取 JD 和简历：新模式优先（直接文本） ──
    jd_text = (data.get('jd_text') or '').strip()
    resume_text = (data.get('resume_text') or '').strip()
    company_name = (data.get('company_name') or '').strip()
    job_title = (data.get('job_title') or '').strip()

    # 旧模式兼容：从数据库读取
    if not jd_text:
        job_id = data.get('job_id')
        resume_id = data.get('resume_id')
        if job_id:
            job = InterestedJob.query.get(job_id)
            if job:
                jd_text = (job.jd or '') + '\n' + (job.job_responsibilities or '') + '\n' + (job.job_requirements or '')
                company_name = company_name or job.company_name
                if not jd_text.strip():
                    jd_text = f'{job.job_name} - {job.company_name} - {job.salary or ""} - {job.location or ""}'
        if resume_id and not resume_text:
            resume = Resume.query.get(resume_id)
            if resume:
                resume_text = resume.content

    # 至少需要 JD 文字
    if not jd_text:
        return jsonify({'success': False, 'error': '请填写岗位 JD 或岗位名称'}), 400

    # 构造函数名称（用于 prompt 上下文）
    if job_title:
        display_job = f'{company_name} - {job_title}' if company_name else job_title
    else:
        display_job = company_name or '目标岗位'

    # 加载或创建会话
    session = None
    messages = []
    current_phase = 'opening'

    if session_id:
        session = InterviewSession.query.filter_by(id=session_id, user_id=request.current_user.id).first()
        if session and session.status == 'in_progress' and session.messages:
            messages = session.messages

    if not session:
        session = InterviewSession(
            user_id=request.current_user.id,
            job_id=data.get('job_id'),
            resume_id=data.get('resume_id'),
            status='in_progress',
            messages=[],
        )
        db.session.add(session)
        db.session.commit()

    # 追加用户本轮回答
    if user_message.strip() and messages:
        messages.append({'role': 'user', 'content': user_message.strip()})

    # 判断当前阶段
    if messages:
        current_phase = _detect_interview_phase(messages)

    # 构建 prompt
    system_prompt = _build_interview_prompt(jd_text, resume_text, display_job, current_phase, messages)

    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={
                'model': config.model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                ] + [{'role': m['role'], 'content': m['content']} for m in messages[-12:]],
                'temperature': 0.7,
                'max_tokens': 600,
            },
            timeout=90,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 调用失败: {resp.status_code}'}), 500

        hr_reply = resp.json()['choices'][0]['message']['content'].strip()

        # 检查是否结束
        is_ended = '[END]' in hr_reply
        hr_reply = hr_reply.replace('[END]', '').replace('[NEXT_PHASE]', '').strip()

        # 保存到会话
        messages.append({'role': 'assistant', 'content': hr_reply})
        session.messages = messages

        report = None
        if is_ended:
            session.status = 'completed'
            session.ended_at = datetime.utcnow()
            # 生成总结报告
            report = _generate_interview_report(config, jd_text, resume_text, messages)
            if report:
                session.overall_score = report.get('overall_score')
                session.strengths = report.get('strengths', [])
                session.weaknesses = report.get('weaknesses', [])
                session.suggestions = report.get('suggestions', [])

        db.session.commit()

        return jsonify({
            'success': True,
            'data': {
                'session_id': session.id,
                'hr_message': hr_reply,
                'phase': current_phase,
                'is_ended': is_ended,
                'report': report,
            }
        })

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': '面试请求失败，请稍后重试'}), 500


@ai_bp.route('/interview/sessions', methods=['GET'])
@login_required
def list_interview_sessions():
    sessions = InterviewSession.query.filter_by(
        user_id=request.current_user.id
    ).order_by(InterviewSession.started_at.desc()).limit(20).all()
    return jsonify({'success': True, 'data': [s.to_dict() for s in sessions]})


def _detect_interview_phase(messages):
    count = sum(1 for m in messages if m['role'] == 'user')
    if count <= 0:
        return 'opening'
    elif count <= 2:
        return 'technical'
    elif count <= 4:
        return 'experience'
    elif count <= 5:
        return 'behavioral'
    elif count <= 6:
        return 'reverse'
    else:
        return 'closing'


def _build_interview_prompt(jd_text, resume_text, company_name, phase, messages):
    phase_guides = {
        'opening': '这是面试开头。先做简短自我介绍（你是HR），然后根据JD和简历，提1个跟岗位直接相关的开放性问题，了解候选人的基本能力。',
        'technical': '深挖技术细节。根据JD里的技术要求，追问候选人在简历中提到的技术栈的具体实践——问项目里怎么用的、遇到什么问题、怎么解决的。一次只问1个问题。',
        'experience': '考察项目经验。针对简历上最亮眼的一个项目，问具体细节：候选人在其中扮演什么角色、做了哪些决策、结果怎么衡量。追问数据。',
        'behavioral': '考察综合素质。问团队协作、冲突处理、时间管理方面的问题。结合岗位特点。',
        'reverse': '这是候选人反问环节。说"面试部分差不多了，你有什么想了解的吗？我可以帮你介绍一下团队、业务、发展空间"。如果候选人问了，回答后加[NEXT_PHASE]。',
        'closing': '面试快结束了。感谢候选人，说"今天的面试到这里，我们会在1-3个工作日内反馈结果"。回复末尾必须加[END]。',
    }

    guide = phase_guides.get(phase, phase_guides['opening'])
    history_count = len([m for m in messages if m['role'] == 'user'])

    resume_section = f"""# 候选人简历
{resume_text[:2500]}

""" if resume_text.strip() else ''

    return f"""# 角色
你是 {company_name or '某公司'} 的一位资深HR，正在进行一场线上技术面试。

# 岗位信息
{jd_text[:2000]}

{resume_section}

# 面试阶段
当前阶段：{phase}（{guide}）
当前第{history_count + 1}轮

# 重要规则
1. 每次只问1个问题，不要多个问题一起抛
2. 根据候选人的回答追问细节，不要跳到不相关的方向
3. 问JD里提到的技术/经验，不要超纲
4. 语气专业、简洁，像真实的HR面试
5. 不要评价候选人的回答（不要说你回答得很好/有待改进）
6. 不要在问题里透露正确答案
7. 如果当前阶段该结束了，回复末尾加[NEXT_PHASE]
8. closing阶段回复末尾加[END]

直接输出你作为HR要说的话。"""


def _generate_interview_report(config, jd_text, resume_text, messages):
    """生成面试总结报告"""
    dialogue = '\n'.join([f"{'HR' if m['role'] == 'assistant' else '求职者'}: {m['content'][:300]}" for m in messages])

    prompt = f"""# 角色
你是一位资深面试官，刚完成了一场面试。请根据对话记录给出评估。

# 岗位要求
{jd_text[:1000]}

# 候选人简历
{resume_text[:1000]}

# 面试对话
{dialogue}

# 输出格式（纯JSON）
{{
  "overall_score": 75,
  "strengths": ["面试中表现好的1-3个方面"],
  "weaknesses": ["需要改进的1-3个方面"],
  "suggestions": ["具体的面试改进建议1-3条"]
}}

整体评分75分为基准，表现好加分、差减分。直接输出JSON不要```json标记。"""

    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={
                'model': config.model,
                'messages': [
                    {'role': 'system', 'content': '你是一位资深面试官，输出纯JSON。'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.3,
                'max_tokens': 800,
            },
            timeout=60,
        )
        if resp.ok:
            text = resp.json()['choices'][0]['message']['content']
            return _parse_ai_json(text)
    except Exception:
        pass
    return None


def _api_endpoint(config):
    """统一构造 API 端点 URL，确保以 /chat/completions 结尾"""
    url = (config.api_url or '').rstrip('/')
    if not url.endswith('/chat/completions'):
        url += '/chat/completions'
    return url


def _parse_ai_json(ai_response):
    """从 AI 返回文本中提取 JSON，支持多种格式和嵌套深度"""
    json_str = ''

    # 1) 优先提取 ```json ... ``` 代码块
    code_block = re.search(r'```json\s*([\s\S]*?)```', ai_response)
    if code_block:
        json_str = code_block.group(1).strip()
    else:
        # 2) 提取 ``` ... ``` 通用代码块
        generic = re.search(r'```\s*([\s\S]*?)```', ai_response)
        if generic:
            json_str = generic.group(1).strip()
        else:
            # 3) 从文本中提取最外层 JSON 对象（支持任意嵌套深度）
            start = ai_response.find('{')
            if start >= 0:
                depth = 0
                for i in range(start, len(ai_response)):
                    ch = ai_response[i]
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            json_str = ai_response[start:i + 1]
                            break

    if not json_str:
        return None

    try:
        result = json.loads(json_str)
    except json.JSONDecodeError:
        # 4) 尝试修复常见的 JSON 问题：尾部逗号、单引号
        try:
            fixed = re.sub(r',\s*}', '}', json_str)
            fixed = re.sub(r',\s*]', ']', fixed)
            result = json.loads(fixed)
        except json.JSONDecodeError:
            return None

    if isinstance(result, dict):
        if result.get('dimensions'):
            for key in result['dimensions']:
                d = result['dimensions'][key]
                if d.get('score', 0) > d.get('max_score', 0):
                    d['score'] = d['max_score']
            calculated = sum(
                result['dimensions'].get(k, {}).get('score', 0)
                for k in ['education', 'technical_skills', 'experience',
                          'career_progression', 'soft_skills', 'resume_quality']
            )
            result['overall_score'] = calculated
        return result
    return None


@ai_bp.route('/analyze-jd', methods=['POST'])
@login_required
def analyze_jd():
    """JD 分析 + 建议提问（借鉴 lakejobai）"""
    data = request.get_json(silent=True) or {}
    job_title = data.get('job_title', '')
    company = data.get('company', '')
    description = data.get('description', '')
    resume_text = data.get('resume_text', '')
    resume_analysis = data.get('resume_analysis', '')

    if not description or len(description) < 20:
        return jsonify({'success': False, 'error': 'JD内容不足'}), 400

    # 检查缓存（24h）
    try:
        job = InterestedJob.query.filter_by(company=company, position=job_title).first()
        if job and job.jd_analysis and job.jd_analysis_at:
            age = (datetime.utcnow() - job.jd_analysis_at).total_seconds()
            if age < 86400:
                return jsonify({'success': True, 'data': json.loads(job.jd_analysis), '_cached': True})
    except Exception:
        pass

    # 构建 prompt
    has_resume = bool(resume_text and len(resume_text) > 10)
    if has_resume:
        sys = '你是求职辅导专家。对比求职者简历和岗位JD，输出严格JSON。'
        user = f"""## 求职者简历
{resume_text[:2000]}
{f"## 简历AI分析\n{resume_analysis[:600]}" if resume_analysis else ""}

## 岗位信息
- 公司: {company}
- 职位: {job_title}
- JD: {description[:2000]}

## 输出格式（严格JSON，不要markdown代码块）
{{
  "match_score": 85,
  "decision": "建议投递",
  "key_skills": ["Python", "LangChain"],
  "gap": "缺少K8s经验",
  "advice": "建议强调Agent开发经验",
  "summary": "整体匹配度较高",
  "reasons": ["技术栈匹配", "经验对口"],
  "risks": ["JD要求年限较高"],
  "suggested_questions": ["团队技术栈是什么？", "目前项目阶段？"]
}}"""
    else:
        sys = '你是求职辅导专家。分析岗位JD，提取关键信息，输出严格JSON。'
        user = f"""## 岗位信息
- 公司: {company}
- 职位: {job_title}
- JD: {description[:2000]}

## 输出格式（严格JSON，不要markdown代码块）
{{
  "match_score": 70,
  "decision": "可以尝试",
  "key_skills": ["Python"],
  "gap": "",
  "advice": "",
  "summary": "该岗位核心要求是...",
  "reasons": ["理由1"],
  "risks": ["风险1"],
  "suggested_questions": ["追问1"]
}}
注意: match_score基于JD难度和市场需求预估，不必对比简历。"""

    try:
        from utils.ai_client import call_ai
        raw = call_ai(sys, user, temperature=0.3, max_tokens=800)
        # 解析 JSON
        raw = raw.strip()
        if raw.startswith('```'):
            raw = re.sub(r'^```\w*\n?', '', raw)
            raw = re.sub(r'\n?```$', '', raw)
        result = json.loads(raw)
        result.setdefault('match_score', 50)
        result.setdefault('decision', '可以尝试')

        # 缓存到数据库
        try:
            if job:
                job.jd_analysis = json.dumps(result, ensure_ascii=False)
                job.jd_analysis_at = datetime.utcnow()
                db.session.commit()
        except Exception:
            pass

        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'data': {
            'match_score': 0, 'decision': '分析失败',
            'key_skills': [], 'summary': f'请检查AI配置: {str(e)}'
        }}), 200


@ai_bp.route('/parse-structured', methods=['POST'])
@login_required
def parse_structured():
    """AI 解析简历文本 → 结构化数据（自动填入结构化编辑器）"""
    data = request.get_json(silent=True) or {}
    resume_text = (data.get('resume_text') or '').strip()
    if not resume_text or len(resume_text) < 20:
        return jsonify({'success': False, 'error': '简历内容过短，至少需要20个字符'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = _build_parse_structured_prompt(resume_text)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位简历结构化解析专家。你只输出纯 JSON，不输出任何解释性文字。严格按照给定的 JSON Schema 提取信息，缺失字段填空字符串或空数组，绝不编造任何信息。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.2, 'max_tokens': 3000},
            timeout=60,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: HTTP {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        parsed = _parse_ai_json(ai_response)

        # 规范化：确保所有顶层字段存在
        defaults = {
            'name': '', 'hometown': '', 'email': '', 'phone': '',
            'political_status': '', 'homepage': '', 'address': '', 'portfolio': '',
            'education': [], 'internships': [], 'projects': [],
            'skills': {'english': '', 'programming': '', 'ai': '', 'tools': '', 'hardware': '', 'other': ''},
            'awards': [], 'student_work': [],
        }
        for key, default in defaults.items():
            if key not in parsed or parsed[key] is None:
                parsed[key] = default
        # 确保 skills 的每个子字段都存在
        if isinstance(parsed.get('skills'), dict):
            for sk in ['english', 'programming', 'ai', 'tools', 'hardware', 'other']:
                if sk not in parsed['skills'] or parsed['skills'][sk] is None:
                    parsed['skills'][sk] = ''

        return jsonify({'success': True, 'data': parsed})
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI 解析失败: {str(e)}'}), 500


def _build_parse_structured_prompt(resume_text):
    """构建「简历文本 → 结构化 JSON」的 prompt"""
    SCHEMA = '''{
  "name": "姓名",
  "hometown": "籍贯（如：湖南长沙）",
  "email": "邮箱地址",
  "phone": "电话号码",
  "political_status": "政治面貌（如：中共党员/共青团员/群众），简历未提及则留空",
  "homepage": "个人主页/博客 URL",
  "address": "通讯地址",
  "portfolio": "作品集/GitHub 链接",
  "education": [
    {
      "school": "学校全称",
      "major": "专业全称",
      "degree": "学历（如：本科/硕士/博士）",
      "period": "就读时间（如：2020.9 - 2024.6）",
      "gpa": "GPA（如：3.8/4.0），未提及则留空",
      "highlights": "亮点（如：奖学金、研究方向、荣誉等），未提及则留空"
    }
  ],
  "internships": [
    {
      "company": "公司/机构全称",
      "role": "实习岗位名称",
      "period": "实习时间（如：2023.6 - 2023.9）",
      "summary": "工作概述（一句话概括主要职责和成果）",
      "star_points": [
        {"action": "具体行动/方法/技术", "result": "量化成果/产出"}
      ]
    }
  ],
  "projects": [
    {
      "name": "项目名称",
      "role": "承担角色（如：项目负责人/核心开发）",
      "period": "项目时间",
      "summary": "项目概述（背景与目标，一句话）",
      "tags": ["技术标签1", "技术标签2"],
      "star_points": [
        {"situation": "背景与痛点", "action": "具体行动/方案", "result": "量化成果（如：性能提升X%、准确率X%）", "keywords": "关键技术词（逗号分隔）"}
      ]
    }
  ],
  "skills": {
    "english": "英语水平（如：CET6 580分，可阅读英文文献）",
    "programming": "编程语言（如：Python、Java、C++）",
    "ai": "AI/数据分析工具（如：PyTorch、Pandas、Scikit-learn）",
    "tools": "开发工具（如：Git、Docker、VS Code）",
    "hardware": "硬件相关技能（如：STM32、PCB设计），无则留空",
    "other": "其他技能（如：项目管理、技术写作）"
  },
  "awards": [
    {"category": "奖项类别（如：竞赛类/荣誉类/奖学金）", "name": "奖项全称"}
  ],
  "student_work": [
    {"org": "学生组织/社团名称", "role": "担任职务", "period": "任职时间", "desc": "工作描述"}
  ]
}'''
    return f"""## 任务
从以下简历文本中提取所有信息，严格按照 JSON Schema 填充。

## JSON Schema
{SCHEMA}

## 重要规则
1. 只提取简历中明确提到的信息，缺失字段填空字符串 "" 或空数组 []
2. 教育经历按时间倒序（最新的在前）
3. 实习和项目经历中，每个 star_point 只包含一个独立的行动和成果
4. 技能字段尽量提取详细（如 "Python、Java" 而非 "编程语言"）
5. star_points 中的 action 和 result 要具体，保留原文中的技术名词和量化数据
6. 只输出 JSON，不要任何 markdown 代码块标记或解释文字

## 简历文本
{resume_text[:5000]}

请输出 JSON："""


# ═══════════════════════════════════════════════════════════════
# Phase 1-3: VitaFlow 借鉴 — 简历生成 / 评分 / 润色 / JD匹配 / PDF导出
# ═══════════════════════════════════════════════════════════════

@ai_bp.route('/generate-resume', methods=['POST'])
@login_required
def generate_resume():
    """AI 一键生成结构化简历"""
    data = request.get_json(silent=True) or {}
    target_position = (data.get('target_position') or '').strip()
    personal_info = (data.get('personal_info') or '').strip()

    if not personal_info or len(personal_info) < 10:
        return jsonify({'success': False, 'error': '个人背景描述过短（至少10个字符）'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = build_generate_resume_prompt(target_position, personal_info)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位简历写作专家。只输出严格 JSON，不输出任何解释。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.3, 'max_tokens': 4000},
            timeout=120,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: HTTP {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        result = _parse_ai_json(ai_response)

        if not result or not isinstance(result, dict):
            return jsonify({'success': False, 'error': 'AI 返回格式异常，请重试'}), 500

        # 规范化字段
        defaults = {
            'name': '', 'hometown': '', 'email': '', 'phone': '',
            'political_status': '', 'homepage': '', 'address': '', 'portfolio': '',
            'education': [], 'internships': [], 'projects': [],
            'skills': {'english': '', 'programming': '', 'ai': '', 'tools': '', 'hardware': '', 'other': ''},
            'awards': [], 'student_work': [],
        }
        for key, default in defaults.items():
            if key not in result or result[key] is None:
                result[key] = default
        if isinstance(result.get('skills'), dict):
            for sk in ['english', 'programming', 'ai', 'tools', 'hardware', 'other']:
                if sk not in result['skills'] or result['skills'][sk] is None:
                    result['skills'][sk] = ''

        plain_text = _structured_to_text(result)
        return jsonify({'success': True, 'data': {'structured_data': result, 'plain_text': plain_text}})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': f'生成失败: {str(e)}'}), 500


@ai_bp.route('/score-resume', methods=['POST'])
@login_required
def score_resume():
    """AI 7 维度简历评分"""
    data = request.get_json(silent=True) or {}
    resume_text = (data.get('resume_text') or '').strip()
    jd_text = (data.get('jd_text') or '').strip()
    target_position = (data.get('target_position') or '').strip()

    if not resume_text or len(resume_text) < 20:
        return jsonify({'success': False, 'error': '简历内容过短'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = build_score_resume_prompt(resume_text, jd_text, target_position)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位资深 HR 和简历诊断专家。只输出纯 JSON。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.3, 'max_tokens': 3000},
            timeout=120,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: HTTP {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        result = _parse_ai_json(ai_response)

        if not result or not isinstance(result, dict):
            return jsonify({'success': False, 'error': 'AI 返回格式异常'}), 500

        # 确保 details 有 7 项
        if isinstance(result.get('details'), list) and len(result['details']) == 7:
            calculated = sum(d.get('score', 0) for d in result['details'])
            result['score'] = result.get('score', calculated) or calculated

        return jsonify({'success': True, 'data': result})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': f'评分失败: {str(e)}'}), 500


@ai_bp.route('/optimize-section', methods=['POST'])
@login_required
def optimize_section():
    """AI 单模块润色"""
    data = request.get_json(silent=True) or {}
    section_type = (data.get('section_type') or '').strip()
    section_data = data.get('section_data')
    full_resume_context = (data.get('full_resume_context') or '').strip()

    if not section_type or not section_data:
        return jsonify({'success': False, 'error': '缺少 section_type 或 section_data'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    # 序列化 section_data 为 JSON 字符串
    import json as _json
    section_data_str = _json.dumps(section_data, ensure_ascii=False, indent=2) if not isinstance(section_data, str) else section_data

    prompt = build_optimize_section_prompt(section_type, section_data_str, full_resume_context)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位简历表达教练。只输出纯 JSON。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.3, 'max_tokens': 3000},
            timeout=90,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: HTTP {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        result = _parse_ai_json(ai_response)

        if not result or not isinstance(result, dict):
            return jsonify({'success': False, 'error': 'AI 返回格式异常'}), 500

        # 尝试将 optimized_section 从 JSON 字符串还原
        if isinstance(result.get('optimized_section'), str):
            try:
                result['optimized_section'] = _json.loads(result['optimized_section'])
            except (_json.JSONDecodeError, TypeError):
                pass  # 保持字符串

        return jsonify({'success': True, 'data': result})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': f'润色失败: {str(e)}'}), 500


@ai_bp.route('/jd-match', methods=['POST'])
@login_required
def jd_match():
    """AI JD 匹配分析 + 简历优化"""
    data = request.get_json(silent=True) or {}
    resume_text = (data.get('resume_text') or '').strip()
    jd_text = (data.get('jd_text') or '').strip()
    job_title = (data.get('job_title') or '').strip()
    company = (data.get('company') or '').strip()

    if not resume_text or len(resume_text) < 20:
        return jsonify({'success': False, 'error': '简历内容过短'}), 400
    if not jd_text or len(jd_text) < 30:
        return jsonify({'success': False, 'error': 'JD 内容过短'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    prompt = build_jd_match_prompt(resume_text, jd_text, job_title, company)
    try:
        resp = requests.post(
            _api_endpoint(config),
            headers={'Authorization': f'Bearer {_api_key(config)}', 'Content-Type': 'application/json'},
            json={'model': config.model, 'messages': [
                {'role': 'system', 'content': '你是一位 JD 匹配分析和简历优化专家。只输出纯 JSON。'},
                {'role': 'user', 'content': prompt},
            ], 'temperature': 0.3, 'max_tokens': 4000},
            timeout=120,
        )
        if not resp.ok:
            return jsonify({'success': False, 'error': f'AI 服务调用失败: HTTP {resp.status_code}'}), 500

        ai_response = resp.json()['choices'][0]['message']['content']
        result = _parse_ai_json(ai_response)

        if not result or not isinstance(result, dict):
            return jsonify({'success': False, 'error': 'AI 返回格式异常'}), 500

        return jsonify({'success': True, 'data': result})

    except requests.Timeout:
        return jsonify({'success': False, 'error': 'AI 服务响应超时'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': f'JD 匹配失败: {str(e)}'}), 500


@ai_bp.route('/export-pdf', methods=['POST'])
@login_required
def export_resume_pdf():
    """服务器端 PDF 导出（Jinja2 + WeasyPrint）"""
    data = request.get_json(silent=True) or {}
    resume_id = data.get('resume_id')

    if not resume_id:
        return jsonify({'success': False, 'error': '缺少 resume_id'}), 400

    resume = Resume.query.filter_by(id=resume_id, user_id=request.current_user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404

    sd = resume.structured_data
    if not isinstance(sd, dict) or not sd:
        return jsonify({'success': False, 'error': '简历没有结构化数据，请先在结构化编辑器中填写'}), 400

    # 使用现有的 HTML 构建逻辑，然后 WeasyPrint 转换
    template_config = data.get('template_config') or {}

    try:
        from weasyprint import HTML
        html_content = _build_resume_html_for_pdf(sd, resume.title, template_config)
        pdf_bytes = HTML(string=html_content).write_pdf()

        import base64
        filename = (resume.title or '简历').replace('/', '_').replace('\\', '_')
        return jsonify({
            'success': True,
            'data': {
                'pdf_base64': base64.b64encode(pdf_bytes).decode('ascii'),
                'filename': f'{filename}.pdf',
                'size': len(pdf_bytes),
            }
        })
    except ImportError:
        return jsonify({
            'success': False,
            'error': 'WeasyPrint 未安装。请运行: pip install weasyprint'
        }), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'PDF 生成失败: {str(e)}'}), 500


def _build_resume_html_for_pdf(sd, title, template_config):
    """将结构化简历数据渲染为 HTML 字符串，用于 WeasyPrint PDF 导出。
    复用前端 buildResumeHTML 的 CSS 方案，在服务端完成渲染。"""
    from jinja2 import Template

    tpl_cfg = {
        'themeColor': template_config.get('themeColor', '#2563eb'),
        'bodyFontSize': template_config.get('bodyFontSize', 13),
        'pageMargin': template_config.get('pageMargin', 16),
        'lineHeight': template_config.get('lineHeight', 1.7),
    }

    TEMPLATE_HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>{{ title }} — 简历</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif;
    font-size: {{ cfg.bodyFontSize }}px;
    color: #374151;
    line-height: {{ cfg.lineHeight }};
    background: #fff;
  }
  .page {
    width: 210mm; min-height: 297mm;
    padding: {{ cfg.pageMargin }}mm;
  }
  .header {
    display: flex; justify-content: space-between;
    padding-bottom: 12px; margin-bottom: 6mm;
    border-bottom: 2px solid {{ cfg.themeColor }};
    break-inside: avoid;
  }
  .header-name {
    font-size: {{ cfg.bodyFontSize * 2 }}px;
    font-weight: 700; color: #111827;
    letter-spacing: 1px; margin-bottom: 6px;
  }
  .header-info { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: #6b7280; }
  .section { margin-bottom: 5mm; }
  .section-title {
    font-size: {{ (cfg.bodyFontSize * 1.15)|round }}px;
    font-weight: 700; color: #111827;
    padding-bottom: 4px; margin-bottom: 5px;
    border-bottom: 1px solid #e5e7eb;
    break-after: avoid;
  }
  .card {
    background: #f9fafb; border-radius: 4px;
    padding: 3mm 3.5mm; margin-bottom: 2mm;
    break-inside: avoid;
  }
  .card-row { display: flex; align-items: baseline; gap: 2mm; }
  .card-left { font-weight: 600; color: #111827; flex-shrink: 0; }
  .card-center { flex: 1; font-size: 12px; color: #374151; }
  .card-right { font-size: 12px; color: #6b7280; white-space: nowrap; }
  .card-sub { font-size: 11.5px; color: #6b7280; margin-top: 1.5mm; line-height: 1.6; }
  .bullets { list-style: none; padding: 0; margin-top: 2mm; }
  .bullets li {
    position: relative; padding-left: 3.5mm; margin-bottom: 1.2mm;
    font-size: 12px; color: #374151; line-height: 1.6;
    break-inside: avoid;
  }
  .bullets li::before {
    content: '•'; position: absolute; left: 0;
    color: {{ cfg.themeColor }}; font-weight: 700;
  }
  .skill-table { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 4mm; }
  .skill-row { display: flex; gap: 2mm; font-size: 12px; }
  .skill-label { font-weight: 600; color: #111827; white-space: nowrap; }
  .skill-value { color: #374151; }
  .award-list { display: flex; flex-wrap: wrap; gap: 2mm 5mm; }
  .award-item { font-size: 12px; color: #374151; }
  .award-cat { font-weight: 600; color: #111827; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-name">{{ name or title }}</div>
      <div class="header-info">
        {%- if phone %}<span>📞 {{ phone }}</span>{% endif -%}
        {%- if email %}<span>✉️ {{ email }}</span>{% endif -%}
        {%- if political_status %}<span>🏛️ {{ political_status }}</span>{% endif -%}
        {%- if homepage %}<span>🌐 {{ homepage }}</span>{% endif -%}
        {%- if address %}<span>📮 {{ address }}</span>{% endif -%}
        {%- if portfolio %}<span>🔗 {{ portfolio }}</span>{% endif -%}
      </div>
    </div>
  </div>

  {%- if education %}
  <div class="section"><div class="section-title">🎓 教育背景</div>
  {%- for e in education %}
  <div class="card"><div class="card-row">
    <span class="card-left">{{ e.school or '' }}</span>
    <span class="card-center">{{ e.major or '' }}{% if e.degree %} · {{ e.degree }}{% endif %}</span>
    <span class="card-right">{{ e.period or '' }}</span>
  </div>
  {%- if e.gpa %}<div class="card-sub">GPA: {{ e.gpa }}</div>{% endif -%}
  {%- if e.highlights %}<div class="card-sub">{{ e.highlights }}</div>{% endif %}
  </div>{% endfor -%}
  </div>{% endif -%}

  {%- if internships %}
  <div class="section"><div class="section-title">💼 实习经历</div>
  {%- for inv in internships %}
  <div class="card"><div class="card-row">
    <span class="card-left">{{ inv.company or '' }}</span>
    <span class="card-center">{{ inv.role or '' }}</span>
    <span class="card-right">{{ inv.period or '' }}</span>
  </div>
  {%- if inv.summary %}<div class="card-sub">{{ inv.summary }}</div>{% endif -%}
  {%- if inv.star_points %}
  <ul class="bullets">{%- for sp in inv.star_points %}
    <li>{% if sp is mapping %}{{ sp.action or '' }}{% if sp.result %}。{{ sp.result }}{% endif %}{% else %}{{ sp }}{% endif %}</li>{% endfor -%}
  </ul>{% endif -%}
  </div>{% endfor -%}
  </div>{% endif -%}

  {%- if projects %}
  <div class="section"><div class="section-title">🚀 项目经历</div>
  {%- for proj in projects %}
  <div class="card"><div class="card-row">
    <span class="card-left">{{ proj.name or '' }}</span>
    <span class="card-center">{{ proj.role or '' }}</span>
    <span class="card-right">{{ proj.period or '' }}</span>
  </div>
  {%- if proj.summary %}<div class="card-sub">{{ proj.summary }}</div>{% endif -%}
  {%- if proj.tags %}<div class="card-sub" style="color:#1E3A8A;">🏷 {{ proj.tags | join(' · ') }}</div>{% endif -%}
  {%- if proj.star_points %}
  <ul class="bullets">{%- for sp in proj.star_points %}
    <li>{% if sp is mapping %}{{ sp.action or '' }}{% if sp.result %}。{{ sp.result }}{% endif %}{% else %}{{ sp }}{% endif %}</li>{% endfor -%}
  </ul>{% endif -%}
  </div>{% endfor -%}
  </div>{% endif -%}

  {%- if awards %}
  <div class="section"><div class="section-title">🏆 获奖情况</div>
  <div class="card"><div class="award-list">
  {%- for a in awards %}
    <span class="award-item">{% if a.category %}<span class="award-cat">{{ a.category }}</span> {% endif %}{{ a.name or '' }}</span>{% endfor -%}
  </div></div>
  </div>{% endif -%}

  {%- if student_work %}
  <div class="section"><div class="section-title">📋 学生工作</div>
  {%- for sw in student_work %}
  <div class="card"><div class="card-row">
    <span class="card-left">{{ sw.org or '' }}</span>
    <span class="card-center">{{ sw.role or '' }}</span>
    <span class="card-right">{{ sw.period or '' }}</span>
  </div>
  {%- if sw.desc %}<div class="card-sub">{{ sw.desc }}</div>{% endif %}
  </div>{% endfor -%}
  </div>{% endif -%}

  {%- if skills is mapping %}
  {%- set active = [] -%}
  {%- for k, v in skills.items() -%}{%- if v %}{%- set _ = active.append((k, v)) -%}{%- endif -%}{%- endfor -%}
  {%- if active %}
  {%- set labels = {'english': '英语', 'programming': '编程', 'ai': 'AI与数据分析', 'tools': '工具', 'hardware': '硬件', 'other': '其他'} %}
  <div class="section"><div class="section-title">🛠 专业技能</div>
  <div class="card"><div class="skill-table">
  {%- for k, v in active %}
    <div class="skill-row"><span class="skill-label">{{ labels.get(k, k) }}</span><span class="skill-value">{{ v }}</span></div>{% endfor -%}
  </div></div>
  </div>{% endif -%}
  {% endif -%}
</div>
</body>
</html>"""

    tpl = Template(TEMPLATE_HTML)
    return tpl.render(
        name=sd.get('name', ''),
        title=title or '未命名简历',
        phone=sd.get('phone', ''),
        email=sd.get('email', ''),
        political_status=sd.get('political_status', ''),
        homepage=sd.get('homepage', ''),
        address=sd.get('address', ''),
        portfolio=sd.get('portfolio', ''),
        education=sd.get('education', []),
        internships=sd.get('internships', []),
        projects=sd.get('projects', []),
        skills=sd.get('skills', {}),
        awards=sd.get('awards', []),
        student_work=sd.get('student_work', []),
        cfg=tpl_cfg,
    )


# ═══════════════════════════════════════════════════════════════
# LaTeX PDF 导出（TailorCV 方案，需要用户自行安装 TeX Live/MiKTeX）
# ═══════════════════════════════════════════════════════════════

import subprocess as _subprocess
import tempfile as _tempfile
import shutil as _shutil
import os as _os

# TeX Live 安装路径检测
_LATEX_PATHS = [
    r'D:\texlive\2026\bin\windows\xelatex.exe',
    r'C:\texlive\2026\bin\windows\xelatex.exe',
]


def _find_xelatex():
    """查找 xelatex 可执行文件"""
    # 先检查已知路径
    for p in _LATEX_PATHS:
        if _os.path.exists(p):
            return p
    # 再搜索 PATH
    result = _shutil.which('xelatex')
    if result:
        return result
    return None


@ai_bp.route('/latex-status', methods=['GET'])
def latex_status():
    """检查 LaTeX 是否可用"""
    xelatex = _find_xelatex()
    if not xelatex:
        return jsonify({
            'success': True,
            'data': {
                'available': False,
                'message': '未检测到 LaTeX。请安装 TeX Live (https://tug.org/texlive/) 或 MiKTeX (https://miktex.org/)。安装后刷新此页面。',
                'install_size': '约 4GB（TeX Live）/ 约 2GB（MiKTeX）',
            }
        })

    try:
        result = _subprocess.run([xelatex, '--version'], capture_output=True, text=True, timeout=15)
        version_line = result.stdout.strip().split('\n')[0] if result.stdout else ''
        return jsonify({
            'success': True,
            'data': {
                'available': True,
                'version': version_line,
                'path': xelatex,
            }
        })
    except Exception:
        return jsonify({
            'success': True,
            'data': {
                'available': False,
                'message': 'LaTeX 已安装但无法执行。请检查安装是否正确。',
            }
        })


@ai_bp.route('/export-pdf-latex', methods=['POST'])
@login_required
def export_resume_pdf_latex():
    """LaTeX PDF 导出 — 需要用户安装 TeX Live/MiKTeX"""
    data = request.get_json(silent=True) or {}
    resume_id = data.get('resume_id')

    if not resume_id:
        return jsonify({'success': False, 'error': '缺少 resume_id'}), 400

    resume = Resume.query.filter_by(id=resume_id, user_id=request.current_user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404

    sd = resume.structured_data
    if not isinstance(sd, dict) or not sd:
        return jsonify({'success': False, 'error': '简历没有结构化数据，请先在结构化编辑器中填写'}), 400

    xelatex = _find_xelatex()
    if not xelatex:
        return jsonify({
            'success': False,
            'error': '未安装 LaTeX。请安装 TeX Live 或 MiKTeX 后重试。',
            'hint': 'TeX Live: https://tug.org/texlive/ | MiKTeX: https://miktex.org/'
        }), 500

    # 渲染 .tex 文件
    tex_content = _build_resume_tex(sd, resume.title)

    # 调试：保存 .tex 到桌面
    _debug_dir = _os.path.expanduser('~/Desktop/tex_debug')
    _os.makedirs(_debug_dir, exist_ok=True)
    with open(_os.path.join(_debug_dir, 'resume.tex'), 'w', encoding='utf-8') as _f:
        _f.write(tex_content)

    # 在临时目录中编译
    tmpdir = _tempfile.mkdtemp(prefix='boss_resume_')
    tex_file = _os.path.join(tmpdir, 'resume.tex')
    pdf_file = _os.path.join(tmpdir, 'resume.pdf')

    try:
        # 写入 .tex
        with open(tex_file, 'w', encoding='utf-8') as f:
            f.write(tex_content)

        # 复制 LaTeX 支持文件到临时目录
        latex_dir = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'latex')
        if _os.path.isdir(latex_dir):
            for fname in ['resume.cls', 'fontawesome.sty', 'linespacing_fix.sty',
                          'zh_CN-Adobefonts_external.sty', 'fontawesome-webfont.ttf']:
                src = _os.path.join(latex_dir, fname)
                if _os.path.exists(src):
                    _shutil.copy2(src, _os.path.join(tmpdir, fname))

        # 运行 xelatex（两遍，目录参数指向 tmpdir）
        xelatex_dir = _os.path.dirname(xelatex)
        env = _os.environ.copy()
        if xelatex_dir not in env.get('PATH', ''):
            env['PATH'] = xelatex_dir + _os.pathsep + env.get('PATH', '')

        for _ in range(2):
            result = _subprocess.run(
                [xelatex, '-interaction=nonstopmode', '-halt-on-error', 'resume.tex'],
                capture_output=True, text=True, timeout=60,
                cwd=tmpdir, env=env, encoding='utf-8', errors='replace',
            )
            if result.returncode != 0:
                # 提取关键错误（优先 stderr，再 stdout）
                combined = (result.stderr or '') + '\n' + (result.stdout or '')
                err_lines = []
                for line in combined.split('\n'):
                    if line.startswith('!') or 'Error' in line or 'error' in line:
                        err_lines.append(line.strip())
                if not err_lines:
                    err_lines = [l for l in combined.split('\n')[-15:] if l.strip()]
                raise RuntimeError('LaTeX 编译失败:\n' + '\n'.join(err_lines[:8]))

        # 读取 PDF
        if not _os.path.exists(pdf_file):
            raise RuntimeError('PDF 未生成，请检查简历内容是否包含特殊字符')

        with open(pdf_file, 'rb') as f:
            pdf_bytes = f.read()

        import base64
        filename = (resume.title or '简历').replace('/', '_').replace('\\', '_')
        return jsonify({
            'success': True,
            'data': {
                'pdf_base64': base64.b64encode(pdf_bytes).decode('ascii'),
                'filename': f'{filename}.pdf',
                'size': len(pdf_bytes),
            }
        })

    except RuntimeError as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'LaTeX 编译失败: {str(e)}'}), 500
    finally:
        # 清理临时文件
        try:
            _shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass


def _build_resume_tex(sd, title):
    """将结构化简历数据渲染为 LaTeX .tex 字符串"""
    from jinja2 import Template
    import re as _re

    # 转义 LaTeX 特殊字符
    def tex_escape(text):
        if not text:
            return ''
        conv = {'&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#', '_': r'\_',
                '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}', '^': r'\^{}',
                '\\': r'\textbackslash{}'}
        regex = _re.compile('|'.join(_re.escape(k) for k in conv))
        return regex.sub(lambda m: conv[m.group()], str(text))

    TEMPLATE_TEX = r'''% ============================================================
% 简历 — 由 BossJob-Helper 自动生成
% 模板源自 TailorCV (https://github.com/h1077/BossJob-Helper)
% 编译: xelatex -interaction=nonstopmode resume.tex
% ============================================================
\documentclass{resume}
\usepackage{zh_CN-Adobefonts_external}
\usepackage{linespacing_fix}
\usepackage{hyperref}
\hypersetup{colorlinks=true,linkcolor=cyan,urlcolor=blue}

\begin{document}
\pagenumbering{gobble}

\MyName{ {{- name or '未命名' -}} }

\BasicInfoBlock
    { {{- hometown or '' -}} }
    { {{- email or '' -}} }
    { {{- phone or '' -}} }
    { {{- political_status or '' -}} }
    { {{- portfolio or homepage or '' -}} }

{%- if education %}
\section{教育背景}
{%- for e in education %}
\datedsubsection{\textbf{ {{- e.school or '' -}} }， {{- e.major or '' -}}， \textit{ {{- e.degree or '' -}} }}{ {{- e.period or '' -}} }
{%- if e.highlights %}
 {{ e.highlights }}
{%- endif %}
{%- if e.gpa %}
GPA: {{ e.gpa }}
{%- endif %}
{%- endfor %}
{%- endif %}

{%- if internships %}
\section{实习经历}
{%- for inv in internships %}
\datedsubsection{\textbf{ {{- inv.company or '' -}} }， {{- inv.role or '' -}} }{ {{- inv.period or '' -}} }
{%- if inv.summary %}
{\ResumeLabel{工作内容}： {{- inv.summary -}} }
{%- endif %}
{%- if inv.star_points %}
\begin{itemize}[parsep=0.05ex, topsep=0ex, leftmargin=1.7em]
{%- for sp in inv.star_points %}
{%- if sp is mapping %}
\item \songti \ResumeLabel{ {{- (sp.keywords or sp.action or '')[:20] -}} }： {{- sp.action or '' -}} {%- if sp.result %}。 {{- sp.result -}} {%- endif %}
{%- else %}
\item \songti  {{- sp -}}
{%- endif %}
{%- endfor %}
\end{itemize}
{%- endif %}
{%- endfor %}
{%- endif %}

{%- if projects %}
\section{项目经历}
{%- for proj in projects %}
{%- set tags = proj.tags or [] %}
\datedsubsection{\ProjectName{ {{- proj.name or '' -}} }， {{- proj.role or '' -}} }{ {{- proj.period or '' -}} }
{%- if proj.summary %}
{\ResumeLabel{项目背景}： {{- proj.summary -}} }
{%- endif %}
{%- if proj.star_points %}
\begin{itemize}[parsep=0.05ex, topsep=0ex, leftmargin=1.7em]
{%- for sp in proj.star_points %}
{%- if sp is mapping %}
\item \songti \ResumeLabel{ {{- (sp.keywords or sp.action or '')[:16] -}} }： {{- sp.action or '' -}} {%- if sp.result %}。 {{- sp.result -}} {%- endif %}
{%- else %}
\item \songti  {{- sp -}}
{%- endif %}
{%- endfor %}
\end{itemize}
{%- endif %}
{%- endfor %}
{%- endif %}

{%- if awards %}
\section{获奖情况}
\begin{itemize}[parsep=0.05ex, topsep=0ex, leftmargin=1.7em]
{%- for a in awards %}
\item {{ a.category + ': ' if a.category else '' }}{{ a.name or '' }}
{%- endfor %}
\end{itemize}
{%- endif %}

{%- if student_work %}
\section{学生工作}
{%- for sw in student_work %}
\datedsubsection{\textbf{ {{- sw.org or '' -}} }， {{- sw.role or '' -}} }{ {{- sw.period or '' -}} }
{%- if sw.desc %}
 {{ sw.desc }}
{%- endif %}
{%- endfor %}
{%- endif %}

{%- if skills is mapping %}
{%- set active = [] -%}
{%- for k, v in skills.items() -%}{%- if v %}{%- set _ = active.append((k, v)) -%}{%- endif -%}{%- endfor -%}
{%- if active %}
{%- set labels = {'english': '英语', 'programming': '编程语言', 'ai': 'AI/数据分析', 'tools': '开发工具', 'hardware': '硬件', 'other': '其他'} %}
\section{专业技能}
\begin{itemize}[parsep=0.05ex, topsep=0ex, leftmargin=1.7em]
{%- for k, v in active %}
\item \textbf{ {{- labels.get(k, k) -}} }： {{- v -}}
{%- endfor %}
\end{itemize}
{%- endif %}
{%- endif %}

\end{document}
'''

    tpl = Template(TEMPLATE_TEX)
    return tpl.render(
        name=tex_escape(sd.get('name', '')),
        hometown=tex_escape(sd.get('hometown', '')),
        email=tex_escape(sd.get('email', '')),
        phone=tex_escape(sd.get('phone', '')),
        political_status=tex_escape(sd.get('political_status', '')),
        homepage=tex_escape(sd.get('homepage', '')),
        portfolio=tex_escape(sd.get('portfolio', '')),
        education=[{k: tex_escape(v) if isinstance(v, str) else v for k, v in e.items()} for e in (sd.get('education') or [])],
        internships=[{k: tex_escape(v) if isinstance(v, str) else v for k, v in e.items()} for e in (sd.get('internships') or [])],
        projects=[{k: tex_escape(v) if isinstance(v, str) else v for k, v in e.items()} for e in (sd.get('projects') or [])],
        skills=sd.get('skills', {}),
        awards=[{k: tex_escape(v) if isinstance(v, str) else v for k, v in e.items()} for e in (sd.get('awards') or [])],
        student_work=[{k: tex_escape(v) if isinstance(v, str) else v for k, v in e.items()} for e in (sd.get('student_work') or [])],
    )
