from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success
from app.core.security import get_current_admin
from app.models.ai_task import AiTask
from app.models.ai_config import (
    AiModelConfig,
    FlowPointRedeemCode,
    FlowPointRedeemRecord,
    FlowPointRule,
    FlowPointTransaction,
    UserFeedback,
)
from app.models.announcement import Announcement
from app.models.export_record import ExportRecord
from app.models.resume import Resume, UploadedFile
from app.models.user import User
from app.schemas.announcement import AnnouncementStatusUpdate, AnnouncementWrite
from app.services.announcement_service import announcement_has_text, sanitize_announcement_html
from app.services.announcement_cache_service import announcement_cache_service
from app.services.ai_config_service import ensure_default_ai_config, invalidate_ai_config_cache
from app.services.ai.token_usage import normalize_token_usage
from app.services.app_settings_service import get_admin_settings, set_setting
from app.services.flow_points_service import (
    _normalize_redeem_code,
    add_point_transaction,
    ensure_default_point_rules,
    generate_redeem_codes,
    import_redeem_codes,
    invalidate_point_rule_cache,
    point_amount,
    point_number,
)
from app.services.email_service import send_feedback_result_email
from app.services.rich_text_service import sanitize_rich_text_html
from app.services.resume_starter_service import (
    admin_resume_starter_industries,
    create_admin_resume_starter,
    delete_admin_resume_starter,
    delete_industry_template_config,
    list_admin_resume_starters,
    list_industry_template_configs,
    save_industry_template_config,
    update_admin_resume_starter,
)
from app.services.template_service import _with_preview, ordered_template_records, update_template_display


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

GRANT_ALL_BATCH_PREFIX = "全员发放批次:"
GRANT_ALL_REVOKE_PREFIX = "撤回全员发放批次:"
OTHER_MODEL_FILTER_VALUE = "__other__"


def _grant_batch_no() -> str:
    return f"FG{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:6].upper()}"


def _batch_description(prefix: str, batch_no: str, description: str) -> str:
    return f"{prefix}{batch_no}｜{description}"[:255]


def _extract_batch_no(description: str | None, prefix: str = GRANT_ALL_BATCH_PREFIX) -> str | None:
    text = (description or "").strip()
    if not text.startswith(prefix):
        return None
    value = text[len(prefix):].split("｜", 1)[0].strip().upper()
    return value or None


def _configured_ai_model_names(db: Session) -> list[str]:
    names = {
        str(value).strip()
        for value in db.scalars(select(AiModelConfig.model))
        if str(value or "").strip()
    }
    return sorted(names)


def _ai_task_model_filter(db: Session, model: str | None):
    if not model:
        return None
    if model == OTHER_MODEL_FILTER_VALUE:
        configured_models = _configured_ai_model_names(db)
        other_condition = or_(AiTask.model_name.is_(None), AiTask.model_name == "")
        if configured_models:
            other_condition = or_(other_condition, AiTask.model_name.not_in(configured_models))
        return other_condition
    return AiTask.model_name == model


def _ai_model_config_lookups(
    db: Session,
) -> tuple[dict[int, AiModelConfig], dict[str, AiModelConfig]]:
    configs = list(db.scalars(select(AiModelConfig)))
    by_id = {item.id: item for item in configs}
    model_candidates: dict[str, list[AiModelConfig]] = {}
    for item in configs:
        raw_name = str(item.model or "").strip()
        if raw_name:
            model_candidates.setdefault(raw_name, []).append(item)
    by_unique_model = {
        raw_name: items[0]
        for raw_name, items in model_candidates.items()
        if len(items) == 1
    }
    return by_id, by_unique_model


def admin_task_model_info(
    task: AiTask | None,
    configs_by_id: dict[int, AiModelConfig] | None = None,
    configs_by_model: dict[str, AiModelConfig] | None = None,
) -> dict[str, str | None]:
    if not task:
        return {"model_name": None, "model_config_name": None, "model_raw_name": None}
    input_data = task.input_data or {}
    config_name = input_data.get("model_name")
    raw_name = input_data.get("model") or task.model_name
    config = None
    config_id = input_data.get("model_config_id")
    if configs_by_id and config_id is not None:
        try:
            config = configs_by_id.get(int(config_id))
        except (TypeError, ValueError):
            config = None
    if not config and configs_by_model and raw_name:
        config = configs_by_model.get(str(raw_name).strip())
    if not config_name and config:
        config_name = config.name
    if not raw_name and config:
        raw_name = config.model
    display_name = config_name or raw_name
    return {
        "model_name": str(display_name) if display_name else None,
        "model_config_name": str(config_name) if config_name else None,
        "model_raw_name": str(raw_name) if raw_name else None,
    }


class UserStateUpdate(BaseModel):
    status: Literal["active", "disabled"]


class UserPointsUpdate(BaseModel):
    points_delta: Decimal
    description: str = "管理员调整 Flow Points"


class UserPointsGrantAll(BaseModel):
    points: Decimal = Field(gt=0)
    description: str = "管理员统一发放 Flow Points"
    batch_size: int = Field(default=500, ge=1, le=2000)


class UserPointsGrantRevoke(BaseModel):
    description: str = "管理员撤回误发放 Flow Points"
    batch_size: int = Field(default=500, ge=1, le=2000)


