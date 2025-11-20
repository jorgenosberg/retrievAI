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
from app.core.vectorstore import delete_by_file_hash, search_documents, count_total_embeddings
from app.core.cache import (
    get_cached_document_stats,
    set_cached_document_stats,
    invalidate_document_stats_cache,
)

settings = get_settings()
router = APIRouter()


@router.get("/", response_model=List[DocumentRead])
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status_filter: Optional[DocumentStatus] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List documents with pagination.

    Admins can see all documents. Regular users only see their own.

    Query params:
        - page: Page number (starts at 1)
        - page_size: Items per page (max 100)
        - status_filter: Filter by status (PROCESSING, COMPLETED, FAILED)
    """
    # Build query
    query = select(Document)

    # Filter by user (unless admin)
    if current_user.role != UserRole.ADMIN:
        query = query.where(Document.uploaded_by == current_user.id)

    # Filter by status
    if status_filter:
        query = query.where(Document.status == status_filter)

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
    is_admin = current_user.role == UserRole.ADMIN
    cache_hit = await get_cached_document_stats(
        None if is_admin else current_user.id,
        is_admin=is_admin,
    )
    if cache_hit:
        return cache_hit

    filters = []
    if not is_admin:
        filters.append(Document.uploaded_by == current_user.id)

    status_counts = {status.value: 0 for status in DocumentStatus}
    status_query = select(Document.status, func.count()).group_by(Document.status)
    if filters:
        status_query = status_query.where(*filters)

    result = await session.execute(status_query)
    for status, count in result.all():
        key = status.value if isinstance(status, DocumentStatus) else str(status)
        status_counts[key] = count

    total_query = select(func.count()).select_from(Document)
    if filters:
        total_query = total_query.where(*filters)
    total_docs = (await session.execute(total_query)).scalar_one() or 0

    storage_query = select(func.coalesce(func.sum(Document.file_size), 0)).select_from(Document)
    if filters:
        storage_query = storage_query.where(*filters)
    total_storage = (await session.execute(storage_query)).scalar_one() or 0

    if is_admin:
        total_chunks = await count_total_embeddings()
    else:
        chunk_query = select(func.coalesce(func.sum(Document.chunk_count), 0)).select_from(Document)
        chunk_query = chunk_query.where(Document.uploaded_by == current_user.id)
        total_chunks = (await session.execute(chunk_query)).scalar_one() or 0

    payload = {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "by_status": status_counts,
        "storage_used_bytes": total_storage,
        "storage_used_mb": round(total_storage / 1024 / 1024, 2) if total_storage else 0,
    }

    await set_cached_document_stats(
        None if is_admin else current_user.id,
        is_admin=is_admin,
        data=payload,
    )

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

    # Check access
    if current_user.role != UserRole.ADMIN and document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
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
    # For regular users, we'd ideally filter by their documents
    # For now, search all documents (can be enhanced later)

    # If not admin, get user's file hashes to filter
    filter_dict = None
    if current_user.role != UserRole.ADMIN:
        # Get user's document file hashes
        statement = select(Document.file_hash).where(Document.uploaded_by == current_user.id)
        result = await session.execute(statement)
        user_file_hashes = result.scalars().all()

        if not user_file_hashes:
            return []  # User has no documents

        # ChromaDB filter - match any of user's file hashes
        # Note: This might need adjustment based on ChromaDB's filter syntax
        # For now, we'll search all and filter results after
        filter_dict = None  # TODO: Implement proper ChromaDB filtering

    # Perform search
    results = await search_documents(query=query, k=k, filter=filter_dict)

    # Filter results by user if not admin
    if current_user.role != UserRole.ADMIN:
        user_file_hashes_set = set(user_file_hashes)
        results = [
            r for r in results
            if r.get("metadata", {}).get("file_hash") in user_file_hashes_set
        ]

    return {
        "query": query,
        "results": results,
        "count": len(results),
    }
