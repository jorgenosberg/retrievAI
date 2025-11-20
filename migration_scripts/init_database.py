#!/usr/bin/env python3
"""
Database initialization script for RetrievAI v0.2.0

This script:
1. Creates all database tables using SQLModel
2. Creates the first admin user
3. Optionally runs all migrations (settings, documents)

Usage:
    python migration_scripts/init_database.py

Environment:
    Make sure Docker Compose services are running:
    docker-compose up -d postgres redis chromadb
"""

import asyncio
import getpass
import sys
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel, select

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.config import settings
from app.db.models import User, AppSettings, Document, Conversation, Message, AuthorizedEmail
from app.core.security import get_password_hash
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


async def create_tables():
    """Create all database tables"""
    print_header("Creating Database Tables")

    try:
        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            future=True
        )

        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(SQLModel.metadata.create_all)

        print_success("All tables created successfully!")
        print_info("Tables created:")
        print("  - users")
        print("  - authorized_emails")
        print("  - app_settings")
        print("  - documents")
        print("  - conversations")
        print("  - messages")

        await engine.dispose()
        return True

    except Exception as e:
        print_error(f"Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        return False


async def create_admin_user():
    """Create the first admin user"""
    print_header("Create Admin User")

    async with async_session_maker() as session:
        # Check if any users exist
        result = await session.exec(select(User))
        existing_users = result.all()

        if existing_users:
            print_warning(f"Found {len(existing_users)} existing user(s)")
            for user in existing_users:
                print(f"  - {user.email} (admin: {user.is_admin})")

            response = input("\nCreate another admin user? (y/N): ").strip().lower()
            if response != 'y':
                print_info("Skipping user creation")
                return True

        # Get admin details
        print_info("Enter admin user details:\n")

        email = input("Email: ").strip()
        if not email:
            print_error("Email is required")
            return False

        full_name = input("Full name (optional): ").strip() or None

        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Confirm password: ")

        if password != password_confirm:
            print_error("Passwords don't match!")
            return False

        if len(password) < 8:
            print_error("Password must be at least 8 characters")
            return False

        # Create user
        try:
            hashed_password = get_password_hash(password)

            admin_user = User(
                email=email,
                full_name=full_name,
                hashed_password=hashed_password,
                is_admin=True,
                is_active=True
            )

            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

            print_success(f"\n✅ Admin user created successfully!")
            print(f"   ID: {admin_user.id}")
            print(f"   Email: {admin_user.email}")
            print(f"   Name: {admin_user.full_name or 'N/A'}")
            print(f"   Admin: {admin_user.is_admin}")

            return True

        except Exception as e:
            print_error(f"Failed to create user: {e}")
            return False


async def run_migrations():
    """Optionally run migration scripts"""
    print_header("Run Migration Scripts")

    print_info("Do you want to run the migration scripts now?")
    print("This will import:")
    print("  - Settings from .retrievai/app_settings.yaml")
    print("  - Documents from .retrievai/file_hashes.txt")

    response = input("\nRun migrations? (y/N): ").strip().lower()

    if response != 'y':
        print_info("Skipping migrations - you can run them manually later:")
        print("  python migration_scripts/migrate_settings.py")
        print("  python migration_scripts/populate_documents.py")
        return True

    # Import and run migration scripts
    try:
        # Import here to avoid circular imports
        from migrate_settings import migrate_settings
        from populate_documents import populate_documents

        print_info("\nRunning settings migration...")
        await migrate_settings()

        print_info("\nRunning documents population...")
        # Get the admin user ID
        async with async_session_maker() as session:
            result = await session.exec(select(User).where(User.is_admin == True))
            admin_user = result.first()
            if admin_user:
                await populate_documents(user_id=admin_user.id)
            else:
                print_warning("No admin user found, using user_id=1")
                await populate_documents(user_id=1)

        print_success("\n✅ All migrations completed!")
        return True

    except Exception as e:
        print_error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Main initialization flow"""
    print(f"\n{BOLD}RetrievAI Database Initialization{RESET}")
    print(f"{BOLD}v0.2.0{RESET}")

    print_info("\nThis script will:")
    print("  1. Create all database tables")
    print("  2. Create the first admin user")
    print("  3. Optionally run data migrations")

    print_warning("\n⚠️  Make sure Docker Compose is running:")
    print("   docker-compose up -d postgres redis chromadb\n")

    response = input("Continue? (y/N): ").strip().lower()
    if response != 'y':
        print_info("Aborting initialization")
        sys.exit(0)

    # Step 1: Create tables
    if not await create_tables():
        print_error("Failed to create tables. Aborting.")
        sys.exit(1)

    # Step 2: Create admin user
    if not await create_admin_user():
        print_error("Failed to create admin user. Aborting.")
        sys.exit(1)

    # Step 3: Run migrations
    await run_migrations()

    # Final message
    print_header("Initialization Complete!")

    print_success("🎉 Database initialization successful!\n")

    print_info("Next steps:")
    print("  1. Start all services: docker-compose up -d")
    print("  2. Check API docs: http://localhost:8000/api/docs")
    print("  3. Verify migration: python migration_scripts/verify_migration.py")
    print("  4. Login with your admin credentials and start using RetrievAI!")


if __name__ == "__main__":
    asyncio.run(main())