class AiConfigWrite(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    provider: str = "openai-compatible"
    base_url: str
    api_key: str = ""
    model: str
    temperature: float = 0.2
    timeout: int = 60
    max_tokens: Optional[int] = None
    supports_multimodal: bool = False
    context_messages: int = Field(default=12, ge=1, le=40)
    is_chat_selectable: bool = True
    sort_order: int = Field(default=100, ge=0, le=9999)
    chat_points_per_call: Optional[Decimal] = Field(default=None, ge=0)
    chat_points_per_million_input_tokens: Optional[Decimal] = Field(default=None, ge=0)
    chat_points_per_million_output_tokens: Optional[Decimal] = Field(default=None, ge=0)
    is_active: bool = True


class PointRuleWrite(BaseModel):
    display_name: str
    points_per_call: Decimal = Field(ge=0)
    points_per_1k_tokens: Decimal = Field(default=Decimal("0.00"), ge=0)
    points_per_million_tokens: Decimal = Field(default=Decimal("0.00"), ge=0)
    points_per_million_input_tokens: Decimal = Field(default=Decimal("0.00"), ge=0)
    points_per_million_output_tokens: Decimal = Field(default=Decimal("0.00"), ge=0)
    enabled: bool = True


class RedeemCodeGenerateRequest(BaseModel):
    count: int = Field(default=1, ge=1, le=500)
    points: Decimal = Field(gt=0)
    price: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_count: int = Field(default=1, gt=0)
    ip_once: bool = False
    custom_codes: str = Field(default="", max_length=20000)
    expire_time: Optional[datetime] = None
    note: Optional[str] = None


class TemplateDisplayUpdate(BaseModel):
    sort_order: Optional[int] = Field(default=None, ge=1)
    is_visible: Optional[bool] = None


class IndustryTemplateWrite(BaseModel):
    default_template_id: str = Field(min_length=1, max_length=50)
    note: str = Field(default="", max_length=255)


class ResumeStarterWrite(BaseModel):
    starter_id: Optional[str] = Field(default=None, max_length=80)
    industry_id: str = Field(min_length=1, max_length=50)
    industry_name: str = Field(min_length=1, max_length=100)
    industry_description: str = Field(default="", max_length=255)
    role_title: str = Field(min_length=1, max_length=100)
    role_subtitle: str = Field(default="", max_length=120)
    default_template_id: str = Field(default="tech", min_length=1, max_length=50)
    keywords: list[str] = Field(default_factory=list)
    focus: list[str] = Field(default_factory=list)
    content: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = Field(default=1000, ge=0)
    is_visible: bool = True


class RedeemCodeStatusUpdate(BaseModel):
    status: Literal["active", "disabled"]


class RedeemCodeUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    points: Decimal = Field(gt=0)
    price: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_count: int = Field(gt=0)
    ip_once: bool = False
    expire_time: Optional[datetime] = None
    status: Literal["active", "disabled"] = "active"
    note: Optional[str] = Field(default=None, max_length=2000)


class RedeemCodeImportRequest(BaseModel):
    text: str
    points: Decimal = Field(gt=0)
    price: Decimal = Field(default=Decimal("0.00"), ge=0)
    total_count: int = Field(default=1, gt=0)
    ip_once: bool = False
    expire_time: Optional[datetime] = None
    note: Optional[str] = None


class RedeemCodeBatchPriceUpdate(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)
    batch_no: Optional[str] = Field(default=None, max_length=80)
    price: Decimal = Field(ge=0)


class AdminSettingsWrite(BaseModel):
    signup_gift_points: int = Field(default=0, ge=0)
    ai_records_hint: str = Field(default="", max_length=500)
    feedback_notify_email: str = Field(default="", max_length=200)
    redeem_daily_attempt_limit: int = Field(default=10, ge=0, le=1000)
    user_agreement: str = Field(default="", max_length=100000)


class FeedbackStatusUpdate(BaseModel):
    status: Literal["open", "processing", "resolved", "closed"]
    admin_note: Optional[str] = None
    admin_reply: Optional[str] = Field(default=None, max_length=500000)


def apply_feedback_update(item: UserFeedback, payload: FeedbackStatusUpdate) -> None:
    item.status = payload.status
    if payload.admin_note is not None:
        item.admin_note = payload.admin_note.strip()
    if payload.admin_reply is not None:
        item.admin_reply = payload.admin_reply.strip() or None
        item.reply_time = datetime.now() if item.admin_reply else None


def feedback_update_data(item: UserFeedback) -> dict:
    return {
        "id": item.id,
        "status": item.status,
        "admin_note": item.admin_note,
        "admin_reply": item.admin_reply,
        "reply_time": item.reply_time,
        "update_time": item.update_time,
    }


def announcement_data(item: Announcement) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "status": item.status,
        "read_count": item.read_count or 0,
        "created_by": item.created_by,
        "published_at": item.published_at,
        "create_time": item.create_time,
        "update_time": item.update_time,
    }


def redeem_code_data(item: FlowPointRedeemCode) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "batch_no": item.batch_no,
        "points": point_number(item.points),
        "price": point_number(getattr(item, "price", 0)),
        "total_count": item.total_count,
        "used_count": item.used_count,
        "ip_once": bool(item.ip_once),
        "expire_time": item.expire_time,
        "status": item.status,
        "note": item.note,
        "create_time": item.create_time,
        "update_time": item.update_time,
    }


