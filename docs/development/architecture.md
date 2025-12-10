# Architecture

## System Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Nginx     │────▶│   Backend   │
│   (React)   │     │  (Reverse   │     │  (FastAPI)  │
└─────────────┘     │   Proxy)    │     └──────┬──────┘
                    └─────────────┘            │
                                               ▼
                    ┌─────────────┬─────────────┬─────────────┐
                    │  PostgreSQL │   ChromaDB  │    Redis    │
                    │  (Metadata) │  (Vectors)  │  (Queue)    │
                    └─────────────┴─────────────┴──────┬──────┘
                                                       │
                                                       ▼
                                               ┌─────────────┐
                                               │ ARQ Worker  │
                                               │  (Tasks)    │
                                               └─────────────┘
```

## Components

### Frontend

React SPA built with Vite and TypeScript. Handles:

- User authentication
- Document upload interface
- Chat interface
- Document management

### Backend

FastAPI application providing REST API endpoints. Core responsibilities:

- Authentication and authorization
- Document processing orchestration
- Chat/RAG endpoints
- Admin functionality

### Background Task Processing (ARQ + Redis)

Document processing is handled asynchronously using **ARQ**, a fast job queue built on Redis. This architecture allows the API to remain responsive while heavy tasks run in the background.

**How it works:**

1. **Job Enqueueing** — When a document is uploaded, FastAPI enqueues a processing job to Redis via ARQ
2. **Job Queue** — Redis stores the job queue, maintaining task order and state
3. **Worker Processing** — A separate ARQ worker process pulls jobs from Redis and executes them
4. **Status Updates** — The worker updates job status in Redis/PostgreSQL; the frontend polls for progress

**Why ARQ?**

- Native async/await support (matches FastAPI's async model)
- Lightweight compared to Celery
- Built specifically for Redis
- Simple API with robust retry and timeout handling

**Task Examples:**

- Document text extraction
- Chunk generation and embedding
- Vector store indexing
- Batch operations

The worker runs as a separate container/process (`arq app.workers.tasks.WorkerSettings`), allowing horizontal scaling independent of the API.

### Data Stores

| Store | Purpose |
|-------|---------|
| **PostgreSQL** | User accounts, document metadata, chat history |
| **ChromaDB** | Vector embeddings for similarity search |
| **Redis** | ARQ job queue, task state, caching |

## RAG Pipeline

1. **Query** — User submits a question
2. **Embed** — Question is converted to vector embedding
3. **Retrieve** — Similar chunks are found via ChromaDB
4. **Augment** — Retrieved chunks are added to prompt context
5. **Generate** — LLM generates response using context
6. **Cite** — Response includes source chunk references

## Authentication

JWT-based authentication with:

- Access tokens (short-lived)
- Refresh tokens (long-lived)
- Secure HTTP-only cookies
