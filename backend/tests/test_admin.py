import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.auth import UserRole

client = TestClient(app)


def test_admin_stats_endpoint():
    """Verify GET /api/v1/admin/stats aggregates system telemetry for admin."""
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
    """Verify GET /api/v1/admin/audit-logs returns chronologically ordered events for admin."""
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


# ======================================================================
# HIERARCHY RESTRICTION & ACCESS CONTROL TESTS
# ======================================================================

def test_admin_endpoints_forbidden_for_students_and_faculties():
    """
    Hierarchy Gate 3:
    Students (Level 1) and Faculties (Level 2) MUST NOT access Admin Stats or Audit Logs.
    """
    # 1. Student access blocked
    res_student_stats = client.get("/api/v1/admin/stats", headers={"X-User-Role": "student"})
    assert res_student_stats.status_code == 403
    assert "Administrator privileges required" in res_student_stats.text

    res_student_audit = client.get("/api/v1/admin/audit-logs", headers={"X-User-Role": "student"})
    assert res_student_audit.status_code == 403

    # 2. Faculty access blocked
    res_faculty_stats = client.get("/api/v1/admin/stats", headers={"X-User-Role": "faculty"})
    assert res_faculty_stats.status_code == 403
    assert "Administrator privileges required" in res_faculty_stats.text

    res_faculty_audit = client.get("/api/v1/admin/audit-logs", headers={"X-User-Role": "faculty"})
    assert res_faculty_audit.status_code == 403


def test_faculty_reviews_and_reports_forbidden_for_students():
    """
    Hierarchy Gate 2:
    Students (Level 1) MUST NOT post faculty review memos or generate formal reports.
    """
    # Student cannot create reviews
    res_review = client.post(
        "/api/v1/reviews",
        json={
            "submission_id": "sub-test-123",
            "notes": "Attempting student self-review memo",
            "author_id": "student-alex",
        },
        headers={"X-User-Role": "student"},
    )
    assert res_review.status_code == 403
    assert "Faculty or Administrator privileges required" in res_review.text

    # Student cannot generate formal report
    res_report = client.get(
        "/api/v1/submissions/sub-test-123/report",
        headers={"X-User-Role": "student"},
    )
    assert res_report.status_code == 403
    assert "Official report generation requires Faculty or Administrator" in res_report.text


def test_github_export_forbidden_for_students():
    """
    Hierarchy Gate 2:
    Students (Level 1) MUST NOT draft or export GitHub issues.
    """
    res_draft = client.post(
        "/api/v1/integrations/github/issues/draft",
        json={"submission_id": "sub-test-123", "finding_ids": ["f1"]},
        headers={"X-User-Role": "student"},
    )
    assert res_draft.status_code == 403
    assert "Faculty or Administrator" in res_draft.text

    res_issue = client.post(
        "/api/v1/integrations/github/issues",
        json={
            "submission_id": "sub-test-123",
            "repository": "owner/repo",
            "title": "Finding Issue Title",
            "body": "Detailed finding explanation body",
            "confirmed": True,
        },
        headers={"X-User-Role": "student"},
    )
    assert res_issue.status_code == 403
    assert "Faculty or Administrator" in res_issue.text
