from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = Field(None, max_length=255)

class RoleCreate(RoleBase):
    company_id: UUID

class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = Field(None, max_length=255)

class RoleRead(RoleBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserRoleRead(BaseModel):
    user_id: UUID
    role_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
