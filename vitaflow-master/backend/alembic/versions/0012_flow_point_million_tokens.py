"""add million-token flow point pricing

Revision ID: 0012_flow_point_million_tokens
Revises: 0011_settings_feedback
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_flow_point_million_tokens"
down_revision = "0011_settings_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "flow_point_rules",
        sa.Column("points_per_million_tokens", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        "UPDATE flow_point_rules "
        "SET points_per_million_tokens = COALESCE(points_per_1k_tokens, 0) * 1000 "
        "WHERE points_per_million_tokens = 0"
    )


def downgrade() -> None:
    op.drop_column("flow_point_rules", "points_per_million_tokens")
