from __future__ import annotations

from app.services.rich_text_service import rich_text_has_text, sanitize_rich_text_html


def sanitize_announcement_html(value: str) -> str:
    return sanitize_rich_text_html(value, allow_images=True)


def announcement_has_text(value: str) -> bool:
    return rich_text_has_text(value)
