from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Form
from sqlalchemy.orm import Session
from uuid import UUID, uuid4
import hashlib
from typing import List, Optional
import os

from app.core.database import get_db
from app.api.v1.auth import get_current_user_context, AuthContext
from app.models.upload import FileUpload
from app.schemas.upload import FileUploadResponse
from app.services.storage import storage_service
from app.services.ingestion import process_upload

router = APIRouter(prefix="/uploads", tags=["uploads"])

SUPPORTED_TYPES = {
    "text/csv": "csv",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/plain": "txt",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit

from app.api.rbac import RequireRole

@router.post("", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(RequireRole("admin"))
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename.")
        
    content_type = file.content_type
    if content_type not in SUPPORTED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {content_type}")
        
    file_type = SUPPORTED_TYPES[content_type]
    
    # Read chunked to enforce max size and compute hash
    content = b""
    hash_sha256 = hashlib.sha256()
    size = 0
    
    while chunk := await file.read(8192):
        size += len(chunk)
        if size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large.")
        content += chunk
        hash_sha256.update(chunk)
        
    if size == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed.")
        
    file_hash = hash_sha256.hexdigest()
    
    # Idempotency check: tenant-scoped
    existing = db.query(FileUpload).filter(
        FileUpload.company_id == auth.company_id,
        FileUpload.file_hash == file_hash
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="File already uploaded.")
        
    stored_filename = f"{uuid4()}.{file_type}"
    storage_service.save_file(stored_filename, content)
    
    upload = FileUpload(
        company_id=auth.company_id,
        uploaded_by_user_id=auth.user_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_type=file_type,
        content_type=content_type,
        file_size=size,
        file_hash=file_hash,
        status="uploaded"
    )
    
    db.add(upload)
    db.commit()
    db.refresh(upload)
    
    return upload

@router.get("", response_model=List[FileUploadResponse])
def list_uploads(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    return db.query(FileUpload).filter(FileUpload.company_id == auth.company_id).all()

@router.get("/{upload_id}", response_model=FileUploadResponse)
def get_upload(
    upload_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context)
):
    upload = db.query(FileUpload).filter(
        FileUpload.id == upload_id,
        FileUpload.company_id == auth.company_id
    ).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found.")
    return upload

@router.post("/{upload_id}/process", response_model=FileUploadResponse)
def trigger_processing(
    upload_id: UUID,
    background_tasks: BackgroundTasks,
    target_entity: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(RequireRole("admin"))
):
    upload = db.query(FileUpload).filter(
        FileUpload.id == upload_id,
        FileUpload.company_id == auth.company_id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found.")
        
    if upload.status not in ["uploaded", "failed"]:
        raise HTTPException(status_code=400, detail=f"Upload is already {upload.status}.")
        
    # Schedule background ingestion
    background_tasks.add_task(process_upload, db, upload_id, auth.company_id, target_entity)
    
    upload.status = "processing"
    db.commit()
    db.refresh(upload)
    
    return upload
