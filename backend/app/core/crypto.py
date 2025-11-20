"""Utility helpers for encrypting and decrypting secrets."""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import get_settings


@lru_cache(maxsize=1)
def _get_cipher() -> Fernet:
    """Create a Fernet cipher using the application's secret key."""
    settings = get_settings()
    secret = settings.SECRET_KEY.encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    """Encrypt a plaintext secret."""
    return _get_cipher().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    """Decrypt an encrypted secret."""
    return _get_cipher().decrypt(token.encode("utf-8")).decode("utf-8")
