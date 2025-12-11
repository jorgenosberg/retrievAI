"""Document ingestion and processing utilities.

This module handles file upload processing, document chunking, and
vectorstore ingestion. Designed to run as async ARQ background tasks
with progress tracking via Redis.
"""

import hashlib
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any
import re

import aiofiles
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    CSVLoader,
    EverNoteLoader,
    TextLoader,
    UnstructuredEPubLoader,
    UnstructuredHTMLLoader,
    UnstructuredMarkdownLoader,
    UnstructuredODTLoader,
    UnstructuredPowerPointLoader,
    UnstructuredWordDocumentLoader,
)
from sqlmodel import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import Document as DBDocument, DocumentStatus, AppSettings
from app.core.pdf_loaders import PyMuPDF4LLMLoader
from app.core.vectorstore import add_documents
from app.core.cache import invalidate_document_stats_cache

logger = logging.getLogger(__name__)
settings = get_settings()

# Map file extensions to document loaders and their arguments
LOADER_MAPPING = {
    ".csv": (CSVLoader, {}),
    ".doc": (UnstructuredWordDocumentLoader, {}),
    ".docx": (UnstructuredWordDocumentLoader, {}),
    ".enex": (EverNoteLoader, {}),
    ".epub": (UnstructuredEPubLoader, {}),
    ".html": (UnstructuredHTMLLoader, {}),
    ".md": (UnstructuredMarkdownLoader, {}),
    ".odt": (UnstructuredODTLoader, {}),
    # Prefer layout-aware PyMuPDF if available; fall back otherwise
    ".pdf": (PyMuPDF4LLMLoader, {"page_chunks": True, "show_progress": False}),
    ".ppt": (UnstructuredPowerPointLoader, {}),
    ".pptx": (UnstructuredPowerPointLoader, {}),
    ".txt": (TextLoader, {"encoding": "utf8"}),
}

# Supported file extensions
SUPPORTED_EXTENSIONS = set(LOADER_MAPPING.keys())


def compute_file_hash(filename: str, identifier: str) -> str:
    """
    Compute MD5 hash for file identification.

    Args:
        filename: Original filename
        identifier: Unique identifier (timestamp)

    Returns:
        MD5 hash string
    """
    hash_input = f"{filename}-{identifier}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()


def add_hash_to_chunks(documents: List[Document], file_hash: str) -> List[Document]:
    """
    Add file hash to metadata of each document chunk.

    Args:
        documents: List of document chunks
        file_hash: File hash to add

    Returns:
        Documents with updated metadata
    """
    for document in documents:
        document.metadata["file_hash"] = file_hash
    return documents


def cleanup_uploaded_file(file_path: Path) -> None:
    """
    Remove the uploaded file from disk after processing.
    """
    try:
        if file_path.exists():
            file_path.unlink()
            logger.info("Deleted uploaded file %s", file_path)
    except Exception as e:  # pragma: no cover - best-effort cleanup
        logger.warning("Failed to delete uploaded file %s: %s", file_path, e)


def safe_load_single_document(file_path: Path) -> Optional[List[Document]]:
    """
    Safely load a single document using appropriate loader.

    Args:
        file_path: Path to the file

    Returns:
        List of loaded documents or None if failed
    """
    ext = file_path.suffix.lower()

    if ext not in LOADER_MAPPING:
        logger.warning(f"Unsupported file type: {ext} for {file_path.name}")
        return None

    loader_class, loader_args = LOADER_MAPPING[ext]

    try:
        loader = loader_class(str(file_path), **loader_args)
        docs = loader.load()

        # Ensure all documents have 'page' metadata (required by chat prompts)
        for i, doc in enumerate(docs):
            if 'page' not in doc.metadata:
                # Use existing page number if available, otherwise use index
                doc.metadata['page'] = doc.metadata.get('page_number', i)

        return docs
    except Exception as e:
        logger.error(f"Failed to load document {file_path.name}: {e}")
        return None


