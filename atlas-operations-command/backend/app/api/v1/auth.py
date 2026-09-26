from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, AuthContext, RegisterRequest, RegisterResponse
from app.services.auth import AuthService
from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new company and its first administrator atomically.
    The first user receives the company-scoped 'admin' role.
    """
    auth_service = AuthService(db)
    return auth_service.register_company_and_admin(request)

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return a JWT access token.
    """
    auth_service = AuthService(db)
    
    # We allow UnauthenticatedException to bubble up 
    # as our global exception handler translates it to 401 correctly.
    access_token = auth_service.authenticate_user(
        company_name=request.company_name,
        email=request.email,
        password=request.password
    )
    
    return TokenResponse(access_token=access_token)

@router.get("/me")
def get_me(context: AuthContext = Depends(get_current_user_context)):
    """
    Returns the current authenticated user's identity based on the JWT access token.
    """
    return {
        "user_id": context.user_id,
        "company_id": context.company_id
    }

@router.get("/admin-test")
def admin_test(context: AuthContext = Depends(RequireRole("admin"))):
    """
    Test endpoint to verify 'admin' RBAC authorization.
    """
    return {"status": "success", "role_authorized": "admin", "user_id": context.user_id}

@router.get("/standard-test")
def standard_test(context: AuthContext = Depends(RequireRole("standard_user"))):
    """
    Test endpoint to verify 'standard_user' RBAC authorization.
    """
    return {"status": "success", "role_authorized": "standard_user", "user_id": context.user_id}
