"""use decimal precision for flow points

Revision ID: 0019_decimal_points
Revises: 0018_split_token_pricing
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_decimal_points"
down_revision = "0018_split_token_pricing"
branch_labels = None
depends_on = None


POINT_DECIMAL = sa.Numeric(14, 2)


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "flow_points",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
            server_default="0.00",
        )
    with op.batch_alter_table("ai_tasks") as batch_op:
        batch_op.alter_column(
            "points_used",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
            server_default="0.00",
        )
    with op.batch_alter_table("flow_point_rules") as batch_op:
        for column in (
            "points_per_call",
            "points_per_1k_tokens",
            "points_per_million_tokens",
            "points_per_million_input_tokens",
            "points_per_million_output_tokens",
        ):
            batch_op.alter_column(
                column,
                existing_type=sa.Integer(),
                type_=POINT_DECIMAL,
                existing_nullable=False,
                server_default="0.00",
            )
    with op.batch_alter_table("flow_point_transactions") as batch_op:
        batch_op.alter_column(
            "points_delta",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
        )
        batch_op.alter_column(
            "balance_after",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
        )
    with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
        batch_op.alter_column(
            "points",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
        )
    with op.batch_alter_table("flow_point_redeem_records") as batch_op:
        batch_op.alter_column(
            "points",
            existing_type=sa.Integer(),
            type_=POINT_DECIMAL,
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("flow_point_redeem_records") as batch_op:
        batch_op.alter_column("points", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
    with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
        batch_op.alter_column("points", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
    with op.batch_alter_table("flow_point_transactions") as batch_op:
        batch_op.alter_column("balance_after", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
        batch_op.alter_column("points_delta", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
    with op.batch_alter_table("flow_point_rules") as batch_op:
        for column in (
            "points_per_million_output_tokens",
            "points_per_million_input_tokens",
            "points_per_million_tokens",
            "points_per_1k_tokens",
            "points_per_call",
        ):
            batch_op.alter_column(column, existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
    with op.batch_alter_table("ai_tasks") as batch_op:
        batch_op.alter_column("points_used", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("flow_points", existing_type=POINT_DECIMAL, type_=sa.Integer(), existing_nullable=False)
