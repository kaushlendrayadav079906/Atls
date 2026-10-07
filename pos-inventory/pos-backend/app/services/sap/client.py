"""SAP Business One Service Layer Client"""

import httpx
import threading
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import logging
from urllib.parse import quote

from app.core.config import settings
from app.core.circuit_breaker import sap_breaker, CircuitBreakerOpen


logger = logging.getLogger(__name__)


class SAPConnectionError(Exception):
    """SAP connection or authentication error"""

    pass


class SAPValidationError(Exception):
    """SAP data validation error"""

    pass


class SAPDocumentClosedError(Exception):
    """Raised when the base SAP document is already closed (e.g. fully returned)."""

    pass


class SAPServiceLayerClient:
    """
    Client for SAP Business One Service Layer (OData V4 API)

    Handles authentication, session management, and API requests.
    """

    def __init__(self):
        self.base_url = settings.SAP_SERVICE_LAYER_URL.rstrip("/")
        self.company_db = settings.SAP_COMPANY_DB
        self.username = settings.SAP_USERNAME
        self.password = settings.SAP_PASSWORD
        self.verify_ssl = settings.SAP_SSL_VERIFY

        self.session_id: Optional[str] = None
        self.session_timeout: Optional[datetime] = None
        self.client: Optional[httpx.Client] = None
        self._session_lock = threading.Lock()  # Prevent concurrent re-logins

        self._init_client()

    def _init_client(self):
        """Initialize HTTP client"""
        self.client = httpx.Client(
            timeout=settings.SAP_HTTP_TIMEOUT,
            verify=self.verify_ssl,
            follow_redirects=True,
        )

    def login(self) -> bool:
        """
        Login to SAP Service Layer and obtain session cookie

        Returns:
            True if login successful

        Raises:
            SAPConnectionError: If login fails
        """
        try:
            login_url = f"{self.base_url}/Login"
            payload = {
                "CompanyDB": self.company_db,
                "UserName": self.username,
                "Password": self.password,
            }

            logger.info(f"Logging in to SAP Service Layer: {self.company_db}")
            response = self.client.post(login_url, json=payload)
            response.raise_for_status()

            # Extract session cookies
            session_cookie = response.cookies.get("B1SESSION")
            route_id_cookie = response.cookies.get("ROUTEID")
            
            if not session_cookie:
                raise SAPConnectionError("No session cookie received from SAP")

            self.session_id = session_cookie
            self.route_id = route_id_cookie
            # SAP sessions typically last 30 minutes
            self.session_timeout = datetime.utcnow() + timedelta(minutes=25)

            logger.info("Successfully logged in to SAP Service Layer")
            return True

        except httpx.HTTPStatusError as e:
            logger.error(
                f"SAP login failed: {e.response.status_code} - {e.response.text}"
            )
            raise SAPConnectionError(f"SAP login failed: {e.response.text}")
        except Exception as e:
            logger.error(f"SAP login error: {str(e)}")
            raise SAPConnectionError(f"SAP login error: {str(e)}")

    def logout(self):
        """Logout from SAP Service Layer"""
        if not self.session_id:
            return

        try:
            logout_url = f"{self.base_url}/Logout"
            self.client.post(logout_url, cookies={"B1SESSION": self.session_id})
            logger.info("Logged out from SAP Service Layer")
        except Exception as e:
            logger.warning(f"Error during logout: {str(e)}")
        finally:
            self.session_id = None
            self.session_timeout = None

    def _ensure_session(self):
        """Ensure we have a valid session, login if needed (thread-safe)."""
        # Fast path: session valid, no lock needed
        if self.session_id and (
            not self.session_timeout or datetime.utcnow() < self.session_timeout
        ):
            return
        # Slow path: acquire lock so only ONE thread re-logs in
        with self._session_lock:
            # Re-check inside the lock (another thread may have already refreshed)
            if self.session_id and (
                not self.session_timeout or datetime.utcnow() < self.session_timeout
            ):
                return
            self.login()

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with session cookie"""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Ask SAP to return up to 100 items per page by default.
            # Explicit $top still overrides this for individual queries.
            "Prefer": "odata.maxpagesize=100",
        }

    def _get_cookies(self) -> Dict[str, str]:
        """Get session cookies"""
        if not self.session_id:
            raise SAPConnectionError("No active session")
        cookies = {"B1SESSION": self.session_id}
        if getattr(self, "route_id", None):
            cookies["ROUTEID"] = self.route_id
        return cookies

    def get(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute GET request to SAP Service Layer

        Args:
            endpoint: API endpoint (e.g., "Items", "Invoices(123)")
            params: Query parameters (OData filters, select, expand, etc.)

        Returns:
            Response data as dictionary
        """

        def _inner():
            self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            try:
                response = self.client.get(
                    url,
                    headers=self._get_headers(),
                    cookies=self._get_cookies(),
                    params=params or {},
                )
                response.raise_for_status()
                logger.debug(f"SAP GET {url} -> {response.status_code}")
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"SAP GET failed: {e.response.status_code} - {e.response.text}"
                )
                self._handle_http_error(e)
            except Exception as e:
                logger.error(f"SAP GET error: {str(e)}")
                raise SAPConnectionError(f"SAP request error: {str(e)}")

        for attempt in range(2):
            try:
                return sap_breaker.call(_inner)
            except SAPConnectionError as exc:
                if attempt == 0 and "Authentication failed" in str(exc):
                    logger.info("SAP authentication failed. Retrying request...")
                    continue
                raise
            except CircuitBreakerOpen as exc:
                raise SAPConnectionError(str(exc))

    def get_binary(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        accept: str = "*/*",
        log_errors: bool = True,
    ) -> tuple[bytes, str | None]:
        """Execute GET request and return raw bytes + content-type.

        This is used for downloading attachment/image binary content.
        """

        def _inner():
            self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            try:
                headers = dict(self._get_headers())
                headers["Accept"] = accept
                # For binary downloads, Content-Type request header is not needed.
                headers.pop("Content-Type", None)

                response = self.client.get(
                    url,
                    headers=headers,
                    cookies=self._get_cookies(),
                    params=params or {},
                )
                response.raise_for_status()
                content_type = response.headers.get("content-type")
                return response.content, content_type
            except httpx.HTTPStatusError as e:
                if log_errors:
                    logger.error(
                        f"SAP GET(binary) failed: {e.response.status_code} - {e.response.text}"
                    )
                else:
                    logger.debug(
                        f"SAP GET(binary) failed: {e.response.status_code} - {e.response.text}"
                    )
                self._handle_http_error(e)
            except Exception as e:
                logger.error(f"SAP GET(binary) error: {str(e)}")
                raise SAPConnectionError(f"SAP request error: {str(e)}")

        for attempt in range(2):
            try:
                return sap_breaker.call(_inner)
            except SAPConnectionError as exc:
                if attempt == 0 and "Authentication failed" in str(exc):
                    logger.info("SAP authentication failed. Retrying binary request...")
                    continue
                raise
            except CircuitBreakerOpen as exc:
                raise SAPConnectionError(str(exc))

    def post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute POST request to SAP Service Layer

        Args:
            endpoint: API endpoint (e.g., "Items", "Invoices")
            data: Request payload

        Returns:
            Response data as dictionary
        """

        def _inner():
            self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            try:
                response = self.client.post(
                    url,
                    headers=self._get_headers(),
                    cookies=self._get_cookies(),
                    json=data,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"SAP POST failed: {e.response.status_code} - {e.response.text}"
                )
                self._handle_http_error(e)
            except Exception as e:
                logger.error(f"SAP POST error: {str(e)}")
                raise SAPConnectionError(f"SAP request error: {str(e)}")

        for attempt in range(2):
            try:
                return sap_breaker.call(_inner)
            except SAPConnectionError as exc:
                if attempt == 0 and "Authentication failed" in str(exc):
                    logger.info("SAP authentication failed. Retrying POST request...")
                    continue
                raise
            except CircuitBreakerOpen as exc:
                raise SAPConnectionError(str(exc))

    def patch(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute PATCH request to SAP Service Layer

        Args:
            endpoint: API endpoint (e.g., "Items('A001')")
            data: Fields to update

        Returns:
            Response data as dictionary
        """

        def _inner():
            self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            try:
                response = self.client.patch(
                    url,
                    headers=self._get_headers(),
                    cookies=self._get_cookies(),
                    json=data,
                )
                response.raise_for_status()
                if response.status_code == 204:
                    return {}
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"SAP PATCH failed: {e.response.status_code} - {e.response.text}"
                )
                self._handle_http_error(e)
            except Exception as e:
                logger.error(f"SAP PATCH error: {str(e)}")
                raise SAPConnectionError(f"SAP request error: {str(e)}")

        for attempt in range(2):
            try:
                return sap_breaker.call(_inner)
            except SAPConnectionError as exc:
                if attempt == 0 and "Authentication failed" in str(exc):
                    logger.info("SAP authentication failed. Retrying PATCH request...")
                    continue
                raise
            except CircuitBreakerOpen as exc:
                raise SAPConnectionError(str(exc))

    def delete(self, endpoint: str) -> bool:
        """
        Execute DELETE request to SAP Service Layer

        Args:
            endpoint: API endpoint (e.g., "Items('A001')")

        Returns:
            True if successful
        """

        def _inner():
            self._ensure_session()
            url = f"{self.base_url}/{endpoint}"
            try:
                response = self.client.delete(
                    url,
                    headers=self._get_headers(),
                    cookies=self._get_cookies(),
                )
                response.raise_for_status()
                return True
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"SAP DELETE failed: {e.response.status_code} - {e.response.text}"
                )
                self._handle_http_error(e)
            except Exception as e:
                logger.error(f"SAP DELETE error: {str(e)}")
                raise SAPConnectionError(f"SAP request error: {str(e)}")

        for attempt in range(2):
            try:
                return sap_breaker.call(_inner)
            except SAPConnectionError as exc:
                if attempt == 0 and "Authentication failed" in str(exc):
                    logger.info("SAP authentication failed. Retrying DELETE request...")
                    continue
                raise
            except CircuitBreakerOpen as exc:
                raise SAPConnectionError(str(exc))

    def _handle_http_error(self, error: httpx.HTTPStatusError):
        """Handle HTTP errors from SAP Service Layer"""
        status_code = error.response.status_code

        sap_code = None
        try:
            error_data = error.response.json()
            error_message = (
                error_data.get("error", {}).get("message", {}).get("value", str(error))
            )
            sap_code = error_data.get("error", {}).get("code")
        except Exception:
            error_message = error.response.text

        # Map SAP error codes to exceptions
        if status_code == 401 or sap_code == 301:
            self.session_id = None  # Force re-login
            raise SAPConnectionError(f"Authentication failed: {error_message}")
        elif status_code == 404:
            raise SAPValidationError(f"Resource not found: {error_message}")
        elif status_code in (400, 422):
            if sap_code == -5002:
                raise SAPDocumentClosedError(
                    f"Base document already closed in SAP: {error_message}"
                )
            raise SAPValidationError(f"Validation error: {error_message}")
        else:
            raise SAPConnectionError(f"SAP error ({status_code}): {error_message}")

    def query_items(
        self,
        filter_str: Optional[str] = None,
        select: Optional[List[str]] = None,
        top: int = 100,
        skip: int = 0,
    ) -> Dict[str, Any]:
        """
        Query Items from SAP

        Args:
            filter_str: OData filter (e.g., "ItemName eq 'Product1'")
            select: Fields to select
            top: Number of records to return
            skip: Number of records to skip

        Returns:
            SAP response with 'value' array
        """
        # params = {
        #     "$top": top,
        #     "$skip": skip,
        # }

        # if filter_str:
        #     params["$filter"] = filter_str

        # if select:
        #     params["$select"] = ",".join(select)

        # params["$expand"] = "ItemPricesCollection($select=Price,PriceList)"
        params = {
            "$top": top,
            "$skip": skip,
        }

        if filter_str:
            params["$filter"] = filter_str

        if select:
            params["$select"] = ",".join(select)

        # NOTE: On this SAP B1 version, ItemPrices and ItemWarehouseInfoCollection
        # are returned INLINE in the response and do NOT support $expand.
        # Attempting $expand on either property returns 400 Bad Request.
        # Both collections are available as-is without any expansion.

        logger.debug(f"SAP Items query params: {params}")
        return self.get("Items", params)

    def get_item_attachments(self, item_code: str) -> Optional[Dict[str, Any]]:
        """Return the Attachments2 object for a given item, if any.

        SAP links attachments via Items.AttachmentEntry -> Attachments2(AbsEntry).
        """
        safe_code = quote(item_code, safe="")
        item = self.get(
            f"Items('{safe_code}')",
            params={"$select": "AttachmentEntry"},
        )
        attachment_entry = item.get("AttachmentEntry")
        if not attachment_entry:
            return None
        return self.get(f"Attachments2({int(attachment_entry)})")

    def get_attachment_data(
        self,
        attachment_entry: int,
        line_num: Optional[int] = None,
    ) -> tuple[bytes, str | None]:
        """Download attachment binary bytes for the first (or specified) line.

        Returns:
            (bytes, content_type)
        """
        abs_entry = int(attachment_entry)

        resolved_line_num = line_num
        if resolved_line_num is None:
            meta = self.get(f"Attachments2({abs_entry})")
            lines = meta.get("Attachments2_Lines") or meta.get("Attachments2_LinesCollection") or []
            if isinstance(lines, list) and lines:
                first_line = lines[0]
                resolved_line_num = first_line.get("LineNum")
            if resolved_line_num is None:
                resolved_line_num = 0

        ln = int(resolved_line_num)

        # Different SAP Service Layer versions expose attachment media slightly differently.
        # Try a small set of known patterns.
        candidate_endpoints = [
            # This is the working pattern on the current SAP Service Layer instance.
            f"Attachments2({abs_entry})/$value",
            f"Attachments2({abs_entry})/Attachments2_Lines({ln})/$value",
            f"Attachments2_Lines(AbsEntry={abs_entry},LineNum={ln})/$value",
        ]

        last_error: Exception | None = None
        for ep in candidate_endpoints:
            try:
                # Some endpoints are probed and can legitimately 400 depending on
                # SAP Service Layer version; avoid noisy ERROR logs for these.
                return self.get_binary(ep, log_errors=False)
            except (SAPValidationError, SAPConnectionError) as exc:
                last_error = exc
                continue

        # Re-raise with context
        raise SAPValidationError(
            f"Could not download attachment {abs_entry} line {ln}: {last_error}"
        )

    def close(self):
        """Close the HTTP client"""
        if self.client:
            self.logout()
            self.client.close()
            self.client = None


# Global SAP client instance
_sap_client: Optional[SAPServiceLayerClient] = None


def get_sap_client() -> SAPServiceLayerClient:
    """Get or create SAP Service Layer client singleton"""
    global _sap_client
    if _sap_client is None:
        _sap_client = SAPServiceLayerClient()
    return _sap_client


def close_sap_client():
    """Close SAP Service Layer client"""
    global _sap_client
    if _sap_client:
        _sap_client.close()
        _sap_client = None
