from __future__ import annotations

import re
import secrets
from copy import deepcopy
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.resume import Resume
from app.services.resume_locale import resolve_resume_language, resume_locale


SENSITIVE_BASIC_FIELDS = {
    "phone",
    "email",
    "location",
    "status",
    "expected_salary",
    "website",
    "github",
    "avatar",
    "gender",
    "age",
    "birthday",
    "wechat",
    "qq",
    "id_card",
}

CUSTOM_SHARE_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$")


def normalize_expire_time(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone().replace(tzinfo=None)
    return value


def share_is_expired(expire_time: datetime | None) -> bool:
    return bool(expire_time and expire_time <= datetime.now())


def generate_share_token(db: Session) -> str:
    for _ in range(8):
        token = secrets.token_urlsafe(32)
        exists = db.scalar(select(Resume.id).where(Resume.share_token == token))
        if not exists:
            return token
    raise AppException("分享链接生成失败，请稍后重试")


def normalize_custom_share_token(db: Session, value: str | None, resume_id: int | None = None) -> str | None:
    token = str(value or "").strip()
    if not token:
        return None
    if not CUSTOM_SHARE_TOKEN_PATTERN.fullmatch(token):
        raise AppException("自定义链接仅支持 3-64 位字母、数字、短横线或下划线，且需以字母或数字开头")
    query = select(Resume.id).where(Resume.share_token == token)
    if resume_id is not None:
        query = query.where(Resume.id != resume_id)
    if db.scalar(query):
        raise AppException("该自定义链接已被使用，请换一个")
    return token


def get_shared_resume(db: Session, token: str) -> Resume:
    normalized = str(token or "").strip()
    if not normalized or len(normalized) > 80:
        raise AppException("分享不存在或已失效", 404)
    resume = db.scalar(select(Resume).where(Resume.share_token == normalized))
    if not resume or not resume.share_enabled or share_is_expired(resume.share_expire_time):
        raise AppException("分享不存在或已失效", 404)
    return resume


def prepare_public_share_content(resume: Resume) -> tuple[dict[str, Any], dict[str, Any], str]:
    resume_data = deepcopy(resume.resume_data or {})
    template_config = deepcopy(resume.template_config or {})
    title = resume.title
    if not resume.share_mask_sensitive:
        return resume_data, template_config, title

    basics = resume_data.get("basics")
    if not isinstance(basics, dict):
        basics = {}
        resume_data["basics"] = basics
    labels = resume_locale(resolve_resume_language(resume.language, resume_data))
    basics["name"] = labels["candidate"]
    for field in SENSITIVE_BASIC_FIELDS:
        basics[field] = ""
    basics["custom_fields"] = []
    template_config["show_avatar"] = False
    return resume_data, template_config, labels["anonymous_resume"]