async def get_chunk_settings() -> Dict[str, Any]:
    """
    Get chunking settings from database.

    Returns:
        Dictionary with chunk_size, chunk_overlap, batch_size, rate_limit
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AppSettings).where(AppSettings.key == "embeddings")
        )
        embeddings_settings = result.scalar_one_or_none()

        if embeddings_settings:
            return {
                "chunk_size": embeddings_settings.value.get("chunk_size", 1500),
                "chunk_overlap": embeddings_settings.value.get("chunk_overlap", 200),
                "batch_size": embeddings_settings.value.get("batch_size", 100),
                "rate_limit": embeddings_settings.value.get("rate_limit", 3),
            }
        else:
            # Defaults
            return {
                "chunk_size": 1500,
                "chunk_overlap": 200,
                "batch_size": 100,
                "rate_limit": 3,
            }


def normalize_text(text: str) -> str:
    """Lightly normalize whitespace to improve splitter behavior."""
    # Collapse excessive whitespace but keep newlines for structure hints
    collapsed = re.sub(r"[ \t]+", " ", text)
    collapsed = re.sub(r"\n{3,}", "\n\n", collapsed)
    return collapsed.strip()


def split_documents(
    documents: List[Document],
    chunk_size: int,
    chunk_overlap: int,
) -> List[Document]:
    """
    Split documents into chunks using Markdown-aware splitting.

    Args:
        documents: List of documents to split
        chunk_size: Maximum chunk size
        chunk_overlap: Overlap between chunks

    Returns:
        List of document chunks
    """
    chunks = []
    seen_chunks = set()
    min_length = 30

    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3")
        ],
        strip_headers=False,
    )
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    for document in documents:
        try:
            # Normalize upfront to make header/semantic splits cleaner
            document.page_content = normalize_text(document.page_content)

            # First split by markdown headers
            document_chunks = md_splitter.split_text(document.page_content)

            # Then split by size
            final_chunks = text_splitter.split_documents(document_chunks)

            # Combine metadata - ensure critical fields are preserved
            for chunk in final_chunks:
                # Start with the original document's metadata (has page, file_hash, etc.)
                combined_metadata = {**document.metadata}
                # Then add any new metadata from the chunk (headers, etc.)
                combined_metadata.update(chunk.metadata)

                # Ensure 'page' field is always present (required by DOCUMENT_PROMPT)
                if 'page' not in combined_metadata:
                    combined_metadata['page'] = document.metadata.get('page', 0)

                content = normalize_text(chunk.page_content)
                if not content or len(content) < min_length:
                    continue

                if content in seen_chunks:
                    continue
                seen_chunks.add(content)

                chunks.append(
                    Document(
                        page_content=content,
                        metadata=combined_metadata
                    )
                )
        except Exception as e:
            logger.error(f"Error splitting document: {e}")
            # Add the document as-is if splitting fails
            # Ensure page metadata exists even for error case
            if 'page' not in document.metadata:
                document.metadata['page'] = 0
            chunks.append(document)

    return chunks


async def process_single_document(
    document_id: int,
    file_path: Path,
    file_hash: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> Dict[str, Any]:
    """
    Process a single document: load, chunk, and add to vectorstore.

    This function is designed to run as an ARQ background task.

    Args:
        document_id: Database ID of the document
        file_path: Path to the uploaded file
        file_hash: Hash of the file
        progress_callback: Optional callback for progress updates

    Returns:
        Dictionary with processing results
    """
    try:
        if progress_callback:
            await progress_callback(10, "Loading document...")

        # Load the document
        docs = safe_load_single_document(file_path)

        if not docs:
            raise ValueError(f"Failed to load document from {file_path}")

        if progress_callback:
            await progress_callback(30, f"Loaded {len(docs)} pages...")

        # Add file hash to all chunks
        docs = add_hash_to_chunks(docs, file_hash)

        # Get chunking settings
        chunk_settings = await get_chunk_settings()

        if progress_callback:
            await progress_callback(40, "Splitting into chunks...")

        # Split into chunks
        chunks = split_documents(
            docs,
            chunk_settings["chunk_size"],
            chunk_settings["chunk_overlap"],
        )

        if progress_callback:
            await progress_callback(60, f"Created {len(chunks)} chunks...")

        # Estimate storage using chunk contents (we don't keep original uploads)
        estimated_size_bytes = sum(len(chunk.page_content.encode("utf-8")) for chunk in chunks)

        # Add to vectorstore in batches
        batch_size = chunk_settings["batch_size"]
        rate_limit = chunk_settings["rate_limit"]
        delay = 1.0 / rate_limit if rate_limit > 0 else 0

        total_added = 0

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            await add_documents(batch)
            total_added += len(batch)

            progress = 60 + int((total_added / len(chunks)) * 35)
            if progress_callback:
                await progress_callback(
                    progress,
                    f"Ingested {total_added}/{len(chunks)} chunks..."
                )

            # Respect rate limit
            if delay > 0 and i + batch_size < len(chunks):
                await asyncio.sleep(delay)

        # Update document in database
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DBDocument).where(DBDocument.id == document_id)
            )
            db_document = result.scalar_one_or_none()

            if db_document:
                db_document.status = DocumentStatus.COMPLETED
                db_document.chunk_count = len(chunks)
                db_document.file_size = estimated_size_bytes
                session.add(db_document)
                await session.commit()
                await invalidate_document_stats_cache(db_document.uploaded_by)

        if progress_callback:
            await progress_callback(100, "Completed!")

        return {
            "success": True,
            "document_id": document_id,
            "chunks_created": len(chunks),
            "pages_processed": len(docs),
        }

    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")

        # Update document status to FAILED
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DBDocument).where(DBDocument.id == document_id)
            )
            db_document = result.scalar_one_or_none()

            if db_document:
                db_document.status = DocumentStatus.FAILED
                db_document.error_message = str(e)
                session.add(db_document)
                await session.commit()
                await invalidate_document_stats_cache(db_document.uploaded_by)

        if progress_callback:
            await progress_callback(0, f"Failed: {str(e)}")

        return {
            "success": False,
            "document_id": document_id,
            "error": str(e),
        }

    finally:
        # Always attempt to delete the uploaded file once processing is done
        cleanup_uploaded_file(file_path)


def is_supported_file_type(filename: str) -> bool:
    """
    Check if a file type is supported.

    Args:
        filename: Name of the file

    Returns:
        True if supported, False otherwise
    """
    ext = Path(filename).suffix.lower()
    return ext in SUPPORTED_EXTENSIONS


def get_supported_extensions() -> List[str]:
    """
    Get list of supported file extensions.

    Returns:
        List of supported extensions
    """
    return sorted(list(SUPPORTED_EXTENSIONS))
