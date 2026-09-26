"""API v1 router"""

from fastapi import APIRouter

from app.api.v1 import auth, products, sales, dashboard, admin, returns, customers, atlas


router = APIRouter()

# Include all endpoint routers
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(products.router, prefix="/products", tags=["Products"])
router.include_router(sales.router, prefix="/sales", tags=["Sales"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
router.include_router(admin.router, prefix="/admin", tags=["Admin"])
router.include_router(returns.router, prefix="/returns", tags=["Returns & Exchange"])
router.include_router(customers.router, prefix="/customers", tags=["Customers"])
router.include_router(atlas.router, prefix="/atlas", tags=["Atlas Analytics"])
