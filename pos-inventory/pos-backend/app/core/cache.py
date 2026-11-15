"""
In-memory cache layer with TTL support.

A lightweight, thread-safe in-memory cache that replaces Redis.
No external dependencies – works out of the box with zero configuration.
"""

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── In-memory store ────────────────────────────────────────────────────────────
# Structure: { key: (expires_at: float, value: Any) }
_store: dict[str, tuple[float, Any]] = {}
_store_lock = asyncio.Lock()

# Metrics tracking
_hits: int = 0
_misses: int = 0
_evictions: int = 0

# Background eviction task handle
_eviction_task: Optional[asyncio.Task] = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

async def init_cache() -> None:
    """Start the background eviction loop. Call once at application startup."""
    global _eviction_task
    _eviction_task = asyncio.create_task(_eviction_loop())
    logger.info("In-memory cache initialised.")


async def close_cache() -> None:
    """Stop the background eviction loop. Call once at application shutdown."""
    global _eviction_task
    if _eviction_task and not _eviction_task.done():
        _eviction_task.cancel()
        try:
            await _eviction_task
        except asyncio.CancelledError:
            pass
        _eviction_task = None
    async with _store_lock:
        _store.clear()
    logger.info("In-memory cache shut down.")


async def _eviction_loop() -> None:
    """Periodically remove expired entries to avoid unbounded memory growth."""
    global _evictions
    while True:
        await asyncio.sleep(60)  # run every minute
        now = time.monotonic()
        async with _store_lock:
            expired = [k for k, (exp, _) in _store.items() if exp <= now]
            for k in expired:
                del _store[k]
            if expired:
                _evictions += len(expired)
        if expired:
            logger.debug(f"Cache eviction: removed {len(expired)} expired entries.")


# ── Public API that mirrors the old Redis helpers ─────────────────────────────

async def cache_get(key: str) -> Optional[Any]:
    """Return the cached value for *key*, or None if absent / expired."""
    global _hits, _misses
    now = time.monotonic()
    async with _store_lock:
        entry = _store.get(key)
        if entry is None:
            _misses += 1
            return None
        expires_at, value = entry
        if expires_at <= now:
            _store.pop(key, None)
            _misses += 1
            return None
        _hits += 1
        return value


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Store *value* under *key* with a TTL in seconds."""
   
    expires_at = time.monotonic() + ttl
    async with _store_lock:
        _store[key] = (expires_at, value)


async def cache_delete(*keys: str) -> None:
    """Remove one or more keys from the cache."""
    if not keys:
        return
    async with _store_lock:
        for key in keys:
            _store.pop(key, None)


async def cache_delete_prefix(prefix: str) -> None:
    """Remove all keys that start with *prefix* from the cache."""
    async with _store_lock:
        matching = [k for k in _store if k.startswith(prefix)]
        for k in matching:
            del _store[k]


async def cache_stats() -> dict[str, Any]:
    """Return lightweight cache metrics for production monitoring."""
    now = time.monotonic()
    async with _store_lock:
        total = len(_store)
        valid = sum(1 for exp, _ in _store.values() if exp > now)
        total_lookups = _hits + _misses
        hit_ratio = round((_hits / total_lookups * 100), 1) if total_lookups > 0 else 0.0
    return {
        "hits": _hits,
        "misses": _misses,
        "hit_ratio_pct": hit_ratio,
        "evictions": _evictions,
        "keys_total": total,
        "keys_valid": valid,
        "keys_expired": max(total - valid, 0),
    }


def get_cache_stats_sync() -> dict[str, Any]:
    """Synchronous read of cache metrics for non-async services."""
    now = time.monotonic()
    total = len(_store)
    valid = sum(1 for exp, _ in _store.values() if exp > now)
    total_lookups = _hits + _misses
    hit_ratio = round((_hits / total_lookups * 100), 1) if total_lookups > 0 else 0.0
    return {
        "hits": _hits,
        "misses": _misses,
        "hit_ratio_pct": hit_ratio,
        "evictions": _evictions,
        "keys_total": total,
        "keys_valid": valid,
        "keys_expired": max(total - valid, 0),
    }


# ── Canonical cache keys ──────────────────────────────────────────────────────

PRODUCTS_LIST_KEY = "pos:products:list"
DASHBOARD_SUMMARY_KEY = "pos:dashboard:today"


# ── ETag helper ───────────────────────────────────────────────────────────────

def make_etag(data: Any) -> str:
    """Deterministic ETag from content (quoted per RFC 7232)."""
    payload = json.dumps(data, sort_keys=True, default=str)
    digest = hashlib.md5(payload.encode()).hexdigest()
    return f'"{digest}"'
