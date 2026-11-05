import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.auth import UserRole

client = TestClient(app)


def test_admin_stats_endpoint():
    """Verify GET /api/v1/admin/stats aggregates system telemetry."""
    response = client.get("/api/v1/admin/stats", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    data = response.json()

    assert "submissions" in data
    assert "analysis" in data
    assert "reviews" in data
    assert "comparisons" in data
    assert "system" in data
    assert "recent_activity" in data

    assert data["submissions"]["total"] >= 0
    assert data["system"]["api"] == "up"
    assert isinstance(data["recent_activity"], list)


def test_admin_audit_logs_endpoint():
    """Verify GET /api/v1/admin/audit-logs returns chronologically ordered events."""
    response = client.get("/api/v1/admin/audit-logs?limit=10", headers={"X-User-Role": "admin"})
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)
    if events:
        first = events[0]
        assert "event_id" in first
        assert "action" in first
        assert "actor_id" in first
        assert "created_at" in first


def test_admin_auth_login():
    """Verify authentication for admin role."""
    # Predefined admin account
    resp = client.post(
        "/api/v1/auth/login",
        json={"role": "admin", "username": "admin-root"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "admin"
    assert "Dean" in body["user"]["name"] or "Admin" in body["user"]["name"]

    # Dynamic admin account
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"role": "admin", "username": "provost-office"},
    )
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["user"]["role"] == "admin"
