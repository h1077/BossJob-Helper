"""
数据库模型 — SQLite 单用户本地版
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    premium_until = db.Column(db.DateTime, nullable=True)
    premium_type = db.Column(db.String(30), nullable=True)
    token_version = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'premiumUntil': self.premium_until.isoformat() if self.premium_until else None,
            'premiumType': self.premium_type or 'local',
            'isPremium': True,
        }


class AIConfig(db.Model):
    __tablename__ = 'ai_configs'

    id = db.Column(db.Integer, primary_key=True)
    config_name = db.Column(db.String(50), nullable=False, unique=True)
    api_url = db.Column(db.String(255), nullable=False)
    api_key = db.Column(db.String(500), nullable=False)
    model = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    rate_limit = db.Column(db.Integer, default=60)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, hide_key=True):
        result = {
            'id': self.id,
            'config_name': self.config_name,
            'api_url': self.api_url,
            'model': self.model,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'rate_limit': self.rate_limit,
        }
        if not hide_key:
            result['api_key'] = self.api_key
        return result


class Resume(db.Model):
    __tablename__ = 'resumes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), default='original')
    score = db.Column(db.Integer, default=0)
    improvements = db.Column(db.JSON, nullable=True)
    analysis_result = db.Column(db.JSON, nullable=True)
    ats_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'type': self.type,
            'score': self.score,
            'improvements': self.improvements if isinstance(self.improvements, list) else [],
            'analysisResult': self.analysis_result if isinstance(self.analysis_result, dict) else None,
            'atsData': self.ats_data if isinstance(self.ats_data, dict) else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
        }


class InterestedJob(db.Model):
    __tablename__ = 'interested_jobs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    job_id = db.Column(db.String(100), nullable=False, index=True)
    company_name = db.Column(db.String(200), nullable=False)
    job_name = db.Column(db.String(200), nullable=False)
    salary = db.Column(db.String(100))
    location = db.Column(db.String(100))
    experience = db.Column(db.String(100))
    education = db.Column(db.String(100))
    jd = db.Column(db.Text)
    company_stage = db.Column(db.String(50))
    company_scale = db.Column(db.String(50))
    company_industry = db.Column(db.String(100))
    business_info = db.Column(db.JSON)
    job_responsibilities = db.Column(db.Text)
    job_requirements = db.Column(db.Text)
    status = db.Column(db.String(20), default='applied')
    source_url = db.Column(db.String(500))
    match_score = db.Column(db.Integer, default=0)
    match_level = db.Column(db.String(50))
    match_reasons = db.Column(db.JSON)
    matched_skills = db.Column(db.JSON)
    match_details = db.Column(db.JSON)
    hr_name = db.Column(db.String(100))
    hr_title = db.Column(db.String(100))
    custom_greeting = db.Column(db.Text, nullable=True)
    collected_at = db.Column(db.BigInteger)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'jobId': self.job_id,
            'companyName': self.company_name,
            'jobName': self.job_name,
            'salary': self.salary,
            'location': self.location,
            'experience': self.experience,
            'education': self.education,
            'jd': self.jd,
            'companyStage': self.company_stage,
            'companyScale': self.company_scale,
            'companyIndustry': self.company_industry,
            'businessInfo': self.business_info if isinstance(self.business_info, dict) else {},
            'jobResponsibilities': self.job_responsibilities,
            'jobRequirements': self.job_requirements,
            'status': self.status,
            'sourceUrl': self.source_url,
            'hrName': self.hr_name,
            'hrTitle': self.hr_title,
            'customGreeting': self.custom_greeting,
            'matchScore': {
                'score': self.match_score or 0,
                'level': self.match_level or '计算中',
                'reasons': self.match_reasons if isinstance(self.match_reasons, list) else [],
                'matchedSkills': self.matched_skills if isinstance(self.matched_skills, list) else [],
                'details': self.match_details if isinstance(self.match_details, dict) else {},
            },
            'collectedAt': self.collected_at,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }


class InterviewSession(db.Model):
    __tablename__ = 'interview_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    job_id = db.Column(db.Integer, db.ForeignKey('interested_jobs.id'), nullable=True)
    resume_id = db.Column(db.Integer, db.ForeignKey('resumes.id'), nullable=True)
    status = db.Column(db.String(20), default='in_progress')
    messages = db.Column(db.JSON, default=list)
    overall_score = db.Column(db.Integer, nullable=True)
    strengths = db.Column(db.JSON, nullable=True)
    weaknesses = db.Column(db.JSON, nullable=True)
    suggestions = db.Column(db.JSON, nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'jobId': self.job_id,
            'resumeId': self.resume_id,
            'status': self.status,
            'messages': self.messages if isinstance(self.messages, list) else [],
            'overallScore': self.overall_score,
            'strengths': self.strengths if isinstance(self.strengths, list) else [],
            'weaknesses': self.weaknesses if isinstance(self.weaknesses, list) else [],
            'suggestions': self.suggestions if isinstance(self.suggestions, list) else [],
            'startedAt': self.started_at.isoformat() if self.started_at else None,
            'endedAt': self.ended_at.isoformat() if self.ended_at else None,
        }


class AnalyticsEvent(db.Model):
    __tablename__ = 'analytics_events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    event_type = db.Column(db.String(100), nullable=False, index=True)
    category = db.Column(db.String(50), nullable=False, index=True)
    page = db.Column(db.String(100), nullable=True)
    metadata_ = db.Column('metadata', db.JSON, nullable=True)
    session_id = db.Column(db.String(64), nullable=False, index=True)
    client_ts = db.Column(db.BigInteger, nullable=True)
    server_ts = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'event_type': self.event_type,
            'category': self.category,
            'page': self.page,
            'metadata': self.metadata_,
            'session_id': self.session_id,
            'client_ts': self.client_ts,
            'server_ts': self.server_ts.isoformat() if self.server_ts else None,
        }

    @staticmethod
    def batch_create(events_data):
        events = [AnalyticsEvent(
            user_id=e.get('user_id'),
            event_type=e.get('event_type', 'unknown'),
            category=e.get('category', 'general'),
            page=e.get('page'),
            metadata_=e.get('metadata'),
            session_id=e.get('session_id', 'unknown'),
            client_ts=e.get('client_ts'),
        ) for e in events_data]
        db.session.add_all(events)
        db.session.commit()
        return len(events)
