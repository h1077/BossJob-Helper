"""add ai task statistics indexes

Revision ID: 0007_ai_task_stats_indexes
Revises: 0006_user_role_status
Create Date: 2026-06-20
"""

from alembic import op


revision = "0007_ai_task_stats_indexes"
down_revision = "0006_user_role_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_ai_tasks_task_type", "ai_tasks", ["task_type"])
    op.create_index("ix_ai_tasks_status", "ai_tasks", ["status"])
    op.create_index("ix_ai_tasks_create_time", "ai_tasks", ["create_time"])


def downgrade() -> None:
    op.drop_index("ix_ai_tasks_create_time", table_name="ai_tasks")
    op.drop_index("ix_ai_tasks_status", table_name="ai_tasks")
    op.drop_index("ix_ai_tasks_task_type", table_name="ai_tasks")