@router.get("/announcements")
def announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(Announcement)
    count_query = select(func.count()).select_from(Announcement)
    filters = []
    if keyword.strip():
        filters.append(Announcement.title.like(f"%{keyword.strip()}%"))
    if status:
        filters.append(Announcement.status == status)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = db.scalar(count_query) or 0
    items = list(
        db.scalars(
            query.order_by(Announcement.create_time.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return success(page_data([announcement_data(item) for item in items], total, page, page_size))


@router.post("/announcements")
def create_announcement(
    payload: AnnouncementWrite,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not payload.title.strip():
        raise AppException("请填写公告标题")
    content = sanitize_announcement_html(payload.content)
    if not announcement_has_text(content):
        raise AppException("请填写公告内容")
    item = Announcement(
        title=payload.title.strip(),
        content=content,
        status=payload.status,
        created_by=admin.id,
        published_at=datetime.now() if payload.status == "published" else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    announcement_cache_service.invalidate()
    return success(announcement_data(item), "公告已创建")


@router.put("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: int,
    payload: AnnouncementWrite,
    db: Session = Depends(get_db),
):
    item = db.get(Announcement, announcement_id)
    if not item:
        raise AppException("公告不存在", 404)
    if not payload.title.strip():
        raise AppException("请填写公告标题")
    content = sanitize_announcement_html(payload.content)
    if not announcement_has_text(content):
        raise AppException("请填写公告内容")
    was_published = item.status == "published"
    item.title = payload.title.strip()
    item.content = content
    item.status = payload.status
    if payload.status == "published" and not was_published:
        item.published_at = datetime.now()
    elif payload.status == "draft":
        item.published_at = None
    db.commit()
    db.refresh(item)
    announcement_cache_service.invalidate()
    return success(announcement_data(item), "公告已更新")


@router.patch("/announcements/{announcement_id}/status")
def update_announcement_status(
    announcement_id: int,
    payload: AnnouncementStatusUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(Announcement, announcement_id)
    if not item:
        raise AppException("公告不存在", 404)
    item.status = payload.status
    item.published_at = datetime.now() if payload.status == "published" else None
    db.commit()
    db.refresh(item)
    announcement_cache_service.invalidate()
    return success(announcement_data(item), "公告状态已更新")


@router.delete("/announcements/{announcement_id}")
def delete_announcement(announcement_id: int, db: Session = Depends(get_db)):
    item = db.get(Announcement, announcement_id)
    if not item:
        raise AppException("公告不存在", 404)
    db.delete(item)
    db.commit()
    announcement_cache_service.invalidate()
    return success(True, "公告已删除")


def page_data(items: list[dict], total: int, page: int, page_size: int) -> dict:
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_resumes = db.scalar(select(func.count()).select_from(Resume)) or 0
    total_ai = db.scalar(select(func.count()).select_from(AiTask)) or 0
    total_exports = db.scalar(select(func.count()).select_from(ExportRecord)) or 0
    first_user_time = db.scalar(select(func.min(User.create_time)))
    operating_days = (today.date() - first_user_time.date()).days + 1 if first_user_time else 0
    ai_success = db.scalar(select(func.count()).select_from(AiTask).where(AiTask.status == "success")) or 0
    export_success = db.scalar(select(func.count()).select_from(ExportRecord).where(ExportRecord.status == "success")) or 0
    storage_bytes = db.scalar(select(func.coalesce(func.sum(UploadedFile.file_size), 0))) or 0
    redeem_revenue_expr = case(
        (FlowPointRedeemRecord.price > 0, FlowPointRedeemRecord.price),
        else_=func.coalesce(FlowPointRedeemCode.price, 0),
    )
    redeem_revenue_query = (
        select(func.coalesce(func.sum(redeem_revenue_expr), 0))
        .select_from(FlowPointRedeemRecord)
        .outerjoin(FlowPointRedeemCode, FlowPointRedeemCode.id == FlowPointRedeemRecord.code_id)
    )
    total_redeem_revenue = point_amount(db.scalar(redeem_revenue_query) or 0)
    today_redeem_revenue = point_amount(
        db.scalar(redeem_revenue_query.where(FlowPointRedeemRecord.create_time >= today)) or 0
    )
    total_points_consumed = point_amount(abs(
        db.scalar(
            select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0)).where(
                FlowPointTransaction.points_delta < 0
            )
        )
        or 0
    ))
    today_points_consumed = point_amount(abs(
        db.scalar(
            select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0)).where(
                FlowPointTransaction.points_delta < 0,
                FlowPointTransaction.create_time >= today,
            )
        )
        or 0
    ))
    total_points_recharged = point_amount(db.scalar(
        select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0)).where(
            FlowPointTransaction.points_delta > 0
        )
    ) or 0)
    active_user_ids: set[int] = set()
    active_user_ids.update(
        uid
        for uid in db.scalars(
            select(Resume.user_id).where(or_(Resume.create_time >= today, Resume.update_time >= today))
        ).all()
        if uid
    )
    active_user_ids.update(uid for uid in db.scalars(select(AiTask.user_id).where(AiTask.create_time >= today)).all() if uid)
    active_user_ids.update(uid for uid in db.scalars(select(ExportRecord.user_id).where(ExportRecord.create_time >= today)).all() if uid)
    breakdown_rows = db.execute(
        select(
            AiTask.task_type,
            func.count(AiTask.id),
            func.sum(case((AiTask.status == "success", 1), else_=0)),
            func.sum(case((AiTask.status == "failed", 1), else_=0)),
        ).group_by(AiTask.task_type)
    ).all()
    token_rows = db.execute(
        select(
            AiTask.task_type,
            AiTask.create_time,
            AiTask.tokens_used,
            AiTask.input_data,
            AiTask.model_name,
            AiTask.points_used,
        )
    ).all()
    token_summary = {"total": 0, "today": 0, "input": 0, "output": 0}
    token_by_type: dict[str, dict[str, int]] = {}
    model_map: dict[str, dict[str, object]] = {}
    configured_models = list(
        db.scalars(
            select(AiModelConfig).order_by(
                AiModelConfig.sort_order.asc(),
                AiModelConfig.id.asc(),
            )
        )
    )
    for config in configured_models:
        model_name = str(config.model or "").strip()
        if not model_name:
            continue
        model_item = model_map.setdefault(
            model_name,
            {
                "model_name": model_name,
                "model_raw_name": model_name,
                "config_names": set(),
                "total": 0,
                "tokens": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "points_used": Decimal("0.00"),
            },
        )
        if config.name and str(config.name) != model_name:
            model_item["config_names"].add(str(config.name))
    for task_type, create_time, fallback_tokens, input_data, raw_model_name, points_used in token_rows:
        usage = normalize_token_usage(input_data, fallback_tokens or 0)
        item = token_by_type.setdefault(str(task_type), {"total": 0, "input": 0, "output": 0})
        item["total"] += int(usage["total_tokens"])
        item["input"] += int(usage["input_tokens"])
        item["output"] += int(usage["output_tokens"])
        token_summary["total"] += int(usage["total_tokens"])
        token_summary["input"] += int(usage["input_tokens"])
        token_summary["output"] += int(usage["output_tokens"])
        if create_time and create_time >= today:
            token_summary["today"] += int(usage["total_tokens"])
        input_data = input_data or {}
        config_name = input_data.get("model_name")
        if not raw_model_name and not config_name:
            continue
        model_name = str(raw_model_name or config_name)
        model_key = model_name
        model_item = model_map.setdefault(
            model_key,
            {
                "model_name": model_name,
                "model_raw_name": str(raw_model_name) if raw_model_name else "",
                "config_names": set(),
                "total": 0,
                "tokens": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "points_used": Decimal("0.00"),
            },
        )
        if config_name and str(config_name) != model_name:
            model_item["config_names"].add(str(config_name))
        model_item["total"] = int(model_item["total"]) + 1
        model_item["tokens"] = int(model_item["tokens"]) + int(usage["total_tokens"])
        model_item["input_tokens"] = int(model_item["input_tokens"]) + int(usage["input_tokens"])
        model_item["output_tokens"] = int(model_item["output_tokens"]) + int(usage["output_tokens"])
        model_item["points_used"] = point_amount(model_item["points_used"]) + point_amount(points_used or 0)
    ai_breakdown = [
        {
            "task_type": task_type,
            "total": int(total),
            "success": int(success_count or 0),
            "failed": int(failed_count or 0),
            "tokens": token_by_type.get(str(task_type), {}).get("total", 0),
            "input_tokens": token_by_type.get(str(task_type), {}).get("input", 0),
            "output_tokens": token_by_type.get(str(task_type), {}).get("output", 0),
        }
        for task_type, total, success_count, failed_count in breakdown_rows
    ]
    section_rows = db.execute(
        select(AiTask.input_data, AiTask.status).where(AiTask.task_type == "section_optimize")
    ).all()
    built_in_sections = {"basics", "summary", "education", "skills", "work", "projects", "awards"}
    section_map: dict[str, dict[str, int]] = {}
    for input_data, task_status in section_rows:
        section_type = str((input_data or {}).get("section_type") or "unknown")
        if section_type not in built_in_sections:
            section_type = "custom"
        item = section_map.setdefault(section_type, {"total": 0, "success": 0, "failed": 0})
        item["total"] += 1
        if task_status in {"success", "failed"}:
            item[task_status] += 1

    daily = []
    start_day = today - timedelta(days=6)
    end_day = today + timedelta(days=1)
    hourly_user_ids: list[set[int]] = [set() for _ in range(24)]
    hourly_actions = [0 for _ in range(24)]

    def add_hourly_activity(user_id: int | None, create_time: datetime | None) -> None:
        if not user_id or not create_time or create_time < start_day or create_time >= end_day:
            return
        hour = create_time.hour
        hourly_user_ids[hour].add(int(user_id))
        hourly_actions[hour] += 1

    resume_activity_rows = db.execute(
        select(Resume.user_id, Resume.create_time, Resume.update_time).where(
            or_(
                Resume.create_time >= start_day,
                Resume.update_time >= start_day,
            )
        )
    ).all()
    for user_id, create_time, update_time in resume_activity_rows:
        add_hourly_activity(user_id, create_time)
        if update_time != create_time:
            add_hourly_activity(user_id, update_time)

    for user_id, create_time in db.execute(
        select(AiTask.user_id, AiTask.create_time).where(AiTask.create_time >= start_day)
    ).all():
        add_hourly_activity(user_id, create_time)

    for user_id, create_time in db.execute(
        select(ExportRecord.user_id, ExportRecord.create_time).where(ExportRecord.create_time >= start_day)
    ).all():
        add_hourly_activity(user_id, create_time)

    for user_id, share_created_time in db.execute(
        select(Resume.user_id, Resume.share_created_time).where(Resume.share_created_time >= start_day)
    ).all():
        add_hourly_activity(user_id, share_created_time)

    hourly_activity = [
        {
            "hour": hour,
            "label": f"{hour:02d}:00",
            "active_users": len(user_ids),
            "actions": hourly_actions[hour],
        }
        for hour, user_ids in enumerate(hourly_user_ids)
    ]

    for offset in range(7):
        day = start_day + timedelta(days=offset)
        next_day = day + timedelta(days=1)
        daily.append(
            {
                "date": day.strftime("%m-%d"),
                "users": db.scalar(select(func.count()).select_from(User).where(User.create_time >= day, User.create_time < next_day)) or 0,
                "resumes": db.scalar(select(func.count()).select_from(Resume).where(Resume.create_time >= day, Resume.create_time < next_day)) or 0,
                "ai_tasks": db.scalar(select(func.count()).select_from(AiTask).where(AiTask.create_time >= day, AiTask.create_time < next_day)) or 0,
                "exports": db.scalar(select(func.count()).select_from(ExportRecord).where(ExportRecord.create_time >= day, ExportRecord.create_time < next_day)) or 0,
                "shares": db.scalar(select(func.count()).select_from(Resume).where(Resume.share_created_time >= day, Resume.share_created_time < next_day)) or 0,
                "tokens": sum(
                    int(normalize_token_usage(input_data, fallback_tokens or 0)["total_tokens"])
                    for _, create_time, fallback_tokens, input_data, _, _ in token_rows
                    if create_time and day <= create_time < next_day
                ),
                "points_consumed": point_number(abs(
                    db.scalar(
                        select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0)).where(
                            FlowPointTransaction.points_delta < 0,
                            FlowPointTransaction.create_time >= day,
                            FlowPointTransaction.create_time < next_day,
                        )
                    )
                    or 0
                )),
            }
        )

    return success(
        {
            "totals": {
                "users": total_users,
                "resumes": total_resumes,
                "ai_tasks": total_ai,
                "exports": total_exports,
                "storage_bytes": int(storage_bytes),
                "operating_days": operating_days,
                "launch_date": first_user_time.date().isoformat() if first_user_time else None,
            },
            "today": {
                "users": db.scalar(select(func.count()).select_from(User).where(User.create_time >= today)) or 0,
                "active_users": len(active_user_ids),
                "resumes": db.scalar(select(func.count()).select_from(Resume).where(Resume.create_time >= today)) or 0,
                "ai_tasks": db.scalar(select(func.count()).select_from(AiTask).where(AiTask.create_time >= today)) or 0,
                "exports": db.scalar(select(func.count()).select_from(ExportRecord).where(ExportRecord.create_time >= today)) or 0,
            },
            "rates": {
                "ai_success": round(ai_success * 100 / total_ai, 1) if total_ai else 0,
                "export_success": round(export_success * 100 / total_exports, 1) if total_exports else 0,
            },
            "tokens": {
                **token_summary,
                "avg_per_task": round(token_summary["total"] / total_ai, 1) if total_ai else 0,
            },
            "points": {
                "consumed": point_number(total_points_consumed),
                "today_consumed": point_number(today_points_consumed),
                "recharged": point_number(total_points_recharged),
            },
            "revenue": {
                "redeemed": point_number(total_redeem_revenue),
                "today_redeemed": point_number(today_redeem_revenue),
            },
            "ai_breakdown": ai_breakdown,
            "model_breakdown": [
                {
                    **{key: value for key, value in item.items() if key not in {"points_used", "config_names"}},
                    "config_names": sorted(item.get("config_names") or []),
                    "points_used": point_number(item["points_used"]),
                }
                for item in sorted(
                    model_map.values(),
                    key=lambda value: (
                        point_amount(value["points_used"]),
                        int(value["tokens"]),
                        int(value["total"]),
                    ),
                    reverse=True,
                )
            ],
            "section_breakdown": [
                {"section_type": section_type, **counts} for section_type, counts in section_map.items()
            ],
            "daily": daily,
            "hourly_activity": hourly_activity,
        }
    )


