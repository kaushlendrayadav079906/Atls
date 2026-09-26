"""phase_7a_localization_and_currency_schema

Revision ID: 7a01b2c3d4e5
Revises: 5b01a2b3c4d5
Create Date: 2026-09-07 10:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a01b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '5b01a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter companies table
    op.add_column('companies', sa.Column('country_code', sa.String(length=2), nullable=True))
    op.add_column('companies', sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'))
    op.add_column('companies', sa.Column('locale', sa.String(length=20), nullable=False, server_default='en-US'))
    op.add_column('companies', sa.Column('state_code', sa.String(length=10), nullable=True))
    op.add_column('companies', sa.Column('gstin', sa.String(length=15), nullable=True))
    op.add_column('companies', sa.Column('tax_id', sa.String(length=50), nullable=True))
    op.add_column('companies', sa.Column('default_tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'))

    # 2. Alter financial_transactions table
    op.add_column('financial_transactions', sa.Column('amount_base', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
    op.add_column('financial_transactions', sa.Column('exchange_rate', sa.Numeric(precision=12, scale=6), nullable=False, server_default='1.000000'))
    op.add_column('financial_transactions', sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'))
    op.add_column('financial_transactions', sa.Column('tax_amount', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
    op.add_column('financial_transactions', sa.Column('is_tax_inclusive', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    op.add_column('financial_transactions', sa.Column('hsn_sac_code', sa.String(length=20), nullable=True))

    # Backfill historical financial_transactions: amount_base = amount where amount_base is 0 or unassigned
    op.execute("UPDATE financial_transactions SET amount_base = amount, exchange_rate = 1.000000, tax_rate = 0.00, tax_amount = 0.00, is_tax_inclusive = 0")

    # 3. Create exchange_rates table
    op.create_table(
        'exchange_rates',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=True),
        sa.Column('from_currency', sa.String(length=3), nullable=False),
        sa.Column('to_currency', sa.String(length=3), nullable=False),
        sa.Column('rate', sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'from_currency', 'to_currency', 'effective_date', name='uq_exchange_rates_company_pair_date')
    )
    op.create_index(op.f('ix_exchange_rates_company_id'), 'exchange_rates', ['company_id'], unique=False)
    op.create_index(op.f('ix_exchange_rates_from_currency'), 'exchange_rates', ['from_currency'], unique=False)
    op.create_index(op.f('ix_exchange_rates_to_currency'), 'exchange_rates', ['to_currency'], unique=False)
    op.create_index(op.f('ix_exchange_rates_effective_date'), 'exchange_rates', ['effective_date'], unique=False)


def downgrade() -> None:
    # 1. Drop exchange_rates table and indexes
    op.drop_index(op.f('ix_exchange_rates_effective_date'), table_name='exchange_rates')
    op.drop_index(op.f('ix_exchange_rates_to_currency'), table_name='exchange_rates')
    op.drop_index(op.f('ix_exchange_rates_from_currency'), table_name='exchange_rates')
    op.drop_index(op.f('ix_exchange_rates_company_id'), table_name='exchange_rates')
    op.drop_table('exchange_rates')

    # 2. Drop columns from financial_transactions
    op.drop_column('financial_transactions', 'hsn_sac_code')
    op.drop_column('financial_transactions', 'is_tax_inclusive')
    op.drop_column('financial_transactions', 'tax_amount')
    op.drop_column('financial_transactions', 'tax_rate')
    op.drop_column('financial_transactions', 'exchange_rate')
    op.drop_column('financial_transactions', 'amount_base')

    # 3. Drop columns from companies
    op.drop_column('companies', 'default_tax_rate')
    op.drop_column('companies', 'tax_id')
    op.drop_column('companies', 'gstin')
    op.drop_column('companies', 'state_code')
    op.drop_column('companies', 'locale')
    op.drop_column('companies', 'timezone')
    op.drop_column('companies', 'country_code')
