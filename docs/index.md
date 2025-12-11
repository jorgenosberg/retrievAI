# RetrievAI

RAG-based document retrieval and chat application powered by LangChain.

## Overview

RetrievAI enables you to upload documents and chat with them using AI-powered retrieval augmented generation (RAG). The system processes your documents, creates vector embeddings, and provides accurate, context-aware responses.

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
<iframe src="https://www.youtube.com/embed/B8lObw2PcWk?si=xCgYQLsBUIGfETa7" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
</div>
Iframe not loading? [Watch the video here](https://youtu.be/B8lObw2PcWk)

## Features

- **Document Upload** — Support for PDF, DOCX, TXT, and Markdown files
- **Intelligent Chunking** — Documents are split into semantic chunks for optimal retrieval
- **Vector Search** — ChromaDB-powered similarity search for relevant context
- **Chat Interface** — Conversational AI with source citations

## Quick Start

```bash
# Clone and configure
git clone https://github.com/your-username/retrievAI.git
cd retrievAI
cp .env.example .env

# Start services
docker compose up -d
```

Access the application:

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:8000](http://localhost:8000)
- **API Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, LangChain, Python 3.11+ |
| Frontend | React 18, TypeScript, Vite |
| Database | PostgreSQL 16 |
| Vector Store | ChromaDB |
| Cache | Redis |
| Infrastructure | Docker Compose, Nginx |
