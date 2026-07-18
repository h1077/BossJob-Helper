"""add user ip tracking

Revision ID: 0014_user_ip_tracking
Revises: 0013_template_sort_order
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_user_ip_tracking"
down_revision = "0013_template_sort_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("register_ip", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("last_login_ip", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("last_login_time", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("last_login_time")
        batch_op.drop_column("last_login_ip")
        batch_op.drop_column("register_ip")
