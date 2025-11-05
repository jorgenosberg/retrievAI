"""Settings API endpoints."""

from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.db.session import get_session
from app.db.models import AppSettings, User
from app.dependencies import get_current_admin_user, get_current_user

router = APIRouter()


# Request/Response models
class SettingsUpdate(BaseModel):
    embeddings: Dict[str, Any] | None = None
    chat: Dict[str, Any] | None = None
    vectorstore: Dict[str, Any] | None = None


class SettingsResponse(BaseModel):
    embeddings: Dict[str, Any]
    chat: Dict[str, Any]
    vectorstore: Dict[str, Any]


# Default settings
DEFAULT_EMBEDDINGS = {
    "model": "text-embedding-3-small",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "batch_size": 100,
    "rate_limit": 3,
}

DEFAULT_CHAT = {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "streaming": True,
}

DEFAULT_VECTORSTORE = {
    "k": 4,
    "fetch_k": 20,
    "search_type": "similarity",
}


async def get_or_create_setting(
    session: AsyncSession,
    key: str,
    default_value: Dict[str, Any]
) -> AppSettings:
    """Get setting from database or create with default value."""
    statement = select(AppSettings).where(AppSettings.key == key)
    result = await session.exec(statement)
    setting = result.first()

    if not setting:
        setting = AppSettings(key=key, value=default_value)
        session.add(setting)
        await session.commit()
        await session.refresh(setting)

    return setting


@router.get("/", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get all application settings.

    Returns embeddings, chat, and vectorstore settings.
    """
    # Get or create each setting
    embeddings = await get_or_create_setting(session, "embeddings", DEFAULT_EMBEDDINGS)
    chat = await get_or_create_setting(session, "chat", DEFAULT_CHAT)
    vectorstore = await get_or_create_setting(session, "vectorstore", DEFAULT_VECTORSTORE)

    return SettingsResponse(
        embeddings=embeddings.value,
        chat=chat.value,
        vectorstore=vectorstore.value,
    )


@router.put("/")
async def update_settings(
    settings_update: SettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Update application settings.

    Admin only. Updates are merged with existing settings.

    Body:
        - embeddings: Embedding model and chunking settings
        - chat: Chat model and parameters
        - vectorstore: Retrieval parameters
    """
    updated_settings = {}

    # Update embeddings settings
    if settings_update.embeddings is not None:
        embeddings = await get_or_create_setting(session, "embeddings", DEFAULT_EMBEDDINGS)
        # Merge with existing
        embeddings.value = {**embeddings.value, **settings_update.embeddings}
        embeddings.updated_by = current_user.id
        session.add(embeddings)
        updated_settings["embeddings"] = embeddings.value

    # Update chat settings
    if settings_update.chat is not None:
        chat = await get_or_create_setting(session, "chat", DEFAULT_CHAT)
        chat.value = {**chat.value, **settings_update.chat}
        chat.updated_by = current_user.id
        session.add(chat)
        updated_settings["chat"] = chat.value

    # Update vectorstore settings
    if settings_update.vectorstore is not None:
        vectorstore = await get_or_create_setting(session, "vectorstore", DEFAULT_VECTORSTORE)
        vectorstore.value = {**vectorstore.value, **settings_update.vectorstore}
        vectorstore.updated_by = current_user.id
        session.add(vectorstore)
        updated_settings["vectorstore"] = vectorstore.value

    await session.commit()

    return {
        "message": "Settings updated successfully",
        "updated": updated_settings,
    }


@router.get("/models")
async def get_available_models():
    """
    Get list of available OpenAI models.

    Returns models for both chat and embeddings.
    This is a public endpoint (no auth required).
    """
    return {
        "chat_models": [
            {
                "id": "gpt-4o",
                "name": "GPT-4o",
                "description": "Most capable model, multimodal",
            },
            {
                "id": "gpt-4o-mini",
                "name": "GPT-4o Mini",
                "description": "Fast and affordable, great for most tasks",
            },
            {
                "id": "gpt-4-turbo",
                "name": "GPT-4 Turbo",
                "description": "Previous generation flagship model",
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "description": "Fast and affordable legacy model",
            },
        ],
        "embedding_models": [
            {
                "id": "text-embedding-3-small",
                "name": "Text Embedding 3 Small",
                "description": "High performance, low cost",
                "dimensions": 1536,
            },
            {
                "id": "text-embedding-3-large",
                "name": "Text Embedding 3 Large",
                "description": "Best performance, higher cost",
                "dimensions": 3072,
            },
            {
                "id": "text-embedding-ada-002",
                "name": "Ada 002 (Legacy)",
                "description": "Previous generation embedding model",
                "dimensions": 1536,
            },
        ],
    }


@router.post("/reset")
async def reset_settings(
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Reset all settings to defaults.

    Admin only. This will restore all settings to their default values.
    """
    # Reset each setting
    for key, default_value in [
        ("embeddings", DEFAULT_EMBEDDINGS),
        ("chat", DEFAULT_CHAT),
        ("vectorstore", DEFAULT_VECTORSTORE),
    ]:
        statement = select(AppSettings).where(AppSettings.key == key)
        result = await session.exec(statement)
        setting = result.first()

        if setting:
            setting.value = default_value
            setting.updated_by = current_user.id
            session.add(setting)
        else:
            setting = AppSettings(
                key=key,
                value=default_value,
                updated_by=current_user.id
            )
            session.add(setting)

    await session.commit()

    return {
        "message": "Settings reset to defaults",
        "embeddings": DEFAULT_EMBEDDINGS,
        "chat": DEFAULT_CHAT,
        "vectorstore": DEFAULT_VECTORSTORE,
    }
