"""add ai configs and flow points

Revision ID: 0010_ai_config_points
Revises: 0009_redis_dismissals
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_ai_config_points"
down_revision = "0009_redis_dismissals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("flow_points", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("ai_tasks", sa.Column("model_name", sa.String(120), nullable=True))
    op.add_column("ai_tasks", sa.Column("points_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("ai_tasks", sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("ai_chat_messages", sa.Column("attachments", sa.JSON(), nullable=True))
    op.add_column("announcements", sa.Column("read_count", sa.Integer(), nullable=False, server_default="0"))

    op.create_table(
        "ai_model_configs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(80), nullable=False, server_default="默认模型"),
        sa.Column("provider", sa.String(50), nullable=False, server_default="openai-compatible"),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("api_key", sa.String(1000), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("timeout", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("max_tokens", sa.Integer(), nullable=True),
        sa.Column("supports_multimodal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("context_messages", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ai_model_configs_is_active", "ai_model_configs", ["is_active"])

    op.create_table(
        "flow_point_rules",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("feature_type", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("points_per_call", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("points_per_1k_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_flow_point_rules_feature_type", "flow_point_rules", ["feature_type"], unique=True)

    op.create_table(
        "flow_point_transactions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("task_id", sa.BigInteger(), nullable=True),
        sa.Column("feature_type", sa.String(50), nullable=False),
        sa.Column("points_delta", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
        sa.Column("create_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_flow_point_transactions_user_id", "flow_point_transactions", ["user_id"])
    op.create_index("ix_flow_point_transactions_task_id", "flow_point_transactions", ["task_id"])
    op.create_index("ix_flow_point_transactions_feature_type", "flow_point_transactions", ["feature_type"])
    op.create_index("ix_flow_point_transactions_create_time", "flow_point_transactions", ["create_time"])

    op.create_table(
        "flow_point_redeem_codes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("batch_no", sa.String(80), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expire_time", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_flow_point_redeem_codes_code", "flow_point_redeem_codes", ["code"], unique=True)
    op.create_index("ix_flow_point_redeem_codes_batch_no", "flow_point_redeem_codes", ["batch_no"])
    op.create_index("ix_flow_point_redeem_codes_expire_time", "flow_point_redeem_codes", ["expire_time"])
    op.create_index("ix_flow_point_redeem_codes_status", "flow_point_redeem_codes", ["status"])
    op.create_index("ix_flow_point_redeem_codes_created_by", "flow_point_redeem_codes", ["created_by"])

    op.create_table(
        "flow_point_redeem_records",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("code_id", sa.BigInteger(), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("code_id", "user_id", name="uq_flow_point_redeem_user"),
    )
    op.create_index("ix_flow_point_redeem_records_code_id", "flow_point_redeem_records", ["code_id"])
    op.create_index("ix_flow_point_redeem_records_code", "flow_point_redeem_records", ["code"])
    op.create_index("ix_flow_point_redeem_records_user_id", "flow_point_redeem_records", ["user_id"])
    op.create_index("ix_flow_point_redeem_records_create_time", "flow_point_redeem_records", ["create_time"])

    op.create_table(
        "announcement_reads",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("announcement_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_read"),
    )
    op.create_index("ix_announcement_reads_announcement_id", "announcement_reads", ["announcement_id"])
    op.create_index("ix_announcement_reads_user_id", "announcement_reads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_announcement_reads_user_id", table_name="announcement_reads")
    op.drop_index("ix_announcement_reads_announcement_id", table_name="announcement_reads")
    op.drop_table("announcement_reads")
    op.drop_index("ix_flow_point_redeem_records_create_time", table_name="flow_point_redeem_records")
    op.drop_index("ix_flow_point_redeem_records_user_id", table_name="flow_point_redeem_records")
    op.drop_index("ix_flow_point_redeem_records_code", table_name="flow_point_redeem_records")
    op.drop_index("ix_flow_point_redeem_records_code_id", table_name="flow_point_redeem_records")
    op.drop_table("flow_point_redeem_records")
    op.drop_index("ix_flow_point_redeem_codes_created_by", table_name="flow_point_redeem_codes")
    op.drop_index("ix_flow_point_redeem_codes_status", table_name="flow_point_redeem_codes")
    op.drop_index("ix_flow_point_redeem_codes_expire_time", table_name="flow_point_redeem_codes")
    op.drop_index("ix_flow_point_redeem_codes_batch_no", table_name="flow_point_redeem_codes")
    op.drop_index("ix_flow_point_redeem_codes_code", table_name="flow_point_redeem_codes")
    op.drop_table("flow_point_redeem_codes")
    op.drop_index("ix_flow_point_transactions_create_time", table_name="flow_point_transactions")
    op.drop_index("ix_flow_point_transactions_feature_type", table_name="flow_point_transactions")
    op.drop_index("ix_flow_point_transactions_task_id", table_name="flow_point_transactions")
    op.drop_index("ix_flow_point_transactions_user_id", table_name="flow_point_transactions")
    op.drop_table("flow_point_transactions")
    op.drop_index("ix_flow_point_rules_feature_type", table_name="flow_point_rules")
    op.drop_table("flow_point_rules")
    op.drop_index("ix_ai_model_configs_is_active", table_name="ai_model_configs")
    op.drop_table("ai_model_configs")
    op.drop_column("announcements", "read_count")
    op.drop_column("ai_chat_messages", "attachments")
    op.drop_column("ai_tasks", "tokens_used")
    op.drop_column("ai_tasks", "points_used")
    op.drop_column("ai_tasks", "model_name")
    op.drop_column("users", "flow_points")
