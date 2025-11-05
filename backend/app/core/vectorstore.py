"""Vector store operations using ChromaDB HTTP client.

This module provides async functions for interacting with ChromaDB vectorstore.
All functions use the ChromaDB HTTP client instead of PersistentClient for
better service isolation in the microservices architecture.
"""

import logging
from typing import List, Dict, Any, Optional

import chromadb
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from sqlmodel import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import AppSettings

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_embeddings_model() -> OpenAIEmbeddings:
    """
    Get OpenAI embeddings model from database settings.
    Falls back to default if not found.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AppSettings).where(AppSettings.key == "embeddings")
        )
        embeddings_settings = result.scalar_one_or_none()

        if embeddings_settings:
            model = embeddings_settings.value.get("model", "text-embedding-3-small")
        else:
            # Default model
            model = "text-embedding-3-small"

        return OpenAIEmbeddings(model=model)


def get_chroma_client() -> chromadb.HttpClient:
    """Get ChromaDB HTTP client."""
    return chromadb.HttpClient(
        host=settings.CHROMA_HOST,
        port=settings.CHROMA_PORT,
    )


async def get_vectorstore() -> Chroma:
    """
    Retrieve Chroma vectorstore instance using HTTP client.
    """
    embeddings = await get_embeddings_model()
    client = get_chroma_client()

    db = Chroma(
        collection_name=settings.VECTORSTORE_COLLECTION_NAME,
        client=client,
        embedding_function=embeddings,
    )

    return db


async def get_retriever(
    k: Optional[int] = None,
    fetch_k: Optional[int] = None,
    search_type: Optional[str] = None,
    document_filter: Optional[Dict[str, Any]] = None
):
    """
    Get retriever with configurable search parameters.

    Args:
        k: Number of documents to return
        fetch_k: Number of documents to fetch before filtering
        search_type: Type of search ("similarity" or "mmr")
        document_filter: Filter to apply (e.g., {"file_hash": "abc123"})
    """
    db = await get_vectorstore()

    # Get default settings from database if not provided
    if k is None or fetch_k is None or search_type is None:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AppSettings).where(AppSettings.key == "vectorstore")
            )
            vs_settings = result.scalar_one_or_none()

            if vs_settings:
                k = k or vs_settings.value.get("k", 4)
                fetch_k = fetch_k or vs_settings.value.get("fetch_k", 20)
                search_type = search_type or vs_settings.value.get("search_type", "similarity")
            else:
                # Defaults
                k = k or 4
                fetch_k = fetch_k or 20
                search_type = search_type or "similarity"

    search_kwargs = {
        "k": k,
    }

    # fetch_k is only used for MMR search
    if search_type == "mmr":
        search_kwargs["fetch_k"] = fetch_k

    if document_filter:
        search_kwargs["filter"] = document_filter

    return db.as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )


async def get_all_embeddings() -> Dict[str, Any]:
    """
    Get all embeddings from the vectorstore.

    Returns:
        Dictionary with 'ids', 'metadatas', and 'documents' keys.
    """
    db = await get_vectorstore()
    return db.get(
        limit=None,  # Fetch all results
        include=["metadatas", "documents"],
    )


async def get_all_embeddings_grouped() -> List[Dict[str, Any]]:
    """
    Get all embeddings grouped by file_hash.

    Returns:
        List of dictionaries with grouped embedding information.
    """
    results = await get_all_embeddings()
    grouped_data = {}

    # Handle empty results
    if not results.get("ids"):
        return []

    for id_, metadata, content in zip(
        results["ids"],
        results["metadatas"],
        results["documents"]
    ):
        file_hash = metadata.get("file_hash", "Unknown")
        source = metadata.get("source", "Unknown")

        if file_hash not in grouped_data:
            grouped_data[file_hash] = {
                "source": source,
                "ids": [],
                "content_preview": [],
                "metadata": metadata,
            }
        grouped_data[file_hash]["ids"].append(id_)
        preview = content[:50] + "..." if content and len(content) > 50 else (content or "No content")
        grouped_data[file_hash]["content_preview"].append(preview)

    # Prepare the list for display
    grouped_list = [
        {
            "file_hash": file_hash,
            "source": data["source"],
            "embedding_count": len(data["ids"]),
            "embedding_ids": data["ids"],
            "content_preview": "\n".join(data["content_preview"][:3]) + (
                "..." if len(data["content_preview"]) > 3 else ""
            ),
            "metadata": data["metadata"],
        }
        for file_hash, data in grouped_data.items()
    ]
    return grouped_list


async def delete_by_file_hash(file_hash: str) -> int:
    """
    Delete all chunks associated with a file hash from ChromaDB.

    Args:
        file_hash: The file hash to delete

    Returns:
        Number of chunks deleted
    """
    db = await get_vectorstore()

    # Get all chunks with this file_hash
    results = db.get(
        where={"file_hash": file_hash},
        include=["metadatas"],
    )

    chunk_ids = results.get("ids", [])

    if chunk_ids:
        db.delete(ids=chunk_ids)
        logger.info(f"Deleted {len(chunk_ids)} chunks for file_hash: {file_hash}")

    return len(chunk_ids)


async def delete_by_ids(embedding_ids: List[str]) -> None:
    """
    Delete embeddings by their IDs.

    Args:
        embedding_ids: List of embedding IDs to delete
    """
    if not embedding_ids:
        return

    db = await get_vectorstore()
    db.delete(ids=embedding_ids)
    logger.info(f"Deleted {len(embedding_ids)} embeddings")


async def search_documents(
    query: str,
    k: int = 10,
    filter: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Perform semantic search across document chunks.

    Args:
        query: Search query text
        k: Number of results to return
        filter: Optional metadata filter

    Returns:
        List of matching documents with scores and metadata
    """
    db = await get_vectorstore()

    results = db.similarity_search_with_score(
        query=query,
        k=k,
        filter=filter,
    )

    # Format results
    formatted_results = []
    for doc, score in results:
        formatted_results.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "score": score,
        })

    return formatted_results


