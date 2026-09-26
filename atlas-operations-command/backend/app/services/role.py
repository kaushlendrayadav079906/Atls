from uuid import UUID
from sqlalchemy.orm import Session
from app.schemas.role import RoleCreate, RoleUpdate
from app.repositories.role import role_repository
from fastapi import status, HTTPException

SUPPORTED_ROLES = {"admin", "standard_user"}

class RoleService:
    def validate_role_name(self, name: str) -> str:
        name_normalized = name.strip().lower()
        if name_normalized not in SUPPORTED_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Role name '{name}' is not supported. Supported roles: {', '.join(SUPPORTED_ROLES)}", "error_code": "INVALID_ROLE_NAME"}
            )
        return name_normalized

    def create_role(self, db: Session, obj_in: RoleCreate):
        obj_in.name = self.validate_role_name(obj_in.name)
        existing = role_repository.get_by_name_within_company(db, obj_in.company_id, obj_in.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": f"Role '{obj_in.name}' already exists in this company", "error_code": "ROLE_ALREADY_EXISTS"}
            )
        return role_repository.create(db, obj_in)

    def get_role(self, db: Session, role_id: UUID):
        role = role_repository.get_by_id(db, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Role not found", "error_code": "ROLE_NOT_FOUND"}
            )
        return role

    def list_roles_by_company(self, db: Session, company_id: UUID, skip: int = 0, limit: int = 100):
        return role_repository.list_by_company(db, company_id, skip, limit)

    def update_role(self, db: Session, role_id: UUID, obj_in: RoleUpdate):
        role = self.get_role(db, role_id)
        if obj_in.name:
            obj_in.name = self.validate_role_name(obj_in.name)
            if obj_in.name != role.name:
                existing = role_repository.get_by_name_within_company(db, role.company_id, obj_in.name)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"message": f"Role '{obj_in.name}' already exists in this company", "error_code": "ROLE_ALREADY_EXISTS"}
                    )
        return role_repository.update(db, role, obj_in)

    def seed_default_roles(self, db: Session, company_id: UUID):
        """Idempotent seed operation for default roles within a company."""
        for role_name in SUPPORTED_ROLES:
            existing = role_repository.get_by_name_within_company(db, company_id, role_name)
            if not existing:
                role_repository.create(db, RoleCreate(company_id=company_id, name=role_name, description=f"Default {role_name} role"))

role_service = RoleService()
