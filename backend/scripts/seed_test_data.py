#!/usr/bin/env python3
"""Seed test database with initial test users and data."""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.session import AsyncSessionLocal
from app.db.models import User, AuthorizedEmail, UserRole
from app.core.security import get_password_hash


async def seed_test_data():
    """Seed the test database with initial data."""

    async with AsyncSessionLocal() as session:
        print("🌱 Seeding test database...")

        # Test users to create
        test_users = [
            {
                "email": "test@example.com",
                "password": "testpassword123",
                "full_name": "Test User",
                "role": UserRole.USER,  # Enum value is "user"
            },
            {
                "email": "admin@example.com",
                "password": "adminpassword123",
                "full_name": "Admin User",
                "role": UserRole.ADMIN,  # Enum value is "admin"
            },
        ]

        for user_data in test_users:
            # Check if authorized email exists
            statement = select(AuthorizedEmail).where(
                AuthorizedEmail.email == user_data["email"]
            )
            result = await session.execute(statement)
            authorized = result.scalar_one_or_none()

            if not authorized:
                # Add to authorized emails
                authorized_email = AuthorizedEmail(email=user_data["email"])
                session.add(authorized_email)
                print(f"  ✓ Authorized email: {user_data['email']}")

            # Check if user already exists
            statement = select(User).where(User.email == user_data["email"])
            result = await session.execute(statement)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"  ⚠ User already exists: {user_data['email']}")
                continue

            # Create user using raw SQL to bypass SQLModel enum conversion
            now = datetime.utcnow()
            hashed_pw = get_password_hash(user_data["password"])

            await session.execute(
                text("""
                    INSERT INTO users (created_at, updated_at, email, full_name, is_active, role, hashed_password)
                    VALUES (:created_at, :updated_at, :email, :full_name, :is_active, :role, :hashed_password)
                """),
                {
                    "created_at": now,
                    "updated_at": now,
                    "email": user_data["email"],
                    "full_name": user_data["full_name"],
                    "is_active": True,
                    "role": user_data["role"].value,  # Use .value to get string
                    "hashed_password": hashed_pw,
                }
            )
            print(f"  ✓ Created user: {user_data['email']} (role: {user_data['role'].value})")

        await session.commit()
        print("\n✅ Test data seeded successfully!\n")
        print("Test Accounts:")
        print("=" * 50)
        print("Regular User:")
        print("  Email:    test@example.com")
        print("  Password: testpassword123")
        print()
        print("Admin User:")
        print("  Email:    admin@example.com")
        print("  Password: adminpassword123")
        print("=" * 50)


async def clear_test_data():
    """Clear all test data from the database."""

    async with AsyncSessionLocal() as session:
        print("🗑️  Clearing test data...")

        test_emails = ["test@example.com", "admin@example.com"]

        for email in test_emails:
            # Delete user
            statement = select(User).where(User.email == email)
            result = await session.execute(statement)
            user = result.scalar_one_or_none()
            if user:
                await session.delete(user)
                print(f"  ✓ Deleted user: {email}")

            # Delete authorized email
            statement = select(AuthorizedEmail).where(AuthorizedEmail.email == email)
            result = await session.execute(statement)
            authorized = result.scalar_one_or_none()
            if authorized:
                await session.delete(authorized)
                print(f"  ✓ Deleted authorized email: {email}")

        await session.commit()
        print("\n✅ Test data cleared successfully!\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed test database with data")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear test data instead of seeding",
    )

    args = parser.parse_args()

    if args.clear:
        asyncio.run(clear_test_data())
    else:
        asyncio.run(seed_test_data())
