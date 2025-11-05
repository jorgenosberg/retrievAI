#!/usr/bin/env python3
"""
Test script to verify ChromaDB connection and inspect existing data.

This script:
1. Connects to ChromaDB HTTP server
2. Lists all collections
3. Retrieves sample data from the collection
4. Counts total documents and chunks
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add backend to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

import chromadb


def main():
    """Test ChromaDB connection and inspect data."""
    print("="*60)
    print("🔍 ChromaDB Connection Test")
    print("="*60)

    # Use localhost since we're running from host
    chroma_host = "localhost"
    chroma_port = 8001  # Mapped port from docker-compose
    collection_name = "rag_collection"

    print(f"\n📡 Connecting to ChromaDB at {chroma_host}:{chroma_port}...")

    try:
        # Create HTTP client
        client = chromadb.HttpClient(
            host=chroma_host,
            port=chroma_port,
        )

        # Test connection with heartbeat
        heartbeat = client.heartbeat()
        print(f"✅ Connection successful! Heartbeat: {heartbeat}")

        # List collections
        print(f"\n📚 Listing collections...")
        collections = client.list_collections()
        print(f"Found {len(collections)} collection(s):")
        for col in collections:
            print(f"   - {col.name} (id: {col.id})")

        # Get the specific collection
        print(f"\n🔎 Inspecting collection: {collection_name}")

        try:
            collection = client.get_collection(collection_name)
            count = collection.count()
            print(f"✅ Collection found! Total chunks: {count:,}")

            # Get a sample of data
            print(f"\n📄 Fetching sample data (first 5 chunks)...")
            sample = collection.get(
                limit=5,
                include=["metadatas", "documents"]
            )

            if sample["ids"]:
                print(f"\nSample chunks:")
                for i, (id_, metadata, content) in enumerate(zip(
                    sample["ids"],
                    sample["metadatas"],
                    sample["documents"]
                ), 1):
                    file_hash = metadata.get("file_hash", "N/A")
                    source = metadata.get("source", "N/A")
                    content_preview = content[:100] + "..." if len(content) > 100 else content

                    print(f"\n  {i}. ID: {id_}")
                    print(f"     File Hash: {file_hash}")
                    print(f"     Source: {source}")
                    print(f"     Content: {content_preview}")

            # Get unique file hashes
            print(f"\n🗂️  Analyzing document groupings...")
            all_data = collection.get(
                limit=count,
                include=["metadatas"]
            )

            file_hashes = set()
            for metadata in all_data["metadatas"]:
                file_hash = metadata.get("file_hash")
                if file_hash:
                    file_hashes.add(file_hash)

            print(f"✅ Found {len(file_hashes)} unique documents")
            print(f"   Average chunks per document: {count / len(file_hashes):.1f}")

            # Show first 10 file hashes
            print(f"\n📋 First 10 file hashes:")
            for i, fh in enumerate(list(file_hashes)[:10], 1):
                print(f"   {i}. {fh}")

            print("\n" + "="*60)
            print("✅ ChromaDB test completed successfully!")
            print("="*60)

        except Exception as e:
            print(f"❌ Error accessing collection '{collection_name}': {e}")
            return False

    except Exception as e:
        print(f"❌ Error connecting to ChromaDB: {e}")
        return False

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
