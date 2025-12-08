# Local End-to-End Testing Guide

This guide explains how to run the complete RetrievAI application locally for testing, using an isolated test environment that doesn't interfere with production data.

## Overview

The test environment provides:
- **Isolated database**: Separate PostgreSQL instance on port 5433
- **Isolated services**: Redis (6380), ChromaDB (8002), Backend (8080), Frontend (3001)
- **Clean state**: Easy to reset and start fresh
- **No production impact**: Completely independent from production data and services

## Quick Start

### 1. Set up your environment

Copy the test environment file and add your OpenAI API key:

```bash
cp .env.test .env.test.local
# Edit .env.test.local and add your OPENAI_API_KEY
```

Or set it directly in your shell:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

### 2. Start the test environment

```bash
./scripts/test-env.sh start
```

This will:
- Start all services (Postgres, Redis, ChromaDB, Backend, Worker, Frontend)
- Wait for health checks to pass
- Display URLs for accessing the services

### 3. Run database migrations

On first run, initialize the database schema:

```bash
./scripts/test-env.sh migrate
```

### 4. Seed test users

Create test user accounts:

```bash
./scripts/test-env.sh seed
```

This creates two test accounts:
- **Regular User**: `test@example.com` / `testpassword123`
- **Admin User**: `admin@example.com` / `adminpassword123`

### 5. Access the application

Open your browser to:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

Login with one of the test accounts created above.

## Test Accounts

After running `./scripts/test-env.sh seed`, you can log in with:

| Account Type | Email | Password |
|-------------|-------|----------|
| Regular User | `test@example.com` | `testpassword123` |
| Admin User | `admin@example.com` | `adminpassword123` |

## Test Environment Commands

The `./scripts/test-env.sh` script provides several commands:

### Start/Stop Commands

```bash
# Start all services
./scripts/test-env.sh start

# Stop all services
./scripts/test-env.sh stop

# Restart all services
./scripts/test-env.sh restart

# Reset environment (deletes ALL test data)
./scripts/test-env.sh reset
```

### Debugging Commands

```bash
# View all logs (follow mode)
./scripts/test-env.sh logs

# View specific service logs
./scripts/test-env.sh logs backend-test
./scripts/test-env.sh logs worker-test
./scripts/test-env.sh logs frontend-test

# Check service status
./scripts/test-env.sh status
```

### Database Commands

```bash
# Run migrations
./scripts/test-env.sh migrate

# Seed test users
./scripts/test-env.sh seed

# Clear test users
./scripts/test-env.sh clear

# Open PostgreSQL shell
./scripts/test-env.sh db

# From the PostgreSQL shell, you can run queries:
# \dt                    - List tables
# \d users               - Describe users table
# SELECT * FROM users;   - Query users
```

### Development Commands

```bash
# Open a shell in the backend container
./scripts/test-env.sh shell

# Rebuild all containers (after dependency changes)
./scripts/test-env.sh build
```

## Service Ports

The test environment uses different ports to avoid conflicts:

| Service | Test Port | Development Port | Production |
|---------|-----------|------------------|------------|
| Frontend | 3001 | 3000 | 3000 |
| Backend API | 8080 | 8000 | 8000 |
| PostgreSQL | 5433 | 5432 | internal |
| Redis | 6380 | 6379 | internal |
| ChromaDB | 8002 | 8001 | internal |

## Testing Workflows

### Full End-to-End Test

1. Start fresh:
   ```bash
   ./scripts/test-env.sh reset
   ./scripts/test-env.sh start
   ./scripts/test-env.sh migrate
   ./scripts/test-env.sh seed
   ```

2. Access frontend at http://localhost:3001

3. Log in with test credentials:
   - Email: `test@example.com`
   - Password: `testpassword123`

4. Test the complete user flow:
   - Upload documents
   - Create a collection
   - Perform searches/queries
   - Check background job processing

5. Monitor logs:
   ```bash
   # In a separate terminal
   ./scripts/test-env.sh logs
   ```

### Testing Backend Changes

1. Make code changes in `backend/app/`

2. Changes auto-reload (hot reload enabled):
   ```bash
   # Watch the logs to see reload
   ./scripts/test-env.sh logs backend-test
   ```

3. Test API at http://localhost:8080/docs

### Testing Frontend Changes

1. Make code changes in `frontend/src/`

2. Changes auto-reload in the container

3. View at http://localhost:3001

### Testing Database Migrations

1. Create a new migration:
   ```bash
   ./scripts/test-env.sh shell
   # Inside container:
   uv run alembic revision --autogenerate -m "description"
   exit
   ```

