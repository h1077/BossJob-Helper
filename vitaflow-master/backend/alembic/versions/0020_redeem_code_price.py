"""add redeem code price

Revision ID: 0020_redeem_code_price
Revises: 0019_decimal_points
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_redeem_code_price"
down_revision = "0019_decimal_points"
branch_labels = None
depends_on = None


MONEY_DECIMAL = sa.Numeric(14, 2)


def _existing_columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    code_columns = _existing_columns("flow_point_redeem_codes")
    if "price" not in code_columns:
        with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
            batch_op.add_column(sa.Column("price", MONEY_DECIMAL, nullable=False, server_default="0.00"))

    record_columns = _existing_columns("flow_point_redeem_records")
    if "price" not in record_columns:
        with op.batch_alter_table("flow_point_redeem_records") as batch_op:
            batch_op.add_column(sa.Column("price", MONEY_DECIMAL, nullable=False, server_default="0.00"))


def downgrade() -> None:
    record_columns = _existing_columns("flow_point_redeem_records")
    if "price" in record_columns:
        with op.batch_alter_table("flow_point_redeem_records") as batch_op:
            batch_op.drop_column("price")

    code_columns = _existing_columns("flow_point_redeem_codes")
    if "price" in code_columns:
        with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
            batch_op.drop_column("price")
