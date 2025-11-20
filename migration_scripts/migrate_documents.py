#!/usr/bin/env python3
"""
Migration script to populate Document records in PostgreSQL from ChromaDB data.

This script:
1. Connects to ChromaDB and retrieves all chunks
2. Groups chunks by file_hash
3. Creates Document records in PostgreSQL with metadata
4. Assigns documents to admin user (first user in database)
"""

import asyncio
import sys
import os
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add backend to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import chromadb
from sqlmodel import select
from app.db.session import AsyncSessionLocal
from app.db.models import Document, DocumentStatus, User


async def get_admin_user():
    """Get the admin user to assign documents to."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.role == "admin").limit(1)
        )
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            # Fall back to first user
            result = await session.execute(select(User).limit(1))
            admin_user = result.scalar_one_or_none()

        return admin_user


async def migrate_documents():
    """Migrate documents from ChromaDB to PostgreSQL."""

    print("="*60)
    print("🔄 Document Migration Script")
    print("   From: ChromaDB collection")
    print("   To: PostgreSQL documents table")
    print("="*60)

    # Connect to ChromaDB
    print("\n📡 Connecting to ChromaDB...")
    chroma_host = "localhost"
    chroma_port = 8001
    collection_name = "rag_collection"

    try:
        client = chromadb.HttpClient(
            host=chroma_host,
            port=chroma_port,
        )

        collection = client.get_collection(collection_name)
        total_chunks = collection.count()
        print(f"✅ Connected! Found {total_chunks:,} chunks")

    except Exception as e:
        print(f"❌ Error connecting to ChromaDB: {e}")
        return False

    # Get all chunks
    print(f"\n📥 Retrieving all chunks (this may take a moment)...")
    all_data = collection.get(
        limit=total_chunks,
        include=["metadatas"]
    )

    # Group by file_hash
    print(f"\n🗂️  Grouping chunks by file_hash...")
    documents_data = defaultdict(lambda: {
        "chunks": [],
        "metadata": None,
        "source": None
    })

    for chunk_id, metadata in zip(all_data["ids"], all_data["metadatas"]):
        file_hash = metadata.get("file_hash")
        if not file_hash:
            continue

        documents_data[file_hash]["chunks"].append(chunk_id)

        # Store first metadata we see for this file_hash
        if documents_data[file_hash]["metadata"] is None:
            documents_data[file_hash]["metadata"] = metadata
            documents_data[file_hash]["source"] = metadata.get("source", "Unknown")

    print(f"✅ Found {len(documents_data)} unique documents")

    # Get admin user
    admin_user = await get_admin_user()
    if not admin_user:
        print("❌ No users found in database. Please run migrate_users.py first.")
        return False

    print(f"👤 Assigning documents to user: {admin_user.email}")

    # Create Document records
    print(f"\n💾 Creating Document records in PostgreSQL...")

    async with AsyncSessionLocal() as session:
        created_count = 0
        skipped_count = 0

        for file_hash, data in documents_data.items():
            # Check if document already exists
            result = await session.execute(
                select(Document).where(Document.file_hash == file_hash)
            )
            existing_doc = result.scalar_one_or_none()

            if existing_doc:
                skipped_count += 1
                continue

            # Extract filename from source path
            source = data["source"]
            filename = Path(source).name if source else f"document_{file_hash[:8]}"

            # Extract metadata
            metadata = data["metadata"] or {}
            chunk_count = len(data["chunks"])

            # Create document record
            document = Document(
                file_hash=file_hash,
                filename=filename,
                file_size=metadata.get("file_size"),
                mime_type=metadata.get("mime_type"),
                chunk_count=chunk_count,
                status=DocumentStatus.COMPLETED,
                uploaded_by=admin_user.id,
                doc_metadata={
                    "source": source,
                    "original_metadata": metadata
                }
            )

            session.add(document)
            created_count += 1

            # Progress update every 100 documents
            if created_count % 100 == 0:
                print(f"   Processed {created_count} documents...")

        # Commit all changes
        print(f"\n💾 Saving changes to database...")
        await session.commit()

        print("\n" + "="*60)
        print(f"✅ Migration complete!")
        print(f"   Documents created: {created_count}")
        print(f"   Documents skipped (already exist): {skipped_count}")
        print(f"   Total documents: {created_count + skipped_count}")
        print("="*60)

    return True


async def verify_migration():
    """Verify the migration was successful."""
    print("\n🔍 Verifying migration...")

    async with AsyncSessionLocal() as session:
        # Count documents
        result = await session.execute(select(Document))
        documents = result.scalars().all()

        print(f"\n📊 Documents in database: {len(documents)}")

        # Show statistics
        total_chunks = sum(doc.chunk_count for doc in documents)
        avg_chunks = total_chunks / len(documents) if documents else 0

        completed = sum(1 for doc in documents if doc.status == DocumentStatus.COMPLETED)
        processing = sum(1 for doc in documents if doc.status == DocumentStatus.PROCESSING)
        failed = sum(1 for doc in documents if doc.status == DocumentStatus.FAILED)

        print(f"   Total chunks: {total_chunks:,}")
        print(f"   Average chunks per document: {avg_chunks:.1f}")
        print(f"\n   Status breakdown:")
        print(f"   - Completed: {completed}")
        print(f"   - Processing: {processing}")
        print(f"   - Failed: {failed}")

        # Show sample documents
        print(f"\n📄 Sample documents (first 5):")
        for i, doc in enumerate(documents[:5], 1):
            print(f"\n   {i}. {doc.filename}")
            print(f"      File Hash: {doc.file_hash}")
            print(f"      Chunks: {doc.chunk_count}")
            print(f"      Status: {doc.status.value}")
            print(f"      Uploaded: {doc.created_at.strftime('%Y-%m-%d %H:%M:%S')}")


async def main():
    """Main migration function."""
    success = await migrate_documents()

    if success:
        await verify_migration()
        print("\n✅ All done! Documents are now available in the API.")
    else:
        print("\n❌ Migration failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
