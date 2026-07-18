import html
import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success
from app.core.security import get_current_user
from app.models.announcement import Announcement, AnnouncementRead
from app.models.user import User
from app.services.announcement_cache_service import announcement_cache_service


router = APIRouter(prefix="/announcements", tags=["announcements"])


def announcement_detail_data(item: Announcement) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "read_count": item.read_count or 0,
        "published_at": item.published_at.isoformat() if item.published_at else None,
    }


def announcement_summary(content: str, limit: int = 120) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", content))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def mark_announcement_read(db: Session, user_id: int, announcement_id: int) -> int:
    announcement = db.get(Announcement, announcement_id)
    if not announcement or announcement.status != "published":
        raise AppException("公告不存在", 404)
    exists = db.scalar(
        select(AnnouncementRead.id).where(
            AnnouncementRead.announcement_id == announcement_id,
            AnnouncementRead.user_id == user_id,
        )
    )
    if not exists:
        db.add(AnnouncementRead(announcement_id=announcement_id, user_id=user_id))
        announcement.read_count = int(announcement.read_count or 0) + 1
        db.add(announcement)
        db.commit()
        announcement_cache_service.invalidate()
    return int(announcement.read_count or 0)


@router.get("")
def announcement_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_suffix = f"history:{page}:{page_size}"
    cached = announcement_cache_service.get_json(cache_suffix)
    if cached is not None:
        return success(cached)
    condition = Announcement.status == "published"
    total = db.scalar(select(func.count()).select_from(Announcement).where(condition)) or 0
    items = list(
        db.scalars(
            select(Announcement)
            .where(condition)
            .order_by(Announcement.published_at.desc(), Announcement.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    data = {
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "summary": announcement_summary(item.content),
                    "read_count": item.read_count or 0,
                    "published_at": item.published_at.isoformat() if item.published_at else None,
                }
                for item in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    announcement_cache_service.set_json(cache_suffix, data)
    return success(data)


@router.get("/current")
def current_announcement(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cached = announcement_cache_service.get_json("current")
    if cached is None:
        announcement = db.scalar(
            select(Announcement)
            .where(Announcement.status == "published")
            .order_by(Announcement.published_at.desc(), Announcement.id.desc())
            .limit(1)
        )
        cached = {"announcement": announcement_detail_data(announcement) if announcement else None}
        announcement_cache_service.set_json("current", cached)
    data = cached.get("announcement") if isinstance(cached, dict) else None
    if not data:
        return success(None)
    if announcement_cache_service.is_dismissed(current_user.id, int(data["id"])):
        return success(None)
    data = {**data, "read_count": mark_announcement_read(db, current_user.id, int(data["id"]))}
    return success(data)


@router.get("/{announcement_id}")
def announcement_detail(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cached = announcement_cache_service.get_json(f"detail:{announcement_id}")
    if cached is not None:
        return success({**cached, "read_count": mark_announcement_read(db, current_user.id, announcement_id)})
    announcement = db.get(Announcement, announcement_id)
    if not announcement or announcement.status != "published":
        raise AppException("公告不存在", 404)
    data = announcement_detail_data(announcement)
    data["read_count"] = mark_announcement_read(db, current_user.id, announcement_id)
    announcement_cache_service.set_json(f"detail:{announcement_id}", data)
    return success(data)


@router.post("/{announcement_id}/dismiss")
def dismiss_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    announcement = db.get(Announcement, announcement_id)
    if not announcement or announcement.status != "published":
        raise AppException("公告不存在", 404)
    announcement_cache_service.dismiss(current_user.id, announcement_id)
    return success(True, "已设置不再提示")
