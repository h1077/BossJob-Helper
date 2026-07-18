from copy import deepcopy
from pathlib import Path
import re
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from app.core.config import settings
from app.services.resume_locale import (
    localized_section_title,
    resolve_resume_language,
    resume_locale,
    section_field_labels,
)
from app.services.rich_text_service import rich_text_to_plain, sanitize_rich_text_html


env = Environment(
    loader=FileSystemLoader(settings.backend_root / "app" / "templates"),
    autoescape=select_autoescape(["html", "xml"]),
)
env.filters["rich_text"] = sanitize_rich_text_html


def inline_text(value: Any) -> str:
    lines = []
    for line in rich_text_to_plain(value).splitlines():
        text = re.sub(r"^[\s•·\-*]+", "", line).strip()
        if text:
            lines.append(text)
    return "；".join(lines)


env.filters["inline_text"] = inline_text

FONT_PRESETS: dict[str, list[str]] = {
    "vf-sans": [
        "VitaFlow Sans SC",
        "Noto Sans SC",
        "Noto Sans CJK SC",
        "Source Han Sans SC",
        "WenQuanYi Micro Hei",
        "Microsoft YaHei",
        "PingFang SC",
        "Arial",
        "sans-serif",
    ],
    "vf-serif": [
        "VitaFlow Serif SC",
        "Noto Serif SC",
        "Noto Serif CJK SC",
        "Source Han Serif SC",
        "AR PL SungtiL GB",
        "SimSun",
        "Songti SC",
        "serif",
    ],
    "vf-rounded": [
        "VitaFlow Rounded SC",
        "Yuanti SC",
        "圆体-简",
        "STYuanti-SC-Regular",
        "HarmonyOS Sans SC",
        "MiSans",
        "PingFang SC",
        "Microsoft YaHei",
        "Arial Rounded MT Bold",
        "Arial",
        "sans-serif",
    ],
    "vf-kai": ["VitaFlow Kai SC", "LXGW WenKai", "AR PL UKai CN", "KaiTi", "STKaiti", "serif"],
}
FONT_FACE_FILES: dict[str, list[tuple[str, int, str]]] = {
    "vf-sans": [
        ("VitaFlow Sans SC", 400, "NotoSansSC-Regular.woff2"),
        ("VitaFlow Sans SC", 700, "NotoSansSC-Bold.woff2"),
    ],
    "vf-serif": [
        ("VitaFlow Serif SC", 400, "NotoSerifSC-Regular.woff2"),
        ("VitaFlow Serif SC", 700, "NotoSerifSC-Bold.woff2"),
    ],
    "vf-rounded": [
        ("VitaFlow Rounded SC", 400, "HarmonyOSSansSC-Regular.woff2"),
        ("VitaFlow Rounded SC", 700, "HarmonyOSSansSC-Bold.woff2"),
    ],
    "vf-kai": [
        ("VitaFlow Kai SC", 400, "LXGWWenKai-Regular.woff2"),
        ("VitaFlow Kai SC", 700, "LXGWWenKai-Bold.woff2"),
    ],
}


def _quote_font(font: str) -> str:
    return "sans-serif" if font == "sans-serif" else "serif" if font == "serif" else f'"{font}"'


def css_font_family(value: Any) -> Markup:
    raw = str(value or "vf-sans").strip() or "vf-sans"
    if raw in FONT_PRESETS:
        fonts = FONT_PRESETS[raw]
    else:
        fonts = []
        for item in raw.split(","):
            font = item.strip().strip("\"'")
            if font:
                fonts.append(font.replace("\\", "").replace('"', "").replace("'", ""))
        fonts = fonts or FONT_PRESETS["vf-sans"]
    if not any(font.lower() in {"arial", "sans-serif"} for font in fonts):
        fonts.extend(["Arial", "sans-serif"])
    return Markup(", ".join(_quote_font(font) for font in fonts))


env.filters["css_font_family"] = css_font_family


def font_face_css(value: Any) -> Markup:
    raw = str(value or "").strip()
    faces = []
    for family, weight, file_name in FONT_FACE_FILES.get(raw, []):
        file_path = settings.backend_root / "app" / "static" / "fonts" / file_name
        if not file_path.is_file():
            continue
        url = f"{settings.pdf_base_url.rstrip('/')}/api/files/font-assets/{file_name}"
        faces.append(
            "@font-face { "
            f"font-family: {_quote_font(family)}; "
            f"src: url('{url}') format('woff2'); "
            f"font-weight: {weight}; "
            "font-style: normal; "
            "font-display: swap; "
            "}"
        )
    return Markup("\n".join(faces))


