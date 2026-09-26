"""phase_3_business_models

Revision ID: 160311329577
Revises: fe280c22a60e
Create Date: 2026-09-04 10:37:39.904791

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '160311329577'
down_revision: Union[str, Sequence[str], None] = 'fe280c22a60e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # factories
    op.create_table('factories',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_factories_company_id'), 'factories', ['company_id'], unique=False)

    # products
    op.create_table('products',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_products_company_id'), 'products', ['company_id'], unique=False)

    # customers
    op.create_table('customers',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customers_company_id'), 'customers', ['company_id'], unique=False)

    # vendors
    op.create_table('vendors',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendors_company_id'), 'vendors', ['company_id'], unique=False)

    # inventory_items
    op.create_table('inventory_items',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('factory_id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['factory_id'], ['factories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_items_company_id'), 'inventory_items', ['company_id'], unique=False)
    op.create_index(op.f('ix_inventory_items_factory_id'), 'inventory_items', ['factory_id'], unique=False)
    op.create_index(op.f('ix_inventory_items_product_id'), 'inventory_items', ['product_id'], unique=False)

    # financial_transactions
    op.create_table('financial_transactions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('factory_id', sa.Uuid(), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency_code', sa.String(length=3), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('customer_id', sa.Uuid(), nullable=True),
        sa.Column('vendor_id', sa.Uuid(), nullable=True),
        sa.Column('product_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['factory_id'], ['factories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_financial_transactions_company_id'), 'financial_transactions', ['company_id'], unique=False)
    op.create_index(op.f('ix_financial_transactions_customer_id'), 'financial_transactions', ['customer_id'], unique=False)
    op.create_index(op.f('ix_financial_transactions_factory_id'), 'financial_transactions', ['factory_id'], unique=False)
    op.create_index(op.f('ix_financial_transactions_product_id'), 'financial_transactions', ['product_id'], unique=False)
    op.create_index(op.f('ix_financial_transactions_transaction_date'), 'financial_transactions', ['transaction_date'], unique=False)
    op.create_index(op.f('ix_financial_transactions_transaction_type'), 'financial_transactions', ['transaction_type'], unique=False)
    op.create_index(op.f('ix_financial_transactions_vendor_id'), 'financial_transactions', ['vendor_id'], unique=False)

    # kpi_snapshots
    op.create_table('kpi_snapshots',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('company_id', sa.Uuid(), nullable=False),
        sa.Column('factory_id', sa.Uuid(), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('metric_name', sa.String(length=100), nullable=False),
        sa.Column('metric_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['factory_id'], ['factories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_kpi_snapshots_company_id'), 'kpi_snapshots', ['company_id'], unique=False)
    op.create_index(op.f('ix_kpi_snapshots_factory_id'), 'kpi_snapshots', ['factory_id'], unique=False)
    op.create_index(op.f('ix_kpi_snapshots_metric_name'), 'kpi_snapshots', ['metric_name'], unique=False)
    op.create_index(op.f('ix_kpi_snapshots_snapshot_date'), 'kpi_snapshots', ['snapshot_date'], unique=False)

def downgrade() -> None:
    op.drop_table('kpi_snapshots')
    op.drop_table('financial_transactions')
    op.drop_table('inventory_items')
    op.drop_table('vendors')
    op.drop_table('customers')
    op.drop_table('products')
    op.drop_table('factories')
