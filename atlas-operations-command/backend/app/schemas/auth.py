from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator, model_validator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

class AuthContext(BaseModel):
    """
    Represents the authenticated identity payload for a request.
    This provides a strictly-typed context boundary for authorization rules.
    Does NOT contain passwords or tokens.
    """
    user_id: UUID
    company_id: UUID

    model_config = ConfigDict(
        # Future-proofing: explicitly reject unexpected token/password fields if inadvertently passed
        extra="forbid"
    )

class LoginRequest(BaseModel):
    company_name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

    model_config = ConfigDict(
        extra="forbid"
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("company_name must not be empty after trimming")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed:
            raise ValueError("email must not be empty")
        return trimmed

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("password must not be empty")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    country_code: Optional[str] = None
    currency_code: str = Field(...)
    timezone: str = Field(...)
    locale: Optional[str] = "en-US"
    region: Optional[str] = "Global"
    fiscal_year_start_month: Optional[int] = Field(1, ge=1, le=12)
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr = Field(...)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(...)

    model_config = ConfigDict(
        extra="forbid"
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("company_name must not be empty after trimming")
        if len(trimmed) > 255:
            raise ValueError("company_name must not exceed 255 characters")
        return trimmed

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("full_name must not be empty after trimming")
        if len(trimmed) > 255:
            raise ValueError("full_name must not exceed 255 characters")
        return trimmed

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip().upper()
        if not trimmed:
            return None
        if len(trimmed) != 2 or not trimmed.isalpha():
            raise ValueError("country_code must be exactly 2 uppercase letters")
        return trimmed

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, v: str) -> str:
        trimmed = v.strip().upper()
        if len(trimmed) != 3 or not trimmed.isalpha():
            raise ValueError("currency_code must be exactly 3 uppercase letters")
        return trimmed

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: Optional[str]) -> str:
        if v is None:
            return "en-US"
        trimmed = v.strip()
        return trimmed if trimmed else "en-US"

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: Optional[str]) -> str:
        if v is None:
            return "Global"
        trimmed = v.strip()
        return trimmed if trimmed else "Global"

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("timezone is required and cannot be empty")
        try:
            ZoneInfo(trimmed)
            return trimmed
        except ZoneInfoNotFoundError:
            raise ValueError(f"Unknown or invalid IANA timezone: '{trimmed}'")
        except Exception as e:
            raise ValueError(f"Timezone validation error: {str(e)}")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

    @model_validator(mode="after")
    def check_passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("password and confirm_password do not match")
        return self

class RegisterResponse(BaseModel):
    message: str = "Company and administrator registered successfully"
    company_id: UUID
    company_name: str
    email: str
    full_name: str

