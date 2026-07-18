from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any

from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import AppException
from app.core.redis import redis_client
from app.models.ai_config import AiModelConfig, FlowPointRule


logger = logging.getLogger(__name__)


AI_CONFIG_CACHE_KEY = f"{settings.redis_key_prefix}:ai:active-model-config"
AI_CONFIG_CACHE_SECONDS = 300
_runtime_config_var: ContextVar["AiRuntimeConfig | None"] = ContextVar("ai_runtime_config", default=None)


@dataclass
class AiRuntimeConfig:
    id: int | None
    name: str
    provider: str
    base_url: str
    api_key: str
    model: str
    temperature: float
    timeout: int
    max_tokens: int | None
    supports_multimodal: bool
    context_messages: int
    is_chat_selectable: bool = True
    sort_order: int = 100
    chat_points_per_call: float | None = None
    chat_points_per_million_input_tokens: float | None = None
    chat_points_per_million_output_tokens: float | None = None

    def chat_billing_override(self) -> dict[str, float | None]:
        return {
            "points_per_call": self.chat_points_per_call,
            "points_per_million_input_tokens": self.chat_points_per_million_input_tokens,
            "points_per_million_output_tokens": self.chat_points_per_million_output_tokens,
        }


def _settings_config() -> AiRuntimeConfig:
    return AiRuntimeConfig(
        id=None,
        name="环境变量配置",
        provider="openai-compatible",
        base_url=settings.ai_base_url,
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        temperature=float(settings.ai_temperature),
        timeout=int(settings.ai_timeout),
        max_tokens=settings.ai_max_tokens,
        supports_multimodal=False,
        context_messages=12,
        is_chat_selectable=True,
        sort_order=100,
    )


