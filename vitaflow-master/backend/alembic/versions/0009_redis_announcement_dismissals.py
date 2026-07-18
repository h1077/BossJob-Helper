"""move announcement dismissals to redis

Revision ID: 0009_redis_dismissals
Revises: 0008_announcements
Create Date: 2026-06-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_redis_dismissals"
down_revision = "0008_announcements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "announcement_dismissals" not in inspector.get_table_names():
        return
    index_names = {item["name"] for item in inspector.get_indexes("announcement_dismissals")}
    if "ix_announcement_dismissals_user_id" in index_names:
        op.drop_index("ix_announcement_dismissals_user_id", table_name="announcement_dismissals")
    if "ix_announcement_dismissals_announcement_id" in index_names:
        op.drop_index("ix_announcement_dismissals_announcement_id", table_name="announcement_dismissals")
    op.drop_table("announcement_dismissals")


def downgrade() -> None:
    op.create_table(
        "announcement_dismissals",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("announcement_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_dismissal"),
    )
    op.create_index("ix_announcement_dismissals_announcement_id", "announcement_dismissals", ["announcement_id"])
    op.create_index("ix_announcement_dismissals_user_id", "announcement_dismissals", ["user_id"])
