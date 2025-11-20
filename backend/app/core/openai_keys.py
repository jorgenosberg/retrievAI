"""Utilities for resolving OpenAI API keys (user + global overrides)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import AppSettings
from app.core.crypto import encrypt_secret, decrypt_secret
from app.core.user_settings import (
    get_or_create_user_preferences,
    get_personal_api_key,
    user_has_personal_api_key,
)

settings = get_settings()
GLOBAL_OPENAI_KEY = "openai_api_override"


async def get_global_openai_key_record(
    session: AsyncSession,
) -> Optional[AppSettings]:
    """Fetch the AppSettings row storing an override key."""
    result = await session.execute(
        select(AppSettings).where(AppSettings.key == GLOBAL_OPENAI_KEY)
    )
    return result.scalar_one_or_none()


async def set_global_openai_key(
    session: AsyncSession,
    api_key: str,
    admin_user_id: int,
) -> None:
    """Store a new encrypted application-wide OpenAI API key."""
    encrypted = encrypt_secret(api_key)
    record = await get_global_openai_key_record(session)

    payload = {
        "encrypted_key": encrypted,
        "set_by": admin_user_id,
        "updated_at": datetime.utcnow().isoformat(),
    }

    if record:
        record.value = payload
        record.updated_by = admin_user_id
    else:
        record = AppSettings(
            key=GLOBAL_OPENAI_KEY,
            value=payload,
            updated_by=admin_user_id,
        )
    session.add(record)
    await session.commit()


async def clear_global_openai_key(session: AsyncSession) -> None:
    """Remove the stored override API key."""
    record = await get_global_openai_key_record(session)
    if record:
        await session.delete(record)
        await session.commit()


async def get_global_openai_key(
    session: AsyncSession,
) -> Optional[str]:
    """Decrypt and return the global override key if present."""
    record = await get_global_openai_key_record(session)
    if not record or not record.value:
        return None
    encrypted = record.value.get("encrypted_key")
    if not encrypted:
        return None
    return decrypt_secret(encrypted)


async def get_global_openai_key_info(
    session: AsyncSession,
) -> Dict[str, Any]:
    """Return metadata about the currently active key source."""
    record = await get_global_openai_key_record(session)
    if record and record.value.get("encrypted_key"):
        return {
            "has_override": True,
            "source": "admin",
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "updated_by": record.updated_by,
        }

    return {
        "has_override": False,
        "source": "env",
        "updated_at": None,
        "updated_by": None,
    }


async def resolve_openai_api_key(
    user_id: Optional[int] = None,
    session: Optional[AsyncSession] = None,
) -> str:
    """
    Determine the OpenAI API key to use, preferring:
        1. User's personal key (if enabled)
        2. Admin-configured app-wide override
        3. .env OPENAI_API_KEY fallback
    """
    close_session = False
    if session is None:
        session = AsyncSessionLocal()
        close_session = True

    try:
        # 1. User personal key (if allowed)
        if user_id is not None:
            prefs = await get_or_create_user_preferences(session, user_id)
            wants_personal = prefs.preferences.get("use_personal_api_key", False)
            if wants_personal and await user_has_personal_api_key(session, user_id):
                personal_key = await get_personal_api_key(session, user_id)
                if personal_key:
                    return personal_key

        # 2. Global override
        global_key = await get_global_openai_key(session)
        if global_key:
            return global_key

        # 3. Environment default
        return settings.OPENAI_API_KEY
    finally:
        if close_session:
            await session.close()
