"""add template display controls

Revision ID: 0013_template_sort_order
Revises: 0012_flow_point_million_tokens
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_template_sort_order"
down_revision = "0012_flow_point_million_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "resume_templates",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "resume_templates",
        sa.Column("is_visible", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("resume_templates", "is_visible")
    op.drop_column("resume_templates", "sort_order")
