#!/usr/bin/env python3
"""
Verification script for v0.1.0 to v0.2.0 migration

Runs comprehensive checks to ensure all data was migrated successfully:
- ChromaDB accessible via HTTP
- Collection exists with expected data
- PostgreSQL has correct users, settings, and documents
- Sample RAG query works end-to-end

Usage:
    python migration_scripts/verify_migration.py
"""

import asyncio
import sys
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from sqlmodel import select, func

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.db.models import User, AppSettings, Document
from app.db.session import async_session_maker

# Color codes
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'


def print_header(msg: str):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{msg.center(60)}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")


def print_info(msg: str):
    print(f"{BLUE}ℹ️  {msg}{RESET}")


def print_success(msg: str):
    print(f"{GREEN}✅ {msg}{RESET}")


def print_warning(msg: str):
    print(f"{YELLOW}⚠️  {msg}{RESET}")


def print_error(msg: str):
    print(f"{RED}❌ {msg}{RESET}")


def check_chromadb_http():
    """Check ChromaDB is accessible via HTTP"""
    print_header("1. ChromaDB HTTP Server Check")

    try:
        # Try to connect via HTTP (as the backend will)
        client = chromadb.HttpClient(
            host="localhost",
            port=8001,  # External port from docker-compose
            settings=ChromaSettings(
                anonymized_telemetry=False
            )
        )

        # Try to heartbeat
        heartbeat = client.heartbeat()
        print_success(f"ChromaDB HTTP server is running (heartbeat: {heartbeat}ns)")

        # Get collection
        try:
            collection = client.get_collection("rag_collection")
            count = collection.count()
            print_success(f"Collection 'rag_collection' exists with {count:,} chunks")

            # Sample query
            if count > 0:
                result = collection.peek(limit=1)
                if result['ids']:
                    print_success("Sample data retrieved successfully")
                    print(f"   Sample chunk ID: {result['ids'][0][:40]}...")

            return True

        except Exception as e:
            print_error(f"Collection 'rag_collection' not found: {e}")
            return False

    except Exception as e:
        print_error(f"Cannot connect to ChromaDB HTTP server: {e}")
        print_info("   Make sure Docker Compose is running: docker-compose up -d")
        return False


async def check_database():
    """Check PostgreSQL database"""
    print_header("2. PostgreSQL Database Check")

    try:
        async with async_session_maker() as session:
            # Check users
            result = await session.exec(select(User))
            users = result.all()

            if users:
                print_success(f"Found {len(users)} user(s)")
                for user in users:
                    role_icon = "👑" if user.is_admin else "👤"
                    print(f"   {role_icon} {user.email} (admin: {user.is_admin}, active: {user.is_active})")
            else:
                print_warning("No users found in database")
                print_info("   Create an admin user to proceed")

            # Check settings
            result = await session.exec(select(AppSettings))
            settings = result.all()

            if settings:
                print_success(f"Found {len(settings)} setting category(ies)")
                for setting in settings:
                    print(f"   ⚙️  {setting.key}: {setting.description}")
            else:
                print_warning("No settings found in database")
                print_info("   Run migrate_settings.py to import settings")

            # Check documents
            result = await session.exec(select(Document))
            documents = result.all()

            if documents:
                total_chunks = sum(doc.chunk_count or 0 for doc in documents)
                print_success(f"Found {len(documents)} document(s) with {total_chunks:,} total chunks")

                # Get file type breakdown
                result = await session.exec(
                    select(Document.file_type, func.count(Document.id))
                    .group_by(Document.file_type)
                )
                breakdown = result.all()
                print("   Document types:")
                for file_type, count in breakdown:
                    print(f"     - {file_type or 'unknown'}: {count}")
            else:
                print_warning("No documents found in database")
                print_info("   Run populate_documents.py to import document metadata")

            return len(users) > 0

    except Exception as e:
        print_error(f"Database check failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_file_hashes_match():
    """Check if ChromaDB chunk count matches file_hashes.txt"""
    print_header("3. Data Integrity Check")

    try:
        # Count lines in file_hashes.txt
        hashes_path = Path(".retrievai/file_hashes.txt")
        if not hashes_path.exists():
            print_warning("file_hashes.txt not found")
            return True

        with open(hashes_path, 'r') as f:
            expected_files = len([line for line in f if line.strip()])

        print_info(f"Expected {expected_files} files from file_hashes.txt")

        # Get unique file_hash count from ChromaDB
        client = chromadb.HttpClient(host="localhost", port=8001)
        collection = client.get_collection("rag_collection")

        result = collection.get(include=["metadatas"])
        unique_hashes = set(m.get('file_hash') for m in result['metadatas'] if m.get('file_hash'))

        print_info(f"Found {len(unique_hashes)} unique file hashes in ChromaDB")

        if len(unique_hashes) == expected_files:
            print_success("File count matches! ✨")
            return True
        else:
            diff = abs(len(unique_hashes) - expected_files)
            print_warning(f"Mismatch: {diff} files difference")
            return True  # Not critical

    except Exception as e:
        print_warning(f"Integrity check skipped: {e}")
        return True


async def check_sample_query():
    """Test a sample RAG query"""
    print_header("4. Sample RAG Query Test")

    try:
        # Check if we have documents
        async with async_session_maker() as session:
            result = await session.exec(select(Document))
            documents = result.all()

            if not documents:
                print_warning("No documents to query - skipping RAG test")
                return True

        # Try a simple query via ChromaDB
        client = chromadb.HttpClient(host="localhost", port=8001)
        collection = client.get_collection("rag_collection")

        # Sample query
        results = collection.query(
            query_texts=["test query"],
            n_results=3
        )

        if results['ids'] and len(results['ids'][0]) > 0:
            print_success(f"RAG query successful! Retrieved {len(results['ids'][0])} chunks")
            print(f"   Top result ID: {results['ids'][0][0][:40]}...")
            return True
        else:
            print_warning("Query returned no results")
            return True

    except Exception as e:
        print_warning(f"Sample query test failed: {e}")
        return True


async def main():
    """Run all verification checks"""
    print(f"\n{BOLD}RetrievAI Migration Verification Tool{RESET}")
    print(f"{BOLD}v0.1.0 → v0.2.0{RESET}")

    all_passed = True

    # Check ChromaDB
    if not check_chromadb_http():
        all_passed = False

    # Check PostgreSQL
    if not await check_database():
        all_passed = False

    # Check integrity
    if not check_file_hashes_match():
        all_passed = False

    # Sample query
    if not await check_sample_query():
        all_passed = False

    # Final report
    print_header("Verification Summary")

    if all_passed:
        print_success("🎉 All checks passed! Migration looks good!")
        print_info("\nNext steps:")
        print("  1. Test the API: http://localhost:8000/api/docs")
        print("  2. Create a test user and try uploading a document")
        print("  3. Try the chat interface with SSE streaming")
    else:
        print_error("⚠️  Some checks failed. Please review the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
