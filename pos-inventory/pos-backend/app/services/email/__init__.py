"""ATLAS Email Service Package"""

from app.services.email.provider import (
    BaseEmailProvider,
    ConsoleEmailProvider,
    MockEmailProvider,
    SMTPEmailProvider,
    get_email_provider,
    reset_email_provider,
    EmailProviderError,
)
from app.services.email.email_service import EmailService, email_service, validate_email_address

__all__ = [
    "BaseEmailProvider",
    "ConsoleEmailProvider",
    "MockEmailProvider",
    "SMTPEmailProvider",
    "get_email_provider",
    "reset_email_provider",
    "EmailProviderError",
    "EmailService",
    "email_service",
    "validate_email_address",
]
