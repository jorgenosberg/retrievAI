"""
Backfill document file sizes for legacy rows that are missing file_size.

We no longer have the original uploads on disk in prod, but we can derive an
estimated size from the chunk contents stored in Chroma. This script sums the
UTF-8 byte length of all chunks for a document and writes that to file_size.
It also updates chunk_count if it is zero/missing.

Usage (inside backend container/venv):
    uv run -m app.scripts.backfill_file_sizes
"""

import asyncio
import logging

from sqlmodel import select

from app.config import get_settings
from app.core.cache import invalidate_document_stats_cache
from app.core.vectorstore import get_chroma_client
from app.db.models import Document
from app.db.session import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


async def backfill_file_sizes() -> None:
    updated = 0
    missing = 0

    client = get_chroma_client()
    collection = client.get_collection(settings.VECTORSTORE_COLLECTION_NAME)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Document).where(
                (Document.file_size.is_(None)) | (Document.file_size == 0)
            )
        )
        docs = result.scalars().all()

        if not docs:
            logger.info("No documents with missing file_size found.")
            return

        logger.info("Found %d documents missing file_size", len(docs))

        for doc in docs:
            # Pull all chunks for this file_hash from Chroma
            try:
                chroma_data = collection.get(
                    where={"file_hash": doc.file_hash},
                    include=["documents"],
                )
            except Exception as exc:  # pragma: no cover - safety for prod run
                logger.error("Chroma get failed for %s: %s", doc.file_hash, exc)
                missing += 1
                continue

            documents = chroma_data.get("documents") or []
            if not documents:
                missing += 1
                logger.warning("No chunks found in Chroma for doc %s (%s)", doc.id, doc.file_hash)
                continue

            # Estimate size using UTF-8 byte length of chunk contents
            estimated_size = sum(len(chunk.encode("utf-8")) for chunk in documents)
            if estimated_size <= 0:
                missing += 1
                logger.warning("Zero-length estimate for doc %s (%s)", doc.id, doc.file_hash)
                continue

            doc.file_size = estimated_size
            if not doc.chunk_count:
                doc.chunk_count = len(documents)

            session.add(doc)
            updated += 1

        if updated:
            await session.commit()
            await invalidate_document_stats_cache()

    logger.info("Backfill complete. Updated=%d, Missing/Skipped=%d", updated, missing)


if __name__ == "__main__":
    asyncio.run(backfill_file_sizes())
