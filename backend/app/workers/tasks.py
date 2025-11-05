"""ARQ background tasks."""

import asyncio
from pathlib import Path
from typing import Dict, Any
from uuid import UUID

from arq import ArqRedis

from app.config import get_settings

settings = get_settings()


async def process_document_upload(
    ctx: Dict[str, Any],
    file_path: str,
    file_hash: str,
    document_id: int,
) -> Dict[str, Any]:
    """
    Process uploaded document: load, chunk, embed, store in ChromaDB.

    This task runs in the background after file upload.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        file_path: Path to uploaded file
        file_hash: MD5 hash of file
        document_id: Database document ID

    Returns:
        Dict with processing results
    """
    from app.core.ingestion import process_single_document

    # Progress callback that updates Redis
    async def progress_callback(progress: int, message: str):
        await ctx["redis"].set(f"task:upload:{file_hash}:progress", str(progress))
        await ctx["redis"].set(f"task:upload:{file_hash}:message", message)

    try:
        # Update task status
        await ctx["redis"].set(f"task:upload:{file_hash}:status", "running")
        await ctx["redis"].set(f"task:upload:{file_hash}:progress", "0")

        # Process document (load, chunk, embed) - this handles DB updates internally
        result = await process_single_document(
            document_id=document_id,
            file_path=Path(file_path),
            file_hash=file_hash,
            progress_callback=progress_callback,
        )

        # Update task status
        await ctx["redis"].set(f"task:upload:{file_hash}:status", "completed")
        await ctx["redis"].set(f"task:upload:{file_hash}:progress", "100")

        return result

    except Exception as e:
        # Update task status (DB is updated inside process_single_document)
        await ctx["redis"].set(f"task:upload:{file_hash}:status", "failed")
        await ctx["redis"].set(f"task:upload:{file_hash}:error", str(e))

        return {
            "success": False,
            "error": str(e),
            "file_hash": file_hash,
        }


async def cleanup_temp_files(ctx: Dict[str, Any], max_age_hours: int = 24) -> int:
    """
    Clean up temporary files older than max_age_hours.

    This can be scheduled as a cron job in ARQ.

    Args:
        ctx: ARQ context
        max_age_hours: Maximum age of files to keep

    Returns:
        Number of files deleted
    """
    import time
    from pathlib import Path

    tmp_dir = settings.TMP_DIR
    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    deleted_count = 0

    for file_path in tmp_dir.glob("**/*"):
        if file_path.is_file():
            file_age = current_time - file_path.stat().st_mtime
            if file_age > max_age_seconds:
                file_path.unlink()
                deleted_count += 1

    return deleted_count


# ARQ worker class
class WorkerSettings:
    """
    ARQ worker settings - imported by arq worker.

    Functions listed in 'functions' will be available as tasks.
    """

    from app.workers.settings import get_redis_settings

    functions = [
        process_document_upload,
        cleanup_temp_files,
    ]

    redis_settings = get_redis_settings()
    queue_name = "arq:queue"
    max_jobs = 2  # Limit for VM
    job_timeout = 1800  # 30 min
    keep_result = 3600  # 1 hour

    # Cron jobs (optional)
    cron_jobs = [
        # Clean temp files daily at 3 AM
        {
            "function": cleanup_temp_files,
            "hour": 3,
            "minute": 0,
        }
    ]
