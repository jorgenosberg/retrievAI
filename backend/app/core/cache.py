"""Lightweight Redis-backed caching helpers."""

import json
from typing import Any, Dict, Optional

from app.dependencies import get_arq_pool

DOCUMENT_STATS_TTL = 60 * 5  # 5 minutes


def _document_stats_key(is_admin: bool, user_id: Optional[int]) -> str:
    if is_admin:
        return "cache:doc_stats:admin"
    if user_id is None:
        raise ValueError("user_id is required for non-admin stats cache keys")
    return f"cache:doc_stats:user:{user_id}"


async def get_cached_document_stats(user_id: Optional[int], is_admin: bool) -> Optional[Dict[str, Any]]:
    """Return cached stats payload if present."""
    redis = await get_arq_pool()
    key = _document_stats_key(is_admin, None if is_admin else user_id)
    payload = await redis.get(key)
    if not payload:
        return None
    if isinstance(payload, bytes):
        payload = payload.decode()
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


async def set_cached_document_stats(
    user_id: Optional[int],
    is_admin: bool,
    data: Dict[str, Any],
) -> None:
    """Persist stats payload for future requests."""
    redis = await get_arq_pool()
    key = _document_stats_key(is_admin, None if is_admin else user_id)
    await redis.set(key, json.dumps(data), ex=DOCUMENT_STATS_TTL)


async def invalidate_document_stats_cache(user_id: Optional[int] = None) -> None:
    """Drop cached stats so next request recomputes them."""
    redis = await get_arq_pool()
    keys = [_document_stats_key(True, None)]
    if user_id is not None:
        keys.append(_document_stats_key(False, user_id))
    await redis.delete(*keys)
