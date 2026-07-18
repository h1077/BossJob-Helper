"""add user role and status

Revision ID: 0006_user_role_status
Revises: 0005_move_email_codes_to_redis
Create Date: 2026-06-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_user_role_status"
down_revision = "0005_move_email_codes_to_redis"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="user"))
    op.add_column("users", sa.Column("status", sa.String(20), nullable=False, server_default="active"))
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_status", "users", ["status"])


def downgrade() -> None:
    op.drop_index("ix_users_status", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "status")
    op.drop_column("users", "role")
