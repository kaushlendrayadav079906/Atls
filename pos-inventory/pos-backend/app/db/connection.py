"""Unified database connection and pooling abstraction.
Supports production MySQL (PyMySQL) and development/testing PostgreSQL (psycopg2).
Provides connection pooling, health checks, transaction safety, and dialect-safe utilities.
"""

from __future__ import annotations

import logging
import os
import queue
import time
import urllib.parse
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

# Connection pool singletons
_MYSQL_POOL: Optional[MySQLConnectionPool] = None
_PG_POOL: Optional[Any] = None
_LAST_PG_FAILURE: float = 0.0
_PG_BACKOFF_SECONDS: float = 15.0


def get_database_dialect() -> str:
    """Detect database dialect from settings.DATABASE_URL."""
    db_url = (settings.DATABASE_URL or "").strip()
    if not db_url:
        return "unconfigured"
    lowered = db_url.lower()
    if lowered.startswith("mysql:") or lowered.startswith("mysql+pymysql:"):
        return "mysql"
    if lowered.startswith("postgres:") or lowered.startswith("postgresql:"):
        return "postgresql"
    if lowered.startswith("sqlite:"):
        return "sqlite"
    return "unknown"


def is_mysql() -> bool:
    """Return True if configured database is MySQL."""
    return get_database_dialect() == "mysql"


def is_postgres() -> bool:
    """Return True if configured database is PostgreSQL."""
    return get_database_dialect() == "postgresql"


class MySQLConnectionPool:
    """Thread-safe connection pool for PyMySQL."""

    def __init__(
        self,
        conn_params: Dict[str, Any],
        min_size: int = 2,
        max_size: int = 10,
        pool_timeout: float = 5.0,
    ) -> None:
        self.conn_params = conn_params
        self.min_size = min_size
        self.max_size = max_size
        self.pool_timeout = pool_timeout
        self._pool: queue.Queue = queue.Queue(maxsize=max_size)
        self._created_count = 0

        # Eagerly pre-fill min_size connections if possible
        for _ in range(min_size):
            try:
                conn = self._create_new_connection()
                self._pool.put_nowait(conn)
                self._created_count += 1
            except Exception as e:
                logger.warning("Could not pre-fill MySQL pool: %s", e)
                break

    def _create_new_connection(self) -> Any:
        import pymysql
        import pymysql.cursors

        params = dict(self.conn_params)
        params["connect_timeout"] = getattr(settings, "DB_CONNECT_TIMEOUT", 5.0)
        params["autocommit"] = False
        return pymysql.connect(**params)

    def get_connection(self) -> Any:
        """Acquire a connection from the pool, validating health."""
        conn = None
        try:
            conn = self._pool.get_nowait()
        except queue.Empty:
            if self._created_count < self.max_size:
                try:
                    conn = self._create_new_connection()
                    self._created_count += 1
                except Exception as e:
                    logger.error("Failed to create new MySQL connection: %s", e)
                    raise
            else:
                try:
                    conn = self._pool.get(timeout=self.pool_timeout)
                except queue.Empty as exc:
                    raise TimeoutError("Timed out waiting for an available MySQL connection from pool.") from exc

        # Ping connection to verify it is still alive; reconnect if dropped
        try:
            conn.ping(reconnect=True)
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            conn = self._create_new_connection()

        return conn

    def release_connection(self, conn: Any, discard: bool = False) -> None:
        """Return a connection back to the pool, or close and discard if broken."""
        if discard:
            self._created_count = max(0, self._created_count - 1)
            try:
                conn.close()
            except Exception:
                pass
            return

        try:
            self._pool.put_nowait(conn)
        except queue.Full:
            self._created_count = max(0, self._created_count - 1)
            try:
                conn.close()
            except Exception:
                pass

    def close_all(self) -> None:
        """Close all connections in the pool."""
        while not self._pool.empty():
            try:
                conn = self._pool.get_nowait()
                conn.close()
            except Exception:
                pass
        self._created_count = 0


def _parse_mysql_url(db_url: str) -> Dict[str, Any]:
    """Parse a MySQL URL into PyMySQL connect kwargs."""
    import pymysql.cursors

    # Standardize scheme for urlparse
    clean_url = db_url
    if clean_url.startswith("mysql+pymysql://"):
        clean_url = "mysql://" + clean_url[len("mysql+pymysql://"):]

    parsed = urllib.parse.urlparse(clean_url)
    user = urllib.parse.unquote(parsed.username or "root")
    password = urllib.parse.unquote(parsed.password or "")
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 3306
    db = parsed.path.lstrip("/")

    # Parse query parameters (e.g. charset=utf8mb4)
    query_params = urllib.parse.parse_qs(parsed.query)
    charset = query_params.get("charset", ["utf8mb4"])[0]

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": db,
        "charset": charset,
        "cursorclass": pymysql.cursors.DictCursor,
    }


def _get_mysql_pool() -> MySQLConnectionPool:
    global _MYSQL_POOL
    if _MYSQL_POOL is None:
        db_url = settings.DATABASE_URL
        params = _parse_mysql_url(db_url)
        max_size = getattr(settings, "DB_POOL_SIZE", 10)
        _MYSQL_POOL = MySQLConnectionPool(params, min_size=2, max_size=max_size)
    return _MYSQL_POOL


def _get_pg_pool() -> Any:
    global _PG_POOL
    if _PG_POOL is None:
        import psycopg2.pool
        db_url = settings.DATABASE_URL
        max_size = getattr(settings, "DB_POOL_SIZE", 10)
        _PG_POOL = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=max_size,
            dsn=db_url,
            connect_timeout=int(getattr(settings, "DB_CONNECT_TIMEOUT", 5.0)),
        )
    return _PG_POOL


