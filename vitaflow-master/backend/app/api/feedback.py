from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success
from app.core.security import get_current_user
from app.models.ai_config import UserFeedback
from app.models.user import User
from app.services.app_settings_service import get_setting
from app.services.email_service import send_feedback_notification
from app.services.rich_text_service import sanitize_rich_text_html

router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


class FeedbackCreate(BaseModel):
    category: str = Field(default="general", max_length=50)
    content: str = Field(min_length=2, max_length=500000)
    contact: Optional[str] = Field(default=None, max_length=120)


def page_data(items: list[dict], total: int, page: int, page_size: int) -> dict:
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def feedback_data(item: UserFeedback) -> dict:
    return {
        "id": item.id,
        "category": item.category,
        "content": sanitize_rich_text_html(item.content, allow_images=True),
        "contact": item.contact,
        "status": item.status,
        "admin_reply": item.admin_reply,
        "reply_time": item.reply_time,
        "create_time": item.create_time,
        "update_time": item.update_time,
    }


@router.post("")
def create_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = sanitize_rich_text_html(payload.content, allow_images=True)
    item = UserFeedback(
        user_id=current_user.id,
        category=(payload.category or "general").strip() or "general",
        content=content,
        contact=(payload.contact or "").strip() or None,
        status="open",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    notify_email = get_setting(db, "feedback_notify_email", "").strip()
    if notify_email:
        try:
            send_feedback_notification(notify_email, item, current_user)
        except Exception:
            logger.warning("Failed to send feedback notification email", exc_info=True)
    return success(
        {
            "id": item.id,
            "status": item.status,
            "create_time": item.create_time,
        },
        "反馈已提交",
    )


@router.get("")
def my_feedbacks(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(UserFeedback).where(UserFeedback.user_id == current_user.id)
    total = db.scalar(
        select(func.count()).select_from(UserFeedback).where(UserFeedback.user_id == current_user.id)
    ) or 0
    items = list(
        db.scalars(
            query.order_by(UserFeedback.create_time.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return success(page_data([feedback_data(item) for item in items], total, page, page_size))
