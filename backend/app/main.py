import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis, auth, comparisons, health, integrations, reviews, submissions
from app.core.config import settings
from app.core.database import DatabaseManager
from app.core.errors import register_error_handlers
from app.core.logging import logger
from app.repositories.submission_repository import submission_repository


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to database & ensure storage directory
    logger.info("Starting CodeOrigin AI backend service...")
    DatabaseManager.connect()
    settings.resolved_upload_dir.mkdir(parents=True, exist_ok=True)
    settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)
    # Reconcile existing uploads from disk into repository
    reconciled = submission_repository.reconcile_untracked_files()
    if reconciled > 0:
        logger.info(f"Reconciled {reconciled} existing uploads into persistent storage.")
    yield
    # Shutdown: clean up database connections
    logger.info("Shutting down CodeOrigin AI backend service...")
    DatabaseManager.disconnect()


app = FastAPI(
    title="CodeOrigin AI API",
    description="Educational code-review, static analysis, and code-evolution backend service.",
    version="0.1.0",
    lifespan=lifespan,
)

# Request ID & Logging Middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = req_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    return response


# CORS Configuration
origins = [
    settings.FRONTEND_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register uniform error handlers
register_error_handlers(app)

# Mount health check at root
app.include_router(health.router)

# Mount API v1 routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(submissions.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(comparisons.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/")
def root():
    return {
        "name": "CodeOrigin AI API",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health_url": "/health",
    }
