"""File upload API endpoints."""

import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from arq import ArqRedis

from app.config import get_settings
from app.db.session import get_session
from app.db.models import Document, DocumentStatus, User
from app.dependencies import get_current_user, get_arq_pool
from app.core.ingestion import is_supported_file_type, get_supported_extensions, compute_file_hash
from app.core.cache import invalidate_document_stats_cache

settings = get_settings()
router = APIRouter()


@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    arq_pool: ArqRedis = Depends(get_arq_pool),
):
    """
    Upload a file for processing.

    The file is saved to disk and a background task is enqueued
    to process it (load, chunk, embed).

    Returns:
        - file_hash: Unique identifier for tracking
        - document_id: Database ID
        - status: "queued"
    """
    # Validate file type
    if not is_supported_file_type(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Supported types: {', '.join(get_supported_extensions())}",
        )

    # Validate file size
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.1f} MB",
        )

    # Compute file hash
    timestamp = datetime.utcnow().isoformat()
    file_hash = compute_file_hash(file.filename, timestamp)

    # Check for duplicate
    from sqlmodel import select
    statement = select(Document).where(Document.file_hash == file_hash)
    result = await session.execute(statement)
    existing_doc = result.scalar_one_or_none()

    if existing_doc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This file has already been uploaded",
        )

    # Save file to upload directory with original extension
    # Extract extension from filename
    import os
    _, ext = os.path.splitext(file.filename)
    file_path = settings.UPLOAD_DIR / f"{file_hash}{ext}"
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(file_content)

    # Detect MIME type (basic detection)
    mime_type = file.content_type or "application/octet-stream"

    # Create document record
    document = Document(
        file_hash=file_hash,
        filename=file.filename,
        file_size=file_size,
        mime_type=mime_type,
        status=DocumentStatus.PROCESSING,
        uploaded_by=current_user.id,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    await invalidate_document_stats_cache(current_user.id)

    # Enqueue background task
    job = await arq_pool.enqueue_job(
        "process_document_upload",
        file_path=str(file_path),
        file_hash=file_hash,
        document_id=document.id,
    )

    return {
        "file_hash": file_hash,
        "document_id": document.id,
        "job_id": job.job_id,
        "status": "queued",
        "message": "File uploaded successfully. Processing in background.",
    }


@router.get("/status/{file_hash}")
async def get_upload_status(
    file_hash: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    arq_pool: ArqRedis = Depends(get_arq_pool),
):
    """
    Get upload processing status.

    Returns:
        - status: "queued", "running", "completed", "failed"
        - progress: 0-100
        - message: Status message
        - document_id: Database ID (if available)
    """
    # Get document from database
    from sqlmodel import select
    statement = select(Document).where(Document.file_hash == file_hash)
    result = await session.execute(statement)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Check if user has access (admin can see all, users only their own)
    from app.db.models import UserRole
    if current_user.role != UserRole.ADMIN and document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Get task status from Redis
    redis = arq_pool
    task_status = await redis.get(f"task:upload:{file_hash}:status")
    task_progress = await redis.get(f"task:upload:{file_hash}:progress")
    task_message = await redis.get(f"task:upload:{file_hash}:message")
    task_error = await redis.get(f"task:upload:{file_hash}:error")

    # Decode bytes to string if needed
    if task_status:
        task_status = task_status.decode() if isinstance(task_status, bytes) else task_status
    if task_progress:
        task_progress = task_progress.decode() if isinstance(task_progress, bytes) else task_progress
    if task_message:
        task_message = task_message.decode() if isinstance(task_message, bytes) else task_message
    if task_error:
        task_error = task_error.decode() if isinstance(task_error, bytes) else task_error

    # Determine status
    status_map = {
        DocumentStatus.PROCESSING: "running",
        DocumentStatus.COMPLETED: "completed",
        DocumentStatus.FAILED: "failed",
    }

    return {
        "file_hash": file_hash,
        "document_id": document.id,
        "status": task_status or status_map.get(document.status, "unknown"),
        "progress": int(task_progress) if task_progress else 0,
        "message": task_message or document.error_message or "Processing...",
        "error": task_error or document.error_message,
        "chunk_count": document.chunk_count,
        "db_status": document.status.value,
    }


@router.get("/supported-types")
async def get_supported_types():
    """
    Get list of supported file types and max upload size.

    Returns:
        - extensions: List of supported file extensions
        - max_size_mb: Maximum file size in MB
    """
    return {
        "extensions": get_supported_extensions(),
        "max_size_bytes": settings.MAX_UPLOAD_SIZE,
        "max_size_mb": round(settings.MAX_UPLOAD_SIZE / 1024 / 1024, 1),
    }
