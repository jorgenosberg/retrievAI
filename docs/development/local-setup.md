# Local Development Setup

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose

## Backend Development

### Using Docker (Recommended)

The test compose file provides hot-reloading:

```bash
docker compose -f docker-compose.test.yml up -d
```

- Backend: [http://localhost:8080](http://localhost:8080)
- Frontend: [http://localhost:3001](http://localhost:3001)

### Native Setup

```bash
cd backend

# Install dependencies
pip install uv
uv sync

# Run migrations
uv run alembic upgrade head

# Start server
uv run uvicorn app.main:app --reload
```

## Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Running Tests

See the [Testing Guide](../TESTING.md) for comprehensive testing instructions.

## Code Structure

```
retrievAI/
├── backend/
│   ├── app/
│   │   ├── api/v1/      # API routes
│   │   ├── db/          # Database models
│   │   ├── services/    # Business logic
│   │   └── workers/     # Background tasks
│   └── alembic/         # Migrations
├── frontend/
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       └── services/    # API clients
└── docs/                # Documentation
```
