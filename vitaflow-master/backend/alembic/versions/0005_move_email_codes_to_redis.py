"""move email verification codes to redis

Revision ID: 0005_move_email_codes_to_redis
Revises: 0004_email_verification
Create Date: 2026-06-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_move_email_codes_to_redis"
down_revision = "0004_email_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_email_verification_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")


def downgrade() -> None:
    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(100), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_email_verification_codes_email", "email_verification_codes", ["email"])
