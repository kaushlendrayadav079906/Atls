from uuid import UUID
from sqlalchemy.orm import Session
from app.repositories.user_role import user_role_repository
from app.services.role import role_service
from app.repositories.user import user_repository
from fastapi import status, HTTPException


class UserRoleService:
    def assign_role(self, db: Session, user_id: UUID, role_id: UUID):
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "User not found", "error_code": "USER_NOT_FOUND"}
            )
        
        role = role_service.get_role(db, role_id)
        
        if user.company_id != role.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "Tenant isolation error: User and Role must belong to the same company", "error_code": "TENANT_ISOLATION_ERROR"}
            )

        existing = user_role_repository.check_assignment(db, user_id, role_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": "User already has this role", "error_code": "ROLE_ALREADY_ASSIGNED"}
            )
            
        return user_role_repository.assign_role(db, user_id, role_id)

    def remove_role(self, db: Session, user_id: UUID, role_id: UUID):
        # We also want to ensure the user and role actually exist before trying to remove
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "User not found", "error_code": "USER_NOT_FOUND"}
            )
            
        role = role_service.get_role(db, role_id)
        
        if user.company_id != role.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "Tenant isolation error", "error_code": "TENANT_ISOLATION_ERROR"}
            )

        success = user_role_repository.remove_role(db, user_id, role_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "User does not have this role assigned", "error_code": "ROLE_NOT_ASSIGNED"}
            )

    def list_roles_for_user(self, db: Session, user_id: UUID):
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "User not found", "error_code": "USER_NOT_FOUND"}
            )
        return user_role_repository.list_roles_for_user(db, user_id)

user_role_service = UserRoleService()
