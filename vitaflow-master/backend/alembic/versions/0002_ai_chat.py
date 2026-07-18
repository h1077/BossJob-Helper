"""ai chat history

Revision ID: 0002_ai_chat
Revises: 0001_init
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_ai_chat"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_sessions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("resume_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ai_chat_sessions_user_id", "ai_chat_sessions", ["user_id"])
    op.create_index("ix_ai_chat_sessions_resume_id", "ai_chat_sessions", ["resume_id"])

    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("resume_id", sa.BigInteger(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("suggestions", sa.JSON(), nullable=True),
        sa.Column("optimized_resume_data", sa.JSON(), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ai_chat_messages_session_id", "ai_chat_messages", ["session_id"])
    op.create_index("ix_ai_chat_messages_user_id", "ai_chat_messages", ["user_id"])
    op.create_index("ix_ai_chat_messages_resume_id", "ai_chat_messages", ["resume_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_chat_messages_resume_id", table_name="ai_chat_messages")
    op.drop_index("ix_ai_chat_messages_user_id", table_name="ai_chat_messages")
    op.drop_index("ix_ai_chat_messages_session_id", table_name="ai_chat_messages")
    op.drop_table("ai_chat_messages")
    op.drop_index("ix_ai_chat_sessions_resume_id", table_name="ai_chat_sessions")
    op.drop_index("ix_ai_chat_sessions_user_id", table_name="ai_chat_sessions")
    op.drop_table("ai_chat_sessions")
