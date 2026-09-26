"""
Minimal thread-safe state-machine circuit breaker.

  CLOSED ──[≥ failure_threshold failures]──► OPEN
  OPEN   ──[≥ recovery_timeout seconds]───► HALF_OPEN
  HALF_OPEN ──[success]────────────────────► CLOSED
  HALF_OPEN ──[failure]────────────────────► OPEN
"""

import logging
import threading
import time
from enum import Enum, auto
from typing import Callable, Optional, Type

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


class CircuitBreakerOpen(Exception):
    """Raised when a call is rejected because the circuit is OPEN."""


class CircuitBreaker:
    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        expected_exception: Type[Exception] = Exception,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self._state = CircuitState.CLOSED
        self._failures = 0
        self._opened_at: Optional[float] = None
        self._lock = threading.Lock()

    # ── public interface ────────────────────────────────────────────────────

    @property
    def state(self) -> CircuitState:
        with self._lock:
            return self._evaluated_state()

    def call(self, func: Callable, *args, **kwargs):
        """Execute *func* through the breaker; raises CircuitBreakerOpen if OPEN."""
        with self._lock:
            state = self._evaluated_state()
            if state == CircuitState.OPEN:
                raise CircuitBreakerOpen(
                    f"Circuit '{self.name}' is OPEN – SAP requests paused "
                    f"for {self.recovery_timeout}s."
                )
        try:
            result = func(*args, **kwargs)
        except self.expected_exception:
            self._record_failure()
            raise
        self._record_success()
        return result

    # ── internals ───────────────────────────────────────────────────────────

    def _evaluated_state(self) -> CircuitState:
        """Must be called while holding _lock (or from within call())."""
        if self._state == CircuitState.OPEN and self._opened_at is not None:
            if time.monotonic() - self._opened_at >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                logger.info(f"[CB:{self.name}] OPEN -> HALF_OPEN")
        return self._state

    def _record_success(self) -> None:
        with self._lock:
            if self._state in (CircuitState.HALF_OPEN, CircuitState.CLOSED):
                if self._state == CircuitState.HALF_OPEN:
                    logger.info(f"[CB:{self.name}] HALF_OPEN -> CLOSED")
                self._state = CircuitState.CLOSED
                self._failures = 0
                self._opened_at = None

    def _record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if (
                self._state == CircuitState.HALF_OPEN
                or self._failures >= self.failure_threshold
            ):
                if self._state != CircuitState.OPEN:
                    logger.warning(
                        f"[CB:{self.name}] -> OPEN after {self._failures} failure(s)"
                    )
                self._state = CircuitState.OPEN
                self._opened_at = time.monotonic()


# ── global SAP instance (imported by client.py) ─────────────────────────────
# failure_threshold=10: parallel hydration can produce simultaneous failures;
#   raising the threshold prevents a single slow batch from opening the circuit.
# recovery_timeout=15.0: recover faster so a brief SAP hiccup doesn't stall
#   dashboards for 30 seconds.
sap_breaker = CircuitBreaker(
    name="sap",
    failure_threshold=10,
    recovery_timeout=15.0,
    expected_exception=Exception,
)
