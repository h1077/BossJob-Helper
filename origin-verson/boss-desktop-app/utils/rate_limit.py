"""
简易内存速率限制器
"""
import time
from collections import defaultdict
from functools import wraps
from flask import request, jsonify

_windows: dict[str, list[float]] = defaultdict(list)
_last_cleanup = time.time()


def _cleanup():
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < 60:
        return
    _last_cleanup = now
    expired = [k for k, v in _windows.items() if not v or now - v[-1] > 3600]
    for k in expired:
        del _windows[k]


def rate_limit(max_requests: int, window_seconds: int):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            _cleanup()
            ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown')
            key = f"{request.endpoint}:{ip}"
            now = time.time()
            cutoff = now - window_seconds
            _windows[key] = [t for t in _windows[key] if t > cutoff]
            if len(_windows[key]) >= max_requests:
                return jsonify({
                    'success': False,
                    'error': '请求过于频繁，请稍后重试',
                    'retry_after': int(cutoff + window_seconds - now) + 1,
                }), 429
            _windows[key].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator
