"""add app settings and user feedback

Revision ID: 0011_settings_feedback
Revises: 0010_ai_config_points
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_settings_feedback"
down_revision = "0010_ai_config_points"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_app_settings_key", "app_settings", ["key"], unique=True)

    op.create_table(
        "user_feedbacks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, server_default="general"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("contact", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_feedbacks_user_id", "user_feedbacks", ["user_id"])
    op.create_index("ix_user_feedbacks_category", "user_feedbacks", ["category"])
    op.create_index("ix_user_feedbacks_status", "user_feedbacks", ["status"])
    op.create_index("ix_user_feedbacks_create_time", "user_feedbacks", ["create_time"])


def downgrade() -> None:
    op.drop_index("ix_user_feedbacks_create_time", table_name="user_feedbacks")
    op.drop_index("ix_user_feedbacks_status", table_name="user_feedbacks")
    op.drop_index("ix_user_feedbacks_category", table_name="user_feedbacks")
    op.drop_index("ix_user_feedbacks_user_id", table_name="user_feedbacks")
    op.drop_table("user_feedbacks")
    op.drop_index("ix_app_settings_key", table_name="app_settings")
    op.drop_table("app_settings")
