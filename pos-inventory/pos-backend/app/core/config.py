"""Application configuration and settings"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "POS Backend API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 3000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"
    
    @field_validator("CORS_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, v: str) -> List[str]:
        """Parse comma-separated CORS origins"""
        return [origin.strip() for origin in v.split(",")]
    
    # Database
    DATABASE_URL: str = ""


    # Rate limiting (requests per minute)
    RATE_LIMIT_GENERAL: str = "120/minute"
    RATE_LIMIT_SALES: str = "30/minute"
    RATE_LIMIT_IMAGES: str = "60/minute"

    # Circuit-breaker
    SAP_CB_THRESHOLD: int = 5
    SAP_CB_RECOVERY_TIMEOUT: float = 30.0

    # JWT Authentication
    SECRET_KEY: str
    REGISTER_MASTER_PASSWORD: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # SAP Business One Service Layer
    SAP_SERVICE_LAYER_URL: str
    SAP_COMPANY_DB: str
    SAP_USERNAME: str
    SAP_PASSWORD: str
    SAP_SSL_VERIFY: bool = False
    SAP_HTTP_TIMEOUT: float = 60.0

    # Optional: Item picture handling.
    # Some SAP setups populate Items.Picture with a filename that is not retrievable
    # through Service Layer. If you have the pictures available on disk (backend runs
    # on the same machine or has a network share), set SAP_PICTURE_BASE_PATH.
    # If pictures are hosted via HTTP, set SAP_PICTURE_BASE_URL.
    SAP_PICTURE_BASE_PATH: str = ""
    SAP_PICTURE_BASE_URL: str = ""
    
    # SAP Defaults
    SAP_DEFAULT_WAREHOUSE: str = "01"
    SAP_DEFAULT_PRICE_LIST: int = 1
    SAP_DEFAULT_CARD_TYPE: str = "C"
    SAP_INCOMING_PAYMENT_SERIES: int | None = None
    # When true, incoming payments are created in background after invoice creation.
    SAP_ASYNC_PAYMENT: bool = True
    # Cache SAP lookups (tax codes, VAT groups, customers) in hours.
    SAP_LOOKUP_CACHE_HOURS: int = 6
    # Retry incoming payment creation on transient failures.
    SAP_PAYMENT_RETRY_ATTEMPTS: int = 3
    SAP_PAYMENT_RETRY_DELAY_SEC: float = 1.5
    
    # Cache Settings (in seconds)
    CACHE_PRODUCTS_TTL: int = 900  # 15 minutes
    CACHE_PRICE_LISTS_TTL: int = 3600  # 1 hour
    CACHE_CUSTOMERS_TTL: int = 1800  # 30 minutes
    CACHE_PRODUCT_IMAGES_TTL: int = 3600  # 1 hour
    
    # Sync Job Settings
    SYNC_PRODUCTS_INTERVAL: int = 900  # 15 minutes
    SYNC_RETRY_ATTEMPTS: int = 3
    SYNC_RETRY_DELAY: int = 60  # seconds
    
    # Timezone
    TIMEZONE: str = "Asia/Kolkata"

    # Public base URL used for generating absolute URLs in cached payloads
    # (e.g., product image proxy URLs). If empty, code falls back to
    # http://localhost:<PORT>.
    PUBLIC_BASE_URL: str = ""

    # AI Provider (OpenAI)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
