#!/bin/sh

# Optimized uvicorn launcher with sensible defaults for constrained VMs.
set -e

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
KEEP_ALIVE="${UVICORN_KEEP_ALIVE:-30}"
GRACEFUL_TIMEOUT="${UVICORN_GRACEFUL_TIMEOUT:-30}"
MAX_REQUESTS="${UVICORN_MAX_REQUESTS:-0}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-0}"

# Auto-calculate workers when not explicitly provided.
if [ "${WEB_CONCURRENCY}" -le 0 ] 2>/dev/null; then
  WEB_CONCURRENCY="$(python3 - <<'PY'
import os
cpu = os.cpu_count() or 1
# Leave at least one core free when possible (for worker/redis/etc.)
suggested = max(1, min(cpu - 1, 4))
print(suggested if suggested > 0 else 1)
PY
  )"
fi

# Reload mode is for local dev; force single worker there.
if [ "${UVICORN_RELOAD:-0}" = "1" ]; then
  WORKER_ARGS="--reload --reload-dir app"
else
  WORKER_ARGS="--workers ${WEB_CONCURRENCY}"
fi

CMD="uv run --no-dev uvicorn app.main:app \
  --host ${HOST} \
  --port ${PORT} \
  --loop uvloop \
  --http httptools \
  --timeout-keep-alive ${KEEP_ALIVE} \
  --timeout-graceful-shutdown ${GRACEFUL_TIMEOUT} \
  ${WORKER_ARGS}"

if [ "${MAX_REQUESTS}" -gt 0 ] 2>/dev/null; then
  CMD="${CMD} --limit-max-requests ${MAX_REQUESTS}"
fi

echo "Starting API with args: ${CMD}"
exec sh -c "${CMD}"
