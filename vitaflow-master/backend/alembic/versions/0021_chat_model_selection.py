"""add chat model selection and pricing

Revision ID: 0021_chat_model_selection
Revises: 0020_redeem_code_price
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_chat_model_selection"
down_revision = "0020_redeem_code_price"
branch_labels = None
depends_on = None


POINT_DECIMAL = sa.Numeric(14, 2)


def _existing_columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _existing_columns("ai_model_configs")
    with op.batch_alter_table("ai_model_configs") as batch_op:
        if "is_chat_selectable" not in columns:
            batch_op.add_column(sa.Column("is_chat_selectable", sa.Boolean(), nullable=False, server_default=sa.true()))
        if "chat_points_per_call" not in columns:
            batch_op.add_column(sa.Column("chat_points_per_call", POINT_DECIMAL, nullable=True))
        if "chat_points_per_million_input_tokens" not in columns:
            batch_op.add_column(sa.Column("chat_points_per_million_input_tokens", POINT_DECIMAL, nullable=True))
        if "chat_points_per_million_output_tokens" not in columns:
            batch_op.add_column(sa.Column("chat_points_per_million_output_tokens", POINT_DECIMAL, nullable=True))


def downgrade() -> None:
    columns = _existing_columns("ai_model_configs")
    with op.batch_alter_table("ai_model_configs") as batch_op:
        if "chat_points_per_million_output_tokens" in columns:
            batch_op.drop_column("chat_points_per_million_output_tokens")
        if "chat_points_per_million_input_tokens" in columns:
            batch_op.drop_column("chat_points_per_million_input_tokens")
        if "chat_points_per_call" in columns:
            batch_op.drop_column("chat_points_per_call")
        if "is_chat_selectable" in columns:
            batch_op.drop_column("is_chat_selectable")
