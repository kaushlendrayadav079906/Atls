from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class NotFoundException(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class AuthException(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class UnauthenticatedException(AuthException):
    pass

class InvalidAuthException(AuthException):
    pass

class ForbiddenException(AuthException):
    pass

class ConflictException(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class DuplicateExchangeRateError(ConflictException):
    pass

class CurrencyRateNotFoundError(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class TaxCalculationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class MissingTaxJurisdictionError(TaxCalculationError):
    pass

class InapplicableTaxJurisdictionError(TaxCalculationError):
    pass

class InvalidTaxRateError(TaxCalculationError):
    pass

class InvalidTaxJurisdictionError(TaxCalculationError):
    pass
class InvalidFiscalConfigurationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail

class InvalidLocalizationConfigurationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail

def add_exception_handlers(app: FastAPI):
    @app.exception_handler(UnauthenticatedException)
    async def unauthenticated_exception_handler(request: Request, exc: UnauthenticatedException):
        return JSONResponse(
            status_code=401,
            content={"detail": exc.detail},
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.exception_handler(ForbiddenException)
    async def forbidden_exception_handler(request: Request, exc: ForbiddenException):
        return JSONResponse(
            status_code=403,
            content={"detail": exc.detail},
        )

    @app.exception_handler(InvalidAuthException)
    async def invalid_auth_exception_handler(request: Request, exc: InvalidAuthException):
        return JSONResponse(
            status_code=403,
            content={"detail": exc.detail},
        )

    @app.exception_handler(NotFoundException)
    async def not_found_exception_handler(request: Request, exc: NotFoundException):
        return JSONResponse(
            status_code=404,
            content={"detail": exc.detail},
        )

    @app.exception_handler(ConflictException)
    async def conflict_exception_handler(request: Request, exc: ConflictException):
        return JSONResponse(
            status_code=409,
            content={"detail": exc.detail},
        )

    @app.exception_handler(CurrencyRateNotFoundError)
    async def currency_rate_not_found_exception_handler(request: Request, exc: CurrencyRateNotFoundError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.detail},
        )

    @app.exception_handler(TaxCalculationError)
    async def tax_calculation_error_handler(request: Request, exc: TaxCalculationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.detail},
        )

    @app.exception_handler(InvalidFiscalConfigurationError)
    async def invalid_fiscal_configuration_error_handler(request: Request, exc: InvalidFiscalConfigurationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.detail},
        )

    @app.exception_handler(InvalidLocalizationConfigurationError)
    async def invalid_localization_configuration_error_handler(request: Request, exc: InvalidLocalizationConfigurationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Global exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"},
        )
