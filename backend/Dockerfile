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
COPY README.md* ./ 2>/dev/null || :

# Install dependencies using UV
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application code
COPY app/ ./app/

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/tmp

# Expose port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
