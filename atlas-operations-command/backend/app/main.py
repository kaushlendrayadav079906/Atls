from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

from app.api.v1.company import router as company_router
from app.api.v1.user import router as user_router
from app.api.v1.role import router as role_router
from app.api.v1.auth import router as auth_router
from app.api.v1.factory import router as factory_router
from app.api.v1.business import router as business_router
from app.api.v1.reports import router as reports_router
from app.api.v1.upload import router as upload_router
from app.api.v1.ai import router as ai_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.currency import router as currency_router
from app.api.v1.tax import router as tax_router
from app.api.v1.localization import router as localization_router
from app.api.v1.fiscal_year import router as fiscal_year_router
from app.core.exceptions import add_exception_handlers

app = FastAPI(title="AtlasOps Cmd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(company_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(role_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(factory_router, prefix="/api/v1")
app.include_router(business_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api")
app.include_router(realtime_router, prefix="/api/v1")
app.include_router(realtime_router, prefix="/api")
app.include_router(currency_router, prefix="/api/v1")
app.include_router(tax_router, prefix="/api/v1")
app.include_router(localization_router, prefix="/api/v1")
app.include_router(fiscal_year_router, prefix="/api/v1")
add_exception_handlers(app)
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/health/db")
def health_db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
