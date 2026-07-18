"""add protected resume sharing

Revision ID: 0016_resume_sharing
Revises: 0015_redeem_code_ip_controls
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_resume_sharing"
down_revision = "0015_redeem_code_ip_controls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("resumes") as batch_op:
        batch_op.add_column(sa.Column("share_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column("share_token", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("share_expire_time", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("share_created_time", sa.DateTime(), nullable=True))
        batch_op.create_index("ix_resumes_share_enabled", ["share_enabled"])
        batch_op.create_index("ix_resumes_share_token", ["share_token"], unique=True)
        batch_op.create_index("ix_resumes_share_expire_time", ["share_expire_time"])


def downgrade() -> None:
    with op.batch_alter_table("resumes") as batch_op:
        batch_op.drop_index("ix_resumes_share_expire_time")
        batch_op.drop_index("ix_resumes_share_token")
        batch_op.drop_index("ix_resumes_share_enabled")
        batch_op.drop_column("share_created_time")
        batch_op.drop_column("share_expire_time")
        batch_op.drop_column("share_token")
        batch_op.drop_column("share_enabled")
