"""add resume starter industry template configs

Revision ID: 0025_industry_tpls
Revises: 0024_resume_starters
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0025_industry_tpls"
down_revision = "0024_resume_starters"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("resume_starter_industry_templates"):
        return
    op.create_table(
        "resume_starter_industry_templates",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("industry_id", sa.String(length=50), nullable=False),
        sa.Column("industry_name", sa.String(length=100), nullable=False),
        sa.Column("industry_description", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("default_template_id", sa.String(length=50), nullable=False, server_default="tech"),
        sa.Column("note", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("create_time", sa.DateTime(), nullable=True),
        sa.Column("update_time", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_resume_starter_industry_templates_industry_id",
        "resume_starter_industry_templates",
        ["industry_id"],
        unique=True,
    )


def downgrade() -> None:
    if not _has_table("resume_starter_industry_templates"):
        return
    op.drop_index("ix_resume_starter_industry_templates_industry_id", table_name="resume_starter_industry_templates")
    op.drop_table("resume_starter_industry_templates")
