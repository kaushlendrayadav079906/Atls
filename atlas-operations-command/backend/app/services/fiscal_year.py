import calendar
from datetime import date
from typing import Tuple, Dict, Any

from app.core.exceptions import InvalidFiscalConfigurationError
from app.schemas.localization import FiscalYearInfoResponse


class FiscalYearService:
    """
    Deterministic domain service for calculating fiscal years, quarters, periods,
    and boundary date ranges based on a company's fiscal_year_start_month (1..12).
    """

    @staticmethod
    def validate_start_month(start_month: int) -> int:
        if not isinstance(start_month, int) or start_month < 1 or start_month > 12:
            raise InvalidFiscalConfigurationError(
                f"Invalid fiscal_year_start_month: {start_month}. Must be an integer between 1 and 12."
            )
        return start_month

    @classmethod
    def get_fiscal_year(cls, target_date: date, start_month: int) -> int:
        cls.validate_start_month(start_month)
        if start_month == 1:
            return target_date.year
        if target_date.month >= start_month:
            return target_date.year
        return target_date.year - 1

    @classmethod
    def get_fiscal_year_label(cls, fiscal_year: int, start_month: int) -> str:
        cls.validate_start_month(start_month)
        if start_month == 1:
            return f"FY{fiscal_year}"
        return f"FY{fiscal_year}-{fiscal_year + 1}"

    @classmethod
    def get_fiscal_quarter(cls, target_date: date, start_month: int) -> int:
        cls.validate_start_month(start_month)
        month_offset = (target_date.month - start_month) % 12
        return (month_offset // 3) + 1

    @classmethod
    def get_fiscal_period(cls, target_date: date, start_month: int) -> int:
        cls.validate_start_month(start_month)
        month_offset = (target_date.month - start_month) % 12
        return month_offset + 1

    @classmethod
    def get_fiscal_year_date_range(cls, fiscal_year: int, start_month: int) -> Tuple[date, date]:
        cls.validate_start_month(start_month)
        if start_month == 1:
            start_date = date(fiscal_year, 1, 1)
            end_date = date(fiscal_year, 12, 31)
            return start_date, end_date

        start_date = date(fiscal_year, start_month, 1)
        end_year = fiscal_year + 1
        end_month = start_month - 1
        _, last_day = calendar.monthrange(end_year, end_month)
        end_date = date(end_year, end_month, last_day)
        return start_date, end_date

    @classmethod
    def get_quarter_date_range(cls, fiscal_year: int, quarter: int, start_month: int) -> Tuple[date, date]:
        cls.validate_start_month(start_month)
        if quarter < 1 or quarter > 4:
            raise InvalidFiscalConfigurationError(f"Invalid fiscal quarter: {quarter}. Must be between 1 and 4.")

        # Quarter start month (1..12)
        q_start_month_idx = ((start_month - 1) + (quarter - 1) * 3) % 12 + 1
        # Quarter end month (1..12)
        q_end_month_idx = ((start_month - 1) + quarter * 3 - 1) % 12 + 1

        # Year determination
        if start_month == 1:
            q_start_year = fiscal_year
            q_end_year = fiscal_year
        else:
            q_start_year = fiscal_year + 1 if q_start_month_idx < start_month else fiscal_year
            q_end_year = fiscal_year + 1 if q_end_month_idx < start_month else fiscal_year

        start_date = date(q_start_year, q_start_month_idx, 1)
        _, last_day = calendar.monthrange(q_end_year, q_end_month_idx)
        end_date = date(q_end_year, q_end_month_idx, last_day)
        return start_date, end_date

    @classmethod
    def calculate_fiscal_info(
        cls,
        target_date: date,
        start_month: int,
        company_id: Any
    ) -> FiscalYearInfoResponse:
        cls.validate_start_month(start_month)
        fy = cls.get_fiscal_year(target_date, start_month)
        fy_label = cls.get_fiscal_year_label(fy, start_month)
        fq = cls.get_fiscal_quarter(target_date, start_month)
        fq_label = f"Q{fq}"
        fp = cls.get_fiscal_period(target_date, start_month)

        fy_start_date, fy_end_date = cls.get_fiscal_year_date_range(fy, start_month)
        q_start_date, q_end_date = cls.get_quarter_date_range(fy, fq, start_month)

        return FiscalYearInfoResponse(
            company_id=company_id,
            fiscal_year_start_month=start_month,
            as_of_date=target_date,
            fiscal_year=fy,
            fiscal_year_label=fy_label,
            fiscal_quarter=fq,
            fiscal_quarter_label=fq_label,
            fiscal_period=fp,
            fiscal_year_start_date=fy_start_date,
            fiscal_year_end_date=fy_end_date,
            quarter_start_date=q_start_date,
            quarter_end_date=q_end_date,
        )


fiscal_year_service = FiscalYearService()
