"""Main FastAPI application"""

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import logging
from logging.handlers import RotatingFileHandler
import os
from urllib.parse import urlparse

from app.core.config import settings
from app.core.cache import (
    init_cache,
    close_cache,
    cache_set,
    PRODUCTS_LIST_KEY,
    cache_stats,
)
from app.core.product_store import product_store
from app.core.rate_limiter import limiter
from app.api.v1 import router as api_v1_router
from app.services.sap.client import get_sap_client, close_sap_client
from app.services import user_service
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


# Configure logging
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        RotatingFileHandler("logs/app.log", maxBytes=10485760, backupCount=5),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)


async def cache_metrics_loop() -> None:
    """Emit cache metrics periodically for production observability."""
    while True:
        await asyncio.sleep(300)
        stats = await cache_stats()
        logger.info(
            "Cache stats: keys=%s, valid=%s, expired=%s",
            stats["keys_total"],
            stats["keys_valid"],
            stats["keys_expired"],
        )


async def warm_products_cache():
    """
    Background task to pre-load products into in-memory cache on startup.
    This ensures the first user request is fast.
    """
    try:
        from app.services.sap.items_service import SAPItemsService
        from app.models.schemas import ProductResponse
        
        logger.info("Starting products cache warming...")
        sap_service = SAPItemsService()
        # Store relative image paths in cache. The products endpoint will
        # absolutize them per-request using PUBLIC_BASE_URL / forwarded headers.
        base_url = None
        
        # Fetch all items from SAP (using parallel pagination)
        sap_items = sap_service.get_items()
        
        # Convert to response format
        products = []
        for sap_item in sap_items:
            category = sap_item.get("U_SUBG") or sap_item.get("ItemsGroupCode")
            if isinstance(category, int):
                category = str(category)
            
            warehouses = sap_item.get("ItemWarehouseInfoCollection") or []
            stock = 0.0
            warehouse_code = None
            best_wh_stock = 0.0

            if warehouses:
                for wh in warehouses:
                    wh_stock = float(wh.get("InStock") or 0)
                    stock += wh_stock
                    if wh_stock > best_wh_stock:
                        best_wh_stock = wh_stock
                        warehouse_code = wh.get("WarehouseCode")
            else:
                stock = float(sap_item.get("QuantityOnStock") or 0)
            
            product = ProductResponse(
                id=sap_item.get("ItemCode") or "",
                name=sap_item.get("ItemName") or "",
                price=sap_service.extract_price(sap_item),
                barcode=sap_item.get("BarCode") or "",
                stock=stock,
                image=sap_service.extract_image_url(sap_item, base_url=base_url),
                category=category,
                brand=sap_item.get("U_Brand"),
                warehouse=warehouse_code,
            )
            products.append(product.model_dump())
        
        # Store in in-memory cache (10 minute TTL)
        await cache_set(PRODUCTS_LIST_KEY, products, ttl=600)
        logger.info(f"Products cache warmed: {len(products)} items cached")
        
    except Exception as e:
        logger.error(f"Failed to warm products cache: {e}")
        # Don't fail startup - cache will be populated on first request


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events

    Startup:
    - Initialise in-memory cache
    - Connect to SAP Service Layer

    Shutdown:
    - Stop in-memory cache
    - Close SAP connection
    """
    logger.info("Starting POS Backend API...")
    sap_host = urlparse(settings.SAP_SERVICE_LAYER_URL).netloc or settings.SAP_SERVICE_LAYER_URL
    logger.info(
        "Runtime config: debug=%s log_level=%s cors_origins=%s sap_host=%s",
        settings.DEBUG,
        settings.LOG_LEVEL,
        len(settings.CORS_ORIGINS),
        sap_host,
    )

    # Initialise in-memory cache
    await init_cache()
    asyncio.create_task(cache_metrics_loop())

    # Initialise PostgreSQL-backed user storage.
    try:
        user_service.init_user_storage()
        logger.info("User storage is ready")
        from app.services import approval_service
        approval_service.init_approval_storage()
        logger.info("Approval storage is ready")
    except Exception as e:
        logger.error(f"User storage initialization failed: {str(e)}")
        logger.warning("Authentication endpoints will be unavailable until PostgreSQL is configured")

    # Connect to SAP Service Layer
    try:
        sap_client = get_sap_client()
        sap_client.login()
        logger.info("Connected to SAP Business One Service Layer")
        
        # Start background cache warming (don't block startup)
        asyncio.create_task(warm_products_cache())

        # Start the long-lived product store background refresh (every ~60 min)
        from app.services.sap.items_service import SAPItemsService as _SAPItemsService
        _items_svc = _SAPItemsService()
        await product_store.start_background_refresh_task(_items_svc.get_items)
        
    except Exception as e:
        logger.error(f"SAP connection failed: {str(e)}")
        logger.warning("Application will continue with limited functionality")

    logger.info(f"{settings.APP_NAME} v{settings.APP_VERSION} is ready!")

    yield

    logger.info("Shutting down POS Backend API...")

    # Stop the product store background refresh task
    await product_store.stop()

    # Stop in-memory cache
    await close_cache()

    # Close SAP connection
    try:
        close_sap_client()
        logger.info("SAP connection closed")
    except Exception as e:
        logger.error(f"Error closing SAP connection: {str(e)}")

    logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Point of Sale Backend API with SAP Business One Integration",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compress responses ≥ 1 KB (reduces payload for large product lists)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Rate-limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Structured request/response logging with latency and request-id."""
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    start = time.perf_counter()
    path = request.url.path
    method = request.method

    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "Request failed: id=%s method=%s path=%s duration_ms=%.2f",
            request_id,
            method,
            path,
            elapsed_ms,
        )
        raise

    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id

    if elapsed_ms >= 1000:
        logger.warning(
            "Slow request: id=%s method=%s path=%s status=%s duration_ms=%.2f",
            request_id,
            method,
            path,
            response.status_code,
            elapsed_ms,
        )
    else:
        logger.info(
            "Request: id=%s method=%s path=%s status=%s duration_ms=%.2f",
            request_id,
            method,
            path,
            response.status_code,
            elapsed_ms,
        )

    return response


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    logger.error(f"Request: {request.method} {request.url}")
    logger.error(f"Headers: {dict(request.headers)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred",
        },
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint distinguishing app liveness from SAP/DB liveness"""
    sap_status = "unavailable"
    db_status = "unavailable"
    
    # Check SAP
    try:
        from app.services.sap.client import get_sap_client
        client = get_sap_client()
        # Ensure it's logged in or try a lightweight call
        if client.session_id:
            sap_status = "connected"
    except Exception as e:
        logger.warning(f"Health check SAP failure: {e}")

    # Check DB
    try:
        from app.services.user_service import _get_connection
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                if cur.fetchone():
                    db_status = "connected"
    except Exception as e:
        logger.warning(f"Health check DB failure: {e}")

    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "dependencies": {
            "sap": sap_status,
            "database": db_status
        }
    }


# Include API routers
app.include_router(api_v1_router, prefix="/api/v1")


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
