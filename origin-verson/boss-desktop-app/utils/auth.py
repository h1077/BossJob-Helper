"""
JWT 鉴权 + 本地模式自动用户（需匹配本地 token）
"""
import os
from functools import wraps
from flask import request, jsonify, current_app

LOCAL_MODE = os.environ.get('LOCAL_MODE', '1') == '1'


def generate_token(user_id, token_version=0):
    import jwt as pyjwt
    from datetime import datetime, timedelta
    from config import JWT_SECRET, JWT_ALGORITHM, TOKEN_EXPIRE_DAYS
    payload = {
        'user_id': user_id,
        'token_version': token_version,
        'exp': datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
        'iat': datetime.utcnow(),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token):
    import jwt as pyjwt
    from config import JWT_SECRET, JWT_ALGORITHM
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None


def _get_or_create_local_user():
    from models import User, db
    user = User.query.filter_by(email='local@boss-desktop').first()
    if not user:
        user = User(
            email='local@boss-desktop',
            password_hash='local-mode-no-password',
            token_version=0,
        )
        db.session.add(user)
        db.session.commit()
    return user


def _check_local_token():
    """验证请求携带的 token 是否与本地 token 匹配"""
    expected = current_app.config.get('LOCAL_TOKEN', '')
    if not expected:
        return True
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:] == expected
    return False


def get_current_user():
    """获取当前用户，本地模式下需 token 匹配"""
    if LOCAL_MODE:
        if _check_local_token():
            return _get_or_create_local_user()
        return None

    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        payload = decode_token(auth_header[7:])
        if payload:
            from models import User
            user = User.query.get(payload.get('user_id'))
            if user and payload.get('token_version', 0) == user.token_version:
                return user
    return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': '认证失败'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated
