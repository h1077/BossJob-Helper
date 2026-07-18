from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


def default_resume_data() -> dict[str, Any]:
    return {
        "basics": {
            "name": "Elliot",
            "title": "AI 应用开发工程师",
            "status": "应届生",
            "phone": "13800000000",
            "email": "zhangsan@example.com",
            "location": "上海",
            "expected_salary": "面议",
            "highest_degree": "本科",
            "website": "",
            "github": "https://github.com/example",
            "avatar": "",
            "custom_fields": [],
            "field_config": {
                "phone": {"label": "电话", "icon": "Phone", "row": 1, "order": 1},
                "email": {"label": "邮箱", "icon": "Mail", "row": 1, "order": 2},
                "status": {"label": "当前状态", "icon": "Info", "row": 1, "order": 3},
                "location": {"label": "地点", "icon": "MapPin", "row": 1, "order": 4},
                "highest_degree": {"label": "最高学历", "icon": "GraduationCap", "row": 2, "order": 1},
                "website": {"label": "个人网站", "icon": "Globe", "row": 2, "order": 2},
                "github": {"label": "代码仓库", "icon": "Github", "row": 2, "order": 3},
                "expected_salary": {"label": "期望薪资", "icon": "Briefcase", "row": 2, "order": 4},
            },
        },
        "summary": {
            "content": "熟悉 FastAPI、Vue3 与大模型应用开发，具备从需求分析、接口设计到前端落地的完整项目经验。"
        },
        "education": [
            {
                "id": "edu_1",
                "school": "示例大学",
                "major": "软件工程",
                "degree": "本科",
                "start_date": "2022.09",
                "end_date": "2026.06",
                "description": "- 主修课程：数据结构、数据库系统、Web 开发、软件工程。",
            }
        ],
        "skills": [
            {
                "id": "skill_1",
                "name": "后端开发",
                "keywords": ["Python", "FastAPI", "SQLAlchemy", "MySQL"],
                "description": "- 熟悉 RESTful API 设计、JWT 鉴权、数据库建模与异步任务拆分。",
            },
            {
                "id": "skill_2",
                "name": "前端开发",
                "keywords": ["Vue3", "TypeScript", "Pinia", "Tailwind CSS"],
                "description": "- 能够构建现代化单页应用，重视组件复用与用户体验。",
            },
        ],
        "work": [],
        "projects": [
            {
                "id": "project_1",
                "name": "VitaFlow 智能简历生成与优化系统",
                "role": "全栈开发",
                "start_date": "2026.03",
                "end_date": "2026.06",
                "tech_stack": "FastAPI / Vue3 / MySQL / LangChain / WeasyPrint",
                "description": "面向求职者的在线简历编辑、AI 优化与多格式导出系统。",
                "highlights": [
                    "设计基于 JSON 的简历数据结构，支持模块排序、隐藏、重命名和模板配置持久化。",
                    "实现后端 Jinja2 HTML 预览与 PlayWright 导出共用模板，提升预览和导出一致性。",
                ],
            }
        ],
        "awards": [],
        "custom_sections": [],
        "layout": {
            "section_order": ["basics", "summary", "education", "skills", "work", "projects", "awards"],
            "hidden_sections": [],
            "skills_options": {"show_keywords": True, "description_inline": False},
            "field_labels": {},
            "section_titles": {
                "basics": "基本信息",
                "summary": "个人简介",
                "education": "教育经历",
                "skills": "专业技能",
                "work": "工作经历",
                "projects": "项目经历",
                "awards": "荣誉奖项",
            },
        },
    }


def default_template_config(template_id: str = "tech") -> dict[str, Any]:
    defaults = {
        "classic": {"theme_color": "#2563eb", "bg_color": "#ffffff", "icon_color": "#2563eb"},
        "tech": {"theme_color": "#2563eb", "bg_color": "#ffffff", "icon_color": "#2563eb"},
        "modern": {"theme_color": "#0f766e", "bg_color": "#ffffff", "icon_color": "#ffffff"},
        "blue_timeline": {"theme_color": "#4673f4", "bg_color": "#ffffff", "icon_color": "#ffffff"},
        "minimal_light": {"theme_color": "#333333", "bg_color": "#ffffff", "icon_color": "#333333"},
        "minimal_mono": {"theme_color": "#000000", "bg_color": "#ffffff", "icon_color": "#6b7280"},
        "modern_clean": {"theme_color": "#0f766e", "bg_color": "#ffffff", "icon_color": "#0f766e"},
        "elegant_line": {"theme_color": "#111827", "bg_color": "#ffffff", "icon_color": "#111827"},
        "editorial_serif": {"theme_color": "#8f2d3b", "bg_color": "#ffffff", "icon_color": "#8f2d3b"},
        "executive_panel": {"theme_color": "#1f3a5f", "bg_color": "#ffffff", "icon_color": "#ffffff"},
        "portfolio_cards": {"theme_color": "#2f855a", "bg_color": "#ffffff", "icon_color": "#2f855a"},
        "compact_matrix": {"theme_color": "#475569", "bg_color": "#ffffff", "icon_color": "#475569"},
    }
    cfg = defaults.get(template_id, {"theme_color": "#2563eb", "bg_color": "#ffffff", "icon_color": "#2563eb"})
    return {
        "template_id": template_id,
        "theme_color": cfg["theme_color"],
        "bg_color": cfg["bg_color"],
        "font_family": "vf-sans",
        "name_font_size": 28,
        "name_font_color": "#111827",
        "title_font_size": 16,
        "title_font_color": "#111827",
        "body_font_size": 13,
        "body_font_color": "#374151",
        "icon_color": cfg["icon_color"],
        "header_icon_color": cfg["icon_color"],
        "line_height": 1.6,
        "page_margin_top": 14,
        "page_margin_right": 16,
        "page_margin_bottom": 14,
        "page_margin_left": 16,
        "next_page_margin_top": 14,
        "next_page_margin_bottom": 14,
        "section_margin_top": 10,
        "section_margin_bottom": 10,
        "section_title_margin_bottom": 6,
        "show_avatar": True,
        "avatar_position": "right",
    }


class ResumeCreate(BaseModel):
    title: str = "我的简历"
    language: str = "zh-CN"
    template_id: str = "tech"
    resume_data: dict[str, Any] = Field(default_factory=default_resume_data)
    template_config: dict[str, Any] = Field(default_factory=default_template_config)


class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    language: Optional[str] = None
    resume_data: Optional[dict[str, Any]] = None
    template_id: Optional[str] = None
    template_config: Optional[dict[str, Any]] = None


class ResumeVersionCreate(BaseModel):
    reason: str = "手动保存版本"


class ResumeShareUpdate(BaseModel):
    enabled: bool
    expire_time: Optional[datetime] = None
    regenerate_token: bool = False
    mask_sensitive: bool = False
    custom_token: Optional[str] = None


class ResumeOut(BaseModel):
    id: int
    user_id: int
    title: str
    language: str
    resume_data: dict[str, Any]
    template_id: str
    template_config: dict[str, Any]
    create_time: Optional[datetime] = None
    update_time: Optional[datetime] = None

    model_config = {"from_attributes": True}
