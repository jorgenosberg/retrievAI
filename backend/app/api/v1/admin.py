"""Admin API endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col
from pydantic import BaseModel, EmailStr

from app.db.session import get_session
from app.db.models import (
    User, UserRead, UserCreate, UserUpdate, UserRole,
    AuthorizedEmail, Document, Conversation, Message
)
from app.dependencies import get_current_admin_user
from app.core.security import get_password_hash
from app.core.vectorstore import get_collection_stats

router = APIRouter()


# Request/Response models
class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.USER
    is_active: bool = True


class AuthorizedEmailCreate(BaseModel):
    email: EmailStr


class AuthorizedEmailRead(BaseModel):
    id: int
    email: str


class SystemStats(BaseModel):
    users: dict
    documents: dict
    conversations: dict
    storage: dict
    vectorstore: dict


# User Management
@router.get("/users", response_model=List[UserRead])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List all users (admin only).

    Query params:
        - page: Page number
        - page_size: Items per page
        - role: Filter by role (USER, ADMIN)
        - is_active: Filter by active status
    """
    query = select(User)

    # Filters
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    # Order by created date
    query = query.order_by(col(User.created_at).desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.exec(query)
    users = result.all()

    return users


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: AdminUserCreate,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new user directly (admin only).

    Bypasses email authorization requirement.
    """
    # Check if user already exists
    statement = select(User).where(User.email == user_data.email)
    result = await session.exec(statement)
    existing_user = result.first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


@router.put("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Update user details (admin only).

    Can update email, full_name, role, and is_active status.
    Cannot update password (use password reset flow).
    """
    # Get user
    statement = select(User).where(User.id == user_id)
    result = await session.exec(statement)
    user = result.first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from deactivating themselves
    if user_id == current_admin.id and user_update.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Update fields
    if user_update.email is not None:
        # Check if new email already exists
        email_check = await session.exec(
            select(User).where(User.email == user_update.email, User.id != user_id)
        )
        if email_check.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )
        user.email = user_update.email

    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a user (admin only).

    Also deletes all user's documents, conversations, and messages (cascade).
    """
    # Get user
    statement = select(User).where(User.id == user_id)
    result = await session.exec(statement)
    user = result.first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from deleting themselves
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    # Count user's data
    doc_count = await session.exec(
        select(func.count()).select_from(Document).where(Document.uploaded_by == user_id)
    )
    conv_count = await session.exec(
        select(func.count()).select_from(Conversation).where(Conversation.user_id == user_id)
    )

    # Delete user (cascade will handle documents, conversations, messages)
    await session.delete(user)
    await session.commit()

    return {
        "message": f"User {user.email} deleted successfully",
        "user_id": user_id,
        "documents_deleted": doc_count.one(),
        "conversations_deleted": conv_count.one(),
    }


# Authorized Emails
@router.get("/authorized-emails", response_model=List[AuthorizedEmailRead])
async def list_authorized_emails(
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List all authorized emails (admin only).
    """
    result = await session.exec(select(AuthorizedEmail))
    emails = result.all()
    return emails


@router.post("/authorized-emails", status_code=status.HTTP_201_CREATED)
async def add_authorized_email(
    email_data: AuthorizedEmailCreate,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Add an email to the authorized list (admin only).

    Allows users with this email to register.
    """
    # Check if already exists
    statement = select(AuthorizedEmail).where(AuthorizedEmail.email == email_data.email)
    result = await session.exec(statement)
    existing = result.first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already authorized",
        )

    # Add email
    authorized_email = AuthorizedEmail(email=email_data.email)
    session.add(authorized_email)
    await session.commit()
    await session.refresh(authorized_email)

    return {
        "message": "Email authorized successfully",
        "id": authorized_email.id,
        "email": authorized_email.email,
    }


@router.delete("/authorized-emails/{email_id}")
async def remove_authorized_email(
    email_id: int,
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Remove an email from the authorized list (admin only).
    """
    statement = select(AuthorizedEmail).where(AuthorizedEmail.id == email_id)
    result = await session.exec(statement)
    authorized_email = result.first()

    if not authorized_email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized email not found",
        )

    email = authorized_email.email
    await session.delete(authorized_email)
    await session.commit()

    return {
        "message": "Authorized email removed successfully",
        "email": email,
    }


# System Statistics
@router.get("/system/stats", response_model=SystemStats)
async def get_system_stats(
    current_admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get system-wide statistics (admin only).

    Returns:
        - users: Total users, by role, active/inactive
        - documents: Total documents, by status, total chunks
        - conversations: Total conversations, total messages
        - storage: Total storage used
        - vectorstore: ChromaDB statistics
    """
    # User stats
    total_users = await session.exec(select(func.count()).select_from(User))
    admin_users = await session.exec(
        select(func.count()).select_from(User).where(User.role == UserRole.ADMIN)
    )
    active_users = await session.exec(
        select(func.count()).select_from(User).where(User.is_active == True)
    )

    # Document stats
    total_documents = await session.exec(select(func.count()).select_from(Document))
    total_chunks = await session.exec(select(func.sum(Document.chunk_count)).select_from(Document))
    total_storage = await session.exec(select(func.sum(Document.file_size)).select_from(Document))

    # Document counts by status
    from app.db.models import DocumentStatus
    doc_by_status = {}
    for doc_status in DocumentStatus:
        count = await session.exec(
            select(func.count()).select_from(Document).where(Document.status == doc_status)
        )
        doc_by_status[doc_status.value] = count.one()

    # Conversation stats
    total_conversations = await session.exec(select(func.count()).select_from(Conversation))
    total_messages = await session.exec(select(func.count()).select_from(Message))

    # ChromaDB stats
    chroma_stats = await get_collection_stats()

    return SystemStats(
        users={
            "total": total_users.one(),
            "admins": admin_users.one(),
            "regular": total_users.one() - admin_users.one(),
            "active": active_users.one(),
            "inactive": total_users.one() - active_users.one(),
        },
        documents={
            "total": total_documents.one(),
            "by_status": doc_by_status,
            "total_chunks": total_chunks.one() or 0,
        },
        conversations={
            "total": total_conversations.one(),
            "total_messages": total_messages.one(),
        },
        storage={
            "total_bytes": total_storage.one() or 0,
            "total_mb": round((total_storage.one() or 0) / 1024 / 1024, 2),
        },
        vectorstore=chroma_stats,
    )
