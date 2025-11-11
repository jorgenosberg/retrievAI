"""Security utilities - JWT, password hashing, etc."""

import hashlib
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

# Bcrypt rounds for password hashing
BCRYPT_ROUNDS = 12


def _prepare_password(password: str) -> bytes:
    """
    Prepare password for bcrypt hashing.
    Bcrypt has a 72-byte limit. For longer passwords, we pre-hash with SHA-256.
    This is a secure approach recommended by OWASP.
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Pre-hash with SHA-256 for passwords > 72 bytes
        hashed = hashlib.sha256(password_bytes).hexdigest()
        return hashed.encode('utf-8')
    return password_bytes


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    prepared_password = _prepare_password(plain_password)
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(prepared_password, hashed_bytes)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    prepared_password = _prepare_password(password)
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(prepared_password, salt)
    return hashed.decode('utf-8')


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"sub": str(user_id), "exp": expire, "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: int) -> str:
    """Create a JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[int]:
    """
    Verify a JWT token and return the user_id.
    Returns None if token is invalid.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type_claim: str = payload.get("type")

        if user_id is None or token_type_claim != token_type:
            return None

        return int(user_id)
    except JWTError:
        return None


def decode_token(token: str) -> Optional[dict]:
    """
    Decode a JWT token and return the full payload.
    Returns None if token is invalid.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
