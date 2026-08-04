"""Template-agnostic resume document model.

Converts Resume.structured_data into a uniform section list that every
template renderer consumes.  Templates only decide layout, ordering, and
styling — never data transformation.
"""
from __future__ import annotations

from typing import Any

# Module ordering per template (section id → priority list)
TEMPLATE_SECTION_ORDER = {
    "classic": [
        "education", "internships", "projects", "skills",
        "awards", "student_work", "custom",
    ],
    "ats_compact": [
        "skills", "projects", "internships", "education",
        "awards", "student_work", "custom",
    ],
    "project_focus": [
        "projects", "skills", "internships", "education",
        "awards", "student_work", "custom",
    ],
}


def _item(label: str, value: str | None) -> dict | None:
    v = (value or "").strip()
    return {"label": label, "value": v} if v else None


def build_resume_document(
    structured_data: dict[str, Any],
    title: str = "",
    hidden_modules: list[str] | None = None,
) -> dict[str, Any]:
    """Return a template-neutral document for rendering."""
    sd = structured_data if isinstance(structured_data, dict) else {}
    hidden = set(hidden_modules or [])
    sections: list[dict[str, Any]] = []

    _add_header_info(sections, sd)
    _add_education(sections, sd, hidden)
    _add_internships(sections, sd, hidden)
    _add_projects(sections, sd, hidden)
    _add_skills(sections, sd, hidden)
    _add_awards(sections, sd, hidden)
    _add_student_work(sections, sd, hidden)
    _add_custom_sections(sections, sd, hidden)

    return {
        "title": title or sd.get("name", ""),
        "sections": sections,
    }


# ── helpers ──


def _hidden(hidden: set, *keys: str) -> bool:
    return any(k in hidden for k in keys)


def _heading(key: str, sd: dict) -> str:
    titles = sd.get("_sectionTitles") or {}
    return str(titles.get(key) or {
        "education": "教育背景",
        "internships": "实习经历",
        "projects": "项目经历",
        "skills": "专业技能",
        "awards": "获奖情况",
        "student_work": "学生工作",
    }.get(key, ""))


# ── section builders ──


def _add_header_info(sections, sd):
    items = []
    for label, key in [
        ("籍贯", "hometown"), ("邮箱", "email"), ("电话", "phone"),
        ("政治面貌", "political_status"), ("个人主页", "homepage"),
        ("通讯地址", "address"), ("作品集", "portfolio"),
    ]:
        entry = _item(label, sd.get(key))
        if entry:
            items.append(entry)
    if items:
        sections.append({"id": "header", "title": sd.get("name", ""), "entries": items, "kind": "header"})


def _add_education(sections, sd, hidden):
    if _hidden(hidden, "education"):
        return
    entries = sd.get("education") or []
    items = [
        {
            "left": e.get("school", ""),
            "center": f"{e.get('major','')} · {e.get('degree','')}",
            "right": e.get("period", ""),
            "sub": (("GPA: " + str(e["gpa"])) if e.get("gpa") else "")
                   + ("\n" + e["highlights"] if e.get("highlights") else ""),
        }
        for e in entries if isinstance(e, dict) and e.get("school")
    ]
    if items:
        sections.append({"id": "education", "title": _heading("education", sd), "entries": items, "kind": "card_list"})


def _add_internships(sections, sd, hidden):
    if _hidden(hidden, "internships"):
        return
    entries = sd.get("internships") or []
    items = [
        {
            "left": e.get("company", ""),
            "center": e.get("role", ""),
            "right": e.get("period", ""),
            "sub": e.get("summary", ""),
        }
        for e in entries if isinstance(e, dict) and e.get("company")
    ]
    if items:
        sections.append({"id": "internships", "title": _heading("internships", sd), "entries": items, "kind": "card_list"})


def _add_projects(sections, sd, hidden):
    if _hidden(hidden, "projects"):
        return
    entries = sd.get("projects") or []
    items = []
    for e in entries:
        if not isinstance(e, dict) or not e.get("name"):
            continue
        tags = e.get("tags", [])
        tag_str = " · ".join(str(t) for t in (tags or []) if t) if isinstance(tags, list) else ""
        items.append({
            "left": e.get("name", ""),
            "center": e.get("role", ""),
            "right": e.get("period", ""),
            "sub": e.get("summary", ""),
            "tags": tag_str,
        })
    if items:
        sections.append({"id": "projects", "title": _heading("projects", sd), "entries": items, "kind": "card_list"})


def _add_skills(sections, sd, hidden):
    if _hidden(hidden, "skills"):
        return
    groups = sd.get("skill_groups") or []
    items = [
        {
            "label": g.get("label", ""),
            "tags": [str(t) for t in (g.get("tags") or []) if t],
            "desc": g.get("desc", ""),
        }
        for g in groups if isinstance(g, dict) and (g.get("label") or g.get("tags"))
    ]
    if items:
        sections.append({"id": "skills", "title": _heading("skills", sd), "entries": items, "kind": "skill_list"})


def _add_awards(sections, sd, hidden):
    if _hidden(hidden, "awards"):
        return
    entries = sd.get("awards") or []
    items = [
        {"label": e.get("category", ""), "value": e.get("name", "")}
        for e in entries if isinstance(e, dict) and (e.get("category") or e.get("name"))
    ]
    if items:
        sections.append({"id": "awards", "title": _heading("awards", sd), "entries": items, "kind": "award_list"})


def _add_student_work(sections, sd, hidden):
    if _hidden(hidden, "student_work"):
        return
    entries = sd.get("student_work") or []
    items = [
        {
            "left": e.get("org", ""),
            "center": e.get("role", ""),
            "right": e.get("period", ""),
            "sub": e.get("desc", ""),
        }
        for e in entries if isinstance(e, dict) and e.get("org")
    ]
    if items:
        sections.append({"id": "student_work", "title": _heading("student_work", sd), "entries": items, "kind": "card_list"})


def _add_custom_sections(sections, sd, hidden):
    entries = sd.get("custom_sections") or []
    for cs in entries:
        if not isinstance(cs, dict):
            continue
        cs_id = cs.get("id") or cs.get("key")
        if cs_id and cs_id in hidden:
            continue
        sections.append({
            "id": cs_id or "custom",
            "title": cs.get("title") or cs.get("label", ""),
            "entries": [{"label": "", "value": cs.get("content", "")}],
            "kind": "text_block",
        })
