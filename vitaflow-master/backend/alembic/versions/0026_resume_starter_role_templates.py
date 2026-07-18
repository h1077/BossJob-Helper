"""add per starter default template

Revision ID: 0026_starter_tpl
Revises: 0025_industry_tpls
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0026_starter_tpl"
down_revision = "0025_industry_tpls"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _columns("resume_starters")
    if "default_template_id" not in columns:
        op.add_column(
            "resume_starters",
            sa.Column("default_template_id", sa.String(length=50), nullable=False, server_default="tech"),
        )

    op.execute(
        """
        UPDATE resume_starters
        SET default_template_id = CASE
            WHEN industry_id = 'data-ai' THEN 'blue_timeline'
            WHEN industry_id = 'finance' THEN 'executive_panel'
            WHEN industry_id = 'education' THEN 'classic'
            WHEN industry_id = 'healthcare' THEN 'modern_clean'
            WHEN industry_id = 'manufacturing' THEN 'compact_matrix'
            WHEN industry_id = 'sales' THEN 'executive_panel'
            WHEN industry_id = 'design-media' THEN 'portfolio_cards'
            WHEN industry_id = 'hr-admin' THEN 'modern_clean'
            WHEN industry_id = 'marketing' THEN 'editorial_serif'
            WHEN industry_id = 'ecommerce-retail' THEN 'modern_clean'
            WHEN industry_id = 'operations-service' THEN 'modern_clean'
            WHEN industry_id = 'logistics-supply' THEN 'compact_matrix'
            WHEN industry_id = 'construction-realestate' THEN 'compact_matrix'
            WHEN industry_id = 'legal-compliance' THEN 'elegant_line'
            WHEN industry_id = 'energy-environment' THEN 'compact_matrix'
            WHEN industry_id = 'hospitality-tourism' THEN 'modern_clean'
            WHEN industry_id = 'food-agriculture' THEN 'classic'
            ELSE 'tech'
        END
        WHERE default_template_id IS NULL OR default_template_id = ''
        """
    )


def downgrade() -> None:
    columns = _columns("resume_starters")
    if "default_template_id" in columns:
        op.drop_column("resume_starters", "default_template_id")
