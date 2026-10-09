"""API v1 router"""

from fastapi import APIRouter

from app.api.v1 import auth, inventory_report, products, sales, sales_orders, purchase_orders, dashboard, admin, returns, customers, atlas, payments_report, production, ai


router = APIRouter()

# Include all endpoint routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(products.router, prefix="/products", tags=["Products"])
router.include_router(sales.router, prefix="/sales", tags=["Sales"])
router.include_router(sales_orders.router, prefix="/sales-orders", tags=["Sales Orders"])
router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["Purchase Orders"])
router.include_router(production.router, prefix="/production", tags=["Production"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
router.include_router(admin.router, prefix="/admin", tags=["Admin"])
router.include_router(returns.router, prefix="/returns", tags=["Returns & Exchange"])
router.include_router(customers.router, prefix="/customers", tags=["Customers"])
router.include_router(atlas.router, prefix="/atlas", tags=["Atlas Analytics"])

router.include_router(payments_report.router, prefix="/reports/payments", tags=["Payment Reports"])

router.include_router(inventory_report.router, prefix="/reports/inventory", tags=["Inventory Reports"])
router.include_router(ai.router, prefix="/ai-assistant", tags=["AI Assistant"])
