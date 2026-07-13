"""
简历管理 API
"""
import os
import tempfile
from flask import Blueprint, request, jsonify
from models import db, Resume
from utils.auth import login_required

resumes_bp = Blueprint('resumes', __name__, url_prefix='/api/resumes')

# ── 结构化数据 → 纯文本渲染 ──

def _structured_to_text(sd):
    """将结构化 JSON 数据渲染为可读的纯文本简历"""
    if not isinstance(sd, dict):
        return ''
    lines = []

    # 基本信息
    name = sd.get('name', '')
    if name:
        info_parts = [name]
        for k, label in [('hometown', '籍贯'), ('email', '邮箱'), ('phone', '电话'),
                         ('political_status', '政治面貌'), ('homepage', '个人主页'),
                         ('address', '通讯地址')]:
            if sd.get(k):
                info_parts.append(f'{label}：{sd[k]}')
        lines.append('\n'.join(info_parts))

    # 教育背景
    edu = sd.get('education', [])
    if isinstance(edu, list) and edu:
        lines.append('\n## 教育背景')
        for e in edu:
            lines.append(f"{e.get('school','')} | {e.get('major','')} | {e.get('degree','')} | {e.get('period','')}")
            if e.get('gpa'):
                lines.append(f"GPA: {e['gpa']}")
            if e.get('highlights'):
                lines.append(f"{e['highlights']}")

    # 实习经历
    internships = sd.get('internships', [])
    if isinstance(internships, list) and internships:
        lines.append('\n## 实习经历')
        for inv in internships:
            lines.append(f"\n### {inv.get('company','')} | {inv.get('role','')} | {inv.get('period','')}")
            if inv.get('summary'):
                lines.append(inv['summary'])
            for sp in inv.get('star_points', []) or []:
                if isinstance(sp, dict):
                    lines.append(f"- {sp.get('action','')}（{sp.get('result','')}）")
                else:
                    lines.append(f"- {sp}")

    # 项目经历
    projects = sd.get('projects', [])
    if isinstance(projects, list) and projects:
        lines.append('\n## 项目经历')
        for proj in projects:
            tags_str = ' | '.join(proj.get('tags', []) or [])
            lines.append(f"\n### {proj.get('name','')} | {proj.get('role','')} | {proj.get('period','')}")
            if tags_str:
                lines.append(f"技术栈: {tags_str}")
            if proj.get('summary'):
                lines.append(proj['summary'])
            for sp in proj.get('star_points', []) or []:
                if isinstance(sp, dict):
                    kw = sp.get('keywords', '')
                    kw_str = f' [关键词: {kw}]' if kw else ''
                    lines.append(f"- {sp.get('action','')}。{sp.get('result','')}{kw_str}")
                else:
                    lines.append(f"- {sp}")

    # 获奖情况
    awards = sd.get('awards', [])
    if isinstance(awards, list) and awards:
        lines.append('\n## 获奖情况')
        for a in awards:
            lines.append(f"- {a.get('category','')}: {a.get('name','')}")

    # 学生工作
    student_work = sd.get('student_work', [])
    if isinstance(student_work, list) and student_work:
        lines.append('\n## 学生工作')
        for sw in student_work:
            lines.append(f"- {sw.get('org','')} | {sw.get('role','')} | {sw.get('period','')} | {sw.get('desc','')}")

    # 技能
    skills = sd.get('skills', {})
    if isinstance(skills, dict):
        skill_labels = {'english': '英语', 'programming': '编程', 'ai': 'AI与数据分析',
                        'tools': '工具', 'hardware': '硬件', 'other': '其他'}
        active_skills = [(skill_labels.get(k, k), v) for k, v in skills.items() if v]
        if active_skills:
            lines.append('\n## 专业技能')
            for label, value in active_skills:
                lines.append(f"- {label}: {value}")

    return '\n'.join(lines)


@resumes_bp.route('', methods=['GET'])
@login_required
def list_resumes():
    user = request.current_user
    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.updated_at.desc()).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in resumes]})


