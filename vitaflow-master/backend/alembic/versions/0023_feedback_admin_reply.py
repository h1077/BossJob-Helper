"""add feedback admin reply

Revision ID: 0023_feedback_admin_reply
Revises: 0022_ai_model_sort_order
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "0023_feedback_admin_reply"
down_revision = "0022_ai_model_sort_order"
branch_labels = None
depends_on = None


def _existing_columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _existing_columns("user_feedbacks")
    with op.batch_alter_table("user_feedbacks") as batch_op:
        if "admin_reply" not in columns:
            batch_op.add_column(sa.Column("admin_reply", sa.Text(), nullable=True))
        if "reply_time" not in columns:
            batch_op.add_column(sa.Column("reply_time", sa.DateTime(), nullable=True))


def downgrade() -> None:
    columns = _existing_columns("user_feedbacks")
    with op.batch_alter_table("user_feedbacks") as batch_op:
        if "reply_time" in columns:
            batch_op.drop_column("reply_time")
        if "admin_reply" in columns:
            batch_op.drop_column("admin_reply")
