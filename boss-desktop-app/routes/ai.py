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
import requests

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


def get_default_ai_config():
    config = AIConfig.query.filter_by(is_default=True, is_active=True).first()
    if not config:
        config = AIConfig.query.filter_by(is_active=True).first()
    return config


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
        return jsonify({
            'success': True,
            'data': {
                'api_url': config.api_url,
                'model': config.model,
                'api_key': config.api_key or '',
                'has_api_key': bool(config.api_key),
                'api_key_preview': mask_api_key(config.api_key) if config.api_key else '',
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
            api_key=api_key,
            model=model,
            is_active=True,
            is_default=True,
        )
        db.session.add(config)
    else:
        config.api_key = api_key
        config.model = model
        config.api_url = api_url

    db.session.commit()
    return jsonify({'success': True, 'data': {'message': 'AI 设置已保存'}})


@ai_bp.route('/test', methods=['POST'])
@login_required
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
        return jsonify({'success': False, 'error': f'连接失败: {str(e)}'}), 500


@ai_bp.route('/proxy', methods=['POST'])
@login_required
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
    if not config or not config.api_key:
        return jsonify({'success': False, 'error': 'AI 服务未配置，请在桌面端设置 AI Key'}), 500

    if not model:
        model = config.model

    try:
        endpoint = config.api_url.rstrip('/')
        if not endpoint.endswith('/chat/completions'):
            endpoint += '/chat/completions'

        resp = requests.post(
            endpoint,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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
        resp = requests.post(
            config.api_url,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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
        return jsonify({'success': False, 'error': f'分析失败: {str(e)}'}), 500


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
            config.api_url,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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
        return jsonify({'success': False, 'error': f'优化失败: {str(e)}'}), 500


def _build_analysis_prompt(resume_text):
    return f"""# Role
你是一位拥有10年以上经验的资深技术HR，精通简历筛选和人才评估。

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

## 输出格式（纯JSON，不要加```json标记）
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
  "interview_focus_questions": ["问题1", "问题2"]
}}"""


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
            config.api_url,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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
        return jsonify({'success': False, 'error': f'生成失败: {str(e)}'}), 500


INTERVIEW_PHASES = ['opening', 'technical', 'experience', 'behavioral', 'reverse', 'closing']


@ai_bp.route('/interview', methods=['POST'])
@login_required
def interview():
    """面试模拟 — 根据 JD + 简历，AI 扮演 HR 分阶段提问"""
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '请求数据为空'}), 400

    config = get_default_ai_config()
    if not config:
        return jsonify({'success': False, 'error': 'AI 服务未配置'}), 500

    job_id = data.get('job_id')
    resume_id = data.get('resume_id')
    user_message = data.get('user_message') or ''
    session_id = data.get('session_id')

    # 获取 JD 和简历
    jd_text = ''
    resume_text = ''
    company_name = ''

    if job_id:
        job = InterestedJob.query.get(job_id)
        if job:
            jd_text = (job.jd or '') + '\n' + (job.job_responsibilities or '') + '\n' + (job.job_requirements or '')
            company_name = job.company_name
            if not jd_text.strip():
                jd_text = f'{job.job_name} - {job.company_name} - {job.salary or ""} - {job.location or ""}'
    if resume_id:
        resume = Resume.query.get(resume_id)
        if resume:
            resume_text = resume.content

    if not jd_text.strip():
        return jsonify({'success': False, 'error': '岗位 JD 为空，请先在职位追踪中选择一个有 JD 的岗位'}), 400
    if not resume_text.strip():
        return jsonify({'success': False, 'error': '简历内容为空，请先在简历管理中创建一份简历'}), 400

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
            job_id=job_id,
            resume_id=resume_id,
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
    system_prompt = _build_interview_prompt(jd_text, resume_text, company_name, current_phase, messages)

    try:
        resp = requests.post(
            config.api_url,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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
        return jsonify({'success': False, 'error': f'面试请求失败: {str(e)}'}), 500


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

    return f"""# 角色
你是 {company_name or '某公司'} 的一位资深HR，正在BOSS直聘上对一位求职者进行线上面试。

# 岗位信息
{jd_text[:2000]}

# 候选人简历
{resume_text[:2500]}

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
            config.api_url,
            headers={'Authorization': f'Bearer {config.api_key}', 'Content-Type': 'application/json'},
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


def _parse_ai_json(ai_response):
    json_str = ''
    code_block = re.search(r'```json\s*([\s\S]*?)```', ai_response)
    if code_block:
        json_str = code_block.group(1).strip()
    else:
        generic = re.search(r'```\s*([\s\S]*?)```', ai_response)
        if generic:
            json_str = generic.group(1).strip()
        else:
            brace = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', ai_response)
            if brace:
                json_str = brace.group(0)

    if not json_str:
        return None

    try:
        result = json.loads(json_str)
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
    except json.JSONDecodeError:
        return None
