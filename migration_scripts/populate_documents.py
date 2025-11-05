#!/usr/bin/env python3
"""
Migration script to populate Document records from existing ChromaDB data

Reads .retrievai/file_hashes.txt and queries ChromaDB to create Document records
in PostgreSQL with metadata extracted from the vector chunks.

Usage:
    python migration_scripts/populate_documents.py
"""

import asyncio
import hashlib
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import chromadb
from sqlmodel import select

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.db.models import Document, DocumentStatus
from app.db.session import async_session_maker

# Color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_info(msg: str):
    print(f"{BLUE}ℹ️  {msg}{RESET}")


def print_success(msg: str):
    print(f"{GREEN}✅ {msg}{RESET}")


def print_warning(msg: str):
    print(f"{YELLOW}⚠️  {msg}{RESET}")


def print_error(msg: str):
    print(f"{RED}❌ {msg}{RESET}")


def load_file_hashes() -> list[str]:
    """Load file hashes from file_hashes.txt"""
    hashes_path = Path(".retrievai/file_hashes.txt")

    if not hashes_path.exists():
        print_error("File hashes not found: .retrievai/file_hashes.txt")
        sys.exit(1)

    with open(hashes_path, 'r') as f:
        hashes = [line.strip() for line in f if line.strip()]

    print_success(f"Loaded {len(hashes)} file hashes")
    return hashes


def get_chroma_client():
    """Get ChromaDB client pointing to local db"""
    db_path = str(Path(".retrievai/db").absolute())
    client = chromadb.PersistentClient(path=db_path)
    return client


async def populate_documents(user_id: int = 1):
    """
    Populate Document records from ChromaDB data

    Args:
        user_id: The user ID to assign documents to (default: 1, first admin user)
    """
    print_info("\n=== Document Population - v0.1.0 to v0.2.0 ===\n")

    # Load file hashes
    file_hashes = load_file_hashes()

    # Connect to ChromaDB
    print_info("Connecting to local ChromaDB...")
    try:
        client = get_chroma_client()
        collection = client.get_collection("rag_collection")
        print_success(f"Connected to ChromaDB collection: {collection.name}")
        print_info(f"Collection has {collection.count()} chunks")
    except Exception as e:
        print_error(f"Failed to connect to ChromaDB: {e}")
        sys.exit(1)

    async with async_session_maker() as session:
        # Check existing documents
        result = await session.exec(select(Document))
        existing = result.all()

        if existing:
            print_warning(f"\nFound {len(existing)} existing documents in database")
            response = input("Delete and recreate? (y/N): ").strip().lower()
            if response != 'y':
                print_info("Aborting migration")
                return

            for doc in existing:
                await session.delete(doc)
            await session.commit()
            print_info("Deleted existing documents")

        # Process each file hash
        print_info(f"\nProcessing {len(file_hashes)} documents...\n")

        documents_created = 0
        chunks_found = 0
        skipped = 0

        for i, file_hash in enumerate(file_hashes, 1):
            try:
                # Query ChromaDB for chunks with this file_hash
                result = collection.get(
                    where={"file_hash": file_hash},
                    include=["metadatas"]
                )

                if not result['ids']:
                    print_warning(f"  [{i}/{len(file_hashes)}] No chunks found for hash: {file_hash[:12]}...")
                    skipped += 1
                    continue

                chunk_count = len(result['ids'])
                chunks_found += chunk_count

                # Extract metadata from first chunk
                metadata = result['metadatas'][0] if result['metadatas'] else {}

                filename = metadata.get('filename', f'unknown_{file_hash[:8]}.txt')
                file_type = metadata.get('file_type', 'unknown')
                file_path = metadata.get('file_path', '')
                page_count = metadata.get('page_count')

                # Create Document record
                document = Document(
                    filename=filename,
                    file_hash=file_hash,
                    file_type=file_type,
                    file_path=file_path,
                    file_size=0,  # Not available from old data
                    chunk_count=chunk_count,
                    page_count=page_count,
                    status=DocumentStatus.COMPLETED,
                    user_id=user_id,
                    uploaded_at=datetime.utcnow(),
                    processed_at=datetime.utcnow()
                )

                session.add(document)
                documents_created += 1

                print(f"  ✓ [{i}/{len(file_hashes)}] {filename} ({chunk_count} chunks)")

            except Exception as e:
                print_error(f"  ✗ [{i}/{len(file_hashes)}] Error processing {file_hash[:12]}: {e}")
                skipped += 1

        # Commit all documents
        await session.commit()

        print_success(f"\n✅ Successfully created {documents_created} document records")
        print_info(f"Total chunks found: {chunks_found}")
        if skipped > 0:
            print_warning(f"Skipped: {skipped} files")


async def main():
    try:
        # You can change the user_id here if needed
        await populate_documents(user_id=1)

        print_info("\n💡 Note: All documents were assigned to user_id=1")
        print_info("   Make sure to create this user first!")

    except Exception as e:
        print_error(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
