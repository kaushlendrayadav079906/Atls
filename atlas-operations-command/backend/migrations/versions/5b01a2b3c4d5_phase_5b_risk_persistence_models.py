"""phase_5b_risk_persistence_models

Revision ID: 5b01a2b3c4d5
Revises: 160311329577
Create Date: 2026-09-05 15:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b01a2b3c4d5'
down_revision: Union[str, Sequence[str], None] = '160311329577'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # risks
    op.create_table('risks',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('likelihood_pct', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('financial_impact', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('department', sa.String(length=100), nullable=False, server_default='Operations'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='active'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risks_company_id'), 'risks', ['company_id'], unique=False)
    op.create_index(op.f('ix_risks_title'), 'risks', ['title'], unique=False)
    op.create_index(op.f('ix_risks_severity'), 'risks', ['severity'], unique=False)
    op.create_index(op.f('ix_risks_category'), 'risks', ['category'], unique=False)
    op.create_index(op.f('ix_risks_status'), 'risks', ['status'], unique=False)

    # ai_recommended_actions
    op.create_table('ai_recommended_actions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('cta_label', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_recommended_actions_company_id'), 'ai_recommended_actions', ['company_id'], unique=False)
    op.create_index(op.f('ix_ai_recommended_actions_title'), 'ai_recommended_actions', ['title'], unique=False)
    op.create_index(op.f('ix_ai_recommended_actions_severity'), 'ai_recommended_actions', ['severity'], unique=False)
    op.create_index(op.f('ix_ai_recommended_actions_category'), 'ai_recommended_actions', ['category'], unique=False)
    op.create_index(op.f('ix_ai_recommended_actions_status'), 'ai_recommended_actions', ['status'], unique=False)

    # executive_briefings
    op.create_table('executive_briefings',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('summary_text', sa.Text(), nullable=False),
        sa.Column('critical_issues', sa.JSON(), nullable=False),
        sa.Column('business_impact', sa.JSON(), nullable=False),
        sa.Column('priority_actions', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_executive_briefings_company_id'), 'executive_briefings', ['company_id'], unique=False)
    op.create_index(op.f('ix_executive_briefings_generated_at'), 'executive_briefings', ['generated_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_executive_briefings_generated_at'), table_name='executive_briefings')
    op.drop_index(op.f('ix_executive_briefings_company_id'), table_name='executive_briefings')
    op.drop_table('executive_briefings')

    op.drop_index(op.f('ix_ai_recommended_actions_status'), table_name='ai_recommended_actions')
    op.drop_index(op.f('ix_ai_recommended_actions_category'), table_name='ai_recommended_actions')
    op.drop_index(op.f('ix_ai_recommended_actions_severity'), table_name='ai_recommended_actions')
    op.drop_index(op.f('ix_ai_recommended_actions_title'), table_name='ai_recommended_actions')
    op.drop_index(op.f('ix_ai_recommended_actions_company_id'), table_name='ai_recommended_actions')
    op.drop_table('ai_recommended_actions')

    op.drop_index(op.f('ix_risks_status'), table_name='risks')
    op.drop_index(op.f('ix_risks_category'), table_name='risks')
    op.drop_index(op.f('ix_risks_severity'), table_name='risks')
    op.drop_index(op.f('ix_risks_title'), table_name='risks')
    op.drop_index(op.f('ix_risks_company_id'), table_name='risks')
    op.drop_table('risks')
