import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app

fixtures_dir = Path(__file__).parent / "fixtures"


def test_revision_comparison_flow(client):
    # 1. Upload base revision (bubble_sort_v1)
    with open(fixtures_dir / "revision_v1.py", "rb") as f:
        v1_bytes = f.read()

    res1 = client.post(
        "/api/v1/submissions",
        files={"file": ("bubble_sort_v1.py", io.BytesIO(v1_bytes), "text/x-python")},
        data={"display_name": "Base Bubble Sort"},
    )
    assert res1.status_code == 201
    base_id = res1.json()["submission_id"]
    proj_id = res1.json()["project_id"]

    # 2. Upload target revision (bubble_sort_v2)
    with open(fixtures_dir / "revision_v2.py", "rb") as f:
        v2_bytes = f.read()

    res2 = client.post(
        "/api/v1/submissions",
        files={"file": ("bubble_sort_v2.py", io.BytesIO(v2_bytes), "text/x-python")},
        data={
            "display_name": "Optimized Bubble Sort",
            "project_id": proj_id,
            "parent_submission_id": base_id,
        },
    )
    assert res2.status_code == 201
    target_id = res2.json()["submission_id"]

    # 3. Create comparison
    comp_res = client.post(
        "/api/v1/comparisons",
        json={"base_submission_id": base_id, "target_submission_id": target_id},
    )
    assert comp_res.status_code == 201
    comp_data = comp_res.json()

    assert comp_data["base_submission_id"] == base_id
    assert comp_data["target_submission_id"] == target_id
    assert "diff" in comp_data
    assert comp_data["summary"]["changed_files"] == 1
    assert comp_data["summary"]["added_lines"] > 0
    assert "bubble_sort" in comp_data["diff"]

    # 4. Fetch comparison by ID
    comp_id = comp_data["comparison_id"]
    get_res = client.get(f"/api/v1/comparisons/{comp_id}")
    assert get_res.status_code == 200
    assert get_res.json()["comparison_id"] == comp_id


def test_faculty_reviews_and_reporting_flow(client):
    # 1. Upload submission
    with open(fixtures_dir / "valid_simple.py", "rb") as f:
        code_bytes = f.read()

    res = client.post(
        "/api/v1/submissions",
        files={"file": ("sample.py", io.BytesIO(code_bytes), "text/x-python")},
    )
    assert res.status_code == 201
    sub_id = res.json()["submission_id"]

    # 2. Run static analysis
    client.post(f"/api/v1/submissions/{sub_id}/analyze")

    # 3. Create review note
    review_res = client.post(
        "/api/v1/reviews",
        json={
            "submission_id": sub_id,
            "notes": "Excellent algorithmic structure. Keep maintainability in mind.",
            "author_id": "prof-alice",
        },
    )
    assert review_res.status_code == 201
    review_data = review_res.json()
    assert review_data["submission_id"] == sub_id
    assert review_data["author_id"] == "prof-alice"
    assert "algorithmic structure" in review_data["notes"]

    # 4. List reviews for submission
    list_res = client.get(f"/api/v1/submissions/{sub_id}/reviews")
    assert list_res.status_code == 200
    reviews = list_res.json()
    assert len(reviews) >= 1
    assert reviews[0]["author_id"] == "prof-alice"

    # 5. Generate comprehensive review report
    report_res = client.get(f"/api/v1/submissions/{sub_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert "report_id" in report_data
    assert report_data["submission_id"] == sub_id
    assert "markdown_report" in report_data
    assert "# CodeOrigin AI" in report_data["markdown_report"]
    assert "prof-alice" in report_data["markdown_report"]
    assert "Educational Advisory Disclaimer" in report_data["markdown_report"]
