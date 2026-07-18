"""backfill per starter default templates

Revision ID: 0027_starter_tpl_backfill
Revises: 0026_starter_tpl
Create Date: 2026-06-30
"""

from alembic import op


revision = "0027_starter_tpl_backfill"
down_revision = "0026_starter_tpl"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
        """
    )


def downgrade() -> None:
    op.execute("UPDATE resume_starters SET default_template_id = 'tech'")
