# RetrievAI v0.2.0

Modern RAG (Retrieval-Augmented Generation) system with separated frontend and backend architecture.

> **Note:** This is the v0.2.0 refactor. For the original v0.1.0 Streamlit app, see [README.md](README.md)

##  Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  React Frontend │────▶│   FastAPI Backend    │────▶│   PostgreSQL   │
│  (Vite + TS)    │     │   (Async + ARQ)      │     │  (Users/Meta)  │
└─────────────────┘     └──────────────────────┘     └────────────────┘
                                 │
                                 ├────────────────┬──────────────────┐
                                 ▼                ▼                  ▼
                        ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
                        │  ChromaDB   │  │    Redis     │  │  ARQ Worker  │
                        │  (Vectors)  │  │  (Queue)     │  │ (Background) │
                        └─────────────┘  └──────────────┘  └──────────────┘
```

##  Tech Stack

### Backend
- **FastAPI** - Modern async web framework
- **SQLModel** - SQL databases with Pydantic integration
- **ARQ** - Async task queue with Redis
- **UV** - Fast Python package manager (10-100x faster than pip)
- **PostgreSQL** - Relational database for users/metadata
- **ChromaDB** - Vector database for document embeddings
- **LangChain** - RAG orchestration

### Frontend (Coming Soon)
- **React 18** - UI framework
- **Vite** - Build tool
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Data fetching
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

##  Prerequisites

- **Docker** & **Docker Compose** (required for local development)
- **Python 3.12+** (for local development without Docker)
- **Node.js 20+** (for frontend development)
- **OpenAI API Key** (required for embeddings and chat)

##  Quick Start

### 1. Clone and Setup

```bash
git clone <repo>
cd retrievAI
git checkout refactor/separate-fe-and-be

# Copy environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check health
curl http://localhost:8000/health
```

**Services:**
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- ChromaDB: http://localhost:8001

### 3. Create First Admin User

```bash
# Access the backend container
docker-compose exec backend python

# In Python shell:
from app.db.session import AsyncSessionLocal
from app.db.models import User, AuthorizedEmail, UserRole
from app.core.security import get_password_hash
import asyncio

async def create_admin():
    async with AsyncSessionLocal() as session:
        # Authorize your email
        auth_email = AuthorizedEmail(email="your@email.com")
        session.add(auth_email)

        # Create admin user
        admin = User(
            email="your@email.com",
            hashed_password=get_password_hash("your-password"),
            full_name="Admin User",
            role=UserRole.ADMIN,
            is_active=True
        )
        session.add(admin)
        await session.commit()
        print("Admin user created!")

asyncio.run(create_admin())
```

### 4. Test API

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}'

# Use the returned access_token for authenticated requests
```

##  Project Structure

```
retrievAI/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API endpoints
│   │   ├── core/           # Business logic
│   │   ├── db/             # Database models
│   │   ├── models/         # Pydantic models
│   │   ├── workers/        # ARQ background tasks
│   │   ├── config.py       # Settings
│   │   └── main.py         # App entry point
│   ├── tests/
│   ├── pyproject.toml      # UV dependencies
│   └── Dockerfile
│
├── frontend/               # React frontend (coming soon)
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
├── migration_scripts/      # Data migration tools
├── docker-compose.yml      # Local development
├── docker-compose.prod.yml # Production (coming soon)
└── README-v0.2.md         # This file
```

##  Development Workflow

### Backend Development

```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
cd backend
uv pip install -e ".[dev]"

# Run backend locally (without Docker)
uvicorn app.main:app --reload

# Run tests
pytest

# Code formatting
ruff format app/
```

### Database Migrations

```bash
# Generate migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head
```

### Background Workers

ARQ workers run automatically with Docker Compose. To run manually:

```bash
docker-compose exec worker arq app.workers.tasks.WorkerSettings
```

##  API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register (requires pre-authorized email)
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

#### Documents (TODO)
- `GET /api/v1/documents` - List documents
- `POST /api/v1/upload` - Upload files
- `DELETE /api/v1/documents/{id}` - Delete document

#### Chat (TODO)
- `POST /api/v1/chat` - Chat with documents (streaming)

#### Admin (TODO)
- `GET /api/v1/admin/users` - Manage users
- `POST /api/v1/admin/authorized-emails` - Authorize emails

##  Migration from v0.1.0

To migrate your existing ChromaDB data:

1. **Backup current data**:
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz .retrievai/
   ```

2. **Run migration script** (coming soon):
   ```bash
   python migration_scripts/migrate_chromadb.py
   python migration_scripts/migrate_users.py
   ```

3. **Mount existing ChromaDB**:
   ```yaml
   # In docker-compose.yml
   chromadb:
     volumes:
       - /path/to/old/.retrievai/db:/chroma/chroma
   ```

##  Production Deployment

### On Your VM (4 vCPU, 16GB RAM, 20GB Disk)

1. **Copy files to VM**:
   ```bash
   rsync -avz . user@vm:/opt/retrievai/
   ```

2. **Set production environment**:
   ```bash
   # On VM
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Use production compose**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Configure Nginx** (for SSL):
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       location /api/ {
           proxy_pass http://localhost:8000;
       }

       location / {
           proxy_pass http://localhost:3000;
       }
   }
   ```

##  Resource Usage (Optimized for VM)

Estimated memory usage:
- PostgreSQL: ~50MB
- Redis: ~50MB
- ChromaDB: ~500MB (with your 2,371 documents)
- Backend: ~200MB
- Worker: ~200MB
- Frontend: ~100MB

**Total: ~1.1GB** (leaves ~14.9GB free on 16GB VM)

##  Next Steps

- [ ] Migrate core RAG logic from `retrievai/utils/` to `backend/app/core/`
- [ ] Implement remaining API endpoints (upload, chat, documents)
- [ ] Build React frontend with TanStack ecosystem
- [ ] Create data migration scripts
- [ ] Write tests
- [ ] Production deployment guide

##  Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `SECRET_KEY` - JWT secret (min 32 characters)
- `DATABASE_URL` - PostgreSQL connection string

**Optional:**
- `ALLOWED_ORIGINS` - CORS origins (default: localhost)
- `MAX_UPLOAD_SIZE` - Max file size in bytes (default: 50MB)
- `DEBUG` - Enable debug mode (default: false)

##  Contributing

This is a personal project being refactored from v0.1.0 monolith to microservices.

##  License

Private project.

---

**Current Status:**  In Development (refactor/separate-fe-and-be branch)

-  Backend structure with FastAPI + SQLModel + ARQ
-  Docker Compose setup
-  Authentication endpoints
-  Core RAG logic migration
-  Frontend with React
-  Data migration from v0.1.0
