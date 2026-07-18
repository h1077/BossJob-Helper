"""split flow point token pricing by input and output

Revision ID: 0018_split_token_pricing
Revises: 0017_resume_share_mask_sensitive
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_split_token_pricing"
down_revision = "0017_resume_share_mask_sensitive"
branch_labels = None
depends_on = None


def _existing_columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _existing_columns("flow_point_rules")
    missing_input = "points_per_million_input_tokens" not in columns
    missing_output = "points_per_million_output_tokens" not in columns
    if missing_input or missing_output:
        with op.batch_alter_table("flow_point_rules") as batch_op:
            if missing_input:
                batch_op.add_column(
                    sa.Column("points_per_million_input_tokens", sa.Integer(), nullable=False, server_default="0")
                )
            if missing_output:
                batch_op.add_column(
                    sa.Column("points_per_million_output_tokens", sa.Integer(), nullable=False, server_default="0")
                )
    op.execute(
        "UPDATE flow_point_rules "
        "SET points_per_million_input_tokens = COALESCE(points_per_million_tokens, 0), "
        "points_per_million_output_tokens = COALESCE(points_per_million_tokens, 0)"
    )


def downgrade() -> None:
    columns = _existing_columns("flow_point_rules")
    has_input = "points_per_million_input_tokens" in columns
    has_output = "points_per_million_output_tokens" in columns
    if has_input or has_output:
        with op.batch_alter_table("flow_point_rules") as batch_op:
            if has_output:
                batch_op.drop_column("points_per_million_output_tokens")
            if has_input:
                batch_op.drop_column("points_per_million_input_tokens")
