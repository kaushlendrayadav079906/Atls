from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.schemas.auth import AuthContext
from app.core.exceptions import ForbiddenException
from app.services.rbac import RBACService

class RequireRole:
    """
    A dependency class that enforces Role-Based Access Control (RBAC).
    Usage:
        @router.get("/protected")
        def protected_route(context = Depends(RequireRole("admin"))):
            ...
    """
    def __init__(self, required_role: str):
        self.required_role = required_role

    def __call__(
        self,
        request: Request,
        context: AuthContext = Depends(get_current_user_context),
        db: Session = Depends(get_db)
    ) -> AuthContext:
        
        rbac_service = RBACService(db)
        
        # Resolve all roles for the authenticated user, enforcing tenant scoping
        assigned_roles = rbac_service.get_user_role_names(
            user_id=context.user_id,
            company_id=context.company_id
        )
        
        # Check if the required role is present
        if self.required_role not in assigned_roles:
            raise ForbiddenException(detail=f"Insufficient permissions: requires {self.required_role}")
            
        return context
