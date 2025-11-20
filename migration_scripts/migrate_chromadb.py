#!/usr/bin/env python3
"""
Migration script for ChromaDB data from v0.1.0 to v0.2.0

This script handles migrating the ChromaDB vectorstore from the local
.retrievai/db directory to the new Docker-based ChromaDB HTTP server.

Two options are available:
1. Direct mount (recommended) - Mount existing directory in Docker Compose
2. Copy and validate - Copy data and verify integrity
"""

import os
import shutil
import sys
from pathlib import Path

# Color codes for terminal output
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


def check_source_db():
    """Check if source ChromaDB exists"""
    source_path = Path(".retrievai/db")

    if not source_path.exists():
        print_error("Source ChromaDB directory not found: .retrievai/db")
        return False

    # Check for chroma.sqlite3 file
    chroma_db = source_path / "chroma.sqlite3"
    if not chroma_db.exists():
        print_error("ChromaDB database file not found: .retrievai/db/chroma.sqlite3")
        return False

    db_size = chroma_db.stat().st_size / (1024 * 1024)  # Convert to MB
    print_success(f"Found ChromaDB database ({db_size:.2f} MB)")
    return True


def option_1_direct_mount():
    """
    Option 1: Update docker-compose.yml to mount existing directory

    This is the recommended approach as it preserves the existing data
    without copying and allows for easy rollback.
    """
    print_info("\n=== Option 1: Direct Mount (Recommended) ===\n")

    print("This option will update your docker-compose.yml to mount the existing")
    print(".retrievai/db directory directly into the ChromaDB container.\n")

    print("Steps to perform:")
    print("1. Update docker-compose.yml chromadb service volumes:")
    print("   FROM: - chroma_data:/chroma/chroma")
    print("   TO:   - ./.retrievai/db:/chroma/chroma\n")

    print("2. Start the ChromaDB service:")
    print("   docker-compose up -d chromadb\n")

    print("3. Verify the collection exists:")
    print("   docker-compose exec chromadb curl http://localhost:8000/api/v1/collections\n")

    print_warning("Manual action required: Update docker-compose.yml as shown above")
    print_success("Once updated, your existing data will be immediately available!")


def option_2_copy_and_validate():
    """
    Option 2: Copy data to new location

    This approach copies the data to a new location for the Docker volume.
    """
    print_info("\n=== Option 2: Copy and Validate ===\n")

    source_path = Path(".retrievai/db")
    target_path = Path("./chroma_data")

    # Check if target already exists
    if target_path.exists():
        print_warning(f"Target directory already exists: {target_path}")
        response = input("Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print_info("Aborting migration")
            return
        shutil.rmtree(target_path)

    # Copy the directory
    print_info(f"Copying {source_path} to {target_path}...")
    shutil.copytree(source_path, target_path)

    # Verify size
    source_size = sum(f.stat().st_size for f in source_path.rglob('*') if f.is_file())
    target_size = sum(f.stat().st_size for f in target_path.rglob('*') if f.is_file())

    if source_size == target_size:
        print_success(f"Copy successful! {target_size / (1024*1024):.2f} MB copied")
    else:
        print_error(f"Size mismatch! Source: {source_size}, Target: {target_size}")
        return

    print("\nNext steps:")
    print("1. Update docker-compose.yml chromadb service volumes:")
    print("   FROM: - chroma_data:/chroma/chroma")
    print("   TO:   - ./chroma_data:/chroma/chroma\n")

    print("2. Start the ChromaDB service:")
    print("   docker-compose up -d chromadb\n")

    print("3. Verify with verify_migration.py")


def main():
    print_info("ChromaDB Migration Tool - v0.1.0 to v0.2.0\n")

    # Check if source DB exists
    if not check_source_db():
        sys.exit(1)

    print("\nTwo migration options available:\n")
    print("1. Direct Mount (Recommended) - Mount existing directory in Docker")
    print("2. Copy and Validate - Copy data to new location\n")

    choice = input("Select option (1 or 2): ").strip()

    if choice == "1":
        option_1_direct_mount()
    elif choice == "2":
        option_2_copy_and_validate()
    else:
        print_error("Invalid choice. Please run again and select 1 or 2.")
        sys.exit(1)


if __name__ == "__main__":
    main()
