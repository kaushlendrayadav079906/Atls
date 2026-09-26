from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class FileUploadBase(BaseModel):
    original_filename: str = Field(..., max_length=255)
    file_type: str = Field(..., max_length=50)
    content_type: str = Field(..., max_length=100)
    file_size: int
    file_hash: str = Field(..., max_length=64)

class FileUploadCreate(FileUploadBase):
    pass

class FileUploadResponse(FileUploadBase):
    id: UUID
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
