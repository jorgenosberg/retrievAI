"""Settings API endpoints."""

from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel, Field

from app.db.session import get_session
from app.db.models import AppSettings, User
from app.dependencies import get_current_admin_user, get_current_user
from app.core.user_settings import (
    get_or_create_user_preferences,
    update_user_preferences,
    user_has_personal_api_key,
    set_personal_api_key,
    delete_personal_api_key,
)
from app.core.openai_keys import (
    get_global_openai_key_info,
    set_global_openai_key,
    clear_global_openai_key,
)

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


class UserPreferencesPayload(BaseModel):
    theme: str = Field(default="system")
    auto_send: bool = Field(default=False)
    show_sources: bool = Field(default=True)
    default_chat_model: str = Field(default="gpt-4o-mini")
    use_personal_api_key: bool = Field(default=False)


class UserSettingsResponse(BaseModel):
    preferences: Dict[str, Any]
    personal_api_key_set: bool


class PersonalAPIKeyRequest(BaseModel):
    api_key: str


class OpenAIKeyInfo(BaseModel):
    has_override: bool
    source: str
    updated_at: str | None = None
    updated_by: int | None = None


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
    result = await session.execute(statement)
    setting = result.scalar_one_or_none()

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
        result = await session.execute(statement)
        setting = result.scalar_one_or_none()

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


@router.get("/me", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the authenticated user's preferences and API key status."""
    prefs = await get_or_create_user_preferences(session, current_user.id)
    has_key = await user_has_personal_api_key(session, current_user.id)
    return UserSettingsResponse(
        preferences=prefs.preferences,
        personal_api_key_set=has_key,
    )


@router.put("/me", response_model=UserSettingsResponse)
async def update_user_settings(
    payload: UserPreferencesPayload,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update per-user settings."""
    has_key = await user_has_personal_api_key(session, current_user.id)
    if payload.use_personal_api_key and not has_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a personal API key before enabling this option.",
        )

    updated = await update_user_preferences(
        session,
        current_user.id,
        payload.model_dump(),
    )

    has_key = await user_has_personal_api_key(session, current_user.id)
    return UserSettingsResponse(
        preferences=updated,
        personal_api_key_set=has_key,
    )


@router.post("/me/api-key")
async def set_personal_key(
    request: PersonalAPIKeyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Store or update the user's personal API key."""
    await set_personal_api_key(session, current_user.id, request.api_key)
    await update_user_preferences(
        session,
        current_user.id,
        {"use_personal_api_key": True},
    )
    return {"message": "Personal API key saved"}


@router.delete("/me/api-key")
async def remove_personal_key(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete the user's stored API key and revert to the shared key."""
    await delete_personal_api_key(session, current_user.id)
    await update_user_preferences(
        session,
        current_user.id,
        {"use_personal_api_key": False},
    )
    return {"message": "Personal API key removed"}


@router.get("/openai-key", response_model=OpenAIKeyInfo)
async def get_openai_key(
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return metadata about the active OpenAI API key source (admin only)."""
    info = await get_global_openai_key_info(session)
    return OpenAIKeyInfo(**info)


@router.post("/openai-key")
async def set_openai_key(
    request: PersonalAPIKeyRequest,
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Set a new application-wide OpenAI API key (admin only)."""
    await set_global_openai_key(session, request.api_key, current_user.id)
    return {"message": "Global OpenAI API key updated"}


@router.delete("/openai-key")
async def delete_openai_key(
    current_user: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove the admin override API key and fall back to .env (admin only)."""
    await clear_global_openai_key(session)
    return {"message": "Global OpenAI API key override removed"}
