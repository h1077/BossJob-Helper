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

    # 只允许本地来源和 BOSS 直聘页面
    CORS(app, resources={r"/api/*": {
        "origins": ["http://localhost:5001", "http://127.0.0.1:5001",
                    "http://localhost:5002", "http://127.0.0.1:5002",
                    "https://www.zhipin.com"]
    }})

    # 本地 token 存储到 app config
    app.config['LOCAL_TOKEN'] = _load_or_create_token(base_dir)

    db.init_app(app)

    with app.app_context():
        db.create_all()

    from routes.ai import ai_bp
    from routes.jobs import jobs_bp
    from routes.resumes import resumes_bp
    from routes.analytics import analytics_bp

    app.register_blueprint(ai_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(resumes_bp)
    app.register_blueprint(analytics_bp)

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
