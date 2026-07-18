from redis import Redis

from app.core.config import settings


redis_client = Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=settings.redis_socket_timeout,
    socket_timeout=settings.redis_socket_timeout,
    health_check_interval=30,
)
