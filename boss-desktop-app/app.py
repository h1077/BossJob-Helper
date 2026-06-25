"""
BOSS 海投桌面管家 — Flask 入口
"""
import os
import sys
import threading
import webbrowser
from flask import Flask, send_from_directory
from flask_cors import CORS
from models import db
from config import PORT, HOST


def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='')

    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.abspath(os.path.dirname(__file__))

    db_path = os.path.join(base_dir, 'data', 'boss_desktop.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app, resources={r"/api/*": {"origins": "*"}})

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
