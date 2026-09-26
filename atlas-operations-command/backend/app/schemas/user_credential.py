from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime

class CredentialCreate(BaseModel):
    password: str = Field(..., min_length=8, description="The user's raw password")

class CredentialResponse(BaseModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
