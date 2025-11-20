#!/usr/bin/env python3
"""
Migration script for application settings from v0.1.0 to v0.2.0

Reads .retrievai/app_settings.yaml and creates AppSettings records in PostgreSQL.

Usage:
    python migration_scripts/migrate_settings.py
"""

import asyncio
import sys
from pathlib import Path

import yaml
from sqlmodel import select

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.db.models import AppSettings
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


def load_settings_yaml() -> dict:
    """Load settings from YAML file"""
    settings_path = Path(".retrievai/app_settings.yaml")

    if not settings_path.exists():
        print_error("Settings file not found: .retrievai/app_settings.yaml")
        sys.exit(1)

    with open(settings_path, 'r') as f:
        data = yaml.safe_load(f)

    print_success(f"Loaded settings from {settings_path}")
    return data


async def migrate_settings():
    """Migrate settings to PostgreSQL"""
    print_info("\n=== Settings Migration - v0.1.0 to v0.2.0 ===\n")

    # Load YAML settings
    yaml_settings = load_settings_yaml()

    print_info("Settings categories found:")
    for key in yaml_settings.keys():
        print(f"  - {key}")

    async with async_session_maker() as session:
        # Check if settings already exist
        result = await session.exec(select(AppSettings))
        existing = result.all()

        if existing:
            print_warning(f"\nFound {len(existing)} existing settings in database")
            print("Existing settings:")
            for setting in existing:
                print(f"  - {setting.key}")

            response = input("\nOverwrite existing settings? (y/N): ").strip().lower()
            if response != 'y':
                print_info("Aborting migration")
                return

            # Delete existing settings
            for setting in existing:
                await session.delete(setting)
            await session.commit()
            print_info("Deleted existing settings")

        # Create new settings
        print_info("\nMigrating settings to PostgreSQL...")

        settings_created = []

        # Embeddings settings
        if 'embeddings' in yaml_settings:
            emb = yaml_settings['embeddings']
            setting = AppSettings(
                key='embeddings',
                value={
                    'model': emb.get('model', 'text-embedding-3-large'),
                    'batch_size': emb.get('batch_size', 100),
                    'chunk_size': emb.get('chunk_size', 1200),
                    'chunk_overlap': emb.get('chunk_overlap', 200),
                    'min_chunk_size': emb.get('min_chunk_size', 700),
                    'rate_limit': emb.get('rate_limit', 1),
                    'available_models': emb.get('available_models', [
                        'text-embedding-3-small',
                        'text-embedding-3-large',
                        'text-embedding-ada-002'
                    ])
                },
                description='Embeddings configuration'
            )
            session.add(setting)
            settings_created.append(f"embeddings (model: {emb.get('model')})")

        # Chat settings
        if 'chat' in yaml_settings:
            chat = yaml_settings['chat']
            setting = AppSettings(
                key='chat',
                value={
                    'model': chat.get('model', 'gpt-4'),
                    'temperature': chat.get('temperature', 0.0),
                    'streaming': chat.get('streaming', True),
                    'available_models': chat.get('available_models', [
                        'gpt-4o-mini',
                        'gpt-4',
                        'gpt-3.5-turbo'
                    ])
                },
                description='Chat model configuration'
            )
            session.add(setting)
            settings_created.append(f"chat (model: {chat.get('model')})")

        # Vectorstore settings
        if 'vectorstore' in yaml_settings:
            vs = yaml_settings['vectorstore']
            setting = AppSettings(
                key='vectorstore',
                value={
                    'k': vs.get('k', 10),
                    'fetch_k': vs.get('fetch_k', 20),
                    'search_type': vs.get('search_type', 'mmr')
                },
                description='Vectorstore search configuration'
            )
            session.add(setting)
            settings_created.append(f"vectorstore (k={vs.get('k')}, fetch_k={vs.get('fetch_k')})")

        await session.commit()

        print_success(f"\n✅ Successfully migrated {len(settings_created)} settings:")
        for s in settings_created:
            print(f"  ✓ {s}")


async def main():
    try:
        await migrate_settings()
    except Exception as e:
        print_error(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
