"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.session import init_db
from app.dependencies import get_arq_pool, close_arq_pool

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print(f"{settings.APP_NAME} v{settings.VERSION} starting...")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database: {settings.DATABASE_URL}")
    print(f"ChromaDB: {settings.chroma_url}")
    print(f"Redis: {settings.REDIS_URL}")

    await init_db()
    print("Database connection verified (apply Alembic migrations separately)")

    await get_arq_pool()
    print("ARQ worker pool initialized")

    try:
        import nltk
        nltk.download("punkt", quiet=True)
        nltk.download("words", quiet=True)
        print("NLTK data downloaded")
    except Exception as e:
        print(f"Warning: Could not download NLTK data: {e}")

    print("Application startup complete")

    yield

    print("Shutting down...")
    await close_arq_pool()
    print("ARQ pool closed")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for RetrievAI document retrieval system",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


# Import and include routers
from app.api.v1 import auth, chat, documents, upload, settings as settings_router, admin, chunks

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(settings_router.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(chunks.router, prefix="/api/v1/chunks", tags=["Chunks"])
