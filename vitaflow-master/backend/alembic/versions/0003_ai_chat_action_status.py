"""persist AI chat change decisions

Revision ID: 0003_ai_chat_action_status
Revises: 0002_ai_chat
Create Date: 2026-06-18
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_ai_chat_action_status"
down_revision = "0002_ai_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_chat_messages",
        sa.Column("action_status", sa.String(20), nullable=False, server_default="none"),
    )
    op.execute(
        "UPDATE ai_chat_messages SET action_status = 'pending' "
        "WHERE optimized_resume_data IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("ai_chat_messages", "action_status")
