"""Helper utilities for per-user preferences and API keys."""

from __future__ import annotations

from typing import Dict, Any, Optional

from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserPreference, UserAPIKey
from app.core.crypto import encrypt_secret, decrypt_secret

DEFAULT_USER_PREFERENCES = {
    "theme": "system",
    "auto_send": False,
    "show_sources": True,
    "default_chat_model": "gpt-4o-mini",
    "use_personal_api_key": False,
}


async def get_or_create_user_preferences(
    session: AsyncSession,
    user_id: int,
) -> UserPreference:
    """Fetch user preferences or create defaults if missing."""
    result = await session.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = UserPreference(
            user_id=user_id,
            preferences=DEFAULT_USER_PREFERENCES.copy(),
        )
        session.add(prefs)
        await session.commit()
        await session.refresh(prefs)

    return prefs


async def update_user_preferences(
    session: AsyncSession,
    user_id: int,
    updates: Dict[str, Any],
) -> Dict[str, Any]:
    """Merge updates into the user's stored preferences."""
    prefs = await get_or_create_user_preferences(session, user_id)
    merged = {**DEFAULT_USER_PREFERENCES, **prefs.preferences, **updates}
    prefs.preferences = merged
    session.add(prefs)
    await session.commit()
    await session.refresh(prefs)
    return prefs.preferences


async def user_has_personal_api_key(
    session: AsyncSession,
    user_id: int,
    service: str = "openai",
) -> bool:
    """Check if a user has stored a personal API key."""
    result = await session.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.service == service,
        )
    )
    return result.scalar_one_or_none() is not None


async def set_personal_api_key(
    session: AsyncSession,
    user_id: int,
    api_key: str,
    service: str = "openai",
) -> None:
    """Store or update a user's encrypted API key."""
    encrypted = encrypt_secret(api_key)
    result = await session.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.service == service,
        )
    )
    record = result.scalar_one_or_none()

    if record:
        record.encrypted_key = encrypted
    else:
        record = UserAPIKey(
            user_id=user_id,
            service=service,
            encrypted_key=encrypted,
        )
    session.add(record)
    await session.commit()


async def delete_personal_api_key(
    session: AsyncSession,
    user_id: int,
    service: str = "openai",
) -> None:
    """Delete a stored user API key."""
    result = await session.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.service == service,
        )
    )
    record = result.scalar_one_or_none()
    if record:
        await session.delete(record)
        await session.commit()


async def get_personal_api_key(
    session: AsyncSession,
    user_id: int,
    service: str = "openai",
) -> Optional[str]:
    """Return the decrypted personal API key for a user if it exists."""
    result = await session.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.service == service,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        return None
    return decrypt_secret(record.encrypted_key)
