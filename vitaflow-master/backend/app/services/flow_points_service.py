from __future__ import annotations

import json
import logging
import re
import secrets
import string
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

from redis.exceptions import RedisError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_client
from app.models.ai_config import (
    FlowPointRedeemCode,
    FlowPointRedeemRecord,
    FlowPointRule,
    FlowPointTransaction,
)
from app.models.ai_task import AiTask
from app.models.user import User
from app.services.app_settings_service import get_int_setting
from app.services.ai.token_usage import estimate_tokens, normalize_token_usage

logger = logging.getLogger(__name__)
POINT_QUANT = Decimal("0.01")
POINT_ZERO = Decimal("0.00")

DEFAULT_POINT_RULES: dict[str, dict[str, Any]] = {
    "generate_resume": {
        "display_name": "AI 简历生成",
        "points_per_call": 100,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
    "import_resume": {
        "display_name": "导入简历",
        "points_per_call": 50,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
    "ai_chat": {
        "display_name": "AI 对话",
        "points_per_call": 5,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 1000,
        "points_per_million_input_tokens": 1000,
        "points_per_million_output_tokens": 1000,
    },
    "resume_score": {
        "display_name": "简历诊断",
        "points_per_call": 30,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
    "jd_optimize": {
        "display_name": "JD 优化",
        "points_per_call": 50,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
    "resume_translate": {
        "display_name": "简历翻译",
        "points_per_call": 50,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
    "section_optimize": {
        "display_name": "AI 润色",
        "points_per_call": 20,
        "points_per_1k_tokens": 0,
        "points_per_million_tokens": 0,
        "points_per_million_input_tokens": 0,
        "points_per_million_output_tokens": 0,
    },
}

ACTIVE_AI_FEATURE_TYPES = set(DEFAULT_POINT_RULES.keys())
POINT_RULE_CACHE_SECONDS = 300
POINT_RULE_CACHE_PREFIX = f"{settings.redis_key_prefix}:flow-point-rule"
REDEEM_ATTEMPT_CACHE_PREFIX = f"{settings.redis_key_prefix}:redeem-attempt"


def _cache_key(feature_type: str) -> str:
    return f"{POINT_RULE_CACHE_PREFIX}:{feature_type}"


def point_amount(value: Any = 0) -> Decimal:
    if isinstance(value, Decimal):
        raw = value
    else:
        try:
            raw = Decimal(str(value if value is not None else "0"))
        except (InvalidOperation, ValueError):
            raw = POINT_ZERO
    return raw.quantize(POINT_QUANT, rounding=ROUND_HALF_UP)


def point_number(value: Any = 0) -> float:
    return float(point_amount(value))


def point_charge_amount(value: Any = 0) -> Decimal:
    if isinstance(value, Decimal):
        raw = value
    else:
        try:
            raw = Decimal(str(value if value is not None else "0"))
        except (InvalidOperation, ValueError):
            raw = POINT_ZERO
    rounded = raw.quantize(POINT_QUANT, rounding=ROUND_HALF_UP)
    if raw > POINT_ZERO and rounded == POINT_ZERO:
        return POINT_QUANT
    return rounded


def _point_text(value: Any = 0) -> str:
    return f"{point_amount(value):.2f}"


def _rule_dict(rule: FlowPointRule) -> dict[str, Any]:
    return {
        "feature_type": rule.feature_type,
        "display_name": rule.display_name,
        "points_per_call": point_number(rule.points_per_call),
        "points_per_1k_tokens": point_number(rule.points_per_1k_tokens),
        "points_per_million_tokens": point_number(rule.points_per_million_tokens),
        "points_per_million_input_tokens": point_number(getattr(rule, "points_per_million_input_tokens", 0)),
        "points_per_million_output_tokens": point_number(getattr(rule, "points_per_million_output_tokens", 0)),
        "enabled": bool(rule.enabled),
    }


def invalidate_point_rule_cache(feature_type: str | None = None) -> None:
    try:
        if feature_type:
            redis_client.delete(_cache_key(feature_type))
        else:
            for item in ACTIVE_AI_FEATURE_TYPES:
                redis_client.delete(_cache_key(item))
    except RedisError:
        logger.warning("Failed to invalidate point rule cache", exc_info=True)


def ensure_default_point_rules(db: Session) -> None:
    existing = set(db.scalars(select(FlowPointRule.feature_type)).all())
    changed = False
    for feature_type, data in DEFAULT_POINT_RULES.items():
        if feature_type in existing:
            continue
        db.add(FlowPointRule(feature_type=feature_type, **data, enabled=True))
        changed = True
    stale = list(db.scalars(select(FlowPointRule).where(FlowPointRule.feature_type.not_in(list(ACTIVE_AI_FEATURE_TYPES)))))
    for item in stale:
        db.delete(item)
        changed = True
    if changed:
        db.commit()
        invalidate_point_rule_cache()


def get_point_rule(db: Session, feature_type: str) -> FlowPointRule:
    if feature_type not in ACTIVE_AI_FEATURE_TYPES:
        raise AppException("AI 点数规则不存在，请在后台配置")
    ensure_default_point_rules(db)
    rule = db.scalar(select(FlowPointRule).where(FlowPointRule.feature_type == feature_type))
    if not rule:
        raise AppException("AI 点数规则不存在，请在后台配置")
    return rule


def get_point_rule_data(db: Session, feature_type: str) -> dict[str, Any]:
    if feature_type not in ACTIVE_AI_FEATURE_TYPES:
        raise AppException("AI 点数规则不存在，请在后台配置")
    try:
        cached = redis_client.get(_cache_key(feature_type))
        if cached:
            return json.loads(cached)
    except (RedisError, json.JSONDecodeError, TypeError):
        logger.warning("Failed to read point rule cache", exc_info=True)
    rule = get_point_rule(db, feature_type)
    data = _rule_dict(rule)
    try:
        redis_client.set(_cache_key(feature_type), json.dumps(data, ensure_ascii=False), ex=POINT_RULE_CACHE_SECONDS)
    except RedisError:
        logger.warning("Failed to write point rule cache", exc_info=True)
    return data


def _billing_token_usage(
    *,
    tokens_used: int = 0,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    token_usage: dict[str, Any] | None = None,
) -> dict[str, int]:
    if token_usage:
        usage = normalize_token_usage({"token_usage": token_usage}, int(token_usage.get("total_tokens") or tokens_used or 0))
        return {
            "input_tokens": int(usage.get("input_tokens") or 0),
            "output_tokens": int(usage.get("output_tokens") or 0),
            "total_tokens": int(usage.get("total_tokens") or 0),
        }

    input_value = max(0, int(input_tokens or 0)) if input_tokens is not None else None
    output_value = max(0, int(output_tokens or 0)) if output_tokens is not None else None
    total_value = max(0, int(tokens_used or 0))
    if input_value is not None or output_value is not None:
        input_value = int(input_value or 0)
        output_value = int(output_value or 0)
        return {
            "input_tokens": input_value,
            "output_tokens": output_value,
            "total_tokens": max(total_value, input_value + output_value),
        }
    return {"input_tokens": 0, "output_tokens": 0, "total_tokens": total_value}


def calculate_points(
    db: Session,
    feature_type: str,
    tokens_used: int = 0,
    *,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    token_usage: dict[str, Any] | None = None,
    pricing_override: dict[str, Any] | None = None,
) -> Decimal:
    rule = get_point_rule_data(db, feature_type)
    if not rule["enabled"]:
        return POINT_ZERO
    if pricing_override:
        for key in (
            "points_per_call",
            "points_per_million_tokens",
            "points_per_million_input_tokens",
            "points_per_million_output_tokens",
        ):
            if pricing_override.get(key) is not None:
                rule[key] = pricing_override.get(key)
    token_points = POINT_ZERO
    usage = _billing_token_usage(
        tokens_used=tokens_used,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        token_usage=token_usage,
    )
    input_rate = point_amount(rule.get("points_per_million_input_tokens") or 0)
    output_rate = point_amount(rule.get("points_per_million_output_tokens") or 0)
    has_split_usage = token_usage is not None or input_tokens is not None or output_tokens is not None
    if has_split_usage and (input_rate or output_rate):
        token_points = (
            (Decimal(int(usage["input_tokens"])) * input_rate / Decimal("1000000"))
            + (Decimal(int(usage["output_tokens"])) * output_rate / Decimal("1000000"))
        )
    else:
        points_per_million = point_amount(rule.get("points_per_million_tokens") or 0)
        points_per_1k = point_amount(rule.get("points_per_1k_tokens") or 0)
        total_tokens = int(usage["total_tokens"])
        if points_per_million and total_tokens > 0:
            token_points = Decimal(total_tokens) * points_per_million / Decimal("1000000")
        elif points_per_1k and total_tokens > 0:
            token_points = Decimal(total_tokens) * points_per_1k / Decimal("1000")
    return max(POINT_ZERO, point_amount(rule["points_per_call"]) + point_charge_amount(token_points))


def _task_net_points(db: Session, task: AiTask) -> Decimal:
    return point_amount(
        db.scalar(
            select(func.coalesce(func.sum(FlowPointTransaction.points_delta), POINT_ZERO)).where(
                FlowPointTransaction.task_id == task.id
            )
        )
        or POINT_ZERO
    )


def _set_task_usage_from_net_points(db: Session, task: AiTask, extra_delta: Decimal | int | float | str = 0) -> None:
    net_points = point_amount(_task_net_points(db, task) + point_amount(extra_delta))
    task.points_used = point_amount(abs(net_points) if net_points < 0 else 0)
    db.add(task)


def precheck_flow_points(
    db: Session,
    user: User,
    feature_type: str,
    tokens_used: int = 0,
    *,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    token_usage: dict[str, Any] | None = None,
    pricing_override: dict[str, Any] | None = None,
) -> Decimal:
    points = calculate_points(
        db,
        feature_type,
        tokens_used=tokens_used,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        token_usage=token_usage,
        pricing_override=pricing_override,
    )
    if points <= 0:
        return POINT_ZERO
    balance = point_amount(user.flow_points)
    if balance < points:
        raise AppException(
            f"Flow Points 不足：本次至少需要 {_point_text(points)} 点，当前余额 {_point_text(balance)} 点。请先兑换或联系管理员充值。",
            402,
        )
    return points


def add_point_transaction(
    db: Session,
    user: User,
    feature_type: str,
    points_delta: Decimal | int | float | str,
    description: str,
    task: AiTask | None = None,
    tokens_used: int = 0,
    allow_overdraft_to_zero: bool = False,
) -> FlowPointTransaction:
    current_balance = point_amount(user.flow_points)
    points_delta = point_amount(points_delta)
    next_balance = point_amount(current_balance + points_delta)
    if next_balance < 0 and allow_overdraft_to_zero and points_delta < 0:
        user.flow_points = POINT_ZERO
    else:
        user.flow_points = next_balance
    if user.flow_points < 0:
        raise AppException(
            f"Flow Points 不足：本次至少需要 {_point_text(abs(points_delta))} 点，当前余额 {_point_text(current_balance)} 点。请先兑换或联系管理员充值。",
            402,
        )
    txn = FlowPointTransaction(
        user_id=user.id,
        task_id=task.id if task else None,
        feature_type=feature_type,
        points_delta=points_delta,
        balance_after=user.flow_points,
        tokens_used=tokens_used,
        description=description,
    )
    db.add(user)
    db.add(txn)
    if task:
        _set_task_usage_from_net_points(db, task, points_delta)
        task.tokens_used = tokens_used
        db.add(task)
    db.flush()
    return txn


def settle_task_flow_points(
    db: Session,
    task: AiTask,
    *,
    description: str | None = None,
) -> Decimal:
    """Settle a completed AI task with the final token usage.

    Most AI tasks are created before the final model usage is known. This
    keeps the audit trail precise by charging/refunding the difference between
    what was already recorded and what the final rule calculates.
    """
    if task.task_type not in ACTIVE_AI_FEATURE_TYPES:
        task.points_used = POINT_ZERO
        db.add(task)
        return POINT_ZERO

    usage = normalize_token_usage(task.input_data or {}, task.tokens_used or 0)
    expected_points = calculate_points(
        db,
        task.task_type,
        tokens_used=int(task.tokens_used or 0),
        token_usage=usage,
        pricing_override=(task.input_data or {}).get("billing_override"),
    )
    current_paid = max(POINT_ZERO, -_task_net_points(db, task))
    delta = point_amount(expected_points - current_paid)
    if delta == 0:
        task.points_used = expected_points
        db.add(task)
        return expected_points

    user = db.get(User, task.user_id)
    if not user:
        task.points_used = current_paid
        db.add(task)
        return current_paid

    label = description or "AI 任务完成后按实际 Token 结算"
    if delta > 0:
        add_point_transaction(
            db,
            user,
            task.task_type,
            -delta,
            label,
            task=task,
            tokens_used=int(task.tokens_used or 0),
            allow_overdraft_to_zero=True,
        )
    else:
        add_point_transaction(
            db,
            user,
            task.task_type,
            abs(delta),
            "AI 任务完成后按实际 Token 退还",
            task=task,
            tokens_used=int(task.tokens_used or 0),
        )
    task.points_used = expected_points
    db.add(task)
    return expected_points


def consume_flow_points(
    db: Session,
    user: User,
    feature_type: str,
    task: AiTask | None = None,
    tokens_used: int = 0,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    token_usage: dict[str, Any] | None = None,
    description: str = "AI 功能调用扣减",
    pricing_override: dict[str, Any] | None = None,
) -> Decimal:
    points = calculate_points(
        db,
        feature_type,
        tokens_used=tokens_used,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        token_usage=token_usage,
        pricing_override=pricing_override,
    )
    if points <= 0:
        return POINT_ZERO
    balance = point_amount(user.flow_points)
    if balance < points:
        raise AppException(
            f"Flow Points 不足：本次至少需要 {_point_text(points)} 点，当前余额 {_point_text(balance)} 点。请先兑换或联系管理员充值。",
            402,
        )
    add_point_transaction(
        db,
        user,
        feature_type,
        -points,
        description,
        task=task,
        tokens_used=tokens_used,
    )
    db.commit()
    db.refresh(user)
    if task:
        db.refresh(task)
    return points


def _normalize_redeem_code(raw: str) -> str:
    code = (raw or "").strip().upper()
    if not code:
        return ""
    if len(code) > 64:
        raise AppException("兑换码不能超过 64 个字符")
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9_-]*", code):
        raise AppException("兑换码只能包含字母、数字、下划线和短横线，且需以字母或数字开头")
    return code


def _increase_redeem_attempt(db: Session, user_id: int) -> None:
    limit = get_int_setting(db, "redeem_daily_attempt_limit", 10)
    if limit <= 0:
        return
    key = f"{REDEEM_ATTEMPT_CACHE_PREFIX}:{user_id}:{datetime.now():%Y%m%d}"
    try:
        attempts = int(redis_client.incr(key) or 0)
        if attempts == 1:
            redis_client.expire(key, 60 * 60 * 26)
    except RedisError:
        logger.warning("Failed to update redeem attempt cache", exc_info=True)
        return
    if attempts > limit:
        raise AppException(f"今日兑换码尝试次数已达上限（{limit} 次），请明天再试")


def redeem_flow_points(db: Session, user: User, code: str, ip_address: str | None = None) -> FlowPointRedeemRecord:
    _increase_redeem_attempt(db, user.id)
    value = code.strip().upper()
    if not value:
        raise AppException("请输入兑换码")
    value = _normalize_redeem_code(value)
    client_ip = (ip_address or "").strip()[:64] or None
    item = db.scalar(select(FlowPointRedeemCode).where(FlowPointRedeemCode.code == value).with_for_update())
    if not item or item.status != "active":
        raise AppException("兑换码不存在")
    if item.expire_time and item.expire_time < datetime.now():
        raise AppException("兑换码已过期")
    if item.used_count >= item.total_count:
        raise AppException("兑换码已被使用完")
    exists = db.scalar(
        select(FlowPointRedeemRecord.id).where(
            FlowPointRedeemRecord.code_id == item.id,
            FlowPointRedeemRecord.user_id == user.id,
        )
    )
    if exists:
        raise AppException("你已经使用过这个兑换码")
    if item.ip_once:
        if not client_ip:
            raise AppException("无法识别当前 IP，不能兑换该 IP 限制兑换码")
        ip_exists = db.scalar(
            select(FlowPointRedeemRecord.id).where(
                FlowPointRedeemRecord.code_id == item.id,
                FlowPointRedeemRecord.ip_address == client_ip,
            )
        )
        if ip_exists:
            raise AppException("当前 IP 已使用过这个兑换码")
    record = FlowPointRedeemRecord(
        code_id=item.id,
        code=item.code,
        user_id=user.id,
        ip_address=client_ip,
        points=item.points,
        price=item.price,
    )
    db.add(record)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise AppException("你已经使用过这个兑换码") from exc
    item.used_count += 1
    db.add(item)
    add_point_transaction(
        db,
        user,
        "redeem",
        item.points,
        f"兑换码 {item.code} 充值",
        task=None,
        tokens_used=0,
    )
    db.commit()
    db.refresh(record)
    db.refresh(user)
    return record


def _random_code(length: int = 12) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_redeem_codes(
    db: Session,
    *,
    admin_id: int,
    count: int,
    points: Decimal | int | float | str,
    total_count: int,
    expire_time: datetime | None,
    note: str | None,
    price: Decimal | int | float | str = 0,
    ip_once: bool = False,
    custom_codes: list[str] | None = None,
) -> list[FlowPointRedeemCode]:
    points = point_amount(points)
    price = point_amount(price)
    cleaned_custom: list[str] = []
    seen_custom: set[str] = set()
    for raw in custom_codes or []:
        code = _normalize_redeem_code(raw)
        if not code or code in seen_custom:
            continue
        cleaned_custom.append(code)
        seen_custom.add(code)
    if cleaned_custom:
        count = len(cleaned_custom)
    if count < 1 or count > 500:
        raise AppException("单次生成数量需要在 1 到 500 之间")
    if len(cleaned_custom) > 500:
        raise AppException("单次自定义创建最多 500 个兑换码")
    if points <= 0:
        raise AppException("兑换点数必须大于 0")
    if price < 0:
        raise AppException("兑换码价格不能小于 0")
    if total_count <= 0:
        raise AppException("每个兑换码可兑换人数必须大于 0")
    batch_no = datetime.now().strftime(("CUS" if cleaned_custom else "FP") + "%Y%m%d%H%M%S")
    items: list[FlowPointRedeemCode] = []
    existing = set(db.scalars(select(FlowPointRedeemCode.code)).all())
    if cleaned_custom:
        duplicates = [item for item in cleaned_custom if item in existing]
        if duplicates:
            preview = "、".join(duplicates[:5])
            suffix = "等" if len(duplicates) > 5 else ""
            raise AppException(f"自定义兑换码已存在：{preview}{suffix}")
        codes = cleaned_custom
    else:
        codes = []
        for _ in range(count):
            code = _random_code()
            while code in existing:
                code = _random_code()
            codes.append(code)
            existing.add(code)
    for code in codes:
        existing.add(code)
        item = FlowPointRedeemCode(
            code=code,
            batch_no=batch_no,
            points=points,
            price=price,
            total_count=total_count,
            used_count=0,
            ip_once=ip_once,
            expire_time=expire_time,
            status="active",
            created_by=admin_id,
            note=note,
        )
        db.add(item)
        items.append(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


def import_redeem_codes(
    db: Session,
    *,
    admin_id: int,
    codes: list[str],
    points: Decimal | int | float | str,
    total_count: int,
    expire_time: datetime | None,
    note: str | None,
    price: Decimal | int | float | str = 0,
    ip_once: bool = False,
) -> list[FlowPointRedeemCode]:
    points = point_amount(points)
    price = point_amount(price)
    cleaned = []
    seen = set()
    for raw in codes:
        code = _normalize_redeem_code(raw)
        if not code or code in seen:
            continue
        cleaned.append(code)
        seen.add(code)
    if not cleaned:
        raise AppException("请提供要导入的兑换码")
    if len(cleaned) > 2000:
        raise AppException("单次导入最多 2000 个兑换码")
    if points <= 0:
        raise AppException("兑换点数必须大于 0")
    if price < 0:
        raise AppException("兑换码价格不能小于 0")
    if total_count <= 0:
        raise AppException("每个兑换码可兑换人数必须大于 0")
    existing = set(db.scalars(select(FlowPointRedeemCode.code).where(FlowPointRedeemCode.code.in_(cleaned))).all())
    batch_no = datetime.now().strftime("IMP%Y%m%d%H%M%S")
    items: list[FlowPointRedeemCode] = []
    for code in cleaned:
        if code in existing:
            continue
        item = FlowPointRedeemCode(
            code=code,
            batch_no=batch_no,
            points=points,
            price=price,
            total_count=total_count,
            used_count=0,
            ip_once=ip_once,
            expire_time=expire_time,
            status="active",
            created_by=admin_id,
            note=note,
        )
        db.add(item)
        items.append(item)
    if not items:
        raise AppException("导入的兑换码都已存在")
    db.commit()
    for item in items:
        db.refresh(item)
    return items
