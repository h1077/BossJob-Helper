from __future__ import annotations

import logging

from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import redis_client
from app.models.ai_config import AppSetting


logger = logging.getLogger(__name__)

SETTING_CACHE_SECONDS = 300
SETTING_CACHE_PREFIX = f"{settings.redis_key_prefix}:app-setting"

DEFAULT_SETTINGS: dict[str, dict[str, str]] = {
    "signup_gift_points": {
        "value": "0",
        "description": "新注册用户默认赠送 Flow Points",
    },
    "ai_records_hint": {
        "value": "1 元约等于 100 Flow Points，具体扣点以后台规则为准。",
        "description": "AI记录页余额下方提示文案",
    },
    "feedback_notify_email": {
        "value": "",
        "description": "用户反馈邮件通知收件邮箱",
    },
    "redeem_daily_attempt_limit": {
        "value": "10",
        "description": "每个用户每天最多尝试兑换码次数，0 表示不限制",
    },
    "user_agreement": {
        "value": "",
        "description": "用户协议与隐私政策",
    },
}


def _cache_key(key: str) -> str:
    return f"{SETTING_CACHE_PREFIX}:{key}"


def ensure_default_settings(db: Session) -> None:
    existing = set(db.scalars(select(AppSetting.key)).all())
    changed = False
    for key, data in DEFAULT_SETTINGS.items():
        if key in existing:
            continue
        db.add(AppSetting(key=key, value=data["value"], description=data.get("description")))
        changed = True
    if changed:
        db.commit()


def invalidate_setting_cache(key: str | None = None) -> None:
    try:
        if key:
            redis_client.delete(_cache_key(key))
        else:
            for item in DEFAULT_SETTINGS:
                redis_client.delete(_cache_key(item))
    except RedisError:
        logger.warning("Failed to invalidate app setting cache", exc_info=True)


def get_setting(db: Session, key: str, default: str = "") -> str:
    try:
        cached = redis_client.get(_cache_key(key))
        if cached is not None:
            return cached
    except RedisError:
        logger.warning("Failed to read app setting cache", exc_info=True)

    ensure_default_settings(db)
    item = db.scalar(select(AppSetting).where(AppSetting.key == key))
    value = item.value if item else DEFAULT_SETTINGS.get(key, {}).get("value", default)
    try:
        redis_client.set(_cache_key(key), value, ex=SETTING_CACHE_SECONDS)
    except RedisError:
        logger.warning("Failed to write app setting cache", exc_info=True)
    return value


def get_int_setting(db: Session, key: str, default: int = 0) -> int:
    try:
        return max(0, int(get_setting(db, key, str(default)) or 0))
    except (TypeError, ValueError):
        return default


def set_setting(db: Session, key: str, value: str, description: str | None = None) -> AppSetting:
    ensure_default_settings(db)
    item = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if not item:
        item = AppSetting(key=key, value=value, description=description)
    else:
        item.value = value
        if description is not None:
            item.description = description
    db.add(item)
    db.commit()
    db.refresh(item)
    invalidate_setting_cache(key)
    return item


def get_admin_settings(db: Session) -> dict[str, str]:
    ensure_default_settings(db)
    rows = db.scalars(select(AppSetting)).all()
    data = {item.key: item.value for item in rows}
    for key, item in DEFAULT_SETTINGS.items():
        data.setdefault(key, item["value"])
    return data
