from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class TemplateOut(BaseModel):
    template_id: str
    name: str
    category: str
    preview_image: Optional[str] = None
    preview_html: Optional[str] = None
    config_schema: Optional[dict[str, Any]] = None
    is_pro: bool = False
