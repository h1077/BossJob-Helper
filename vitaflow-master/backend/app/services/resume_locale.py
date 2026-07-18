from __future__ import annotations

from copy import deepcopy
import re
from typing import Any


SUPPORTED_RESUME_LANGUAGES = {"zh-CN", "en"}

RESUME_LOCALES: dict[str, dict[str, Any]] = {
    "zh-CN": {
        "html_lang": "zh-CN",
        "unnamed": "未命名",
        "avatar_alt": "头像",
        "colon": "：",
        "list_separator": "、",
        "skill_keywords": "技能标签",
        "project_tech_stack": "技术栈",
        "custom_tech_stack": "技术/工具",
        "experience": "经历",
        "content": "内容",
        "candidate": "求职者",
        "anonymous_resume": "匿名简历",
        "section_titles": {
            "basics": "基本信息",
            "summary": "个人简介",
            "education": "教育经历",
            "skills": "专业技能",
            "work": "工作经历",
            "projects": "项目经历",
            "awards": "荣誉奖项",
        },
        "field_config": {
            "phone": "电话",
            "email": "邮箱",
            "status": "当前状态",
            "location": "地点",
            "highest_degree": "最高学历",
            "website": "个人网站",
            "github": "代码仓库",
            "expected_salary": "期望薪资",
        },
    },
    "en": {
        "html_lang": "en",
        "unnamed": "Untitled",
        "avatar_alt": "Profile photo",
        "colon": ": ",
        "list_separator": " / ",
        "skill_keywords": "Skills",
        "project_tech_stack": "Tech Stack",
        "custom_tech_stack": "Tools",
        "experience": "Experience",
        "content": "Content",
        "candidate": "Candidate",
        "anonymous_resume": "Anonymous Resume",
        "section_titles": {
            "basics": "Contact",
            "summary": "Professional Summary",
            "education": "Education",
            "skills": "Skills",
            "work": "Work Experience",
            "projects": "Project Experience",
            "awards": "Awards",
        },
        "field_config": {
            "phone": "Phone",
            "email": "Email",
            "status": "Status",
            "location": "Location",
            "highest_degree": "Education",
            "website": "Website",
            "github": "GitHub",
            "expected_salary": "Expected Salary",
        },
    },
}


def normalize_resume_language(value: Any) -> str:
    language = str(value or "").strip()
    if language.lower().startswith("en"):
        return "en"
    return "zh-CN"


def detect_resume_language(text: str) -> str:
    value = str(text or "")
    han_count = len(re.findall(r"[\u3400-\u9fff]", value))
    latin_count = len(re.findall(r"[A-Za-z]", value))
    if latin_count >= 40 and latin_count > han_count * 2:
        return "en"
    return "zh-CN"


def _resume_display_text(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(_resume_display_text(item))
        return result
    if isinstance(value, dict):
        result = []
        ignored_keys = {
            "id",
            "icon",
            "preset_type",
            "avatar",
            "url",
            "website",
            "github",
            "field_config",
            "layout",
        }
        for key, item in value.items():
            if key not in ignored_keys:
                result.extend(_resume_display_text(item))
        return result
    return []


def resolve_resume_language(value: Any, resume_data: Any = None) -> str:
    stored = normalize_resume_language(value)
    if not isinstance(resume_data, dict):
        return stored
    layout = resume_data.get("layout")
    if isinstance(layout, dict) and layout.get("language_locked") is True:
        return stored
    if stored == "en":
        return stored

    titles = layout.get("section_titles") if isinstance(layout, dict) else {}
    title_values = set(titles.values()) if isinstance(titles, dict) else set()
    english_titles = set(RESUME_LOCALES["en"]["section_titles"].values())
    chinese_titles = set(RESUME_LOCALES["zh-CN"]["section_titles"].values())
    english_hits = len(title_values & english_titles)
    chinese_hits = len(title_values & chinese_titles)
    if english_hits >= 2 and english_hits > chinese_hits:
        return "en"

    display_text = "\n".join(_resume_display_text(resume_data))
    return detect_resume_language(display_text)


def resume_locale(language: Any) -> dict[str, Any]:
    return deepcopy(RESUME_LOCALES[normalize_resume_language(language)])


def localized_section_title(key: str, title: Any, language: Any) -> str:
    locale = resume_locale(language)
    localized = locale["section_titles"].get(key)
    current = str(title or "").strip()
    if not localized:
        return current or key
    known_defaults = {
        values["section_titles"].get(key)
        for values in RESUME_LOCALES.values()
        if values["section_titles"].get(key)
    }
    if not current or current == key or current in known_defaults:
        return localized
    return current


def section_field_labels(layout: dict[str, Any], section_key: str, language: Any, *, custom: bool = False) -> dict[str, str]:
    locale = resume_locale(language)
    defaults: dict[str, str] = {}
    if section_key == "projects":
        defaults["tech_stack"] = locale["project_tech_stack"]
    elif section_key == "skills":
        defaults["keywords"] = locale["skill_keywords"]
    elif custom:
        defaults["tech_stack"] = locale["custom_tech_stack"]

    configured = layout.get("field_labels") if isinstance(layout, dict) else {}
    section_config = configured.get(section_key) if isinstance(configured, dict) else {}
    if isinstance(section_config, dict):
        for key, value in section_config.items():
            if isinstance(value, str):
                defaults[key] = value
    return defaults
