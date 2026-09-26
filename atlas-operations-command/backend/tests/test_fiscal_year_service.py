import pytest
from datetime import date
from uuid import uuid4

from app.services.fiscal_year import fiscal_year_service, FiscalYearService
from app.core.exceptions import InvalidFiscalConfigurationError


def test_fiscal_year_start_month_validation():
    """Verify validation of fiscal_year_start_month boundaries."""
    # Valid
    for m in range(1, 13):
        assert FiscalYearService.validate_start_month(m) == m

    # Invalid
    with pytest.raises(InvalidFiscalConfigurationError):
        FiscalYearService.validate_start_month(0)

    with pytest.raises(InvalidFiscalConfigurationError):
        FiscalYearService.validate_start_month(13)

    with pytest.raises(InvalidFiscalConfigurationError):
        FiscalYearService.validate_start_month(-1)

    with pytest.raises(InvalidFiscalConfigurationError):
        FiscalYearService.validate_start_month("4")  # type: ignore


@pytest.mark.parametrize("start_month", list(range(1, 13)))
def test_all_twelve_start_months_fiscal_periods(start_month):
    """Verify fiscal year, quarter, and period calculation for all 12 start months."""
    company_id = uuid4()
    
    # Test on the first day of the fiscal year
    start_date = date(2026, start_month, 1)
    info = fiscal_year_service.calculate_fiscal_info(start_date, start_month, company_id)

    assert info.fiscal_year == 2026
    assert info.fiscal_period == 1
    assert info.fiscal_quarter == 1
    assert info.fiscal_quarter_label == "Q1"
    assert info.fiscal_year_start_date == start_date

    if start_month == 1:
        assert info.fiscal_year_label == "FY2026"
        assert info.fiscal_year_end_date == date(2026, 12, 31)
    else:
        assert info.fiscal_year_label == "FY2026-2027"


def test_april_start_month_standard_cases():
    """Detailed boundary checks for Indian Standard fiscal year (Start Month = 4)."""
    company_id = uuid4()
    start_month = 4

    # 1. First day of FY: 2026-04-01 -> FY2026 Q1 Period 1
    info = fiscal_year_service.calculate_fiscal_info(date(2026, 4, 1), start_month, company_id)
    assert info.fiscal_year == 2026
    assert info.fiscal_year_label == "FY2026-2027"
    assert info.fiscal_quarter == 1
    assert info.fiscal_period == 1
    assert info.quarter_start_date == date(2026, 4, 1)
    assert info.quarter_end_date == date(2026, 6, 30)

    # 2. End of Q1: 2026-06-30 -> FY2026 Q1 Period 3
    info = fiscal_year_service.calculate_fiscal_info(date(2026, 6, 30), start_month, company_id)
    assert info.fiscal_year == 2026
    assert info.fiscal_quarter == 1
    assert info.fiscal_period == 3

    # 3. Start of Q2: 2026-07-01 -> FY2026 Q2 Period 4
    info = fiscal_year_service.calculate_fiscal_info(date(2026, 7, 1), start_month, company_id)
    assert info.fiscal_year == 2026
    assert info.fiscal_quarter == 2
    assert info.fiscal_period == 4
    assert info.quarter_start_date == date(2026, 7, 1)
    assert info.quarter_end_date == date(2026, 9, 30)

    # 4. Start of Q3: 2026-10-01 -> FY2026 Q3 Period 7
    info = fiscal_year_service.calculate_fiscal_info(date(2026, 10, 1), start_month, company_id)
    assert info.fiscal_year == 2026
    assert info.fiscal_quarter == 3
    assert info.fiscal_period == 7
    assert info.quarter_start_date == date(2026, 10, 1)
    assert info.quarter_end_date == date(2026, 12, 31)

    # 5. December to January transition: 2026-12-31 to 2027-01-01
    info_dec = fiscal_year_service.calculate_fiscal_info(date(2026, 12, 31), start_month, company_id)
    assert info_dec.fiscal_year == 2026
    assert info_dec.fiscal_quarter == 3
    assert info_dec.fiscal_period == 9

    info_jan = fiscal_year_service.calculate_fiscal_info(date(2027, 1, 1), start_month, company_id)
    assert info_jan.fiscal_year == 2026
    assert info_jan.fiscal_year_label == "FY2026-2027"
    assert info_jan.fiscal_quarter == 4
    assert info_jan.fiscal_period == 10
    assert info_jan.quarter_start_date == date(2027, 1, 1)
    assert info_jan.quarter_end_date == date(2027, 3, 31)

    # 6. Last day of FY: 2027-03-31 -> FY2026 Q4 Period 12
    info_end = fiscal_year_service.calculate_fiscal_info(date(2027, 3, 31), start_month, company_id)
    assert info_end.fiscal_year == 2026
    assert info_end.fiscal_quarter == 4
    assert info_end.fiscal_period == 12
    assert info_end.fiscal_year_end_date == date(2027, 3, 31)