2. Apply migration:
   ```bash
   ./scripts/test-env.sh migrate
   ```

3. Verify in database:
   ```bash
   ./scripts/test-env.sh db
   # Inside psql:
   \dt
   ```

### Testing Worker Jobs

1. Start environment and watch worker logs:
   ```bash
   ./scripts/test-env.sh start
   ./scripts/test-env.sh logs worker-test
   ```

2. Trigger a job (e.g., upload a document via frontend)

3. Monitor job execution in worker logs

## Connecting External Tools

You can connect external tools to the test environment:

### Database GUI (TablePlus, DBeaver, etc.)

```
Host: localhost
Port: 5433
Database: retrievai_test
Username: retrievai_test
Password: test_password
```

### Redis CLI

```bash
redis-cli -p 6380
```

### Direct API Testing

```bash
# Health check
curl http://localhost:8080/health

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

## Troubleshooting

### Services won't start

```bash
# Check for port conflicts
lsof -i :3001,8080,5433,6380,8002

# Check Docker resources
docker system df

# View detailed logs
./scripts/test-env.sh logs
```

### Database connection errors

```bash
# Wait for database to be ready
./scripts/test-env.sh status

# Check database health
docker-compose -f docker-compose.test.yml -p retrievai-test \
  exec postgres-test pg_isready -U retrievai_test
```

### Migration issues

```bash
# Check current migration status
./scripts/test-env.sh shell
uv run alembic current
uv run alembic history

# Reset database and re-run migrations
./scripts/test-env.sh reset
./scripts/test-env.sh start
./scripts/test-env.sh migrate
```

### Clean slate

When in doubt, reset everything:

```bash
./scripts/test-env.sh reset
docker system prune -f
./scripts/test-env.sh build
./scripts/test-env.sh start
./scripts/test-env.sh migrate
```

## Architecture

The test environment uses Docker Compose to orchestrate:

```
┌─────────────────────────────────────────────┐
│  Browser (localhost:3001)                   │
│  ├── Frontend Container                     │
│  │   └── React + Vite                       │
│  └── API Requests → localhost:8080          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Backend Container (localhost:8080)         │
│  ├── FastAPI                                │
│  ├── SQLAlchemy (async)                     │
│  └── ChromaDB client                        │
└─────────────────────────────────────────────┘
          ↓              ↓              ↓
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Postgres│    │  Redis  │    │ ChromaDB│
    │  :5433  │    │  :6380  │    │  :8002  │
    └─────────┘    └─────────┘    └─────────┘
          ↑
┌─────────────────────────────────────────────┐
│  Worker Container                           │
│  ├── ARQ background worker                  │
│  └── Processes async jobs                   │
└─────────────────────────────────────────────┘
```

All data is stored in Docker volumes:
- `postgres_test_data` - PostgreSQL data
- `redis_test_data` - Redis data
- `chroma_test_data` - ChromaDB vectors
- `upload_test_data` - Uploaded files

## CI/CD Integration

You can use this test environment in CI/CD pipelines:

```bash
# In your CI script
export OPENAI_API_KEY=$CI_OPENAI_API_KEY
./scripts/test-env.sh start
./scripts/test-env.sh migrate

# Run your tests
pytest backend/tests/

# Cleanup
./scripts/test-env.sh stop
```

## Differences from Development Environment

| Aspect | Development (`docker-compose.yml`) | Test (`docker-compose.test.yml`) |
|--------|-----------------------------------|----------------------------------|
| Ports | Standard (3000, 8000, etc.) | Offset (+1 or +80) |
| Database | `retrievai` | `retrievai_test` |
| Data | Persistent development data | Easily resettable test data |
| Purpose | Daily development | Isolated testing |

Both environments can run simultaneously without conflicts.

## Best Practices

1. **Reset between test sessions**: Start each major test session with a clean slate
   ```bash
   ./scripts/test-env.sh reset && ./scripts/test-env.sh start
   ```

2. **Monitor logs**: Keep logs open during testing to catch issues early
   ```bash
   ./scripts/test-env.sh logs
   ```

3. **Test migrations**: Always test migrations in the test environment before production
   ```bash
   ./scripts/test-env.sh reset
   ./scripts/test-env.sh start
   ./scripts/test-env.sh migrate
   ```

4. **Use realistic data**: Upload realistic documents and create realistic test scenarios

5. **Test the full stack**: Don't just test the API - test through the frontend UI

## Next Steps

- Consider adding automated test scripts
- Set up Playwright or Cypress for E2E UI testing
- Create test data seed scripts
- Add performance testing with realistic data volumes