async def count_total_embeddings() -> int:
    """
    Count total number of embeddings in the vectorstore.

    Returns:
        Total embedding count
    """
    try:
        results = await get_all_embeddings()
        ids = results.get("ids")
        if ids is None:
            return 0
        return len(ids)
    except Exception as e:
        logger.warning(f"Failed to count embeddings: {e}")
        return 0


async def count_total_documents() -> int:
    """
    Count total number of unique documents (by file_hash).

    Returns:
        Total document count
    """
    results = await get_all_embeddings_grouped()
    return len(results)


async def add_documents(documents: List[Any]) -> List[str]:
    """
    Add documents to the vectorstore.

    Args:
        documents: List of LangChain Document objects

    Returns:
        List of IDs for the added documents
    """
    db = await get_vectorstore()
    ids = db.add_documents(documents)
    logger.info(f"Added {len(ids)} documents to vectorstore")
    return ids


async def collection_exists() -> bool:
    """
    Check if the collection exists in ChromaDB.

    Returns:
        True if collection exists, False otherwise
    """
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        return any(c.name == settings.VECTORSTORE_COLLECTION_NAME for c in collections)
    except Exception as e:
        logger.error(f"Error checking collection existence: {e}")
        return False


async def get_collection_stats() -> Dict[str, Any]:
    """
    Get statistics about the ChromaDB collection.

    Returns:
        Dictionary with collection stats
    """
    try:
        client = get_chroma_client()
        collection = client.get_collection(settings.VECTORSTORE_COLLECTION_NAME)
        count = collection.count()

        return {
            "name": settings.VECTORSTORE_COLLECTION_NAME,
            "count": count,
            "exists": True,
        }
    except Exception as e:
        logger.error(f"Error getting collection stats: {e}")
        return {
            "name": settings.VECTORSTORE_COLLECTION_NAME,
            "count": 0,
            "exists": False,
            "error": str(e),
        }
