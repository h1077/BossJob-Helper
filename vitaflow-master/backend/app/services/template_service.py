from __future__ import annotations

import json
import logging
from typing import Any, Optional

from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import redis_client
from app.models.template import ResumeTemplate
from app.schemas.resume import default_resume_data, default_template_config
from app.services.preview_service import render_resume_html


logger = logging.getLogger(__name__)

TEMPLATE_CACHE_SECONDS = 3600
TEMPLATE_LIST_CACHE_KEY = f"{settings.redis_key_prefix}:templates:list:v21"
TEMPLATE_DETAIL_CACHE_PREFIX = f"{settings.redis_key_prefix}:templates:detail:v21"

TEMPLATES: list[dict[str, Any]] = [
    {
        "template_id": "classic",
        "name": "经典单栏",
        "category": "通用",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#111827"},
    },
    {
        "template_id": "tech",
        "name": "技术岗位",
        "category": "技术",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#2563eb"},
    },
    {
        "template_id": "modern",
        "name": "现代双栏",
        "category": "互联网",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#0f766e"},
    },
    {
        "template_id": "blue_timeline",
        "name": "蓝色时间轴",
        "category": "技术",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#4673f4"},
    },
    {
        "template_id": "minimal_light",
        "name": "极简明亮",
        "category": "极简",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#000000"},
    },
    {
        "template_id": "minimal_mono",
        "name": "极简单色",
        "category": "极简",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#000000"},
    },
    {
        "template_id": "modern_clean",
        "name": "现代清新",
        "category": "现代",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#0f766e"},
    },
    {
        "template_id": "elegant_line",
        "name": "优雅线型",
        "category": "创意",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#111827"},
    },
    {
        "template_id": "editorial_serif",
        "name": "编辑部衬线",
        "category": "内容",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#8f2d3b", "icon_color": "#8f2d3b"},
    },
    {
        "template_id": "executive_panel",
        "name": "商务简报",
        "category": "管理",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#1f3a5f", "icon_color": "#ffffff"},
    },
    {
        "template_id": "portfolio_cards",
        "name": "作品集卡片",
        "category": "设计",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#2f855a", "bg_color": "#ffffff", "icon_color": "#2f855a"},
    },
    {
        "template_id": "compact_matrix",
        "name": "紧凑矩阵",
        "category": "ATS",
        "preview_image": "",
        "is_pro": False,
        "config_schema": {"theme_color": "#475569", "icon_color": "#475569", "line_height": 1.45},
    },
]


def _preview_avatar() -> str:
    return (
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 210'%3E"
        "%3Crect width='160' height='210' fill='%23f8fafc'/%3E"
        "%3Cpath d='M20 210 C20 145 40 130 80 130 C120 130 140 145 140 210 Z' fill='%231e3a8a'/%3E"
        "%3Cpath d='M55 133 L80 175 L105 133 C90 140 70 140 55 133 Z' fill='%23ffffff'/%3E"
        "%3Crect x='68' y='105' width='24' height='40' fill='%23e5c3ad'/%3E"
        "%3Ccircle cx='80' cy='72' r='36' fill='%23111827'/%3E"
        "%3Ccircle cx='80' cy='86' r='32' fill='%23f7d9c4'/%3E"
        "%3C/svg%3E"
    )


