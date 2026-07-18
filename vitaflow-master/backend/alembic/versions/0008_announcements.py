"""add announcements

Revision ID: 0008_announcements
Revises: 0007_ai_task_stats_indexes
Create Date: 2026-06-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_announcements"
down_revision = "0007_ai_task_stats_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "announcements",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_announcements_status", "announcements", ["status"])
    op.create_index("ix_announcements_created_by", "announcements", ["created_by"])
    op.create_index("ix_announcements_published_at", "announcements", ["published_at"])

    op.create_table(
        "announcement_dismissals",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("announcement_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_dismissal"),
    )
    op.create_index("ix_announcement_dismissals_announcement_id", "announcement_dismissals", ["announcement_id"])
    op.create_index("ix_announcement_dismissals_user_id", "announcement_dismissals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_announcement_dismissals_user_id", table_name="announcement_dismissals")
    op.drop_index("ix_announcement_dismissals_announcement_id", table_name="announcement_dismissals")
    op.drop_table("announcement_dismissals")
    op.drop_index("ix_announcements_published_at", table_name="announcements")
    op.drop_index("ix_announcements_created_by", table_name="announcements")
    op.drop_index("ix_announcements_status", table_name="announcements")
    op.drop_table("announcements")
