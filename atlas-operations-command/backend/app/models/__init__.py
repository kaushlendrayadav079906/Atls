from app.core.database import Base
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.models.user_credential import UserCredential

# Phase 3 models
from app.models.factory import Factory
from app.models.product import Product
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.inventory_item import InventoryItem
from app.models.financial_transaction import FinancialTransaction
from app.models.kpi_snapshot import KpiSnapshot

# Phase 4 models
from app.models.upload import FileUpload
from app.models.staging import StagedRecord

# Phase 5B models
from app.models.risk import Risk, AiRecommendedAction, ExecutiveBriefing

# Phase 7A models
from app.models.exchange_rate import ExchangeRate