def _preview_resume_data() -> dict[str, Any]:
    data = default_resume_data()
    data["basics"].update(
        {
            "name": "Elliot",
            "title": "AI 应用开发工程师",
            "phone": "18800000000",
            "email": "admin@cgz233.cn",
            "status": "在读",
            "location": "杭州",
            "highest_degree": "本科",
            "website": "https://www.cgz233.cn",
            "avatar": _preview_avatar(),
            "custom_fields": [
                {"id": "age", "label": "年龄", "value": "男22岁", "icon": "Info", "row": 1, "order": 3},
            ],
        }
    )
    data["basics"]["field_config"]["status"] = {"label": "当前状态", "icon": "Tag", "row": 2, "order": 1}
    data["basics"]["field_config"]["location"] = {"label": "地点", "icon": "MapPin", "row": 2, "order": 3}
    data["basics"]["field_config"]["highest_degree"] = {"label": "最高学历", "icon": "CalendarCheck", "row": 3, "order": 1}
    data["basics"]["field_config"]["website"] = {"label": "个人网站", "icon": "Globe", "row": 3, "order": 2}
    data["summary"]["content"] = "熟悉 Java、Spring Boot、Spring Cloud、MySQL、Redis 与 LangChain，具备从需求分析、接口设计到上线部署的完整项目经验。"
    data["skills"] = [
        {
            "id": "skill_1",
            "name": "专业技能",
            "keywords": [],
            "description": "- 熟练掌握 Java 核心基础知识，熟悉常见设计模式，具备良好的编码习惯。\n- 熟练使用 Spring、Spring MVC、Spring Boot，掌握 AOP 编程思想。\n- 熟悉 MySQL、Redis 等数据库与缓存的日常操作，熟悉 MyBatis-Plus 框架。\n- 掌握 Vue、uni-app 等前端开发框架，了解大模型应用开发流程。",
        }
    ]
    data["work"] = [
        {
            "id": "work_1",
            "company": "零度极客有限公司",
            "position": "Java开发",
            "start_date": "2024.09",
            "end_date": "2025.03",
            "description": "软件开发部 杭州",
            "highlights": [
                "负责前后端开发工作，后端基于 Spring Boot 构建接口，前端使用 uni-app 实现移动端应用。",
                "参与需求分析、系统设计、接口联调与接口测试。",
                "使用 Redis 实现缓存机制，提升系统响应速度。",
            ],
        }
    ]
    data["projects"] = [
        {
            "id": "project_1",
            "name": "VitaFlow 智能简历生成与优化系统",
            "role": "全栈开发",
            "start_date": "2026.03",
            "end_date": "2026.06",
            "tech_stack": "FastAPI、Vue3、MySQL、LangChain、PlayWright",
            "description": "面向求职者的在线简历编辑、AI 优化与多格式导出系统。",
            "highlights": [
                "设计基于 JSON 的简历数据结构，支持模块排序、隐藏、重命名和模板配置持久化。",
                "实现后端 Jinja2 HTML 预览与 PlayWright 导出共用模板，提升预览和导出一致性。",
            ],
        }
    ]
    data["awards"] = []
    data["layout"]["section_order"] = ["basics", "skills", "work", "projects"]
    data["layout"]["section_titles"]["skills"] = "专业技能"
    data["layout"]["section_titles"]["work"] = "工作经历"
    data["layout"]["section_titles"]["projects"] = "项目经历"
    return data


def _with_preview(template: dict[str, Any]) -> dict[str, Any]:
    item = template.copy()
    config = default_template_config(item["template_id"])
    config.update(item.get("config_schema") or {})
    config["template_id"] = item["template_id"]
    item["preview_html"] = render_resume_html(_preview_resume_data(), item["template_id"], config, "zh-CN")
    return item


def _read_cache(key: str) -> Any | None:
    try:
        cached = redis_client.get(key)
        return json.loads(cached) if cached else None
    except (RedisError, json.JSONDecodeError, TypeError):
        logger.warning("Failed to read template cache", exc_info=True)
        return None


def _write_cache(key: str, value: Any) -> None:
    try:
        redis_client.set(key, json.dumps(value, ensure_ascii=False), ex=TEMPLATE_CACHE_SECONDS)
    except (RedisError, TypeError):
        logger.warning("Failed to write template cache", exc_info=True)


def invalidate_template_cache() -> None:
    try:
        redis_client.delete(TEMPLATE_LIST_CACHE_KEY)
        for item in TEMPLATES:
            redis_client.delete(f"{TEMPLATE_DETAIL_CACHE_PREFIX}:{item['template_id']}")
    except RedisError:
        logger.warning("Failed to invalidate template cache", exc_info=True)


