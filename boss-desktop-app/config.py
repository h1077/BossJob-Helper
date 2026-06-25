import os

os.environ.setdefault('LOCAL_MODE', '1')
LOCAL_MODE = os.environ.get('LOCAL_MODE', '1') == '1'

JWT_SECRET = os.environ.get('JWT_SECRET', 'boss-desktop-local-jwt-secret')
JWT_ALGORITHM = 'HS256'
TOKEN_EXPIRE_DAYS = 365

PORT = int(os.environ.get('PORT', 5001))
HOST = os.environ.get('HOST', '127.0.0.1')
