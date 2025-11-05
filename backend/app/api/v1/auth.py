"""Authentication API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.session import get_session
from app.db.models import User, UserCreate, UserRead, AuthorizedEmail
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)
from app.models import auth as auth_models
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: auth_models.RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Register a new user.

    Email must be pre-authorized by admin.
    """
    # Check if email is authorized
    statement = select(AuthorizedEmail).where(AuthorizedEmail.email == user_data.email)
    result = await session.exec(statement)
    authorized = result.first()

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not authorized for registration",
        )

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
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


@router.post("/login", response_model=auth_models.Token)
async def login(
    login_data: auth_models.LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Login with email and password.

    Returns access and refresh tokens.
    """
    # Find user
    statement = select(User).where(User.email == login_data.email)
    result = await session.exec(statement)
    user = result.first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current authenticated user information."""
    return current_user


@router.put("/me/password")
async def update_password(
    password_data: auth_models.PasswordUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update current user's password."""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )

    current_user.hashed_password = get_password_hash(password_data.new_password)
    session.add(current_user)
    await session.commit()

    return {"message": "Password updated successfully"}