def test_january_start_month_calendar_year():
    """Verify standard calendar year (Start Month = 1)."""
    company_id = uuid4()
    start_month = 1

    # Jan 1
    info = fiscal_year_service.calculate_fiscal_info(date(2026, 1, 1), start_month, company_id)
    assert info.fiscal_year == 2026
    assert info.fiscal_year_label == "FY2026"
    assert info.fiscal_quarter == 1
    assert info.fiscal_period == 1
    assert info.fiscal_year_start_date == date(2026, 1, 1)
    assert info.fiscal_year_end_date == date(2026, 12, 31)
    assert info.quarter_start_date == date(2026, 1, 1)
    assert info.quarter_end_date == date(2026, 3, 31)

    # Dec 31
    info_dec = fiscal_year_service.calculate_fiscal_info(date(2026, 12, 31), start_month, company_id)
    assert info_dec.fiscal_year == 2026
    assert info_dec.fiscal_year_label == "FY2026"
    assert info_dec.fiscal_quarter == 4
    assert info_dec.fiscal_period == 12
    assert info_dec.quarter_start_date == date(2026, 10, 1)
    assert info_dec.quarter_end_date == date(2026, 12, 31)


def test_leap_year_february_29_boundaries():
    """Verify leap year handling for start month = 3 (March start -> Feb end)."""
    company_id = uuid4()
    start_month = 3

    # Leap Year 2028 (FY2027 starts 2027-03-01, ends 2028-02-29)
    info = fiscal_year_service.calculate_fiscal_info(date(2027, 3, 1), start_month, company_id)
    assert info.fiscal_year == 2027
    assert info.fiscal_year_label == "FY2027-2028"
    assert info.fiscal_year_start_date == date(2027, 3, 1)
    assert info.fiscal_year_end_date == date(2028, 2, 29)
    assert info.fiscal_quarter == 1

    # Date on Feb 29, 2028
    info_leap = fiscal_year_service.calculate_fiscal_info(date(2028, 2, 29), start_month, company_id)
    assert info_leap.fiscal_year == 2027
    assert info_leap.fiscal_quarter == 4
    assert info_leap.fiscal_period == 12
    assert info_leap.quarter_start_date == date(2027, 12, 1)
    assert info_leap.quarter_end_date == date(2028, 2, 29)

    # Non-Leap Year 2027 (FY2026 ends 2027-02-28)
    info_non_leap = fiscal_year_service.calculate_fiscal_info(date(2027, 2, 28), start_month, company_id)
    assert info_non_leap.fiscal_year == 2026
    assert info_non_leap.fiscal_year_end_date == date(2027, 2, 28)
    assert info_non_leap.quarter_end_date == date(2027, 2, 28)


def test_july_start_month_australian_us_federal_variations():
    """Verify July start (US/AUS standard, start_month = 7)."""
    company_id = uuid4()
    start_month = 7

    # 2026-07-01 -> FY2026 Q1 Period 1
    info_q1 = fiscal_year_service.calculate_fiscal_info(date(2026, 7, 1), start_month, company_id)
    assert info_q1.fiscal_year == 2026
    assert info_q1.fiscal_quarter == 1
    assert info_q1.fiscal_period == 1
    assert info_q1.fiscal_year_start_date == date(2026, 7, 1)
    assert info_q1.fiscal_year_end_date == date(2027, 6, 30)

    # 2027-06-30 -> FY2026 Q4 Period 12
    info_q4 = fiscal_year_service.calculate_fiscal_info(date(2027, 6, 30), start_month, company_id)
    assert info_q4.fiscal_year == 2026
    assert info_q4.fiscal_quarter == 4
    assert info_q4.fiscal_period == 12


def test_quarter_date_range_invalid_quarter():
    """Verify invalid quarter validation."""
    with pytest.raises(InvalidFiscalConfigurationError):
        fiscal_year_service.get_quarter_date_range(2026, 0, 4)

    with pytest.raises(InvalidFiscalConfigurationError):
        fiscal_year_service.get_quarter_date_range(2026, 5, 4)
