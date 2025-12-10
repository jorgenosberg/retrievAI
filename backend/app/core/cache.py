"""Lightweight Redis-backed caching helpers."""

import json
from typing import Any, Dict, Optional

from app.dependencies import get_arq_pool

DOCUMENT_STATS_TTL = 60 * 5  # 5 minutes
_DOCUMENT_STATS_KEY = "cache:doc_stats:global"


async def get_cached_document_stats(user_id: Optional[int], is_admin: bool) -> Optional[Dict[str, Any]]:
    """Return cached stats payload if present."""
    redis = await get_arq_pool()
    payload = await redis.get(_DOCUMENT_STATS_KEY)
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
    await redis.set(_DOCUMENT_STATS_KEY, json.dumps(data), ex=DOCUMENT_STATS_TTL)


async def invalidate_document_stats_cache(user_id: Optional[int] = None) -> None:
    """Drop cached stats so next request recomputes them."""
    redis = await get_arq_pool()
    await redis.delete(_DOCUMENT_STATS_KEY)
