# RetrievAI Backend

Modern async FastAPI backend with SQLModel, ARQ, and UV.

## Tech Stack

- **FastAPI** - Async web framework
- **SQLModel** - SQL databases with Pydantic
- **ARQ** - Async background tasks with Redis
- **UV** - Fast Python package manager
- **PostgreSQL** - User and metadata storage
- **ChromaDB** - Vector embeddings storage
- **Redis** - Task queue for ARQ

## Development Setup

### Prerequisites

- Python 3.12+
- Docker & Docker Compose
- OpenAI API key

### Quick Start

1. **Install UV** (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   uv pip install -e ".[dev]"
   ```

3. **Set environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. **Start services with Docker Compose** (from project root):
   ```bash
   cd ..
   docker-compose up -d
   ```

5. **Access the API**:
   - API: http://localhost:8000
   - Docs: http://localhost:8000/api/docs
   - Health: http://localhost:8000/health

## Project Structure

```
backend/
├── app/
│   ├── api/v1/          # API endpoints
│   ├── core/            # Business logic
│   ├── db/              # Database models & session
│   ├── models/          # Pydantic models
│   ├── workers/         # ARQ background tasks
│   ├── middleware/      # Custom middleware
│   ├── config.py        # Settings
│   ├── dependencies.py  # FastAPI dependencies
│   └── main.py          # Application entry point
├── tests/               # Tests
├── alembic/             # Database migrations
├── pyproject.toml       # Dependencies (UV compatible)
└── Dockerfile           # Container definition
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Documents
- `GET /api/v1/documents` - List documents
- `DELETE /api/v1/documents/{id}` - Delete document

### Upload
- `POST /api/v1/upload` - Upload files (triggers background processing)

### Chat
- `POST /api/v1/chat` - Chat with documents (streaming)

### Admin
- `GET /api/v1/admin/users` - Manage users
- `POST /api/v1/admin/authorized-emails` - Authorize emails

## Background Tasks

Background tasks are handled by ARQ workers:

```bash
# Start worker manually
arq app.workers.tasks.WorkerSettings
```

Tasks:
- `process_document_upload` - Process uploaded documents
- `cleanup_temp_files` - Clean old temp files (cron)

## Database Migrations

Using Alembic for migrations:

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

## Testing

```bash
pytest
```

## Production Deployment

See main README for deployment instructions.
