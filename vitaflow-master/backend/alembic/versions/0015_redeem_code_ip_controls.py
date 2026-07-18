"""add redeem code ip controls

Revision ID: 0015_redeem_code_ip_controls
Revises: 0014_user_ip_tracking
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_redeem_code_ip_controls"
down_revision = "0014_user_ip_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
        batch_op.add_column(sa.Column("ip_once", sa.Boolean(), nullable=False, server_default=sa.false()))

    with op.batch_alter_table("flow_point_redeem_records") as batch_op:
        batch_op.add_column(sa.Column("ip_address", sa.String(length=64), nullable=True))
        batch_op.create_index("ix_flow_point_redeem_records_ip_address", ["ip_address"])
        batch_op.create_index("ix_flow_point_redeem_records_code_ip", ["code_id", "ip_address"])


def downgrade() -> None:
    with op.batch_alter_table("flow_point_redeem_records") as batch_op:
        batch_op.drop_index("ix_flow_point_redeem_records_code_ip")
        batch_op.drop_index("ix_flow_point_redeem_records_ip_address")
        batch_op.drop_column("ip_address")

    with op.batch_alter_table("flow_point_redeem_codes") as batch_op:
        batch_op.drop_column("ip_once")
