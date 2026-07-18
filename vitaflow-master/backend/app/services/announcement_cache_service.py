from __future__ import annotations

import json
import logging
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_client


logger = logging.getLogger(__name__)


class AnnouncementCacheService:
    def __init__(self, client: Redis):
        self.client = client
        self.prefix = f"{settings.redis_key_prefix}:announcements"

    @property
    def version_key(self) -> str:
        return f"{self.prefix}:cache-version"

    def _version(self) -> str | None:
        try:
            version = self.client.get(self.version_key)
            if version:
                return version
            self.client.set(self.version_key, "1", nx=True)
            return self.client.get(self.version_key) or "1"
        except RedisError:
            logger.warning("Failed to read announcement cache version", exc_info=True)
            return None

    def cache_key(self, suffix: str) -> str | None:
        version = self._version()
        return f"{self.prefix}:cache:v{version}:{suffix}" if version else None

    def get_json(self, suffix: str) -> Any | None:
        try:
            key = self.cache_key(suffix)
            if not key:
                return None
            value = self.client.get(key)
            return json.loads(value) if value is not None else None
        except (RedisError, json.JSONDecodeError):
            logger.warning("Failed to read announcement cache", exc_info=True)
            return None

    def set_json(self, suffix: str, value: Any) -> None:
        try:
            key = self.cache_key(suffix)
            if not key:
                return
            self.client.set(
                key,
                json.dumps(value, ensure_ascii=False),
                ex=settings.announcement_cache_ttl_seconds,
            )
        except RedisError:
            # Cache failure must not make persisted announcements unavailable.
            logger.warning("Failed to write announcement cache", exc_info=True)

    def invalidate(self) -> None:
        try:
            self.client.incr(self.version_key)
        except RedisError:
            logger.warning("Failed to invalidate announcement cache", exc_info=True)

    def dismissed_key(self, user_id: int) -> str:
        return f"{self.prefix}:dismissed:user:{user_id}"

    def is_dismissed(self, user_id: int, announcement_id: int) -> bool:
        try:
            return bool(self.client.sismember(self.dismissed_key(user_id), str(announcement_id)))
        except RedisError:
            # Prefer showing the announcement over making the resume page fail.
            logger.warning("Failed to read dismissed announcements", exc_info=True)
            return False

    def dismiss(self, user_id: int, announcement_id: int) -> None:
        try:
            self.client.sadd(self.dismissed_key(user_id), str(announcement_id))
        except RedisError as exc:
            raise AppException("公告偏好保存失败，请稍后重试") from exc


announcement_cache_service = AnnouncementCacheService(redis_client)