def _sync_builtin_templates(db: Session) -> list[ResumeTemplate]:
    rows = db.scalars(select(ResumeTemplate)).all()
    row_by_id = {row.template_id: row for row in rows}
    changed = False
    for index, item in enumerate(TEMPLATES, start=1):
        row = row_by_id.get(item["template_id"])
        if not row:
            row = ResumeTemplate(
                template_id=item["template_id"],
                name=item["name"],
                category=item["category"],
                preview_image=item.get("preview_image") or "",
                config_schema=item.get("config_schema") or {},
                is_pro=1 if item.get("is_pro") else 0,
                sort_order=index,
                is_visible=1,
            )
            db.add(row)
            row_by_id[item["template_id"]] = row
            changed = True
            continue
        if not row.sort_order:
            row.sort_order = index
            changed = True
        for attr in ("name", "category", "preview_image", "config_schema"):
            next_value = item.get(attr) or ({} if attr == "config_schema" else "")
            if getattr(row, attr) != next_value:
                setattr(row, attr, next_value)
                changed = True
        next_is_pro = 1 if item.get("is_pro") else 0
        if row.is_pro != next_is_pro:
            row.is_pro = next_is_pro
            changed = True
    if changed:
        db.commit()
    return db.scalars(
        select(ResumeTemplate)
        .where(ResumeTemplate.template_id.in_([item["template_id"] for item in TEMPLATES]))
        .order_by(ResumeTemplate.sort_order.asc(), ResumeTemplate.id.asc())
    ).all()


def _template_from_row(row: ResumeTemplate) -> dict[str, Any]:
    return {
        "template_id": row.template_id,
        "name": row.name,
        "category": row.category,
        "preview_image": row.preview_image or "",
        "is_pro": bool(row.is_pro),
        "is_visible": bool(row.is_visible),
        "config_schema": row.config_schema or {},
        "sort_order": row.sort_order or 0,
    }


def ordered_template_records(db: Session, include_hidden: bool = False) -> list[dict[str, Any]]:
    items = [_template_from_row(row) for row in _sync_builtin_templates(db)]
    return items if include_hidden else [item for item in items if item["is_visible"]]


def list_templates(db: Session | None = None) -> list[dict[str, Any]]:
    if db is not None:
        return [_with_preview(item) for item in ordered_template_records(db)]
    cached = _read_cache(TEMPLATE_LIST_CACHE_KEY)
    if isinstance(cached, list):
        return cached
    items = [_with_preview(item) for item in TEMPLATES]
    _write_cache(TEMPLATE_LIST_CACHE_KEY, items)
    return items


def get_template(template_id: str, db: Session | None = None) -> Optional[dict[str, Any]]:
    if db is not None:
        template = next((item for item in ordered_template_records(db) if item["template_id"] == template_id), None)
        return _with_preview(template) if template else None
    cache_key = f"{TEMPLATE_DETAIL_CACHE_PREFIX}:{template_id}"
    cached = _read_cache(cache_key)
    if isinstance(cached, dict):
        return cached
    template = next((item for item in TEMPLATES if item["template_id"] == template_id), None)
    if not template:
        return None
    item = _with_preview(template)
    _write_cache(cache_key, item)
    return item


def update_template_display(
    db: Session,
    template_id: str,
    sort_order: int | None = None,
    is_visible: bool | None = None,
) -> dict[str, Any]:
    rows = _sync_builtin_templates(db)
    target = next((row for row in rows if row.template_id == template_id), None)
    if not target:
        raise ValueError("template_not_found")
    if is_visible is not None:
        target.is_visible = 1 if is_visible else 0
    if sort_order is not None:
        target.sort_order = int(sort_order)
    db.add(target)
    db.commit()
    invalidate_template_cache()
    db.refresh(target)
    return _template_from_row(target)
