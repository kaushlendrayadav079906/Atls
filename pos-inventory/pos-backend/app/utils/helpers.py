"""Utility functions"""

from datetime import datetime, date
from typing import Optional
import pytz

from app.core.config import settings


def get_timezone():
    """Get configured timezone"""
    return pytz.timezone(settings.TIMEZONE)


def get_current_date() -> date:
    """Get current date in configured timezone"""
    tz = get_timezone()
    return datetime.now(tz).date()


def get_current_datetime() -> datetime:
    """Get current datetime in configured timezone"""
    tz = get_timezone()
    return datetime.now(tz)


def format_currency(amount: float) -> str:
    """Format amount as currency (Indian Rupees)"""
    return f"₹{amount:,.2f}"


def generate_sale_id() -> str:
    """Generate unique sale ID"""
    timestamp = int(datetime.utcnow().timestamp())
    return f"SALE-{timestamp}"


def parse_sap_date(sap_date_str: str) -> Optional[datetime]:
    """
    Parse SAP date string to datetime
    
    SAP dates are typically in format: /Date(1234567890000)/
    """
    if not sap_date_str:
        return None
    
    try:
        # Extract timestamp from /Date(123)/
        if sap_date_str.startswith("/Date(") and sap_date_str.endswith(")/"):
            timestamp_ms = int(sap_date_str[6:-2])
            return datetime.fromtimestamp(timestamp_ms / 1000.0)
        
        # Try ISO format
        return datetime.fromisoformat(sap_date_str)
    except:
        return None


def format_sap_date(dt: datetime) -> str:
    """Format datetime for SAP (YYYY-MM-DD)"""
    return dt.strftime("%Y-%m-%d")
