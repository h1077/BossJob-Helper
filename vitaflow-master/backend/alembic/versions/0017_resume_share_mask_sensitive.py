"""add sensitive information masking for resume sharing

Revision ID: 0017_resume_share_mask_sensitive
Revises: 0016_resume_sharing
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_resume_share_mask_sensitive"
down_revision = "0016_resume_sharing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("resumes") as batch_op:
        batch_op.add_column(
            sa.Column("share_mask_sensitive", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("resumes") as batch_op:
        batch_op.drop_column("share_mask_sensitive")
