"""Vector store operations using ChromaDB HTTP client.

This module provides async functions for interacting with ChromaDB vectorstore.
All functions use the ChromaDB HTTP client instead of PersistentClient for
better service isolation in the microservices architecture.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable

import chromadb
from langchain_chroma import Chroma
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from sqlmodel import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import AppSettings
from app.core.openai_keys import resolve_openai_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

# Chroma requires a normalization function when using similarity_score_threshold
def _cosine_relevance_score(distance: float) -> float:
    # Chroma returns cosine distance in [0, 2]; we normalize to [0,1] similarity
    # Cosine similarity = 1 - distance/2 for Chroma's cosine distance.
    return 1 - (distance / 2)


class RerankRetriever(BaseRetriever):
    """Wrap a vectorstore with a simple score-based rerank."""

    def __init__(
        self,
        vectorstore: Chroma,
        search_type: str,
        search_kwargs: Dict[str, Any],
        rerank_k: int,
        keep_k: int,
    ):
        self.vectorstore = vectorstore
        self.search_type = search_type
        self.search_kwargs = search_kwargs
        self.rerank_k = rerank_k
        self.keep_k = keep_k

    async def _aget_relevant_documents(
        self, query: str
    ) -> List[Document]:
        # For MMR, just delegate (no rerank)
        if self.search_type == "mmr":
            fetch_k = self.search_kwargs.get("fetch_k")
            filt = self.search_kwargs.get("filter")
            docs = await asyncio.to_thread(
                self.vectorstore.max_marginal_relevance_search,
                query,
                k=self.keep_k,
                fetch_k=fetch_k,
                filter=filt,
            )
            return docs

        # Similarity-based search with scores, then rerank and truncate.
        initial_k = max(self.rerank_k, self.search_kwargs.get("k", self.keep_k))
        filt = self.search_kwargs.get("filter")
        score_threshold = self.search_kwargs.get("score_threshold")

        try:
            docs_and_scores = await asyncio.to_thread(
                self.vectorstore.similarity_search_with_score,
                query,
                k=initial_k,
                filter=filt,
            )
        except AttributeError:
            # Fallback for older langchain_chroma versions
            docs_and_scores = await asyncio.to_thread(
                self.vectorstore.similarity_search_with_relevance_scores,
                query,
                k=initial_k,
                filter=filt,
            )

        if score_threshold is not None:
            docs_and_scores = [
                (doc, score) for doc, score in docs_and_scores
                if score >= score_threshold
            ]

        docs_and_scores.sort(key=lambda pair: pair[1], reverse=True)
        top_docs = [doc for doc, _ in docs_and_scores[: self.keep_k]]
        return top_docs

    async def aget_relevant_documents(self, query: str) -> List["Document"]:
        return await self._aget_relevant_documents(query)

    def _get_relevant_documents(self, query: str) -> List["Document"]:  # pragma: no cover - sync fallback
        return asyncio.get_event_loop().run_until_complete(
            self._aget_relevant_documents(query)
        )


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

        api_key = await resolve_openai_api_key()
        return OpenAIEmbeddings(model=model, api_key=api_key)


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
        collection_metadata={"hnsw:space": "cosine"},
        relevance_score_fn=_cosine_relevance_score,
    )

    return db


async def get_retriever(
    k: Optional[int] = None,
    fetch_k: Optional[int] = None,
    search_type: Optional[str] = None,
    document_filter: Optional[Dict[str, Any]] = None,
    score_threshold: Optional[float] = None,
    enable_rerank: Optional[bool] = None,
    rerank_k: Optional[int] = None,
    rerank_keep_k: Optional[int] = None,
):
    """
    Get retriever with configurable search parameters.

    Args:
        k: Number of documents to return
        fetch_k: Number of documents to fetch before filtering
        search_type: Type of search ("similarity" or "mmr")
        document_filter: Filter to apply (e.g., {"file_hash": "abc123"})
        score_threshold: Only used when search_type is similarity_score_threshold
        enable_rerank: Whether to rerank the initial hits
        rerank_k: Number of initial hits to rerank
        rerank_keep_k: Number of reranked hits to keep
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
                score_threshold = score_threshold or vs_settings.value.get("score_threshold")
                enable_rerank = enable_rerank if enable_rerank is not None else vs_settings.value.get("rerank_enabled", True)
                rerank_k = rerank_k or vs_settings.value.get("rerank_k", 30)
                rerank_keep_k = rerank_keep_k or vs_settings.value.get("rerank_keep_k", k)
            else:
                # Defaults
                k = k or 4
                fetch_k = fetch_k or 20
                search_type = search_type or "similarity"
                score_threshold = score_threshold or 0.2
                enable_rerank = True if enable_rerank is None else enable_rerank
                rerank_k = rerank_k or 30
                rerank_keep_k = rerank_keep_k or k

    search_kwargs = {
        "k": k,
    }

    # fetch_k is only used for MMR search
    if search_type == "mmr":
        search_kwargs["fetch_k"] = fetch_k
    # score_threshold is required for similarity_score_threshold
    if search_type == "similarity_score_threshold":
        search_kwargs["score_threshold"] = float(score_threshold or 0.2)

    if document_filter:
        search_kwargs["filter"] = document_filter

    base_retriever = db.as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )

    # Wrap with reranker for similarity modes
    if enable_rerank and search_type in {"similarity", "similarity_score_threshold"}:
        return RerankRetriever(
            vectorstore=db,
            search_type=search_type,
            search_kwargs=search_kwargs,
            rerank_k=rerank_k or k,
            keep_k=rerank_keep_k or k,
        )

    return base_retriever

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
