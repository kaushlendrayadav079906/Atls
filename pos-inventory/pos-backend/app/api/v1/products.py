"""Products API endpoints – SAP-only, in-memory-cached, ETag, rate-limited."""

import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import time
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
import logging
import os
from mimetypes import guess_type
from urllib.parse import quote

from fastapi.responses import RedirectResponse

from app.core.cache import (
    cache_get, cache_set, cache_delete, make_etag, PRODUCTS_LIST_KEY,
)
from app.core.product_store import product_store
from app.core.rate_limiter import limiter
from app.core.security import get_current_user, require_admin, require_manager_or_admin
from app.core.config import settings
from app.models.schemas import ProductCreate, ProductUpdate, ProductResponse
from app.services.sap.items_service import SAPItemsService
from app.services.sap.client import SAPValidationError


router = APIRouter()
logger = logging.getLogger(__name__)

# Cache TTL for the full products list (10 minutes)
_PRODUCTS_TTL = 600

# Thread pool for running sync SAP calls.
# Size: enough to handle concurrent users without overwhelming SAP.
import os as _os
_executor = ThreadPoolExecutor(max_workers=min(32, (_os.cpu_count() or 4) * 4))

# In-memory miss cache (avoids hammering SAP for items with no image)
_image_miss_cache: dict[str, tuple[float, str]] = {}
_image_miss_cache_lock = asyncio.Lock()
_IMAGE_MISS_TTL = 300


def _public_base_url(request: Request) -> str:
    """Resolve the externally reachable base URL.

    Prefer explicit PUBLIC_BASE_URL. Otherwise, attempt to respect common
    reverse-proxy headers (IIS/ARR), then fall back to request.base_url.
    """
    if settings.PUBLIC_BASE_URL:
        return settings.PUBLIC_BASE_URL.rstrip("/")

    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        return f"{proto}://{host}".rstrip("/")

    return str(request.base_url).rstrip("/")


def _absolutize_image_url(image: str | None, base_url: str) -> str | None:
    if not image:
        return image
    if image.startswith("/"):
        return f"{base_url}{image}"
    return image


def _if_none_match_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False

    etag_value = etag.strip()
    if etag_value.startswith("W/"):
        etag_value = etag_value[2:].strip()
    if len(etag_value) >= 2 and etag_value[0] == '"' and etag_value[-1] == '"':
        etag_value = etag_value[1:-1]

    for candidate in (c.strip() for c in if_none_match.split(",")):
        if not candidate:
            continue
        if candidate == "*":
            return True

        cand_value = candidate
        if cand_value.startswith("W/"):
            cand_value = cand_value[2:].strip()
        if len(cand_value) >= 2 and cand_value[0] == '"' and cand_value[-1] == '"':
            cand_value = cand_value[1:-1]

        if cand_value == etag_value:
            return True

    return False


def _bytes_etag(data: bytes) -> str:
    return f'"{hashlib.md5(data).hexdigest()}"'


async def _image_cache_get(key: str) -> tuple[bytes, str | None, str] | None:
    """Read image from the single shared cache store."""
    cached = await cache_get(key)
    if isinstance(cached, dict) and cached.get("b64"):
        try:
            data = base64.b64decode(cached["b64"])
            content_type = cached.get("content_type")
            etag = cached.get("etag") or _bytes_etag(data)
            return data, content_type, etag
        except Exception:
            pass
    return None


async def _image_cache_set(key: str, data: bytes, content_type: str | None) -> str:
    """Write image to the single shared cache store."""
    ttl = int(settings.CACHE_PRODUCT_IMAGES_TTL)
    etag = _bytes_etag(data)
    await cache_set(
        key,
        {
            "b64": base64.b64encode(data).decode("ascii"),
            "content_type": content_type,
            "etag": etag,
        },
        ttl=ttl,
    )
    return etag


async def _image_miss_get(key: str) -> str | None:
    """Return miss detail string if this key is cached as a miss, else None."""
    cached = await cache_get(key)
    if cached is True:
        return "No image found for item"
    if isinstance(cached, dict) and cached.get("missing") is True:
        return str(cached.get("detail") or "No image found for item")

    now = time.time()
    async with _image_miss_cache_lock:
        entry = _image_miss_cache.get(key)
        if not entry:
            return None
        exp, detail = entry
        if exp <= now:
            _image_miss_cache.pop(key, None)
            return None
        return detail


async def _image_miss_set(key: str, detail: str) -> None:
    ttl = min(int(settings.CACHE_PRODUCT_IMAGES_TTL), _IMAGE_MISS_TTL)
    await cache_set(key, {"missing": True, "detail": detail}, ttl=ttl)
    async with _image_miss_cache_lock:
        _image_miss_cache[key] = (time.time() + ttl, detail)


def _to_response(sap_item: dict, sap_service: SAPItemsService, branch: Optional[str] = None) -> ProductResponse:
    """Convert a raw SAP item dict to a ProductResponse.

    If *branch* is provided (SAP WarehouseCode), stock is taken only from that
    warehouse so each operator sees only their branch's inventory.
    """
    # Convert category to string if it's an integer (ItemsGroupCode)
    category = sap_item.get("U_Category") or sap_item.get("U_SUBG") or sap_item.get("ItemsGroupCode")
    if isinstance(category, int):
        category = str(category)

    warehouses = sap_item.get("ItemWarehouseInfoCollection") or []
    stock = 0.0
    warehouse_code: str | None = None

    if warehouses:
        if branch:
            # Show stock only for the user's assigned branch warehouse
            branch_upper = branch.strip().upper()
            for wh in warehouses:
                if str(wh.get("WarehouseCode") or "").strip().upper() == branch_upper:
                    stock = float(wh.get("InStock") or 0)
                    warehouse_code = wh.get("WarehouseCode")
                    break
        else:
            # Admin / no branch: sum all warehouses, pick the best for the warehouse field
            best_wh_stock = 0.0
            for wh in warehouses:
                wh_stock = float(wh.get("InStock") or 0)
                stock += wh_stock
                if wh_stock > best_wh_stock:
                    best_wh_stock = wh_stock
                    warehouse_code = wh.get("WarehouseCode")
    else:
        stock = float(sap_item.get("QuantityOnStock") or 0)

    return ProductResponse(
        id=sap_item.get("ItemCode") or "",
        name=sap_item.get("ItemName") or "",
        price=sap_service.extract_price(sap_item),
        barcode=sap_item.get("BarCode") or "",  # Convert None to empty string
        stock=stock,
        # Cache/store as relative path; absolute URL is resolved per-request.
        image=sap_service.extract_image_url(sap_item, base_url=None),
        category=category,
        brand=sap_item.get("U_Brand"),  # Custom field - will be None if not present
        size=sap_item.get("U_Size"),    # UDF_SIZE
        color=sap_item.get("U_Colour"),  # UDF_COLOR
        warehouse=warehouse_code,
    )


@router.get("/{item_code}/image")
@limiter.limit(settings.RATE_LIMIT_IMAGES)
async def get_product_image(
    request: Request,
    item_code: str,
):
    """Proxy product image bytes from SAP attachments.

    Returns 404 when the item has no attachment image.
    """
    cache_key = f"pos:products:image:{item_code}"
    miss_key = f"{cache_key}:miss"

    miss_detail = await _image_miss_get(miss_key)
    if miss_detail is not None:
        raise HTTPException(status_code=404, detail=miss_detail)

    cached = await _image_cache_get(cache_key)
    if cached is not None:
        data, content_type, etag = cached
        if _if_none_match_matches(request.headers.get("if-none-match"), etag):
            return Response(status_code=304, headers={"ETag": etag})
        return Response(
            content=data,
            media_type=content_type or "application/octet-stream",
            headers={
                "Cache-Control": f"private, max-age={int(settings.CACHE_PRODUCT_IMAGES_TTL)}",
                "ETag": etag,
            },
        )

    sap_service = SAPItemsService()
    loop = asyncio.get_running_loop()
    try:
        data, content_type = await loop.run_in_executor(
            _executor, lambda: sap_service.get_item_image_data(item_code)
        )
    except SAPValidationError:
        # Fallback: some SAP systems only populate Items.Picture (filename/path)
        # and do not link attachments via AttachmentEntry.
        # Only fetch the minimal fields needed for Picture fallback.
        sap_item = await loop.run_in_executor(
            _executor,
            lambda: sap_service.get_item_by_code(item_code, select=["ItemCode", "ItemName", "Picture"]),
        )
        if not sap_item:
            await _image_miss_set(miss_key, "Product not found")
            raise HTTPException(status_code=404, detail="Product not found")

        picture = sap_item.get("Picture")
        if not picture:
            await _image_miss_set(miss_key, "No attachment/picture found for item")
            raise HTTPException(status_code=404, detail="No attachment/picture found for item")

        picture_name = os.path.basename(str(picture))
        # 1) Serve from local/shared filesystem if configured
        if settings.SAP_PICTURE_BASE_PATH:
            full_path = os.path.join(settings.SAP_PICTURE_BASE_PATH, picture_name)
            if not os.path.exists(full_path):
                await _image_miss_set(miss_key, f"Picture file not found on server: {picture_name}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Picture file not found on server: {picture_name}",
                )
            with open(full_path, "rb") as f:
                data = f.read()
            content_type = guess_type(picture_name)[0] or "application/octet-stream"
            etag = await _image_cache_set(cache_key, data, content_type)
            if _if_none_match_matches(request.headers.get("if-none-match"), etag):
                return Response(status_code=304, headers={"ETag": etag})
            return Response(
                content=data,
                media_type=content_type,
                headers={
                    "Cache-Control": f"private, max-age={int(settings.CACHE_PRODUCT_IMAGES_TTL)}",
                    "ETag": etag,
                },
            )

        # 2) Redirect to an HTTP-hosted image base URL if configured
        if settings.SAP_PICTURE_BASE_URL:
            safe_name = quote(picture_name)
            target = f"{settings.SAP_PICTURE_BASE_URL.rstrip('/')}/{safe_name}"
            return RedirectResponse(
                url=target,
                status_code=307,
                headers={"Cache-Control": f"private, max-age={int(settings.CACHE_PRODUCT_IMAGES_TTL)}"},
            )

        # No way to retrieve picture bytes in this environment
        await _image_miss_set(
            miss_key,
            (
                f"Item has Picture='{picture_name}' but Service Layer attachments are not linked; "
                "set SAP_PICTURE_BASE_PATH or SAP_PICTURE_BASE_URL to serve images"
            ),
        )
        raise HTTPException(
            status_code=404,
            detail=(
                f"Item has Picture='{picture_name}' but Service Layer attachments are not linked; "
                "set SAP_PICTURE_BASE_PATH or SAP_PICTURE_BASE_URL to serve images"
            ),
        )
    except Exception as exc:
        logger.error(f"SAP image fetch failed for {item_code}: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve product image from SAP")

    etag = await _image_cache_set(cache_key, data, content_type)
    if _if_none_match_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers={"ETag": etag})
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={
            "Cache-Control": f"private, max-age={int(settings.CACHE_PRODUCT_IMAGES_TTL)}",
            "ETag": etag,
        },
    )


@router.get("/health")
async def products_health():
    """Health check for products endpoint (no auth required)"""
    return {"status": "ok", "service": "products"}


@router.get("", response_model=List[ProductResponse])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_products(
    request: Request,
    response: Response,
    search: Optional[str] = Query(None, max_length=100, description="Search term (name, barcode, or code)"),
    force_refresh: bool = Query(False, description="Bypass and evict the server-side cache"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all products – served from in-memory cache when available (10 min TTL).
    Supports ETag / 304 Not Modified.
    Products are filtered to show stock only for the user's assigned branch warehouse.
    Requires: Authorization: Bearer <token>
    """
    logger.info(f"Getting products for user: {current_user.get('sub')}")
    sap_service = SAPItemsService()
    public_base = _public_base_url(request)

    # Determine the user's branch for branch-scoped stock (non-admin users only)
    role = str(current_user.get("role") or "user").lower()
    user_branch: Optional[str] = None
    if role != "admin":
        raw_branch = str(current_user.get("branch_id") or "").strip()
        if raw_branch:
            user_branch = raw_branch
        elif settings.SAP_DEFAULT_WAREHOUSE:
            user_branch = settings.SAP_DEFAULT_WAREHOUSE

    branch_suffix = f":branch:{user_branch}" if user_branch else ":branch:all"
    cache_key = (PRODUCTS_LIST_KEY + branch_suffix) if not search else f"{PRODUCTS_LIST_KEY}{branch_suffix}:s:{search}"

    # --- Force refresh: evict both short-TTL cache and long-lived product store ---
    if force_refresh:
        await cache_delete(cache_key)
        await product_store.invalidate(user_branch)
        logger.info(f"Products cache evicted by force_refresh (key={cache_key!r}, branch={user_branch!r})")

    # --- Long-lived product store (60-min TTL, survives across multiple 10-min cache cycles) ---
    store_items = await product_store.get(user_branch)
    if store_items is not None and not search:
        # Fast path: build response directly from the store, skip SAP entirely
        products = [_to_response(item, sap_service, branch=user_branch) for item in store_items]
        response.headers["X-Cache"] = "STORE-HIT"
        logger.debug(f"Products STORE HIT (branch={user_branch!r}, count={len(products)})")

        # Also refresh the short-TTL endpoint cache for ETag support
        payload = [p.model_dump() for p in products]
        resolved = [{**p, "image": _absolutize_image_url(p.get("image"), public_base)} for p in payload]
        etag = make_etag(resolved)
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = f"private, max-age={_PRODUCTS_TTL}"
        return [ProductResponse(**{**p, "image": _absolutize_image_url(p.get("image"), public_base)}) for p in payload]

    # --- Short-TTL cache hit (only for unfiltered list) ---
    cached_data: list | None = await cache_get(cache_key)
    if cached_data is not None:
        response.headers["X-Cache"] = "HIT"
        logger.info(f"Products cache HIT (search={search!r}, branch={user_branch!r})")
        resolved_payload: list[dict] = []
        for p in cached_data:
            if not isinstance(p, dict):
                continue
            item = dict(p)
            item["image"] = _absolutize_image_url(item.get("image"), public_base)
            resolved_payload.append(item)

        etag = make_etag(resolved_payload)
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = f"private, max-age={_PRODUCTS_TTL}"
        return [ProductResponse(**p) for p in resolved_payload]

    # --- SAP fetch (run in thread pool so the event loop is not blocked) ---
    try:
        loop = asyncio.get_running_loop()
        sap_items = await loop.run_in_executor(_executor, lambda: sap_service.get_items(search=search))
        logger.info(f"Products cache MISS -> fetched from SAP (search={search!r}, branch={user_branch!r})")
    except Exception as exc:
        logger.error(f"SAP products fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not retrieve products from SAP")

    products = [_to_response(item, sap_service, branch=user_branch) for item in sap_items]
    response.headers["X-Cache"] = "MISS"

    # Populate the long-lived product store (only for unfiltered list)
    if not search:
        await product_store.set(user_branch, sap_items)

    # Store in short-TTL cache (only for unfiltered list)
    if not search:
        # Store relative image paths + warehouse in cache.
        payload = [p.model_dump() for p in products]
        await cache_set(cache_key, payload, ttl=_PRODUCTS_TTL)
        # ETag based on what we actually return (absolute image URLs).
        resolved_for_etag = [
            {**p.model_dump(), "image": _absolutize_image_url(p.image, public_base)}
            for p in products
        ]
        etag = make_etag(resolved_for_etag)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = f"private, max-age={_PRODUCTS_TTL}"

    # Return absolute URLs to the frontend.
    return [
        ProductResponse(**{**p.model_dump(), "image": _absolutize_image_url(p.image, public_base)})
        for p in products
    ]


@router.get("/{barcode}", response_model=ProductResponse)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_product_by_barcode(
    request: Request,
    barcode: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch a single product by barcode directly from SAP."""
    sap_service = SAPItemsService()
    public_base = _public_base_url(request)
    sap_item = sap_service.get_item_by_barcode(barcode)

    if not sap_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode {barcode} not found",
        )

    # Apply branch-scoped stock (same logic as get_products)
    role = str(current_user.get("role") or "user").lower()
    user_branch: Optional[str] = None
    if role != "admin":
        raw_branch = str(current_user.get("branch_id") or "").strip()
        if raw_branch:
            user_branch = raw_branch
        elif settings.SAP_DEFAULT_WAREHOUSE:
            user_branch = settings.SAP_DEFAULT_WAREHOUSE

    product = _to_response(sap_item, sap_service, branch=user_branch)
    return ProductResponse(**{**product.model_dump(), "image": _absolutize_image_url(product.image, public_base)})


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_product(
    request: Request,
    product: ProductCreate,
    current_user: dict = Depends(require_admin),
):
    """Create a new product in SAP (admin only) and invalidate the products cache."""
    sap_service = SAPItemsService()
    try:
        sap_item = sap_service.create_item(
            {
                "name": product.name,
                "price": product.price,
                "barcode": product.barcode,
                "stock": product.stock,
                "image": product.image,
                "category": product.category,
                "brand": product.brand,
            }
        )
    except Exception as exc:
        logger.error(f"SAP create_item failed: {exc}")
        raise HTTPException(status_code=502, detail="Failed to create product in SAP")

    await cache_delete(PRODUCTS_LIST_KEY)
    public_base = _public_base_url(request)
    created_product = _to_response(sap_item, sap_service)
    return ProductResponse(**{**created_product.model_dump(), "image": _absolutize_image_url(created_product.image, public_base)})


@router.put("/{item_code}", response_model=ProductResponse)
@limiter.limit("30/minute")
async def update_product(
    request: Request,
    item_code: str,
    product: ProductUpdate,
    current_user: dict = Depends(require_admin),
):
    """Update a product in SAP (admin only) and invalidate the products cache."""
    sap_service = SAPItemsService()
    try:
        sap_service.update_item(item_code, product.model_dump(exclude_unset=True))
    except Exception as exc:
        logger.error(f"SAP update_item failed: {exc}")
        raise HTTPException(status_code=502, detail="Failed to update product in SAP")

    await cache_delete(PRODUCTS_LIST_KEY)

    # Return fresh data from SAP
    sap_item = sap_service.get_item_by_code(item_code)
    if not sap_item:
        raise HTTPException(status_code=404, detail="Product not found after update")
    public_base = _public_base_url(request)
    updated_product = _to_response(sap_item, sap_service)
    return ProductResponse(**{**updated_product.model_dump(), "image": _absolutize_image_url(updated_product.image, public_base)})


@router.delete("/{item_code}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_product(
    request: Request,
    item_code: str,
    current_user: dict = Depends(require_admin),
):
    """Soft-delete a product in SAP (admin only, freezes it) and invalidate the products cache."""
    sap_service = SAPItemsService()
    try:
        sap_service.soft_delete_item(item_code)
    except Exception as exc:
        logger.error(f"SAP soft_delete_item failed: {exc}")
        raise HTTPException(status_code=502, detail="Failed to soft-delete product in SAP")

    await cache_delete(PRODUCTS_LIST_KEY)


async def _refresh_cache_background(sap_service: SAPItemsService):
    """Background task to refresh products cache."""
    loop = asyncio.get_running_loop()
    try:
        # Run SAP fetch in thread pool to avoid blocking
        sap_items = await loop.run_in_executor(_executor, sap_service.get_items)
        products = [_to_response(item, sap_service) for item in sap_items]
        payload = [p.model_dump() for p in products]
        await cache_set(PRODUCTS_LIST_KEY, payload, ttl=_PRODUCTS_TTL)
        logger.info(f"Products cache refreshed successfully with {len(products)} items")
    except Exception as exc:
        logger.error(f"Background cache refresh failed: {exc}")


@router.post("/refresh-cache", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def refresh_products_cache(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_manager_or_admin),
):
    """
    Trigger a background refresh of the products cache (manager/admin only).
    Returns immediately while cache is being refreshed.
    """
    sap_service = SAPItemsService()
    background_tasks.add_task(_refresh_cache_background, sap_service)
    return {"message": "Cache refresh started", "status": "processing"}
