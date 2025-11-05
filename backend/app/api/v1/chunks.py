"""API endpoints for chunk context retrieval."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.vectorstore import get_chroma_client
from app.dependencies import get_current_user
from app.db.models import User
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


class ChunkMetadata(BaseModel):
    """Chunk metadata response."""
    source: str
    page: Optional[int] = None
    file_hash: Optional[str] = None
    title: Optional[str] = None


class ChunkResponse(BaseModel):
    """Single chunk response."""
    content: str
    metadata: ChunkMetadata


class ChunkContextRequest(BaseModel):
    """Request to get chunk context."""
    file_hash: str
    chunk_content: str
    context_size: int = 2


class ChunkContextResponse(BaseModel):
    """Response containing chunk with surrounding context."""
    current_chunk: ChunkResponse
    previous_chunks: List[ChunkResponse]
    next_chunks: List[ChunkResponse]
    total_chunks: int
    current_index: int


@router.post("/context", response_model=ChunkContextResponse)
async def get_chunk_context(
    request: ChunkContextRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Get a chunk with surrounding context (previous and next chunks).

    Args:
        request: ChunkContextRequest with file_hash, chunk_content, and context_size
        current_user: Current authenticated user

    Returns:
        ChunkContextResponse with current chunk and surrounding context
    """
    try:
        logger.info(f"Fetching chunk context for file_hash: {request.file_hash}")
        logger.info(f"Chunk content preview: {request.chunk_content[:100]}")

        # Get ChromaDB client
        client = get_chroma_client()
        collection = client.get_collection(settings.VECTORSTORE_COLLECTION_NAME)

        # Get all chunks for this file, sorted by page
        # ChromaDB doesn't support ordering, so we'll get all and sort in Python
        results = collection.get(
            where={"file_hash": request.file_hash},
            include=["documents", "metadatas"]
        )

        logger.info(f"Found {len(results['documents']) if results and results.get('documents') else 0} chunks")

        if not results or not results["documents"]:
            # Try to get a sample to see what file_hashes exist
            sample = collection.get(limit=5, include=["metadatas"])
            sample_hashes = [m.get("file_hash") for m in sample.get("metadatas", [])] if sample else []
            logger.error(f"No chunks found for file_hash: {request.file_hash}")
            logger.error(f"Sample file_hashes in collection: {sample_hashes}")
            raise HTTPException(
                status_code=404,
                detail=f"No chunks found for this document. Requested hash: {request.file_hash}"
            )

        # Build list of chunks with their data
        chunks = []
        for idx, (doc, meta) in enumerate(zip(results["documents"], results["metadatas"])):
            chunks.append({
                "index": idx,
                "content": doc,
                "metadata": meta
            })

        # Sort by page number if available, otherwise keep original order
        chunks.sort(key=lambda x: (
            x["metadata"].get("page", 0) if x["metadata"].get("page") is not None else 0,
            x["index"]
        ))

        # Find the current chunk by matching content
        current_idx = None
        for idx, chunk in enumerate(chunks):
            # Match using the first 200 chars (same as preview in sources)
            if request.chunk_content[:200] in chunk["content"][:300]:
                current_idx = idx
                break

        if current_idx is None:
            # Try exact match on shorter substring
            for idx, chunk in enumerate(chunks):
                if request.chunk_content[:100] == chunk["content"][:100]:
                    current_idx = idx
                    break

        if current_idx is None:
            raise HTTPException(
                status_code=404,
                detail="Could not find the specified chunk in this document"
            )

        # Get surrounding chunks
        start_idx = max(0, current_idx - request.context_size)
        end_idx = min(len(chunks), current_idx + request.context_size + 1)

        # Build response
        def build_chunk_response(chunk_data) -> ChunkResponse:
            return ChunkResponse(
                content=chunk_data["content"],
                metadata=ChunkMetadata(
                    source=chunk_data["metadata"].get("source", "Unknown"),
                    page=chunk_data["metadata"].get("page"),
                    file_hash=chunk_data["metadata"].get("file_hash"),
                    title=chunk_data["metadata"].get("title"),
                )
            )

        return ChunkContextResponse(
            current_chunk=build_chunk_response(chunks[current_idx]),
            previous_chunks=[
                build_chunk_response(chunks[i])
                for i in range(start_idx, current_idx)
            ],
            next_chunks=[
                build_chunk_response(chunks[i])
                for i in range(current_idx + 1, end_idx)
            ],
            total_chunks=len(chunks),
            current_index=current_idx,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chunk context: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