@router.get("/settings")
def admin_settings(db: Session = Depends(get_db)):
    return success(get_admin_settings(db))


@router.put("/settings")
def update_admin_settings(payload: AdminSettingsWrite, db: Session = Depends(get_db)):
    set_setting(db, "signup_gift_points", str(payload.signup_gift_points), "新注册用户赠送 Flow Points")
    set_setting(db, "ai_records_hint", payload.ai_records_hint.strip(), "AI 记录页余额提示")
    set_setting(db, "feedback_notify_email", payload.feedback_notify_email.strip(), "用户反馈通知邮箱")
    set_setting(
        db,
        "redeem_daily_attempt_limit",
        str(payload.redeem_daily_attempt_limit),
        "每个用户每天最多尝试兑换码次数，0 表示不限制",
    )
    set_setting(db, "user_agreement", payload.user_agreement.strip(), "用户协议与隐私政策")
    return success(get_admin_settings(db), "系统设置已更新")


@router.get("/feedbacks")
def feedbacks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(UserFeedback, User.username, User.email).join(User, User.id == UserFeedback.user_id)
    count_query = select(func.count()).select_from(UserFeedback)
    if status:
        query = query.where(UserFeedback.status == status)
        count_query = count_query.where(UserFeedback.status == status)
    total = db.scalar(count_query) or 0
    rows = db.execute(
        query.order_by(UserFeedback.create_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "username": username,
            "email": email,
            "category": item.category,
            "content": sanitize_rich_text_html(item.content, allow_images=True),
            "contact": item.contact,
            "status": item.status,
            "admin_note": item.admin_note,
            "admin_reply": item.admin_reply,
            "reply_time": item.reply_time,
            "create_time": item.create_time,
            "update_time": item.update_time,
        }
        for item, username, email in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.patch("/feedbacks/{feedback_id}")
def update_feedback(feedback_id: int, payload: FeedbackStatusUpdate, db: Session = Depends(get_db)):
    item = db.get(UserFeedback, feedback_id)
    if not item:
        raise AppException("反馈不存在", 404)
    apply_feedback_update(item, payload)
    db.add(item)
    db.commit()
    db.refresh(item)
    return success(feedback_update_data(item), "反馈状态已更新")


@router.post("/feedbacks/{feedback_id}/send-email")
def send_feedback_email(feedback_id: int, payload: FeedbackStatusUpdate, db: Session = Depends(get_db)):
    item = db.get(UserFeedback, feedback_id)
    if not item:
        raise AppException("反馈不存在", 404)
    user = db.get(User, item.user_id)
    if not user:
        raise AppException("反馈用户不存在", 404)
    apply_feedback_update(item, payload)
    if not item.admin_reply:
        raise AppException("请先填写用户可见回复")
    db.add(item)
    db.commit()
    db.refresh(item)
    send_feedback_result_email(user.email, item, user)
    data = feedback_update_data(item)
    data["email_sent"] = True
    return success(data, "处理结果邮件已发送")


@router.post("/users/flow-points/grant-all")
def grant_all_users_flow_points(
    payload: UserPointsGrantAll,
    db: Session = Depends(get_db),
):
    points = point_amount(payload.points)
    description = payload.description.strip() or "管理员统一发放 Flow Points"
    batch_no = _grant_batch_no()
    transaction_description = _batch_description(GRANT_ALL_BATCH_PREFIX, batch_no, description)
    total_count = 0
    batch_count = 0
    last_user_id = 0
    max_user_id = int(db.scalar(select(func.coalesce(func.max(User.id), 0)).where(User.status == "active")) or 0)

    while True:
        users = list(
            db.scalars(
                select(User)
                .where(User.status == "active", User.id > last_user_id, User.id <= max_user_id)
                .order_by(User.id.asc())
                .limit(payload.batch_size)
            )
        )
        if not users:
            break

        batch_count += 1
        for user in users:
            user.flow_points = point_amount(point_amount(user.flow_points) + points)
            db.add(user)
            db.add(
                FlowPointTransaction(
                    user_id=user.id,
                    feature_type="admin_grant_all",
                    points_delta=points,
                    balance_after=user.flow_points,
                    tokens_used=0,
                    description=transaction_description,
                )
            )

        total_count += len(users)
        last_user_id = int(users[-1].id)
        db.commit()
        db.expunge_all()

    return success(
        {
            "count": total_count,
            "points": point_number(points),
            "batch_size": payload.batch_size,
            "batches": batch_count,
            "batch_no": batch_no,
        },
        "Flow Points 已分批发放",
    )


@router.post("/users/flow-points/grant-all/{batch_no}/revoke")
def revoke_all_users_flow_points_grant(
    batch_no: str,
    payload: UserPointsGrantRevoke,
    db: Session = Depends(get_db),
):
    batch_no = batch_no.strip().upper()
    if not batch_no:
        raise AppException("发放批次不存在", 404)
    grant_prefix = f"{GRANT_ALL_BATCH_PREFIX}{batch_no}｜"
    revoke_prefix = f"{GRANT_ALL_REVOKE_PREFIX}{batch_no}｜"
    grant_exists = db.scalar(
        select(FlowPointTransaction.id)
        .where(
            FlowPointTransaction.feature_type == "admin_grant_all",
            FlowPointTransaction.points_delta > 0,
            FlowPointTransaction.description.like(f"{grant_prefix}%"),
        )
        .limit(1)
    )
    if not grant_exists:
        raise AppException("没有找到可撤回的全员发放批次", 404)
    revoked_exists = db.scalar(
        select(FlowPointTransaction.id)
        .where(
            FlowPointTransaction.feature_type == "admin_grant_all_revoke",
            FlowPointTransaction.description.like(f"{revoke_prefix}%"),
        )
        .limit(1)
    )
    if revoked_exists:
        raise AppException("该全员发放批次已经撤回，不能重复撤回")

    description = payload.description.strip() or "管理员撤回误发放 Flow Points"
    transaction_description = _batch_description(GRANT_ALL_REVOKE_PREFIX, batch_no, description)
    total_count = 0
    batch_count = 0
    last_transaction_id = 0

    while True:
        grant_transactions = list(
            db.scalars(
                select(FlowPointTransaction)
                .where(
                    FlowPointTransaction.feature_type == "admin_grant_all",
                    FlowPointTransaction.points_delta > 0,
                    FlowPointTransaction.description.like(f"{grant_prefix}%"),
                    FlowPointTransaction.id > last_transaction_id,
                )
                .order_by(FlowPointTransaction.id.asc())
                .limit(payload.batch_size)
            )
        )
        if not grant_transactions:
            break

        users = {
            user.id: user
            for user in db.scalars(
                select(User).where(User.id.in_([item.user_id for item in grant_transactions]))
            )
        }
        batch_count += 1
        for grant_transaction in grant_transactions:
            user = users.get(grant_transaction.user_id)
            if not user:
                continue
            revoke_points = point_amount(grant_transaction.points_delta)
            user.flow_points = max(point_amount(point_amount(user.flow_points) - revoke_points), Decimal("0.00"))
            db.add(user)
            db.add(
                FlowPointTransaction(
                    user_id=user.id,
                    feature_type="admin_grant_all_revoke",
                    points_delta=-revoke_points,
                    balance_after=user.flow_points,
                    tokens_used=0,
                    description=transaction_description,
                )
            )
            total_count += 1

        last_transaction_id = int(grant_transactions[-1].id)
        db.commit()
        db.expunge_all()

    return success(
        {
            "count": total_count,
            "batch_size": payload.batch_size,
            "batches": batch_count,
            "batch_no": batch_no,
        },
        "全员发放批次已撤回",
    )


@router.get("/flow-point-transactions")
def flow_point_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    direction: Optional[Literal["consume", "recharge"]] = None,
    feature_type: Optional[str] = None,
    model: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = select(FlowPointTransaction, User.username, User.email, AiTask).join(
        User, User.id == FlowPointTransaction.user_id
    ).outerjoin(
        AiTask, AiTask.id == FlowPointTransaction.task_id
    )
    count_query = select(func.count()).select_from(FlowPointTransaction).join(
        User, User.id == FlowPointTransaction.user_id
    ).outerjoin(
        AiTask, AiTask.id == FlowPointTransaction.task_id
    )
    filters = []
    if keyword.strip():
        pattern = f"%{keyword.strip()}%"
        filters.append(
            or_(
                User.username.like(pattern),
                User.email.like(pattern),
                FlowPointTransaction.description.like(pattern),
            )
        )
    if direction == "consume":
        filters.append(FlowPointTransaction.points_delta < 0)
    if direction == "recharge":
        filters.append(FlowPointTransaction.points_delta > 0)
    if feature_type:
        filters.append(FlowPointTransaction.feature_type == feature_type)
    model_filter = _ai_task_model_filter(db, model)
    if model_filter is not None:
        filters.append(AiTask.id.is_not(None))
        filters.append(model_filter)
    if user_id:
        filters.append(FlowPointTransaction.user_id == user_id)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = db.scalar(count_query) or 0
    rows = db.execute(
        query.order_by(FlowPointTransaction.create_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    configs_by_id, configs_by_model = _ai_model_config_lookups(db)
    grant_batch_nos = {
        batch_no
        for item, *_ in rows
        if item.feature_type == "admin_grant_all" and item.points_delta > 0
        for batch_no in [_extract_batch_no(item.description)]
        if batch_no
    }
    revoked_batch_nos: set[str] = set()
    if grant_batch_nos:
        revoke_filters = [
            FlowPointTransaction.description.like(f"{GRANT_ALL_REVOKE_PREFIX}{batch_no}｜%")
            for batch_no in grant_batch_nos
        ]
        revoked_descriptions = db.scalars(
            select(FlowPointTransaction.description).where(
                FlowPointTransaction.feature_type == "admin_grant_all_revoke",
                or_(*revoke_filters),
            )
        )
        revoked_batch_nos = {
            batch_no
            for description in revoked_descriptions
            for batch_no in [_extract_batch_no(description, GRANT_ALL_REVOKE_PREFIX)]
            if batch_no
        }
    feature_names = {
        "generate_resume": "AI 智能生成",
        "import_resume": "导入简历",
        "section_optimize": "AI 润色",
        "ai_chat": "AI 助手",
        "resume_score": "智能诊断",
        "jd_optimize": "JD 优化",
        "resume_translate": "简历翻译",
        "redeem": "兑换码充值",
        "admin_adjust": "管理员调整",
        "admin_grant_all": "全员发放",
        "admin_grant_all_revoke": "全员发放撤回",
        "signup_gift": "注册赠送",
    }
    items = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "username": username,
            "email": email,
            "feature_type": item.feature_type,
            "feature_name": feature_names.get(item.feature_type, item.feature_type),
            "points_delta": point_number(item.points_delta),
            "balance_after": point_number(item.balance_after),
            "tokens_used": item.tokens_used or 0,
            **admin_task_model_info(task, configs_by_id, configs_by_model),
            "description": item.description or "",
            "grant_batch_no": _extract_batch_no(item.description, GRANT_ALL_BATCH_PREFIX)
            or _extract_batch_no(item.description, GRANT_ALL_REVOKE_PREFIX),
            "can_revoke": (
                item.feature_type == "admin_grant_all"
                and item.points_delta > 0
                and (batch_no := _extract_batch_no(item.description)) is not None
                and batch_no not in revoked_batch_nos
            ),
            "task_id": item.task_id,
            "direction": "recharge" if item.points_delta > 0 else "consume",
            "create_time": item.create_time,
        }
        for item, username, email, task in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.get("/users")
def users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    status: Optional[str] = None,
    sort_by: str = Query("create_time"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    db: Session = Depends(get_db),
):
    resume_count = select(Resume.user_id, func.count(Resume.id).label("resume_count")).group_by(Resume.user_id).subquery()
    query = select(User, func.coalesce(resume_count.c.resume_count, 0)).outerjoin(resume_count, resume_count.c.user_id == User.id)
    count_query = select(func.count()).select_from(User)
    filters = []
    if keyword.strip():
        pattern = f"%{keyword.strip()}%"
        filters.append(or_(User.username.like(pattern), User.email.like(pattern)))
    if status:
        filters.append(User.status == status)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = db.scalar(count_query) or 0
    sort_columns = {
        "username": User.username,
        "email": User.email,
        "role": User.role,
        "resume_count": func.coalesce(resume_count.c.resume_count, 0),
        "flow_points": User.flow_points,
        "status": User.status,
        "create_time": User.create_time,
    }
    sort_column = sort_columns.get(sort_by, User.create_time)
    order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()
    rows = db.execute(
        query.order_by(order_expr, User.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    items = [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "role": user.role,
            "status": user.status,
            "flow_points": point_number(user.flow_points),
            "resume_count": int(count),
            "create_time": user.create_time,
        }
        for user, count in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStateUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise AppException("用户不存在", 404)
    if user.id == admin.id:
        raise AppException("不能停用当前管理员账号")
    if user.role == "admin":
        raise AppException("不能在此停用其他管理员")
    user.status = payload.status
    db.commit()
    return success({"id": user.id, "status": user.status}, "用户状态已更新")


@router.patch("/users/{user_id}/flow-points")
def update_user_flow_points(
    user_id: int,
    payload: UserPointsUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise AppException("用户不存在", 404)
    if payload.points_delta == 0:
        raise AppException("调整点数不能为 0")
    add_point_transaction(
        db,
        user,
        "admin_adjust",
        payload.points_delta,
        payload.description.strip() or "管理员调整 Flow Points",
    )
    db.commit()
    db.refresh(user)
    return success({"id": user.id, "flow_points": point_number(user.flow_points)}, "Flow Points 已调整")


@router.get("/resumes")
def resumes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    db: Session = Depends(get_db),
):
    query = select(Resume, User.username, User.email).join(User, User.id == Resume.user_id)
    count_query = select(func.count()).select_from(Resume)
    if keyword.strip():
        pattern = f"%{keyword.strip()}%"
        condition = or_(Resume.title.like(pattern), User.username.like(pattern), User.email.like(pattern))
        query = query.where(condition)
        count_query = count_query.join(User, User.id == Resume.user_id).where(condition)
    total = db.scalar(count_query) or 0
    rows = db.execute(query.order_by(Resume.update_time.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {
            "id": resume.id,
            "title": resume.title,
            "user_id": resume.user_id,
            "username": username,
            "email": email,
            "language": resume.language,
            "template_id": resume.template_id,
            "create_time": resume.create_time,
            "update_time": resume.update_time,
        }
        for resume, username, email in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.get("/ai-tasks")
def ai_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    model: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(AiTask, User.username).join(User, User.id == AiTask.user_id)
    count_query = select(func.count()).select_from(AiTask)
    if status:
        query = query.where(AiTask.status == status)
        count_query = count_query.where(AiTask.status == status)
    if task_type:
        query = query.where(AiTask.task_type == task_type)
        count_query = count_query.where(AiTask.task_type == task_type)
    model_filter = _ai_task_model_filter(db, model)
    if model_filter is not None:
        query = query.where(model_filter)
        count_query = count_query.where(model_filter)
    total = db.scalar(count_query) or 0
    rows = db.execute(query.order_by(AiTask.create_time.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    configs_by_id, configs_by_model = _ai_model_config_lookups(db)
    items = [
        {
            "id": task.id,
            "user_id": task.user_id,
            "username": username,
            "resume_id": task.resume_id,
            "task_type": task.task_type,
            "status": task.status,
            **admin_task_model_info(task, configs_by_id, configs_by_model),
            "points_used": point_number(task.points_used),
            "tokens_used": task.tokens_used,
            "error_message": task.error_message,
            "input_data": {
                **(task.input_data or {}),
                "token_usage": normalize_token_usage(task.input_data or {}, task.tokens_used or 0),
            },
            "output_data": task.output_data or {},
            "create_time": task.create_time,
            "update_time": task.update_time,
        }
        for task, username in rows
    ]
    return success(page_data(items, total, page, page_size))


def ai_config_data(item: AiModelConfig) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "provider": item.provider,
        "base_url": item.base_url,
        "model": item.model,
        "temperature": item.temperature,
        "timeout": item.timeout,
        "max_tokens": item.max_tokens,
        "supports_multimodal": item.supports_multimodal,
        "context_messages": item.context_messages,
        "is_chat_selectable": bool(getattr(item, "is_chat_selectable", True)),
        "sort_order": int(getattr(item, "sort_order", 100) or 100),
        "chat_points_per_call": point_number(item.chat_points_per_call) if item.chat_points_per_call is not None else None,
        "chat_points_per_million_input_tokens": point_number(item.chat_points_per_million_input_tokens) if item.chat_points_per_million_input_tokens is not None else None,
        "chat_points_per_million_output_tokens": point_number(item.chat_points_per_million_output_tokens) if item.chat_points_per_million_output_tokens is not None else None,
        "is_active": item.is_active,
        "has_api_key": bool(item.api_key),
        "create_time": item.create_time,
        "update_time": item.update_time,
    }


@router.get("/ai-configs")
def ai_configs(db: Session = Depends(get_db)):
    ensure_default_ai_config(db)
    items = list(
        db.scalars(
            select(AiModelConfig).order_by(
                AiModelConfig.sort_order.asc(),
                AiModelConfig.is_active.desc(),
                AiModelConfig.update_time.desc(),
                AiModelConfig.id.desc(),
            )
        )
    )
    return success([ai_config_data(item) for item in items])


@router.post("/ai-configs")
def create_ai_config(payload: AiConfigWrite, db: Session = Depends(get_db)):
    if not payload.api_key.strip():
        raise AppException("请填写 API Key")
    if payload.is_active:
        db.query(AiModelConfig).update({AiModelConfig.is_active: False})
    item = AiModelConfig(
        name=payload.name.strip(),
        provider=payload.provider.strip() or "openai-compatible",
        base_url=payload.base_url.strip(),
        api_key=payload.api_key.strip(),
        model=payload.model.strip(),
        temperature=payload.temperature,
        timeout=payload.timeout,
        max_tokens=payload.max_tokens,
        supports_multimodal=payload.supports_multimodal,
        context_messages=payload.context_messages,
        is_chat_selectable=payload.is_chat_selectable,
        sort_order=payload.sort_order,
        chat_points_per_call=point_amount(payload.chat_points_per_call) if payload.chat_points_per_call is not None else None,
        chat_points_per_million_input_tokens=point_amount(payload.chat_points_per_million_input_tokens) if payload.chat_points_per_million_input_tokens is not None else None,
        chat_points_per_million_output_tokens=point_amount(payload.chat_points_per_million_output_tokens) if payload.chat_points_per_million_output_tokens is not None else None,
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    invalidate_ai_config_cache()
    return success(ai_config_data(item), "AI 模型配置已创建")


@router.put("/ai-configs/{config_id}")
def update_ai_config(config_id: int, payload: AiConfigWrite, db: Session = Depends(get_db)):
    item = db.get(AiModelConfig, config_id)
    if not item:
        raise AppException("模型配置不存在", 404)
    if payload.is_active:
        db.query(AiModelConfig).filter(AiModelConfig.id != item.id).update({AiModelConfig.is_active: False})
    item.name = payload.name.strip()
    item.provider = payload.provider.strip() or "openai-compatible"
    item.base_url = payload.base_url.strip()
    if payload.api_key.strip():
        item.api_key = payload.api_key.strip()
    item.model = payload.model.strip()
    item.temperature = payload.temperature
    item.timeout = payload.timeout
    item.max_tokens = payload.max_tokens
    item.supports_multimodal = payload.supports_multimodal
    item.context_messages = payload.context_messages
    item.is_chat_selectable = payload.is_chat_selectable
    item.sort_order = payload.sort_order
    item.chat_points_per_call = point_amount(payload.chat_points_per_call) if payload.chat_points_per_call is not None else None
    item.chat_points_per_million_input_tokens = point_amount(payload.chat_points_per_million_input_tokens) if payload.chat_points_per_million_input_tokens is not None else None
    item.chat_points_per_million_output_tokens = point_amount(payload.chat_points_per_million_output_tokens) if payload.chat_points_per_million_output_tokens is not None else None
    item.is_active = payload.is_active
    db.add(item)
    db.commit()
    db.refresh(item)
    invalidate_ai_config_cache()
    return success(ai_config_data(item), "AI 模型配置已更新")


@router.delete("/ai-configs/{config_id}")
def delete_ai_config(config_id: int, db: Session = Depends(get_db)):
    item = db.get(AiModelConfig, config_id)
    if not item:
        raise AppException("模型配置不存在", 404)
    if item.is_active:
        raise AppException("不能删除正在使用的模型配置")
    db.delete(item)
    db.commit()
    invalidate_ai_config_cache()
    return success(True, "AI 模型配置已删除")


@router.get("/point-rules")
def point_rules(db: Session = Depends(get_db)):
    ensure_default_point_rules(db)
    items = list(db.scalars(select(FlowPointRule).order_by(FlowPointRule.id.asc())))
    return success(
        [
            {
                "id": item.id,
                "feature_type": item.feature_type,
                "display_name": item.display_name,
                "points_per_call": point_number(item.points_per_call),
                "points_per_1k_tokens": point_number(item.points_per_1k_tokens),
                "points_per_million_tokens": point_number(item.points_per_million_tokens),
                "points_per_million_input_tokens": point_number(item.points_per_million_input_tokens),
                "points_per_million_output_tokens": point_number(item.points_per_million_output_tokens),
                "enabled": item.enabled,
                "update_time": item.update_time,
            }
            for item in items
        ]
    )


@router.put("/point-rules/{feature_type}")
def update_point_rule(feature_type: str, payload: PointRuleWrite, db: Session = Depends(get_db)):
    ensure_default_point_rules(db)
    item = db.scalar(select(FlowPointRule).where(FlowPointRule.feature_type == feature_type))
    if not item:
        raise AppException("点数规则不存在", 404)
    item.display_name = payload.display_name.strip() or item.display_name
    item.points_per_call = point_amount(payload.points_per_call)
    item.points_per_1k_tokens = point_amount(0)
    input_rate = point_amount(payload.points_per_million_input_tokens)
    output_rate = point_amount(payload.points_per_million_output_tokens)
    if not input_rate and not output_rate and payload.points_per_million_tokens:
        input_rate = point_amount(payload.points_per_million_tokens)
        output_rate = point_amount(payload.points_per_million_tokens)
    item.points_per_million_input_tokens = input_rate
    item.points_per_million_output_tokens = output_rate
    item.points_per_million_tokens = max(input_rate, output_rate)
    item.enabled = payload.enabled
    db.add(item)
    db.commit()
    db.refresh(item)
    invalidate_point_rule_cache(feature_type)
    return success(
        {
            "feature_type": item.feature_type,
            "display_name": item.display_name,
            "points_per_call": point_number(item.points_per_call),
            "points_per_1k_tokens": point_number(item.points_per_1k_tokens),
            "points_per_million_tokens": point_number(item.points_per_million_tokens),
            "points_per_million_input_tokens": point_number(item.points_per_million_input_tokens),
            "points_per_million_output_tokens": point_number(item.points_per_million_output_tokens),
            "enabled": item.enabled,
        },
        "点数规则已更新",
    )


@router.get("/redeem-codes")
def redeem_codes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    points: Optional[Decimal] = Query(None, gt=0),
    keyword: str = "",
    db: Session = Depends(get_db),
):
    query = select(FlowPointRedeemCode)
    count_query = select(func.count()).select_from(FlowPointRedeemCode)
    if status == "used":
        query = query.where(FlowPointRedeemCode.used_count >= FlowPointRedeemCode.total_count)
        count_query = count_query.where(FlowPointRedeemCode.used_count >= FlowPointRedeemCode.total_count)
    elif status:
        query = query.where(FlowPointRedeemCode.status == status)
        count_query = count_query.where(FlowPointRedeemCode.status == status)
    if points is not None:
        query = query.where(FlowPointRedeemCode.points == point_amount(points))
        count_query = count_query.where(FlowPointRedeemCode.points == point_amount(points))
    if keyword.strip():
        like = f"%{keyword.strip().upper()}%"
        query = query.where(FlowPointRedeemCode.code.like(like))
        count_query = count_query.where(FlowPointRedeemCode.code.like(like))
    total = db.scalar(count_query) or 0
    rows = list(
        db.scalars(
            query.order_by(FlowPointRedeemCode.create_time.desc(), FlowPointRedeemCode.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    items = [redeem_code_data(item) for item in rows]
    return success(page_data(items, total, page, page_size))


@router.get("/redeem-codes/export")
def export_redeem_codes(
    status: Optional[str] = None,
    points: Optional[Decimal] = Query(None, gt=0),
    keyword: str = "",
    db: Session = Depends(get_db),
):
    query = select(FlowPointRedeemCode)
    if status == "used":
        query = query.where(FlowPointRedeemCode.used_count >= FlowPointRedeemCode.total_count)
    elif status:
        query = query.where(FlowPointRedeemCode.status == status)
    if points is not None:
        query = query.where(FlowPointRedeemCode.points == point_amount(points))
    if keyword.strip():
        query = query.where(FlowPointRedeemCode.code.like(f"%{keyword.strip().upper()}%"))
    items = list(db.scalars(query.order_by(FlowPointRedeemCode.create_time.desc(), FlowPointRedeemCode.id.desc())))
    text = "\n".join(item.code for item in items)
    headers = {"Content-Disposition": 'attachment; filename="flow-point-codes.txt"'}
    return PlainTextResponse(text, media_type="text/plain; charset=utf-8", headers=headers)


@router.post("/redeem-codes/import")
def import_redeem_code_text(
    payload: RedeemCodeImportRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    items = import_redeem_codes(
        db,
        admin_id=admin.id,
        codes=payload.text.splitlines(),
        points=payload.points,
        total_count=payload.total_count,
        ip_once=payload.ip_once,
        expire_time=payload.expire_time,
        note=payload.note,
        price=payload.price,
    )
    return success(
        [redeem_code_data(item) for item in items],
        f"已导入 {len(items)} 个兑换码",
    )


@router.post("/redeem-codes")
def create_redeem_codes(
    payload: RedeemCodeGenerateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    items = generate_redeem_codes(
        db,
        admin_id=admin.id,
        count=payload.count,
        points=payload.points,
        total_count=payload.total_count,
        ip_once=payload.ip_once,
        custom_codes=payload.custom_codes.splitlines() if payload.custom_codes else None,
        expire_time=payload.expire_time,
        note=payload.note,
        price=payload.price,
    )
    return success(
        [redeem_code_data(item) for item in items],
        "兑换码已生成",
    )


@router.patch("/redeem-codes/batch-price")
def update_redeem_code_batch_price(
    payload: RedeemCodeBatchPriceUpdate,
    db: Session = Depends(get_db),
):
    note = payload.note.strip() if payload.note else ""
    batch_no = payload.batch_no.strip().upper() if payload.batch_no else ""
    if not note and not batch_no:
        raise AppException("请输入要匹配的备注或批次 ID")
    price = point_amount(payload.price)
    filters = []
    if note:
        filters.append(FlowPointRedeemCode.note == note)
    if batch_no:
        filters.append(FlowPointRedeemCode.batch_no == batch_no)
    query = select(FlowPointRedeemCode).where(*filters)
    items = list(db.scalars(query))
    if not items:
        raise AppException("没有找到对应的兑换码", 404)
    code_ids = [item.id for item in items]
    for item in items:
        item.price = price
        db.add(item)
    records = list(db.scalars(select(FlowPointRedeemRecord).where(FlowPointRedeemRecord.code_id.in_(code_ids))))
    for record in records:
        record.price = price
        db.add(record)
    db.commit()
    return success(
        {
            "note": note,
            "batch_no": batch_no,
            "price": point_number(price),
            "codes": len(items),
            "redeemed": len(records),
        },
        f"已更新 {len(items)} 个兑换码价格",
    )


@router.patch("/redeem-codes/{code_id}/status")
def update_redeem_code_status(
    code_id: int,
    payload: RedeemCodeStatusUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(FlowPointRedeemCode, code_id)
    if not item:
        raise AppException("兑换码不存在", 404)
    item.status = payload.status
    db.add(item)
    db.commit()
    return success({"id": item.id, "status": item.status}, "兑换码状态已更新")


@router.put("/redeem-codes/{code_id}")
def update_redeem_code(
    code_id: int,
    payload: RedeemCodeUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(FlowPointRedeemCode, code_id)
    if not item:
        raise AppException("兑换码不存在", 404)

    normalized_code = _normalize_redeem_code(payload.code)
    duplicate = db.scalar(
        select(FlowPointRedeemCode.id).where(
            FlowPointRedeemCode.code == normalized_code,
            FlowPointRedeemCode.id != code_id,
        )
    )
    if duplicate:
        raise AppException("兑换码已存在")
    if payload.total_count < item.used_count:
        raise AppException(f"可兑换人数不能小于已兑换人数（{item.used_count}）")
    if item.used_count > 0 and normalized_code != item.code:
        raise AppException("已有兑换记录，不能修改兑换码")

    item.code = normalized_code
    item.points = point_amount(payload.points)
    item.price = point_amount(payload.price)
    item.total_count = payload.total_count
    item.ip_once = payload.ip_once
    item.expire_time = payload.expire_time
    item.status = payload.status
    item.note = payload.note.strip() if payload.note and payload.note.strip() else None
    db.add(item)
    records = list(db.scalars(select(FlowPointRedeemRecord).where(FlowPointRedeemRecord.code_id == item.id)))
    for record in records:
        record.price = item.price
        db.add(record)
    db.commit()
    db.refresh(item)
    return success(redeem_code_data(item), "兑换码已更新")


@router.delete("/redeem-codes/{code_id}")
def delete_redeem_code(
    code_id: int,
    db: Session = Depends(get_db),
):
    item = db.get(FlowPointRedeemCode, code_id)
    if not item:
        raise AppException("兑换码不存在", 404)
    if item.used_count > 0:
        raise AppException("该兑换码已有兑换记录，不能删除，请改为下架")

    db.delete(item)
    db.commit()
    return success({"id": code_id}, "兑换码已删除")


@router.get("/exports")
def exports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(ExportRecord, User.username).join(User, User.id == ExportRecord.user_id)
    count_query = select(func.count()).select_from(ExportRecord)
    if status:
        query = query.where(ExportRecord.status == status)
        count_query = count_query.where(ExportRecord.status == status)
    total = db.scalar(count_query) or 0
    rows = db.execute(query.order_by(ExportRecord.create_time.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    items = [
        {
            "id": record.id,
            "user_id": record.user_id,
            "username": username,
            "resume_id": record.resume_id,
            "file_type": record.file_type,
            "file_name": record.file_name,
            "status": record.status,
            "error_message": record.error_message,
            "create_time": record.create_time,
        }
        for record, username in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.get("/templates")
def templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    usage_rows = db.execute(select(Resume.template_id, func.count(Resume.id)).group_by(Resume.template_id)).all()
    usage = {template_id: int(count) for template_id, count in usage_rows}
    all_items = [
        {
            "template_id": item["template_id"],
            "name": item["name"],
            "category": item["category"],
            "is_pro": bool(item["is_pro"]),
            "is_visible": bool(item.get("is_visible", True)),
            "sort_order": int(item.get("sort_order") or 0),
            "usage_count": usage.get(item["template_id"], 0),
            "preview_html": _with_preview(item)["preview_html"],
        }
        for item in ordered_template_records(db, include_hidden=True)
    ]
    start = (page - 1) * page_size
    return success(page_data(all_items[start : start + page_size], len(all_items), page, page_size))


@router.patch("/templates/{template_id}")
def update_template(template_id: str, payload: TemplateDisplayUpdate, db: Session = Depends(get_db)):
    try:
        item = update_template_display(
            db,
            template_id,
            sort_order=payload.sort_order,
            is_visible=payload.is_visible,
        )
    except ValueError:
        raise AppException("模板不存在")
    return success(item)


@router.get("/resume-starter-industries")
def resume_starter_industries(db: Session = Depends(get_db)):
    return success(admin_resume_starter_industries(db))


@router.get("/resume-starters")
def admin_resume_starters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    industry_id: str = "",
    db: Session = Depends(get_db),
):
    template_records = ordered_template_records(db, include_hidden=True)
    all_items = list_admin_resume_starters(db, template_records, keyword, industry_id)
    start = (page - 1) * page_size
    return success(page_data(all_items[start : start + page_size], len(all_items), page, page_size))


@router.post("/resume-starters")
def create_resume_starter(payload: ResumeStarterWrite, db: Session = Depends(get_db)):
    template_records = ordered_template_records(db, include_hidden=True)
    item = create_admin_resume_starter(db, payload.model_dump(), template_records)
    return success(item, "岗位预设已创建")


@router.put("/resume-starters/{starter_id}")
def update_resume_starter(starter_id: str, payload: ResumeStarterWrite, db: Session = Depends(get_db)):
    template_records = ordered_template_records(db, include_hidden=True)
    item = update_admin_resume_starter(db, starter_id, payload.model_dump(), template_records)
    return success(item, "岗位预设已保存")


@router.delete("/resume-starters/{starter_id}")
def delete_resume_starter(starter_id: str, db: Session = Depends(get_db)):
    delete_admin_resume_starter(db, starter_id)
    return success(True, "岗位预设已删除")


@router.get("/resume-starter-industry-templates")
def resume_starter_industry_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    template_records = ordered_template_records(db, include_hidden=True)
    all_items = list_industry_template_configs(db, template_records)
    start = (page - 1) * page_size
    return success(page_data(all_items[start : start + page_size], len(all_items), page, page_size))


@router.put("/resume-starter-industry-templates/{industry_id}")
def update_resume_starter_industry_template(industry_id: str, payload: IndustryTemplateWrite, db: Session = Depends(get_db)):
    template_ids = {item["template_id"] for item in ordered_template_records(db, include_hidden=True)}
    if payload.default_template_id not in template_ids:
        raise AppException("模板不存在")
    item = save_industry_template_config(db, industry_id, payload.default_template_id, payload.note)
    template = next((row for row in ordered_template_records(db, include_hidden=True) if row["template_id"] == payload.default_template_id), None)
    if template:
        item["template_name"] = template["name"]
        item["template_category"] = template["category"]
    return success(item, "行业默认模板已保存")


@router.delete("/resume-starter-industry-templates/{industry_id}")
def delete_resume_starter_industry_template(industry_id: str, db: Session = Depends(get_db)):
    delete_industry_template_config(db, industry_id)
    return success(True, "行业默认模板配置已删除")
