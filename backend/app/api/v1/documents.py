"""Document management API endpoints."""

import os
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.config import get_settings
from app.db.session import get_session
from app.db.models import Document, DocumentStatus, DocumentRead, User, UserRole
from app.dependencies import get_current_user
from app.core.vectorstore import delete_by_file_hash, search_documents
from app.core.cache import (
    get_cached_document_stats,
    set_cached_document_stats,
    invalidate_document_stats_cache,
    clear_upload_task_status,
)

settings = get_settings()
router = APIRouter()


@router.get("/", response_model=List[DocumentRead])
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status_filter: Optional[DocumentStatus] = None,
    search: Optional[str] = Query(None, min_length=1),
    file_type: Optional[str] = Query(None, min_length=1),
    uploaded_by: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    min_chunks: Optional[int] = None,
    max_chunks: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List documents with pagination and comprehensive filtering.

    Admins can see all documents. Regular users only see their own.

    Query params:
        - page: Page number (starts at 1)
        - page_size: Items per page (max 100)
        - status_filter: Filter by status (PROCESSING, COMPLETED, FAILED)
        - search: Search by filename (case-insensitive partial match)
        - file_type: Filter by file extension (e.g., 'pdf', 'docx', 'txt')
        - uploaded_by: Filter by user ID (admin only)
        - date_from: Filter documents created after this date (ISO format)
        - date_to: Filter documents created before this date (ISO format)
        - min_size: Minimum file size in bytes
        - max_size: Maximum file size in bytes
        - min_chunks: Minimum chunk count
        - max_chunks: Maximum chunk count
    """
    # Build query
    query = select(Document)

    # Filter by user (admin-only helper)
    if current_user.role == UserRole.ADMIN and uploaded_by is not None:
        # Admin-only filter: filter by specific user
        query = query.where(Document.uploaded_by == uploaded_by)

    # Filter by status
    if status_filter:
        query = query.where(Document.status == status_filter)

    # Search by filename
    if search:
        query = query.where(Document.filename.ilike(f"%{search}%"))

    # Filter by file type (extension)
    if file_type:
        # Match files ending with the extension (case-insensitive)
        query = query.where(Document.filename.ilike(f"%.{file_type}"))

    # Filter by date range
    if date_from:
        from datetime import datetime
        try:
            date_from_dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            # Remove timezone info to match timezone-naive database column
            date_from_dt = date_from_dt.replace(tzinfo=None)
            query = query.where(Document.created_at >= date_from_dt)
        except ValueError:
            pass  # Invalid date format, skip filter

    if date_to:
        from datetime import datetime
        try:
            date_to_dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            # Remove timezone info to match timezone-naive database column
            date_to_dt = date_to_dt.replace(tzinfo=None)
            query = query.where(Document.created_at <= date_to_dt)
        except ValueError:
            pass  # Invalid date format, skip filter

    # Filter by file size
    if min_size is not None:
        query = query.where(Document.file_size >= min_size)
    if max_size is not None:
        query = query.where(Document.file_size <= max_size)

    # Filter by chunk count
    if min_chunks is not None:
        query = query.where(Document.chunk_count >= min_chunks)
    if max_chunks is not None:
        query = query.where(Document.chunk_count <= max_chunks)

    # Order by most recent first
    query = query.order_by(col(Document.created_at).desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute
    result = await session.execute(query)
    documents = result.scalars().all()

    return documents


@router.get("/stats")
async def get_document_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get document statistics.

    Returns:
        - total_documents: Total number of documents
        - total_chunks: Total number of embeddings
        - by_status: Count by status
        - storage_used: Total storage in bytes
    """
    cache_hit = await get_cached_document_stats(None, is_admin=True)
    if cache_hit:
        return cache_hit

    status_counts = {status.value: 0 for status in DocumentStatus}
    status_query = select(Document.status, func.count()).group_by(Document.status)

    result = await session.execute(status_query)
    for status, count in result.all():
        key = status.value if isinstance(status, DocumentStatus) else str(status)
        status_counts[key] = count

    total_query = select(func.count()).select_from(Document)
    total_docs = (await session.execute(total_query)).scalar_one() or 0

    storage_query = select(func.coalesce(func.sum(Document.file_size), 0)).select_from(Document)
    total_storage = (await session.execute(storage_query)).scalar_one() or 0

    chunk_query = select(func.coalesce(func.sum(Document.chunk_count), 0)).select_from(Document)
    total_chunks = (await session.execute(chunk_query)).scalar_one() or 0

    payload = {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "by_status": status_counts,
        "storage_used_bytes": total_storage,
        "storage_used_mb": round(total_storage / 1024 / 1024, 2) if total_storage else 0,
    }

    await set_cached_document_stats(None, is_admin=True, data=payload)

    return payload


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get document details by ID.

    Returns document with all metadata including error messages if failed.
    """
    statement = select(Document).where(Document.id == document_id)
    result = await session.execute(statement)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a document.

    This will:
    1. Delete all chunks from ChromaDB
    2. Delete the document record from PostgreSQL
    3. Remove the physical file from disk

    Returns:
        - message: Confirmation message
        - chunks_deleted: Number of chunks removed from vectorstore
    """
    # Get document
    statement = select(Document).where(Document.id == document_id)
    result = await session.execute(statement)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Check access
    if current_user.role != UserRole.ADMIN and document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Delete from ChromaDB
    chunks_deleted = await delete_by_file_hash(document.file_hash)

    # Delete physical file
    file_path = settings.UPLOAD_DIR / document.file_hash
    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception as e:
            # Log but don't fail if file deletion fails
            import logging
            logging.error(f"Failed to delete file {file_path}: {e}")

    # Clear Redis task status keys (prevents stale status if same file is re-uploaded)
    await clear_upload_task_status(document.file_hash)

    # Delete from database
    await session.delete(document)
    await session.commit()
    await invalidate_document_stats_cache(document.uploaded_by)

    return {
        "message": f"Document '{document.filename}' deleted successfully",
        "document_id": document_id,
        "chunks_deleted": chunks_deleted,
    }


@router.post("/search")
async def semantic_search(
    query: str = Query(..., min_length=1),
    k: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Perform semantic search across document chunks.

    Args:
        query: Search query text
        k: Number of results to return (max 50)

    Returns:
        List of matching chunks with scores and metadata
    """
    # Search across all documents for all users
    results = await search_documents(query=query, k=k, filter=None)

    return {
        "query": query,
        "results": results,
        "count": len(results),
    }
