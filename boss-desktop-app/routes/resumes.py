"""
简历管理 API
"""
from flask import Blueprint, request, jsonify
from models import db, Resume
from utils.auth import login_required

resumes_bp = Blueprint('resumes', __name__, url_prefix='/api/resumes')


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
