"""SQLModel database models with async support."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from enum import Enum

from sqlmodel import Field, SQLModel, Relationship, Column, String
from sqlalchemy import JSON, Text


# Enums
class UserRole(str, Enum):
    """User role enumeration."""
    USER = "user"
    ADMIN = "admin"


class DocumentStatus(str, Enum):
    """Document processing status."""
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskStatus(str, Enum):
    """Background task status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Base models
class TimestampModel(SQLModel):
    """Mixin for created_at and updated_at timestamps."""
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
        nullable=False,
    )


# User models
class UserBase(SQLModel):
    """Shared User properties."""
    email: str = Field(unique=True, index=True, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    is_active: bool = Field(default=True)
    role: UserRole = Field(default=UserRole.USER)


class User(UserBase, TimestampModel, table=True):
    """User database model."""
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str = Field(max_length=255)

    # Relationships
    documents: List["Document"] = Relationship(back_populates="uploader")
    conversations: List["Conversation"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    """User creation model."""
    password: str = Field(min_length=8)


class UserRead(UserBase):
    """User read model (public)."""
    id: int
    created_at: datetime
    updated_at: datetime


class UserUpdate(SQLModel):
    """User update model."""
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


# Authorized Email
class AuthorizedEmail(TimestampModel, table=True):
    """Pre-authorized email addresses for registration."""
    __tablename__ = "authorized_emails"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)


# Document models
class DocumentBase(SQLModel):
    """Shared Document properties."""
    file_hash: str = Field(unique=True, index=True, max_length=255)
    filename: str = Field(max_length=512)
    file_size: Optional[int] = None
    mime_type: Optional[str] = Field(default=None, max_length=100)
    chunk_count: int = Field(default=0)
    status: DocumentStatus = Field(default=DocumentStatus.PROCESSING)
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    doc_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class Document(DocumentBase, TimestampModel, table=True):
    """Document metadata model."""
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    uploaded_by: int = Field(foreign_key="users.id")

    # Relationships
    uploader: User = Relationship(back_populates="documents")


class DocumentRead(DocumentBase):
    """Document read model."""
    id: int
    uploaded_by: int
    created_at: datetime
    updated_at: datetime


# Conversation models
class ConversationBase(SQLModel):
    """Shared Conversation properties."""
    title: Optional[str] = Field(default=None, max_length=512)


class Conversation(ConversationBase, TimestampModel, table=True):
    """Conversation model."""
    __tablename__ = "conversations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: int = Field(foreign_key="users.id")

    # Relationships
    user: User = Relationship(back_populates="conversations")
    messages: List["Message"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class ConversationRead(ConversationBase):
    """Conversation read model."""
    id: UUID
    user_id: int
    created_at: datetime
    updated_at: datetime


# Message models
class MessageBase(SQLModel):
    """Shared Message properties."""
    role: str = Field(max_length=50)  # "user" or "assistant"
    content: str = Field(sa_column=Column(Text))
    sources: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class Message(MessageBase, TimestampModel, table=True):
    """Message model."""
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: UUID = Field(foreign_key="conversations.id")

    # Relationships
    conversation: Conversation = Relationship(back_populates="messages")


class MessageRead(MessageBase):
    """Message read model."""
    id: int
    conversation_id: UUID
    created_at: datetime


# App Settings
class AppSettings(TimestampModel, table=True):
    """Application settings."""
    __tablename__ = "app_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=255)
    value: Dict[str, Any] = Field(sa_column=Column(JSON))
    updated_by: Optional[int] = Field(default=None, foreign_key="users.id")


class UserPreference(TimestampModel, table=True):
    """Per-user settings and preferences."""
    __tablename__ = "user_preferences"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True)
    preferences: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


# API Key
class APIKey(TimestampModel, table=True):
    """Encrypted API keys."""
    __tablename__ = "api_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    service: str = Field(max_length=100)
    encrypted_key: str = Field(sa_column=Column(Text))
    updated_by: Optional[int] = Field(default=None, foreign_key="users.id")


class UserAPIKey(TimestampModel, table=True):
    """Encrypted per-user API keys."""
    __tablename__ = "user_api_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True)
    service: str = Field(default="openai", max_length=100)
    encrypted_key: str = Field(sa_column=Column(Text))


# Background Task
class BackgroundTask(TimestampModel, table=True):
    """Background task tracking."""
    __tablename__ = "background_tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_type: str = Field(max_length=100)
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    progress: int = Field(default=0)
    result: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_by: Optional[int] = Field(default=None, foreign_key="users.id")
