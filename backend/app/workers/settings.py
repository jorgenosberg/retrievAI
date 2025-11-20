"""ARQ worker settings."""

from arq.connections import RedisSettings

from app.config import get_settings

settings = get_settings()


def get_redis_settings() -> RedisSettings:
    """Get Redis settings for ARQ from config."""
    # Parse redis://host:port/db format
    redis_url = settings.REDIS_URL
    if redis_url.startswith("redis://"):
        redis_url = redis_url[8:]

    # Split into components
    parts = redis_url.split("/")
    host_port = parts[0].split(":")
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else 6379
    database = int(parts[1]) if len(parts) > 1 else 0

    return RedisSettings(
        host=host,
        port=port,
        database=database,
    )


# ARQ worker settings
class WorkerSettings:
    """ARQ worker configuration."""

    redis_settings = get_redis_settings()
    queue_name = "arq:queue"
    max_jobs = 2  # Limit concurrent jobs for VM constraints
    job_timeout = 1800  # 30 minutes for long OCR tasks
    keep_result = 3600  # Keep results for 1 hour
