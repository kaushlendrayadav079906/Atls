"""
In-memory product store with 60-minute TTL and background auto-refresh.

Stores raw SAP item dicts keyed by branch (or 'all' for admin). Provides:
  - get(branch)             → cached items or None (if expired/missing)
  - set(branch, items)      → store items with TTL
  - patch_stock(branch, deltas) → adjust InStock after a sale or return
  - invalidate(branch)      → force-expire one branch's entry
  - invalidate_all()        → clear everything
  - start_background_refresh(fetch_fn) → asyncio task that auto-repopulates

Thread-safe: uses a threading.Lock (synchronous callers) for patching, and
asyncio.Lock for the async set/get/invalidate API.
"""

import asyncio
import logging
import time
import threading
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default product store TTL: 60 minutes.
PRODUCT_STORE_TTL = 3600


class ProductStore:
    """Singleton in-memory product store."""

    def __init__(self, ttl: int = PRODUCT_STORE_TTL) -> None:
        self._ttl = ttl
        # key: branch (str | 'all')  → (expires_at: float, items: List[dict])
        self._store: Dict[str, tuple[float, List[Dict[str, Any]]]] = {}
        self._async_lock = asyncio.Lock()
        self._thread_lock = threading.Lock()
        self._refresh_task: Optional[asyncio.Task] = None

    # ── Async API (call from FastAPI request handlers) ────────────────────────

    async def get(self, branch: Optional[str]) -> Optional[List[Dict[str, Any]]]:
        """Return cached items for *branch* or None if absent/expired."""
        key = branch or "all"
        now = time.monotonic()
        async with self._async_lock:
            entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, items = entry
        if expires_at <= now:
            async with self._async_lock:
                self._store.pop(key, None)
            return None
        return items

    async def set(self, branch: Optional[str], items: List[Dict[str, Any]]) -> None:
        """Store *items* for *branch* with the configured TTL."""
        key = branch or "all"
        expires_at = time.monotonic() + self._ttl
        async with self._async_lock:
            self._store[key] = (expires_at, items)
        logger.info("ProductStore: stored %d items for branch=%r (TTL=%ds)", len(items), key, self._ttl)

    async def invalidate(self, branch: Optional[str]) -> None:
        """Remove the cached entry for *branch*."""
        key = branch or "all"
        async with self._async_lock:
            self._store.pop(key, None)
        logger.debug("ProductStore: invalidated branch=%r", key)

    async def invalidate_all(self) -> None:
        """Clear all cached entries."""
        async with self._async_lock:
            self._store.clear()
        logger.debug("ProductStore: all entries invalidated")

    # ── Synchronous stock-patch (safe to call from background tasks) ──────────

    def patch_stock(self, branch: Optional[str], deltas: List[Dict[str, Any]]) -> None:
        """
        Adjust InStock for each item in *deltas* without a SAP round-trip.

        *deltas* is a list of dicts: {itemCode: str, qty_change: float}
        Positive qty_change = stock increase (return), negative = decrease (sale).

        Patches the specific warehouse in ItemWarehouseInfoCollection matching
        *branch*, and also updates the top-level QuantityOnStock for consistency.
        """
        key = branch or "all"
        with self._thread_lock:
            entry = self._store.get(key)
            if entry is None:
                return
            expires_at, items = entry

            delta_map: Dict[str, float] = {}
            for d in deltas:
                code = str(d.get("itemCode") or "").strip()
                if code:
                    delta_map[code] = delta_map.get(code, 0.0) + float(d.get("qty_change", 0))

            if not delta_map:
                return

            branch_upper = branch.upper() if branch else None

            for item in items:
                code = str(item.get("ItemCode") or "").strip()
                change = delta_map.get(code)
                if change is None:
                    continue

                # Adjust the specific warehouse in the collection
                warehouses = item.get("ItemWarehouseInfoCollection") or []
                patched_wh = False
                for wh in warehouses:
                    wh_code = str(wh.get("WarehouseCode") or "").strip().upper()
                    if branch_upper is None or wh_code == branch_upper:
                        old_stock = float(wh.get("InStock") or 0)
                        wh["InStock"] = max(0.0, old_stock + change)
                        patched_wh = True
                        if branch_upper:
                            break  # Only patch the specific warehouse for non-admin

                # Also patch the summary QuantityOnStock
                old_qty = float(item.get("QuantityOnStock") or 0)
                item["QuantityOnStock"] = max(0.0, old_qty + change)

            self._store[key] = (expires_at, items)

        logger.debug("ProductStore.patch_stock: applied %d deltas for branch=%r", len(delta_map), key)

    # ── Background refresh ────────────────────────────────────────────────────

    def start_background_refresh(self, fetch_fn: Callable[[], List[Dict[str, Any]]]) -> None:
        """
        Launch an asyncio background task that repopulates all currently-cached
        branches every *ttl* seconds using *fetch_fn* (a synchronous callable
        that returns raw SAP items).

        *fetch_fn* is run in a thread pool executor so it doesn't block the
        event loop.
        """
        async def _refresh_loop() -> None:
            while True:
                # Sleep slightly less than TTL to ensure refresh completes before expiry
                await asyncio.sleep(max(self._ttl - 60, 60))
                async with self._async_lock:
                    branches_to_refresh = list(self._store.keys())

                if not branches_to_refresh:
                    logger.debug("ProductStore background refresh: nothing cached yet, skipping.")
                    continue

                logger.info(
                    "ProductStore background refresh: refreshing %d branch(es): %s",
                    len(branches_to_refresh),
                    branches_to_refresh,
                )

                loop = asyncio.get_running_loop()
                try:
                    fresh_items = await loop.run_in_executor(None, fetch_fn)
                except Exception as exc:
                    logger.error("ProductStore background refresh failed: %s", exc)
                    continue

                expires_at = time.monotonic() + self._ttl
                async with self._async_lock:
                    for key in branches_to_refresh:
                        # Only refresh branches that are still cached (not manually invalidated)
                        if key in self._store:
                            self._store[key] = (expires_at, fresh_items)

                logger.info(
                    "ProductStore background refresh: updated %d branch(es) with %d items.",
                    len(branches_to_refresh),
                    len(fresh_items),
                )

        async def _start() -> None:
            self._refresh_task = asyncio.create_task(_refresh_loop())

        # Schedule on the running event loop
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(_refresh_loop())
        except RuntimeError:
            # If called before the event loop is running, it will be started
            # explicitly by the caller via start_background_refresh_task()
            pass

    async def start_background_refresh_task(self, fetch_fn: Callable[[], List[Dict[str, Any]]]) -> None:
        """Async version: launch the background refresh task from an async context."""
        async def _refresh_loop() -> None:
            while True:
                await asyncio.sleep(max(self._ttl - 60, 60))

                async with self._async_lock:
                    branches_to_refresh = list(self._store.keys())

                if not branches_to_refresh:
                    logger.debug("ProductStore background refresh: nothing cached yet, skipping.")
                    continue

                logger.info(
                    "ProductStore background refresh: refreshing %d branch(es): %s",
                    len(branches_to_refresh),
                    branches_to_refresh,
                )

                loop = asyncio.get_running_loop()
                try:
                    fresh_items = await loop.run_in_executor(None, fetch_fn)
                except Exception as exc:
                    logger.error("ProductStore background refresh failed: %s", exc)
                    continue

                expires_at = time.monotonic() + self._ttl
                async with self._async_lock:
                    for key in list(branches_to_refresh):
                        if key in self._store:
                            self._store[key] = (expires_at, fresh_items)

                logger.info(
                    "ProductStore background refresh: updated %d branch(es) with %d items.",
                    len(branches_to_refresh),
                    len(fresh_items),
                )

        self._refresh_task = asyncio.create_task(_refresh_loop())
        logger.info("ProductStore background refresh task started (interval=%ds).", max(self._ttl - 60, 60))

    async def stop(self) -> None:
        """Cancel the background refresh task if running."""
        if self._refresh_task and not self._refresh_task.done():
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
        self._refresh_task = None


# Module-level singleton
product_store = ProductStore(ttl=PRODUCT_STORE_TTL)
