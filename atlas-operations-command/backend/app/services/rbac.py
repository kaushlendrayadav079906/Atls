from sqlalchemy.orm import Session
from uuid import UUID

from app.models.role import Role
from app.models.user_role import UserRole

class RBACService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_role_names(self, user_id: UUID, company_id: UUID) -> set[str]:
        """
        Resolves the roles assigned to a user by verifying both the UserRole
        assignment and ensuring the Role actually belongs to the user's company.
        This enforces tenant isolation at the role level.
        Returns a set of role names.
        """
        # Query UserRoles and join with Roles
        # We enforce that the role's company_id matches the user's company_id
        roles = (
            self.db.query(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(
                UserRole.user_id == user_id,
                Role.company_id == company_id
            )
            .all()
        )
        
        return {role[0] for role in roles}
