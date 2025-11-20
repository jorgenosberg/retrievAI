# Backend Dockerfile with UV
FROM python:3.12-slim

# Install system dependencies for OCR and PDF processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    ghostscript \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies using UV sync
RUN uv sync --no-dev

# Copy application code
COPY app/ ./app/
COPY start.sh ./start.sh
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic/

RUN chmod +x /app/start.sh

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/tmp

# Expose port
EXPOSE 8000

# Run via helper script (auto-tunes uvicorn workers)
CMD ["/app/start.sh"]