def _decimal_number(value: Decimal | int | float | str | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _from_model(item: AiModelConfig) -> AiRuntimeConfig:
    return AiRuntimeConfig(
        id=item.id,
        name=item.name,
        provider=item.provider,
        base_url=item.base_url,
        api_key=item.api_key,
        model=item.model,
        temperature=float(item.temperature),
        timeout=int(item.timeout),
        max_tokens=item.max_tokens,
        supports_multimodal=bool(item.supports_multimodal),
        context_messages=max(1, min(int(item.context_messages or 12), 40)),
        is_chat_selectable=bool(getattr(item, "is_chat_selectable", True)),
        sort_order=int(getattr(item, "sort_order", 100) or 100),
        chat_points_per_call=_decimal_number(getattr(item, "chat_points_per_call", None)),
        chat_points_per_million_input_tokens=_decimal_number(getattr(item, "chat_points_per_million_input_tokens", None)),
        chat_points_per_million_output_tokens=_decimal_number(getattr(item, "chat_points_per_million_output_tokens", None)),
    )


def _cache_config(config: AiRuntimeConfig) -> None:
    try:
        redis_client.set(
            AI_CONFIG_CACHE_KEY,
            json.dumps(asdict(config), ensure_ascii=False),
            ex=AI_CONFIG_CACHE_SECONDS,
        )
    except RedisError:
        logger.warning("Failed to write AI config cache", exc_info=True)


def _read_cached_config() -> AiRuntimeConfig | None:
    try:
        value = redis_client.get(AI_CONFIG_CACHE_KEY)
        if not value:
            return None
        data = json.loads(value)
        return AiRuntimeConfig(**data)
    except (RedisError, json.JSONDecodeError, TypeError):
        logger.warning("Failed to read AI config cache", exc_info=True)
        return None


def invalidate_ai_config_cache() -> None:
    try:
        redis_client.delete(AI_CONFIG_CACHE_KEY)
    except RedisError:
        logger.warning("Failed to invalidate AI config cache", exc_info=True)


@contextmanager
def bind_ai_runtime_config(config: AiRuntimeConfig):
    token = _runtime_config_var.set(config)
    try:
        yield
    finally:
        _runtime_config_var.reset(token)


def _select_active_config(session: Session) -> AiModelConfig | None:
    return session.scalar(
        select(AiModelConfig)
        .where(AiModelConfig.is_active == True)  # noqa: E712
        .order_by(AiModelConfig.sort_order.asc(), AiModelConfig.update_time.desc(), AiModelConfig.id.desc())
        .limit(1)
    )


def get_ai_config_by_id(db: Session, config_id: int, *, require_chat_selectable: bool = False) -> AiRuntimeConfig:
    item = db.get(AiModelConfig, config_id)
    if not item:
        raise AppException("模型配置不存在或已停用")
    if require_chat_selectable and not bool(getattr(item, "is_chat_selectable", True)):
        raise AppException("该模型暂未开放给 AI 助手使用")
    config = _from_model(item)
    if not config.api_key:
        raise AppException("未配置大模型 API KEY，请在后台 AI 配置中填写")
    return config


def get_default_chat_ai_config(db: Session) -> AiRuntimeConfig:
    item = db.scalar(
        select(AiModelConfig)
        .where(AiModelConfig.is_chat_selectable == True, AiModelConfig.is_active == True)  # noqa: E712
        .order_by(AiModelConfig.sort_order.asc(), AiModelConfig.update_time.desc(), AiModelConfig.id.desc())
        .limit(1)
    )
    if not item:
        item = db.scalar(
            select(AiModelConfig)
            .where(AiModelConfig.is_chat_selectable == True)  # noqa: E712
            .order_by(AiModelConfig.sort_order.asc(), AiModelConfig.update_time.desc(), AiModelConfig.id.desc())
            .limit(1)
        )
    config = _from_model(item) if item else get_active_ai_config(db)
    if not config.api_key:
        raise AppException("未配置大模型 API KEY，请在后台 AI 配置中填写")
    return config


def get_active_ai_config(db: Session | None = None) -> AiRuntimeConfig:
    scoped = _runtime_config_var.get()
    if scoped:
        return scoped

    cached = _read_cached_config()
    if cached:
        return cached

    owns_session = db is None
    session = db or SessionLocal()
    try:
        item = _select_active_config(session)
        config = _from_model(item) if item else _settings_config()
        if not config.api_key:
            raise AppException("未配置大模型 API KEY，请在后台 AI 配置中填写")
        _cache_config(config)
        return config
    finally:
        if owns_session:
            session.close()


def public_ai_capability(db: Session, *, include_all_chat_models: bool = False) -> dict[str, Any]:
    config = get_active_ai_config(db)
    default_chat_config = get_default_chat_ai_config(db)
    chat_rule = db.scalar(select(FlowPointRule).where(FlowPointRule.feature_type == "ai_chat"))
    default_points_per_call = _decimal_number(getattr(chat_rule, "points_per_call", None))
    default_input_rate = _decimal_number(getattr(chat_rule, "points_per_million_input_tokens", None))
    default_output_rate = _decimal_number(getattr(chat_rule, "points_per_million_output_tokens", None))
    model_query = select(AiModelConfig)
    if not include_all_chat_models:
        model_query = model_query.where(AiModelConfig.is_chat_selectable == True)  # noqa: E712
    items = list(
        db.scalars(
            model_query.order_by(
                AiModelConfig.sort_order.asc(),
                AiModelConfig.is_active.desc(),
                AiModelConfig.update_time.desc(),
                AiModelConfig.id.desc(),
            )
        )
    )
    if not items:
        active_item = _select_active_config(db)
        if active_item:
            items = [active_item]
    return {
        "id": config.id,
        "name": config.name,
        "supports_multimodal": config.supports_multimodal,
        "context_messages": config.context_messages,
        "default_chat_model_id": default_chat_config.id,
        "chat_models": [
            {
                "id": item.id,
                "name": item.name,
                "supports_multimodal": bool(item.supports_multimodal),
                "context_messages": max(1, min(int(item.context_messages or 12), 40)),
                "sort_order": int(getattr(item, "sort_order", 100) or 100),
                "points_per_call": (
                    _decimal_number(item.chat_points_per_call)
                    if item.chat_points_per_call is not None
                    else default_points_per_call
                ),
                "points_per_million_input_tokens": (
                    _decimal_number(item.chat_points_per_million_input_tokens)
                    if item.chat_points_per_million_input_tokens is not None
                    else default_input_rate
                ),
                "points_per_million_output_tokens": (
                    _decimal_number(item.chat_points_per_million_output_tokens)
                    if item.chat_points_per_million_output_tokens is not None
                    else default_output_rate
                ),
                "uses_default_pricing": (
                    item.chat_points_per_call is None
                    and item.chat_points_per_million_input_tokens is None
                    and item.chat_points_per_million_output_tokens is None
                ),
            }
            for item in items
        ],
    }


def ensure_default_ai_config(db: Session) -> AiModelConfig | None:
    exists = db.scalar(select(AiModelConfig.id).limit(1))
    if exists:
        return None
    if not settings.ai_api_key:
        return None
    item = AiModelConfig(
        name="默认模型",
        provider="openai-compatible",
        base_url=settings.ai_base_url,
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        temperature=float(settings.ai_temperature),
        timeout=int(settings.ai_timeout),
        max_tokens=settings.ai_max_tokens,
        supports_multimodal=False,
        context_messages=12,
        is_chat_selectable=True,
        sort_order=100,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    invalidate_ai_config_cache()
    return item
