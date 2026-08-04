"""Unified resume HTML renderer.

Takes a template-agnostic document + template config → renders the
corresponding Jinja2 template.  Used by the preview endpoint, standard
PDF export, and future DOCX render-plan pipeline.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from utils.resume_document import TEMPLATE_SECTION_ORDER, build_resume_document
from utils.resume_templates import normalize_template_config

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "resume"
_env: Environment | None = None


def _get_env() -> Environment:
    global _env
    if _env is None:
        loader = FileSystemLoader(str(_TEMPLATE_DIR))
        _env = Environment(loader=loader, autoescape=select_autoescape(["html"]))
        _env.globals["now"] = __import__("datetime").datetime.utcnow
    return _env


def render_resume_html(
    structured_data: dict[str, Any],
    title: str = "",
    template_config: dict[str, Any] | None = None,
    hidden_modules: list[str] | None = None,
) -> str:
    """Render a complete HTML page for preview or PDF."""
    cfg = normalize_template_config(template_config)
    template_id = cfg.get("templateId", "classic")
    doc = build_resume_document(structured_data, title, hidden_modules)

    # Reorder sections per template — header always first
    ordered: list[dict[str, Any]] = []
    # Header first
    for section in doc["sections"]:
        if section.get("kind") == "header":
            ordered.append(section)
            break
    # Then follow template order
    order = TEMPLATE_SECTION_ORDER.get(template_id, TEMPLATE_SECTION_ORDER["classic"])
    for section_id in order:
        for section in doc["sections"]:
            if section.get("kind") == "header":
                continue
            if section["id"] == section_id or (
                section_id == "custom" and section.get("kind") == "text_block"
            ):
                if section not in ordered:
                    ordered.append(section)
    # Append any sections not yet included
    seen_ids = {s["id"] for s in ordered}
    for section in doc["sections"]:
        sid = section["id"]
        if sid not in seen_ids and section not in ordered:
            ordered.append(section)

    env = _get_env()
    template_file = f"{template_id}.html"
    tpl = env.get_template(template_file)
    return tpl.render(
        title=doc["title"] or title,
        sections=ordered,
        cfg=cfg,
    )
