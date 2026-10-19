"""
Email Provider Adapters for ATLAS.
Supports SMTP with TLS/SSL authentication, Console logging provider, and Mock testing provider.
"""

from __future__ import annotations

import abc
import email.utils
import logging
import smtplib
import uuid
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailProviderError(Exception):
    """Custom exception raised when an email provider fails to send."""
    pass


class BaseEmailProvider(abc.ABC):
    """Abstract base class for email delivery providers."""

    @abc.abstractmethod
    def send(
        self,
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an email message through the provider.

        Returns:
            Dict containing:
                - success: bool
                - status: str ("accepted_by_provider", "sent", "failed")
                - provider: str
                - provider_message_id: str
                - details: Optional[Dict[str, Any]]
        """
        pass


class ConsoleEmailProvider(BaseEmailProvider):
    """
    Console/Local email provider for development and testing.
    Logs structured email content to stdout/logger without external dependencies.
    """

    def send(
        self,
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        message_id = f"console_{uuid.uuid4().hex[:12]}@atlas.local"
        sender_addr = from_address or settings.EMAIL_FROM_ADDRESS
        sender_name = from_name or settings.EMAIL_FROM_NAME

        log_payload = (
            f"\n{'=' * 60}\n"
            f"[ATLAS EMAIL CONSOLE PROVIDER - ACCEPTED]\n"
            f"Message-ID: {message_id}\n"
            f"From: {sender_name} <{sender_addr}>\n"
            f"To: {to_email}\n"
            f"CC: {', '.join(cc) if cc else 'None'}\n"
            f"BCC: {', '.join(bcc) if bcc else 'None'}\n"
            f"Subject: {subject}\n"
            f"{'-' * 60}\n"
            f"{body}\n"
            f"{'=' * 60}\n"
        )
        logger.info(log_payload)

        return {
            "success": True,
            "status": "accepted_by_provider",
            "provider": "console",
            "provider_message_id": message_id,
            "details": {
                "sender": f"{sender_name} <{sender_addr}>",
                "recipient": to_email,
                "cc_count": len(cc or []),
                "bcc_count": len(bcc or []),
            },
        }


class MockEmailProvider(BaseEmailProvider):
    """
    Mock email provider for unit and automated integration tests.
    Stores messages in-memory with optional simulation of provider failures.
    """

    def __init__(self):
        self.sent_messages: List[Dict[str, Any]] = []
        self.simulate_failure: bool = False
        self.failure_reason: str = "Simulated provider outage"

    def send(
        self,
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.simulate_failure:
            raise EmailProviderError(self.failure_reason)

        message_id = f"mock_{uuid.uuid4().hex[:12]}@atlas.mock"
        record = {
            "to_email": to_email,
            "subject": subject,
            "body": body,
            "cc": cc or [],
            "bcc": bcc or [],
            "from_address": from_address or settings.EMAIL_FROM_ADDRESS,
            "from_name": from_name or settings.EMAIL_FROM_NAME,
            "message_id": message_id,
        }
        self.sent_messages.append(record)

        return {
            "success": True,
            "status": "accepted_by_provider",
            "provider": "mock",
            "provider_message_id": message_id,
            "details": {"queue_size": len(self.sent_messages)},
        }

    def reset(self):
        self.sent_messages.clear()
        self.simulate_failure = False


class SMTPEmailProvider(BaseEmailProvider):
    """
    SMTP email provider for real transactional email delivery.
    Supports TLS, SSL, authenticated SMTP, and strict connection timeouts.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: Optional[bool] = None,
        use_ssl: Optional[bool] = None,
        timeout: Optional[float] = None,
    ):
        self.host = host or settings.SMTP_HOST
        self.port = port or settings.SMTP_PORT
        self.username = username or settings.SMTP_USER
        self.password = password if password is not None else settings.SMTP_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS
        self.use_ssl = use_ssl if use_ssl is not None else settings.SMTP_USE_SSL
        self.timeout = timeout if timeout is not None else settings.SMTP_TIMEOUT

    def send(
        self,
        to_email: str,
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        sender_addr = from_address or settings.EMAIL_FROM_ADDRESS
        sender_name = from_name or settings.EMAIL_FROM_NAME
        clean_cc = [c.strip() for c in (cc or []) if c and c.strip()]
        clean_bcc = [b.strip() for b in (bcc or []) if b and b.strip()]

        message_id = email.utils.make_msgid(domain="atlas.local")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        msg["From"] = email.utils.formataddr((str(Header(sender_name, "utf-8")), sender_addr))
        msg["To"] = to_email
        if clean_cc:
            msg["Cc"] = ", ".join(clean_cc)
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["Message-ID"] = message_id

        # Plain text version
        part_text = MIMEText(body, "plain", "utf-8")
        msg.attach(part_text)

        all_recipients = [to_email] + clean_cc + clean_bcc

        try:
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=self.timeout)

            with server:
                server.ehlo()
                if self.use_tls and not self.use_ssl:
                    server.starttls()
                    server.ehlo()

                if self.username and self.password:
                    server.login(self.username, self.password)

                send_errors = server.sendmail(sender_addr, all_recipients, msg.as_string())
                if send_errors:
                    logger.warning("SMTP partial recipient rejection: %s", send_errors)

            logger.info("Email successfully accepted by SMTP provider (%s) for %s", self.host, to_email)
            return {
                "success": True,
                "status": "accepted_by_provider",
                "provider": "smtp",
                "provider_message_id": message_id,
                "details": {
                    "host": self.host,
                    "port": self.port,
                    "recipients_count": len(all_recipients),
                },
            }

        except smtplib.SMTPAuthenticationError as auth_err:
            logger.error("SMTP authentication failed for user %s: %s", self.username, auth_err)
            raise EmailProviderError("Email provider authentication failed. Check backend SMTP credentials.")
        except smtplib.SMTPRecipientsRefused as rec_err:
            logger.error("SMTP recipient refused: %s", rec_err)
            raise EmailProviderError(f"Recipient address was refused by the mail server: {rec_err}")
        except smtplib.SMTPServerDisconnected as disc_err:
            logger.error("SMTP server unexpectedly disconnected: %s", disc_err)
            raise EmailProviderError("Mail server disconnected unexpectedly. Please retry.")
        except Exception as exc:
            logger.error("SMTP send failed: %s", exc, exc_info=True)
            raise EmailProviderError(f"Email delivery provider error: {str(exc)}")


# Global singleton cache for provider
_PROVIDER_INSTANCE: Optional[BaseEmailProvider] = None


def get_email_provider() -> BaseEmailProvider:
    """Factory to get the configured email provider instance."""
    global _PROVIDER_INSTANCE
    provider_name = (getattr(settings, "EMAIL_PROVIDER", "console") or "console").strip().lower()

    if provider_name == "mock":
        if not isinstance(_PROVIDER_INSTANCE, MockEmailProvider):
            _PROVIDER_INSTANCE = MockEmailProvider()
        return _PROVIDER_INSTANCE

    if provider_name == "smtp":
        if not isinstance(_PROVIDER_INSTANCE, SMTPEmailProvider):
            _PROVIDER_INSTANCE = SMTPEmailProvider()
        return _PROVIDER_INSTANCE

    # Default: Console logger
    if not isinstance(_PROVIDER_INSTANCE, ConsoleEmailProvider):
        _PROVIDER_INSTANCE = ConsoleEmailProvider()
    return _PROVIDER_INSTANCE


def reset_email_provider():
    """Reset global provider instance (used in tests)."""
    global _PROVIDER_INSTANCE
    _PROVIDER_INSTANCE = None