env.filters["font_face_css"] = font_face_css


def split_tags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[,，、;；\n\r]+", str(value))
    tags: list[str] = []
    for item in raw_items:
        text = str(item).strip()
        if text and text not in tags:
            tags.append(text)
    return tags


env.filters["split_tags"] = split_tags

BUILT_IN_SECTIONS = ["basics", "summary", "education", "skills", "work", "projects", "awards"]
BUILT_IN_TITLES = {
    "basics": "基本信息",
    "summary": "个人简介",
    "education": "教育经历",
    "skills": "专业技能",
    "work": "工作经历",
    "projects": "项目经历",
    "awards": "荣誉奖项",
}
AVAILABLE_TEMPLATES = {
    "classic", "tech", "modern", "blue_timeline",
    "minimal_light", "minimal_mono", "modern_clean", "elegant_line",
    "editorial_serif", "executive_panel", "portfolio_cards", "compact_matrix",
}


def _has_text(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return any(_has_text(item) for item in value)
    if isinstance(value, dict):
        return any(_has_text(item) for key, item in value.items() if key not in {"id", "preset_type"})
    return bool(value)


def _prepare_resume_data(resume_data: dict[str, Any], language: str = "zh-CN") -> dict[str, Any]:
    data = deepcopy(resume_data or {})
    normalized_language = resolve_resume_language(language, data)
    data["_language"] = normalized_language
    data["_labels"] = resume_locale(normalized_language)
    basics = data.setdefault("basics", {})
    avatar = basics.get("avatar")
    public_prefix = settings.minio_public_url.rstrip("/") + "/"
    if isinstance(avatar, str) and avatar.startswith(public_prefix):
        object_name = avatar.removeprefix(public_prefix)
        basics["avatar"] = f"{settings.pdf_base_url.rstrip('/')}/api/files/{object_name}"
    layout = data.setdefault("layout", {})
    skills_options = layout.get("skills_options")
    if not isinstance(skills_options, dict):
        skills_options = {}
    layout["skills_options"] = {
        "show_keywords": skills_options.get("show_keywords") is not False,
        "description_inline": skills_options.get("description_inline") is True,
    }
    custom_sections = [item for item in data.get("custom_sections", []) if isinstance(item, dict) and item.get("id")]
    custom_by_id = {item["id"]: item for item in custom_sections}
    custom_ids = list(custom_by_id.keys())
    order = layout.get("section_order")
    if not isinstance(order, list) or not order:
        order = [*BUILT_IN_SECTIONS, *custom_ids]
    order = [key for key in order if key in BUILT_IN_SECTIONS or key in custom_ids]
    for key in [*BUILT_IN_SECTIONS, *custom_ids]:
        if key not in order:
            order.append(key)
    order = ["basics", *[key for key in order if key != "basics"]]
    layout["section_order"] = order
    hidden = set(layout.setdefault("hidden_sections", []))
    hidden.discard("basics")
    layout["hidden_sections"] = [key for key in layout["hidden_sections"] if key != "basics"]
    titles = layout.setdefault("section_titles", {})
    for key in BUILT_IN_TITLES:
        titles[key] = localized_section_title(key, titles.get(key), normalized_language)
    for item in custom_sections:
        if not titles.get(item["id"]) or titles.get(item["id"]) == item["id"]:
            titles[item["id"]] = item.get("title") or "自定义模块"
    sections = []
    for key in order:
        if key in hidden:
            continue
        title = localized_section_title(key, titles.get(key), normalized_language)
        section_data = custom_by_id.get(key) if key in custom_by_id else data.get(key)
        if key != "basics" and not _has_text(section_data):
            continue
        sections.append(
            {
                "key": key,
                "title": title,
                "data": section_data,
                "field_labels": section_field_labels(
                    layout,
                    key,
                    normalized_language,
                    custom=key in custom_by_id,
                ),
            }
        )
    data["_sections"] = sections
    return data


def render_resume_html(
    resume_data: dict[str, Any],
    template_id: str,
    template_config: dict[str, Any],
    language: str = "zh-CN",
) -> str:
    safe_template = template_id if template_id in AVAILABLE_TEMPLATES else "classic"
    template = env.get_template(f"resume/{safe_template}.html")
    config = template_config or {}
    config.setdefault("template_id", safe_template)
    return template.render(
        resume=_prepare_resume_data(resume_data, language),
        config=config,
        static_base=str(settings.backend_root / "app" / "static"),
    )
