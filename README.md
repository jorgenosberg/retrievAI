# RetrievAI

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-FF6F61)](https://trychroma.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

RAG-based document retrieval and chat application powered by LangChain.

## Stack

- **Backend:** FastAPI, LangChain, PostgreSQL, ChromaDB
- **Frontend:** React, TypeScript, Vite
- **Infrastructure:** Docker Compose, Nginx, OpenStack

## Quick Start

```bash
cp .env.example .env
docker compose up -d
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- API Docs: `http://localhost:8000/api/docs`

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Testing Guide](docs/TESTING.md)
