from typing import List
from fastapi import APIRouter, Header, HTTPException, Query, status

from app.schemas.admin import AdminOverviewResponse, AuditEventItem
from app.services.admin_service import admin_service
from app.repositories.audit_repository import audit_repository

router = APIRouter(prefix="/admin", tags=["Administration & Governance"])


@router.get("/stats", response_model=AdminOverviewResponse)
def get_admin_stats(
    x_user_role: str = Header(default="admin", alias="X-User-Role"),
):
    """
    Returns platform-wide administrative statistics across submissions,
    multi-tool static analyses, faculty evaluations, and lineage diffs.
    Enforces Level 3 (Administrator) hierarchy check.
    """
    if x_user_role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required (Hierarchy Level 3).",
        )
    return admin_service.get_overview_stats()


@router.get("/audit-logs", response_model=List[AuditEventItem])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    x_user_role: str = Header(default="admin", alias="X-User-Role"),
):
    """
    Returns chronologically ordered institutional audit events with actor attribution.
    Enforces Level 3 (Administrator) hierarchy check.
    """
    if x_user_role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required (Hierarchy Level 3).",
        )
    raw_events = audit_repository.list_events(limit=limit)
    return [
        AuditEventItem(
            event_id=ev.get("event_id", str(ev.get("_id", ""))),
            action=ev.get("action", "UNKNOWN"),
            actor_id=ev.get("actor_id", "system"),
            details=ev.get("details", {}),
            created_at=str(ev.get("created_at", "")),
        )
        for ev in raw_events
    ]
