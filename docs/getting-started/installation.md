# Installation

## Prerequisites

- Docker and Docker Compose
- OpenAI API key

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/retrievAI.git
cd retrievAI
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Start Services

```bash
docker compose up -d
```

This starts all services:

- PostgreSQL database
- Redis cache
- ChromaDB vector store
- FastAPI backend
- ARQ worker
- React frontend

### 4. Verify Installation

Check service health:

```bash
docker compose ps
```

All services should show as "healthy" or "running".

Access the application at [http://localhost:3000](http://localhost:3000).
