"""
Boss海投小助手 — Flask 入口
"""
import os
import sys
import secrets
import threading
import webbrowser
from flask import Flask, send_from_directory, request
from flask_cors import CORS
from models import db
from config import PORT, HOST


def _run_migrations(inspector):
    """幂等迁移：检测缺失列/表并自动补充，重复执行安全"""
    from sqlalchemy import text as _text

    def _has_column(table, col):
        return col in {c['name'] for c in inspector.get_columns(table)}

    def _has_table(name):
        return inspector.has_table(name)

    # Resume 表：结构化内容与模板配置列
    if not _has_column('resumes', 'structured_data'):
        db.session.execute(_text("ALTER TABLE resumes ADD COLUMN structured_data JSON"))
        print('[migration] + resumes.structured_data')
    if not _has_column('resumes', 'template_config'):
        db.session.execute(_text("ALTER TABLE resumes ADD COLUMN template_config JSON"))
        print('[migration] + resumes.template_config')

    # InterestedJob 表：status_updated_at / status_notes / delivery_url
    if not _has_column('interested_jobs', 'status_updated_at'):
        db.session.execute(_text("ALTER TABLE interested_jobs ADD COLUMN status_updated_at DATETIME"))
        print('[migration] + interested_jobs.status_updated_at')
    if not _has_column('interested_jobs', 'status_notes'):
        db.session.execute(_text("ALTER TABLE interested_jobs ADD COLUMN status_notes TEXT"))
        print('[migration] + interested_jobs.status_notes')
    if not _has_column('interested_jobs', 'delivery_url'):
        db.session.execute(_text("ALTER TABLE interested_jobs ADD COLUMN delivery_url VARCHAR(500)"))
        print('[migration] + interested_jobs.delivery_url')
    if not _has_column('interested_jobs', 'resume_id'):
        db.session.execute(_text("ALTER TABLE interested_jobs ADD COLUMN resume_id INTEGER"))
        print('[migration] + interested_jobs.resume_id')
    if not _has_column('interested_jobs', 'resume_version_id'):
        db.session.execute(_text("ALTER TABLE interested_jobs ADD COLUMN resume_version_id INTEGER"))
        print('[migration] + interested_jobs.resume_version_id')

    # 新表：由 create_all 处理，这里对已有数据库启动路径兜底。
    if any(not _has_table(table) for table in (
        'position_strategies', 'strategy_rules', 'resume_versions',
    )):
        db.create_all()
        print('[migration] + tables created via create_all')

    if _has_table('resume_versions') and not _has_column('resume_versions', 'template_config'):
        db.session.execute(_text("ALTER TABLE resume_versions ADD COLUMN template_config JSON"))
        print('[migration] + resume_versions.template_config')

    db.session.commit()

    # ── 种子数据：默认策略规则 ──
    _seed_default_strategy_rules()


def _seed_default_strategy_rules():
    """种子数据：插入默认策略规则（幂等，已存在则跳过）"""
    from models import StrategyRule
    from utils.strategy_rules import DEFAULT_RULES
    for ctype, rule in DEFAULT_RULES.items():
        existing = StrategyRule.query.filter_by(company_type=ctype).first()
        if not existing:
            db.session.add(StrategyRule(
                company_type=ctype,
                show_political_status=rule['show_political_status'],
                student_work_handling=rule['student_work_handling'],
                tone=rule['tone'],
                skill_order=rule.get('skill_order', []),
            ))
    db.session.commit()


def _load_or_create_token(base_dir):
    token_path = os.path.join(base_dir, 'data', '.local_token')
    if os.path.exists(token_path):
        with open(token_path, 'r') as f:
            return f.read().strip()
    token = secrets.token_urlsafe(32)
    with open(token_path, 'w') as f:
        f.write(token)
    return token


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='')

    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.abspath(os.path.dirname(__file__))

    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, 'boss_desktop.db')

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # 本地桌面工具，放开所有来源（含 Chrome 扩展 sidepanel）
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # 本地 token 存储到 app config
    app.config['LOCAL_TOKEN'] = _load_or_create_token(base_dir)

    db.init_app(app)

    with app.app_context():
        db.create_all()
        # ── 手动迁移：为已有数据库补充新列（幂等，重复执行安全） ──
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        _run_migrations(inspector)

    from routes.ai import ai_bp
    from routes.jobs import jobs_bp
    from routes.resumes import resumes_bp
    from routes.analytics import analytics_bp
    from routes.agent import agent_bp

    app.register_blueprint(ai_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(resumes_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(agent_bp)

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'app': 'Boss海投小助手'}

    @app.route('/api/local-token')
    def local_token():
        """给本地脚本提供 token，只有 localhost 能访问"""
        if request.remote_addr not in ('127.0.0.1', '::1', 'localhost'):
            return {'error': 'Forbidden'}, 403
        return {'token': app.config['LOCAL_TOKEN']}

    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def static_files(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        return send_from_directory(app.static_folder, path)

    return app


if __name__ == '__main__':
    app = create_app()
    threading.Timer(1.5, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()
    print(f'\n  Boss海投小助手 已启动')
    print(f'  仪表盘: http://localhost:{PORT}')
    print(f'  按 Ctrl+C 退出\n')
    app.run(host=HOST, port=PORT, debug=False)
