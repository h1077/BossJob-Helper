from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AiModelConfig(Base):
    __tablename__ = "ai_model_configs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), default="默认模型")
    provider: Mapped[str] = mapped_column(String(50), default="openai-compatible")
    base_url: Mapped[str] = mapped_column(String(500))
    api_key: Mapped[str] = mapped_column(String(1000))
    model: Mapped[str] = mapped_column(String(120))
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    timeout: Mapped[int] = mapped_column(Integer, default=60)
    max_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True, default=8192)
    supports_multimodal: Mapped[bool] = mapped_column(Boolean, default=False)
    context_messages: Mapped[int] = mapped_column(Integer, default=12)
    is_chat_selectable: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    chat_points_per_call: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    chat_points_per_million_input_tokens: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    chat_points_per_million_output_tokens: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class FlowPointRule(Base):
    __tablename__ = "flow_point_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    feature_type: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    points_per_call: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    points_per_1k_tokens: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    points_per_million_tokens: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    points_per_million_input_tokens: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    points_per_million_output_tokens: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class FlowPointTransaction(Base):
    __tablename__ = "flow_point_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    task_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    feature_type: Mapped[str] = mapped_column(String(50), index=True)
    points_delta: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(String(255), default="")
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)


class FlowPointRedeemCode(Base):
    __tablename__ = "flow_point_redeem_codes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    batch_no: Mapped[str] = mapped_column(String(80), index=True)
    points: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    total_count: Mapped[int] = mapped_column(Integer, default=1)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    ip_once: Mapped[bool] = mapped_column(Boolean, default=False)
    expire_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_by: Mapped[int] = mapped_column(BigInteger, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class FlowPointRedeemRecord(Base):
    __tablename__ = "flow_point_redeem_records"
    __table_args__ = (UniqueConstraint("code_id", "user_id", name="uq_flow_point_redeem_user"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code_id: Mapped[int] = mapped_column(BigInteger, index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    points: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class UserFeedback(Base):
    __tablename__ = "user_feedbacks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, index=True)
    category: Mapped[str] = mapped_column(String(50), default="general", index=True)
    content: Mapped[str] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    create_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    update_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