@resumes_bp.route('', methods=['POST'])
@login_required
def create_resume():
    user = request.current_user
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    structured_data = data.get('structuredData') or data.get('structured_data')

    # 如果提供了结构化数据但没有纯文本 content，自动生成
    if structured_data and not content:
        content = _structured_to_text(structured_data)

    if not title or not content:
        return jsonify({'success': False, 'error': '标题和内容不能为空'}), 400
    resume = Resume(
        user_id=user.id,
        title=title,
        content=content,
        type=data.get('type', 'original'),
        score=data.get('score', 0),
        improvements=data.get('improvements'),
        analysis_result=data.get('analysisResult'),
        ats_data=data.get('atsData'),
        structured_data=structured_data,
    )
    db.session.add(resume)
    db.session.commit()
    return jsonify({'success': True, 'data': resume.to_dict()})


@resumes_bp.route('/<int:resume_id>', methods=['PUT'])
@login_required
def update_resume(resume_id):
    user = request.current_user
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404
    data = request.get_json(silent=True) or {}
    for field, col in [
        ('title', 'title'), ('content', 'content'), ('type', 'type'),
        ('score', 'score'), ('improvements', 'improvements'),
        ('analysisResult', 'analysis_result'), ('atsData', 'ats_data'),
    ]:
        if field in data:
            setattr(resume, col, data[field])

    # 处理结构化数据
    if 'structuredData' in data or 'structured_data' in data:
        sd = data.get('structuredData') or data.get('structured_data')
        resume.structured_data = sd
        # 如果只传了结构化数据，自动更新纯文本内容
        if sd and not data.get('content'):
            resume.content = _structured_to_text(sd)

    db.session.commit()
    return jsonify({'success': True, 'data': resume.to_dict()})


@resumes_bp.route('/<int:resume_id>', methods=['DELETE'])
@login_required
def delete_resume(resume_id):
    user = request.current_user
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404
    db.session.delete(resume)
    db.session.commit()
    return jsonify({'success': True})


# ── 结构化数据专用端点 ──

@resumes_bp.route('/<int:resume_id>/structured', methods=['GET'])
@login_required
def get_structured(resume_id):
    """仅返回简历的结构化数据"""
    user = request.current_user
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404
    return jsonify({
        'success': True,
        'data': resume.structured_data if isinstance(resume.structured_data, dict) else {},
    })


@resumes_bp.route('/<int:resume_id>/structured', methods=['PUT'])
@login_required
def update_structured(resume_id):
    """保存结构化数据，自动生成纯文本 content"""
    user = request.current_user
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if not resume:
        return jsonify({'success': False, 'error': '简历不存在'}), 404

    data = request.get_json(silent=True) or {}
    sd = data.get('structuredData') or data.get('structured_data')
    if not isinstance(sd, dict):
        return jsonify({'success': False, 'error': 'structuredData 必须是 JSON 对象'}), 400

    resume.structured_data = sd
    resume.content = _structured_to_text(sd)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': resume.to_dict(),
        'generatedContent': resume.content,
    })


# ── 批量定制简历 ──

@resumes_bp.route('/batch-customize', methods=['POST'])
@login_required
def batch_customize():
    """根据主简历 + 多个岗位策略，批量生成定制简历"""
    from models import InterestedJob, PositionStrategy
    from utils.strategy_rules import apply_strategy

    user = request.current_user
    data = request.get_json(silent=True) or {}
    resume_id = data.get('resumeId') or data.get('resume_id')
    job_ids = data.get('jobIds') or data.get('job_ids') or []

    if not resume_id or not job_ids:
        return jsonify({'success': False, 'error': '缺少 resumeId 或 jobIds'}), 400

    master = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if not master:
        return jsonify({'success': False, 'error': '主简历不存在'}), 404

    sd = master.structured_data
    if not isinstance(sd, dict) or not sd:
        return jsonify({'success': False, 'error': '主简历没有结构化数据，请先在结构化编辑器中填写'}), 400

    results = []
    for job_id in job_ids:
        job = InterestedJob.query.filter_by(id=job_id, user_id=user.id).first()
        if not job:
            results.append({'jobId': job_id, 'success': False, 'error': '岗位不存在'})
            continue

        # 获取岗位策略
        strategy = PositionStrategy.query.filter_by(job_id=job_id).first()
        strategy_dict = strategy.to_dict() if strategy else {'companyType': '私企'}

        # 应用策略裁剪
        customized_sd = apply_strategy(sd, strategy_dict)

        # 生成定制文本
        customized_text = _structured_to_text(customized_sd)

        # 创建定制简历
        title = f"{master.title} - {job.company_name} {job.job_name}"
        targeted = Resume(
            user_id=user.id,
            title=title[:200],
            content=customized_text,
            type='targeted',
            structured_data=customized_sd,
        )
        db.session.add(targeted)
        db.session.flush()

        results.append({
            'jobId': job_id,
            'companyName': job.company_name,
            'jobName': job.job_name,
            'resumeId': targeted.id,
            'resumeTitle': targeted.title,
            'success': True,
        })

    db.session.commit()
    return jsonify({'success': True, 'data': results})


