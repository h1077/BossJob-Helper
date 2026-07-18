"""email verification codes

Revision ID: 0004_email_verification
Revises: 0003_ai_chat_action_status
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_email_verification"
down_revision = "0003_ai_chat_action_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_index("ix_email_verification_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
