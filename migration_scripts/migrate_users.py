#!/usr/bin/env python3
"""
Migration script to import users from auth_config.yaml to PostgreSQL database.

This script:
1. Reads existing users from .retrievai/auth_config.yaml
2. Imports them into the PostgreSQL database with their existing bcrypt hashes
3. Imports authorized emails
4. Sets the first user (jorgenao) as admin, others as regular users
"""

import asyncio
import sys
from pathlib import Path
import yaml

# Add backend to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlmodel import select
from app.db.session import AsyncSessionLocal
from app.db.models import User, AuthorizedEmail, UserRole


async def migrate_users():
    """Migrate users from YAML to database."""

    # Read auth_config.yaml
    yaml_path = Path(__file__).parent.parent / ".retrievai" / "auth_config.yaml"

    if not yaml_path.exists():
        print(f"❌ Error: {yaml_path} not found")
        return False

    print(f"📖 Reading {yaml_path}")
    with open(yaml_path, "r") as f:
        auth_config = yaml.safe_load(f)

    users_data = auth_config.get("credentials", {}).get("usernames", {})
    authorized_emails = auth_config.get("pre-authorized", [])

    print(f"Found {len(users_data)} users and {len(authorized_emails)} authorized emails")

    async with AsyncSessionLocal() as session:
        # Migrate users
        migrated_count = 0
        skipped_count = 0

        for username, user_info in users_data.items():
            email = user_info.get("email")
            first_name = user_info.get("first_name", "")
            last_name = user_info.get("last_name", "")
            hashed_password = user_info.get("password")

            # Check if user already exists
            result = await session.execute(
                select(User).where(User.email == email)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"⏭️  Skipping {email} (already exists)")
                skipped_count += 1
                continue

            # Create full name
            full_name = f"{first_name} {last_name}".strip()

            # Determine role (make jorgenao admin, others are users)
            role = UserRole.ADMIN if username == "jorgenao" else UserRole.USER

            # Create user with existing bcrypt hash
            user = User(
                email=email,
                full_name=full_name if full_name else None,
                hashed_password=hashed_password,
                is_active=True,
                role=role
            )

            session.add(user)
            migrated_count += 1
            role_label = "👑 ADMIN" if role == UserRole.ADMIN else "👤 USER"
            print(f"✅ Created {role_label}: {email} ({full_name})")

        # Migrate authorized emails
        auth_migrated = 0
        auth_skipped = 0

        for email in authorized_emails:
            # Check if already exists
            result = await session.execute(
                select(AuthorizedEmail).where(AuthorizedEmail.email == email)
            )
            existing = result.scalar_one_or_none()

            if existing:
                auth_skipped += 1
                continue

            auth_email = AuthorizedEmail(email=email)
            session.add(auth_email)
            auth_migrated += 1
            print(f"✉️  Authorized: {email}")

        # Commit all changes
        await session.commit()

        print("\n" + "="*60)
        print(f"✅ Migration complete!")
        print(f"   Users: {migrated_count} created, {skipped_count} skipped")
        print(f"   Authorized emails: {auth_migrated} created, {auth_skipped} skipped")
        print("="*60)

        return True


async def verify_migration():
    """Verify the migration was successful."""
    print("\n🔍 Verifying migration...")

    async with AsyncSessionLocal() as session:
        # Count users
        result = await session.execute(select(User))
        users = result.scalars().all()

        print(f"\n📊 Users in database: {len(users)}")
        for user in users:
            role_label = "👑 ADMIN" if user.role == UserRole.ADMIN else "👤 USER"
            print(f"   {role_label} {user.email} - {user.full_name}")

        # Count authorized emails
        result = await session.execute(select(AuthorizedEmail))
        emails = result.scalars().all()

        print(f"\n📧 Authorized emails: {len(emails)}")
        for email in emails:
            print(f"   ✉️  {email.email}")


async def main():
    """Main migration function."""
    print("="*60)
    print("🔄 User Migration Script")
    print("   From: .retrievai/auth_config.yaml")
    print("   To: PostgreSQL database")
    print("="*60)

    success = await migrate_users()

    if success:
        await verify_migration()
        print("\n✅ All done! Users can now log in with their existing passwords.")
    else:
        print("\n❌ Migration failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
