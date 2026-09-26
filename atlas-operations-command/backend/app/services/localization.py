import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.company import Company
from app.repositories.company import company_repository
from app.schemas.localization import (
    LocalizationConfigResponse,
    FormattingMetadata,
)
from app.core.exceptions import (
    NotFoundException,
    InvalidLocalizationConfigurationError,
    InvalidFiscalConfigurationError,
)

logger = logging.getLogger(__name__)

# Deterministic currency symbol metadata mapping
CURRENCY_SYMBOLS = {
    "USD": "$",
    "INR": "₹",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "CAD": "CA$",
    "AUD": "A$",
    "SGD": "S$",
    "CHF": "CHF",
    "CNY": "¥",
}


class LocalizationService:
    """
    Localization Service providing tenant-scoped localization configuration,
    timezone validation, and deterministic formatting metadata.
    """

    def validate_timezone(self, timezone_str: str) -> str:
        """
        Validates the timezone against IANA timezone database via zoneinfo.
        Raises InvalidLocalizationConfigurationError on failure.
        """
        if not timezone_str or not isinstance(timezone_str, str):
            raise InvalidLocalizationConfigurationError(f"Invalid timezone: '{timezone_str}'.")
        try:
            ZoneInfo(timezone_str)
            return timezone_str
        except ZoneInfoNotFoundError:
            raise InvalidLocalizationConfigurationError(
                f"Unknown or invalid IANA timezone: '{timezone_str}'."
            )
        except Exception as e:
            raise InvalidLocalizationConfigurationError(
                f"Timezone validation error for '{timezone_str}': {str(e)}"
            )

    def get_formatting_metadata(self, company: Company) -> FormattingMetadata:
        """
        Derives formatting metadata based on company configuration.
        """
        currency_code = (company.currency_code or "").upper()
        symbol = CURRENCY_SYMBOLS.get(currency_code, currency_code)

        # Standard deterministic formatting tokens
        return FormattingMetadata(
            currency_symbol=symbol,
            currency_decimals=2 if currency_code != "JPY" else 0,
            date_format="YYYY-MM-DD",
            decimal_separator=".",
            thousands_separator=",",
        )

    def get_localization_config(self, db: Session, company_id: UUID) -> LocalizationConfigResponse:
        """
        Loads the company for the given tenant and returns full localization configuration.
        """
        company = company_repository.get_by_id(db, id=company_id)
        if not company:
            raise NotFoundException(detail="Company not found.")

        # Validate timezone safely
        self.validate_timezone(company.timezone)

        # Validate fiscal_year_start_month
        if (
            company.fiscal_year_start_month is None
            or company.fiscal_year_start_month < 1
            or company.fiscal_year_start_month > 12
        ):
            raise InvalidFiscalConfigurationError(
                f"Invalid fiscal_year_start_month: {company.fiscal_year_start_month}."
            )

        formatting = self.get_formatting_metadata(company)

        return LocalizationConfigResponse(
            company_id=company.id,
            name=company.name,
            country_code=company.country_code,
            timezone=company.timezone,
            locale=company.locale,
            currency_code=company.currency_code,
            state_code=company.state_code,
            gstin=company.gstin,
            tax_id=company.tax_id,
            default_tax_rate=company.default_tax_rate,
            fiscal_year_start_month=company.fiscal_year_start_month,
            formatting=formatting,
        )


localization_service = LocalizationService()
