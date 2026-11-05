from unittest.mock import AsyncMock, patch
import httpx
import pytest

from app.core.config import settings
from app.repositories.analysis_repository import analysis_repository
from app.repositories.audit_repository import audit_repository
from app.repositories.submission_repository import submission_repository


@pytest.fixture
def sample_submission_with_analysis(client):
    """Creates a sample submission and corresponding static analysis."""
    # 1. Create submission
    code = "import os\ndef insecure_calc(x):\n    eval(x)\n"
    res = client.post(
        "/api/v1/submissions",
        files={"file": ("vulnerable.py", code.encode("utf-8"), "text/x-python")},
    )
    assert res.status_code == 201
    sub_data = res.json()
    sub_id = sub_data["submission_id"]

    # 2. Run analysis
    res_ana = client.post(f"/api/v1/submissions/{sub_id}/analyze")
    assert res_ana.status_code == 200
    ana_data = res_ana.json()

    return sub_data, ana_data


def test_draft_issue_unknown_submission(client):
    res = client.post(
        "/api/v1/integrations/github/issues/draft",
        json={"submission_id": "00000000-0000-0000-0000-000000000000", "finding_ids": []},
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_draft_issue_success(client, sample_submission_with_analysis):
    sub, ana = sample_submission_with_analysis
    sub_id = sub["submission_id"]
    findings = ana["findings"]
    assert len(findings) > 0

    selected_ids = [findings[0]["finding_id"]]

    res = client.post(
        "/api/v1/integrations/github/issues/draft",
        json={
            "submission_id": sub_id,
            "finding_ids": selected_ids,
            "repository_url": "test-org/test-project",
            "custom_title": "Security audit findings for review",
            "custom_notes": "Please fix this eval usage before submitting Phase 2.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["submission_id"] == sub_id
    assert data["repository"] == "test-org/test-project"
    assert data["title"] == "Security audit findings for review"
    assert "Please fix this eval usage" in data["body"]
    assert "CodeOrigin AI" in data["body"]
    assert data["finding_count"] == 1
    assert data["selected_finding_ids"] == selected_ids


def test_create_issue_requires_explicit_confirmation(client, sample_submission_with_analysis):
    sub, _ = sample_submission_with_analysis
    sub_id = sub["submission_id"]

    res = client.post(
        "/api/v1/integrations/github/issues",
        json={
            "submission_id": sub_id,
            "repository": "test-org/test-project",
            "title": "Unapproved issue",
            "body": "Body content",
            "confirmed": False,  # Missing approval
        },
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "EXPLICIT_APPROVAL_REQUIRED"


def test_create_issue_without_token_configured(client, sample_submission_with_analysis, monkeypatch):
    sub, _ = sample_submission_with_analysis
    sub_id = sub["submission_id"]

    monkeypatch.setattr(settings, "GITHUB_TOKEN", "")

    res = client.post(
        "/api/v1/integrations/github/issues",
        json={
            "submission_id": sub_id,
            "repository": "test-org/test-project",
            "title": "Approved issue",
            "body": "Body content",
            "confirmed": True,
        },
    )
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "GITHUB_TOKEN_NOT_CONFIGURED"


def test_create_issue_success_with_mocked_github(client, sample_submission_with_analysis, monkeypatch):
    sub, ana = sample_submission_with_analysis
    sub_id = sub["submission_id"]

    monkeypatch.setattr(settings, "GITHUB_TOKEN", "mock-token-123")

    mock_resp = httpx.Response(
        status_code=201,
        json={
            "id": 998877,
            "number": 42,
            "html_url": "https://github.com/test-org/test-project/issues/42",
            "title": "Fix critical security flaw",
        },
        request=httpx.Request("POST", "https://api.github.com/repos/test-org/test-project/issues"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        res = client.post(
            "/api/v1/integrations/github/issues",
            json={
                "submission_id": sub_id,
                "repository": "https://github.com/test-org/test-project",
                "title": "Fix critical security flaw",
                "body": "Detailed findings body...",
                "confirmed": True,
                "finding_ids": [f["finding_id"] for f in ana["findings"]],
            },
            headers={"X-User-ID": "prof-evaluation"},
        )

        assert res.status_code == 201
        data = res.json()
        assert data["issue_id"] == 998877
        assert data["issue_number"] == 42
        assert data["issue_url"] == "https://github.com/test-org/test-project/issues/42"
        assert data["repository"] == "test-org/test-project"
        assert data["actor_id"] == "prof-evaluation"
        assert data["status"] == "created"

        # Verify audit log was recorded
        audit_events = [e for e in audit_repository._memory_store if e.get("action") == "GITHUB_ISSUE_CREATED"]
        if not audit_events:
            # Check MongoDB if connected
            col = audit_repository._collection
            if col is not None:
                audit_events = list(col.find({"action": "GITHUB_ISSUE_CREATED"}))
        assert len(audit_events) > 0
        last_event = audit_events[-1]
        assert last_event["actor_id"] == "prof-evaluation"
        assert last_event["details"]["issue_number"] == 42
        assert last_event["details"]["repository"] == "test-org/test-project"


def test_create_issue_github_permission_error(client, sample_submission_with_analysis, monkeypatch):
    sub, _ = sample_submission_with_analysis
    sub_id = sub["submission_id"]

    monkeypatch.setattr(settings, "GITHUB_TOKEN", "mock-token-123")

    mock_resp = httpx.Response(
        status_code=403,
        json={"message": "Resource not accessible by personal access token"},
        request=httpx.Request("POST", "https://api.github.com/repos/test-org/test-project/issues"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        res = client.post(
            "/api/v1/integrations/github/issues",
            json={
                "submission_id": sub_id,
                "repository": "test-org/test-project",
                "title": "Title with permission error",
                "body": "Body content exceeding five characters",
                "confirmed": True,
            },
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "GITHUB_PERMISSION_DENIED"
