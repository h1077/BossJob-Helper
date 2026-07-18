"""add resume starters

Revision ID: 0024_resume_starters
Revises: 0023_feedback_admin_reply
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_resume_starters"
down_revision = "0023_feedback_admin_reply"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("resume_starters"):
        return
    op.create_table(
        "resume_starters",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("starter_id", sa.String(length=80), nullable=False),
        sa.Column("industry_id", sa.String(length=50), nullable=False),
        sa.Column("industry_name", sa.String(length=100), nullable=False),
        sa.Column("industry_description", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("role_title", sa.String(length=100), nullable=False),
        sa.Column("role_subtitle", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("focus", sa.JSON(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_visible", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("create_time", sa.DateTime(), nullable=True),
        sa.Column("update_time", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_starters_starter_id", "resume_starters", ["starter_id"], unique=True)
    op.create_index("ix_resume_starters_industry_id", "resume_starters", ["industry_id"], unique=False)


def downgrade() -> None:
    if not _has_table("resume_starters"):
        return
    op.drop_index("ix_resume_starters_industry_id", table_name="resume_starters")
    op.drop_index("ix_resume_starters_starter_id", table_name="resume_starters")
    op.drop_table("resume_starters")