# ── 文件解析辅助函数 ──

def _extract_pdf_text(file) -> str:
    """从 PDF 提取文字：PyPDF2 为主，pdfplumber 为降级"""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file)
        parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        if parts:
            return '\n'.join(parts)
    except Exception:
        pass

    # 降级到 pdfplumber
    try:
        import pdfplumber
        file.seek(0)
        with pdfplumber.open(file) as pdf:
            parts = [page.extract_text() or '' for page in pdf.pages]
            return '\n'.join(parts)
    except ImportError:
        raise ImportError('pdfplumber') from None


def _extract_docx_text(file) -> str:
    """从 DOCX 提取段落文字"""
    try:
        from docx import Document
    except ImportError:
        raise ImportError('python-docx') from None
    file.seek(0)
    doc = Document(file)
    return '\n'.join(p.text for p in doc.paragraphs)


def _extract_doc_text(file) -> str:
    """尽力提取旧版 .doc 文字（textract + antiword）"""
    try:
        import textract
        with tempfile.NamedTemporaryFile(suffix='.doc', delete=False) as tmp:
            tmp.write(file.read())
            tmp_path = tmp.name
        try:
            text = textract.process(tmp_path, method='antiword').decode('utf-8', errors='replace')
            return text
        finally:
            os.unlink(tmp_path)
    except ImportError:
        raise ImportError('textract') from None
    except Exception:
        raise RuntimeError('.doc 旧格式支持有限，建议转为 .docx 或 .txt 后重新上传') from None


# ── 文件解析端点 ──

@resumes_bp.route('/parse-file', methods=['POST'])
def parse_resume_file():
    """上传简历文件（pdf/docx/doc/txt），返回提取的文字。
    仅允许 localhost 访问（用于浏览器扩展桥接），无需登录。
    需要 Python 依赖: python-docx, PyPDF2, pdfplumber (可选)
    """
    # 仅允许本地访问
    if request.remote_addr not in ('127.0.0.1', '::1', 'localhost'):
        return jsonify({'success': False, 'error': '仅允许本地访问'}), 403

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'success': False, 'error': '文件名为空'}), 400

    filename = file.filename.lower()
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''

    # 大小限制：10MB
    MAX_SIZE = 10 * 1024 * 1024
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_SIZE:
        return jsonify({'success': False, 'error': '文件过大 (最大10MB)'}), 413

    try:
        if ext == 'txt' or file.mimetype == 'text/plain':
            text = file.read().decode('utf-8', errors='replace')
        elif ext == 'pdf':
            text = _extract_pdf_text(file)
        elif ext == 'docx':
            text = _extract_docx_text(file)
        elif ext == 'doc':
            text = _extract_doc_text(file)
        else:
            return jsonify({'success': False, 'error': f'不支持的文件格式: .{ext}，支持 PDF/Word/TXT'}), 400

        text = text.strip()
        if not text:
            return jsonify({
                'success': False,
                'error': '文件中未检测到可提取的文字，请确认文件是否为扫描件或图片'
            }), 422

        return jsonify({
            'success': True,
            'text': text,
            'filename': os.path.basename(file.filename),
            'char_count': len(text),
        })

    except ImportError as e:
        return jsonify({
            'success': False,
            'error': f'缺少解析库: {str(e)}，请运行 pip install {str(e)} 安装依赖'
        }), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'文件解析失败: {str(e)}'}), 500
