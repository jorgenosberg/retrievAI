# RetrievAI

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-FF6F61)](https://trychroma.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

RAG-based document retrieval and chat application powered by LangChain.

<p align="center">
  <img src="docs/assets/retrievai-login-page.png" alt="Login" width="50%">
  <img src="docs/assets/retrievai-chat-page.png" alt="Chat" width="50%">
</p>

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

📖 **[Full Documentation](https://jorgenosberg.github.io/retrievAI/)**

<p align="center">
  <img src="docs/assets/retrievai-docs-page.png" alt="Documentation" width="80%">
</p>

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Testing Guide](docs/TESTING.md)
