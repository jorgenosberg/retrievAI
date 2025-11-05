#!/usr/bin/env python3
"""
Verify that backend can access ChromaDB data for documents in PostgreSQL.

This script:
1. Selects a random document from PostgreSQL
2. Queries ChromaDB for chunks with that file_hash
3. Verifies chunk count matches
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add backend to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlmodel import select
from app.db.session import AsyncSessionLocal
from app.db.models import Document
from app.core.vectorstore import get_vectorstore


async def verify_integration():
    """Verify ChromaDB integration with PostgreSQL documents."""

    print("="*60)
    print("🔍 ChromaDB Integration Verification")
    print("="*60)

    # Get a sample document from PostgreSQL
    print("\n📊 Fetching sample document from PostgreSQL...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Document).limit(5)
        )
        documents = result.scalars().all()

        if not documents:
            print("❌ No documents found in PostgreSQL")
            return False

        print(f"✅ Found {len(documents)} documents to test")

    # Test each document
    success_count = 0
    fail_count = 0

    for doc in documents:
        print(f"\n📄 Testing: {doc.filename}")
        print(f"   File Hash: {doc.file_hash}")
        print(f"   Expected chunks: {doc.chunk_count}")

        try:
            # Query ChromaDB
            db = await get_vectorstore()
            results = db.get(
                where={"file_hash": doc.file_hash},
                include=["metadatas"]
            )

            actual_chunks = len(results["ids"])
            print(f"   Actual chunks in ChromaDB: {actual_chunks}")

            if actual_chunks == doc.chunk_count:
                print(f"   ✅ Match!")
                success_count += 1
            else:
                print(f"   ⚠️  Mismatch! Expected {doc.chunk_count}, got {actual_chunks}")
                fail_count += 1

        except Exception as e:
            print(f"   ❌ Error: {e}")
            fail_count += 1

    print("\n" + "="*60)
    print(f"📊 Verification Results:")
    print(f"   ✅ Successful: {success_count}")
    print(f"   ❌ Failed: {fail_count}")

    if fail_count == 0:
        print("\n🎉 All tests passed! ChromaDB integration is working correctly.")
        print("="*60)
        return True
    else:
        print("\n⚠️  Some tests failed. Check the output above.")
        print("="*60)
        return False


async def main():
    """Main function."""
    success = await verify_integration()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