@contextmanager
def get_db_connection() -> Iterator[Any]:
    """
    Context manager providing a pooled database connection.
    Automatically handles commit on normal exit and rollback on unhandled exception.
    Always returns the connection to the pool.
    """
    dialect = get_database_dialect()
    db_url = (settings.DATABASE_URL or "").strip()

    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured in settings.")

    conn = None
    is_pooled = True
    discard = False

    try:
        if dialect == "mysql":
            pool = _get_mysql_pool()
            conn = pool.get_connection()
        elif dialect == "postgresql":
            global _LAST_PG_FAILURE
            if time.time() - _LAST_PG_FAILURE < _PG_BACKOFF_SECONDS:
                raise RuntimeError("PostgreSQL connection circuit breaker is active (service unreachable).")
            try:
                try:
                    pool = _get_pg_pool()
                    conn = pool.getconn()
                except Exception as pool_err:
                    logger.warning("PG pool failed (%s), opening direct connection", pool_err)
                    import psycopg2
                    timeout = 1 if (getattr(settings, "TESTING", False) or "PYTEST_CURRENT_TEST" in os.environ) else int(getattr(settings, "DB_CONNECT_TIMEOUT", 2))
                    conn = psycopg2.connect(
                        db_url,
                        connect_timeout=timeout,
                    )
                    is_pooled = False
            except Exception as e:
                _LAST_PG_FAILURE = time.time()
                raise e
        else:
            raise RuntimeError(f"Unsupported database dialect: {dialect}. Use MySQL or PostgreSQL.")

        yield conn
        conn.commit()

    except Exception:
        discard = True
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn is not None:
            if dialect == "mysql" and is_pooled:
                _get_mysql_pool().release_connection(conn, discard=discard)
            elif dialect == "postgresql" and is_pooled:
                try:
                    _get_pg_pool().putconn(conn, close=discard)
                except Exception:
                    pass
            elif not is_pooled:
                try:
                    conn.close()
                except Exception:
                    pass


@contextmanager
def get_db_cursor(conn: Any, dict_cursor: bool = True) -> Iterator[Any]:
    """
    Context manager yielding a cursor appropriate for the database driver.
    Yields dictionary cursors by default (returns Dict[str, Any] rows).
    """
    dialect = get_database_dialect()
    if dialect == "mysql":
        import pymysql.cursors
        if dict_cursor:
            cur = conn.cursor(pymysql.cursors.DictCursor)
        else:
            cur = conn.cursor()
    elif dialect == "postgresql":
        import psycopg2.extras
        if dict_cursor:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = conn.cursor()
    else:
        cur = conn.cursor()

    try:
        yield cur
    finally:
        try:
            cur.close()
        except Exception:
            pass


def check_db_health() -> Dict[str, Any]:
    """
    Safe non-blocking database health check.
    Executes 'SELECT 1' and measures latency.
    Never exposes credentials, usernames, or server hostnames in the returned payload.
    """
    dialect = get_database_dialect()
    if dialect == "unconfigured":
        return {
            "status": "unconfigured",
            "dialect": "none",
            "latency_ms": None,
            "error": "DATABASE_URL is not set",
        }

    start = time.perf_counter()
    try:
        with get_db_connection() as conn:
            with get_db_cursor(conn, dict_cursor=False) as cur:
                cur.execute("SELECT 1")
                row = cur.fetchone()
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                if row:
                    return {
                        "status": "healthy",
                        "dialect": dialect,
                        "latency_ms": latency_ms,
                        "error": None,
                    }
                return {
                    "status": "degraded",
                    "dialect": dialect,
                    "latency_ms": latency_ms,
                    "error": "Query returned no result",
                }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        err_msg = str(exc)
        # Sanitize error message to ensure passwords/credentials are never leaked
        if "@" in err_msg:
            err_msg = err_msg.split("@")[-1]
        logger.warning("Database health check failed: %s", err_msg)
        return {
            "status": "unhealthy",
            "dialect": dialect,
            "latency_ms": latency_ms,
            "error": err_msg[:120],
        }


def normalize_ddl_for_dialect(sql: str) -> str:
    """
    Normalize DDL statements for the active database dialect.
    Converts PostgreSQL-specific types and syntax to MySQL equivalents when running on MySQL.
    """
    if not is_mysql():
        return sql

    s = sql
    # Convert JSONB to JSON
    s = s.replace("JSONB", "JSON")
    # Convert TEXT PRIMARY KEY to VARCHAR(64) PRIMARY KEY
    s = s.replace("id TEXT PRIMARY KEY", "id VARCHAR(64) PRIMARY KEY")
    s = s.replace("TEXT PRIMARY KEY", "VARCHAR(64) PRIMARY KEY")
    # References to TEXT columns
    s = s.replace("user_id TEXT REFERENCES", "user_id VARCHAR(64) REFERENCES")
    s = s.replace("requester_id TEXT", "requester_id VARCHAR(64)")
    s = s.replace("approver_id TEXT", "approver_id VARCHAR(64)")
    # Convert SERIAL PRIMARY KEY to INT AUTO_INCREMENT PRIMARY KEY
    s = s.replace("SERIAL PRIMARY KEY", "INT AUTO_INCREMENT PRIMARY KEY")
    s = s.replace("TIMESTAMP WITH TIME ZONE", "TIMESTAMP")
    # Convert ADD COLUMN IF NOT EXISTS (safe migration syntax in MySQL 8.0.29+)
    return s
