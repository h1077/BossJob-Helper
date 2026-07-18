"""add ai model sort order

Revision ID: 0022_ai_model_sort_order
Revises: 0021_chat_model_selection
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0022_ai_model_sort_order"
down_revision = "0021_chat_model_selection"
branch_labels = None
depends_on = None


def _existing_columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _existing_columns("ai_model_configs")
    with op.batch_alter_table("ai_model_configs") as batch_op:
        if "sort_order" not in columns:
            batch_op.add_column(sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"))


def downgrade() -> None:
    columns = _existing_columns("ai_model_configs")
    with op.batch_alter_table("ai_model_configs") as batch_op:
        if "sort_order" in columns:
            batch_op.drop_column("sort_order")
