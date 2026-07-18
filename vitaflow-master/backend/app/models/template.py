from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ResumeTemplate(Base):
    __tablename__ = "resume_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50))
    preview_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    config_schema: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    is_pro: Mapped[int] = mapped_column(default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[int] = mapped_column(Integer, default=1)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
