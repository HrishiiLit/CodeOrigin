from datetime import datetime, timezone
from fastapi import APIRouter, Response, status

from app.core.database import DatabaseManager
from app.schemas.common import HealthResponse, HealthServices

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def check_health(response: Response):
    db_connected = DatabaseManager.is_connected()
    db_status = "up" if db_connected else "down"

    is_healthy = db_connected
    system_status = "healthy" if is_healthy else "degraded"

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=system_status,
        version="0.1.0",
        timestamp=datetime.now(timezone.utc),
        services=HealthServices(
            api="up",
            database=db_status,
        ),
    )
