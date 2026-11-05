import sys
import io
import time
from pathlib import Path
from fastapi.testclient import TestClient

from app.core.config import settings, find_project_root
from app.main import app

def run_live_e2e_verification():
    print("=" * 60)
    print("CodeOrigin AI — End-to-End System Integration Verification")
    print("=" * 60)

    client = TestClient(app)
    project_root = find_project_root()
    print(f"[1] Verified Project Root: {project_root}")
    print(f"[1] Resolved Centralized Storage Root: {settings.resolved_storage_dir}")
    print(f"[1] Resolved Uploads Directory: {settings.resolved_upload_dir}")
    print(f"[1] Resolved Processed Directory: {settings.resolved_processed_dir}")
    print(f"[1] Resolved Generated Directory: {settings.resolved_generated_dir}")

    assert settings.resolved_storage_dir.is_dir(), "Storage directory missing!"
    assert settings.resolved_upload_dir.is_dir(), "Uploads directory missing!"
    assert settings.resolved_processed_dir.is_dir(), "Processed directory missing!"
    assert settings.resolved_generated_dir.is_dir(), "Generated directory missing!"

    # 1. Health check
    print("\n--- Testing Health Check ---")
    health_res = client.get("/health")
    assert health_res.status_code in (200, 503)
    assert health_res.json()["services"]["api"] == "up"
    print(f"Health Response: {health_res.json()}")

    # 2. Phase 2 & Storage Bug Verification: Single Python File Upload
    print("\n--- Testing Upload & Storage Bug Fix (Phase 2) ---")
    code_v1 = b"""import math
import os

def calculate_circle_stats(radius: float):
    # Base implementation
    area = math.pi * radius * radius
    circumference = 2 * math.pi * radius
    return area, circumference
"""
    upload_v1_res = client.post(
        "/api/v1/submissions",
        files={"file": ("circle_stats_v1.py", io.BytesIO(code_v1), "text/x-python")},
        data={"display_name": "Circle Stats Base Revision"},
    )
    assert upload_v1_res.status_code == 201
    v1_data = upload_v1_res.json()
    sub1_id = v1_data["submission_id"]
    proj_id = v1_data["project_id"]
    print(f"Submission 1 Created: ID={sub1_id}, Status={v1_data['status']}")

    # Verify physical file location
    from app.services.submission_service import submission_service
    sub1_doc = submission_service.repo.find_by_id(sub1_id)
    storage_key_1 = sub1_doc["storage_key"]
    print(f"Storage Key in Database: {storage_key_1}")
    assert storage_key_1.startswith("uploads/")

    physical_path_1 = settings.resolved_storage_dir / storage_key_1
    print(f"Physical File Location: {physical_path_1}")
    assert physical_path_1.exists(), "Physical file does not exist in Storage!"
    assert not (project_root / "backend" / "storage").exists(), "Bug! Files being saved in backend source directory!"

    # 3. Phase 3: Static Analysis Pipeline
    print("\n--- Testing Static Analysis Pipeline (Phase 3) ---")
    analyze_res = client.post(f"/api/v1/submissions/{sub1_id}/analyze")
    assert analyze_res.status_code == 200
    analysis_data = analyze_res.json()
    print(f"Analysis Status: {analysis_data['status']}")
    print(f"Tool Versions: {analysis_data['tool_versions']}")
    print(f"Summary: {analysis_data['summary']}")
    print(f"Findings Count: {len(analysis_data['findings'])}")

    for f in analysis_data["findings"]:
        print(f"  - [{f['severity'].upper()}] {f['tool'].upper()} ({f['rule_id']}): {f['message']} at line {f['line']}")

    # Retrieve analysis check
    get_ana = client.get(f"/api/v1/submissions/{sub1_id}/analysis")
    assert get_ana.status_code == 200
    assert get_ana.json()["analysis_id"] == analysis_data["analysis_id"]

    # 4. Phase 4: Revision Comparison Engine
    print("\n--- Testing Revision Comparison Engine (Phase 4) ---")
    code_v2 = b"""import math

def calculate_circle_stats(radius: float):
    # Optimized revision with input validation
    if radius < 0:
        raise ValueError("Radius must be non-negative")
    area = math.pi * (radius ** 2)
    circumference = 2 * math.pi * radius
    diameter = 2 * radius
    return {"area": area, "circumference": circumference, "diameter": diameter}
"""
    upload_v2_res = client.post(
        "/api/v1/submissions",
        files={"file": ("circle_stats_v2.py", io.BytesIO(code_v2), "text/x-python")},
        data={
            "display_name": "Circle Stats Optimized Revision",
            "project_id": proj_id,
            "parent_submission_id": sub1_id,
        },
    )
    assert upload_v2_res.status_code == 201
    sub2_id = upload_v2_res.json()["submission_id"]
    print(f"Submission 2 Created: ID={sub2_id}")

    # Run comparison
    comp_res = client.post(
        "/api/v1/comparisons",
        json={"base_submission_id": sub1_id, "target_submission_id": sub2_id},
    )
    assert comp_res.status_code == 201
    comp_data = comp_res.json()
    print(f"Comparison Created: ID={comp_data['comparison_id']}")
    print(f"Change Metrics: Added={comp_data['summary']['added_lines']}, Removed={comp_data['summary']['removed_lines']}, Files={comp_data['summary']['changed_files']}")
    print("Diff Sample:")
    print("\n".join(comp_data["diff"].splitlines()[:10]))

    # 5. Phase 5: Faculty Review & Reporting
    print("\n--- Testing Faculty Reviews & Reporting (Phase 5) ---")
    rev_res = client.post(
        "/api/v1/reviews",
        json={
            "submission_id": sub2_id,
            "notes": "Excellent enhancement. Cleanly resolved the unused import and added rigorous parameter validation.",
            "author_id": "prof-evaluation",
        },
    )
    assert rev_res.status_code == 201
    print(f"Review Created: ID={rev_res.json()['review_id']}")

    # List reviews
    list_rev = client.get(f"/api/v1/submissions/{sub2_id}/reviews")
    assert list_rev.status_code == 200
    print(f"Attached Reviews Count: {len(list_rev.json())}")

    # Generate full report
    rep_res = client.get(f"/api/v1/submissions/{sub2_id}/report")
    assert rep_res.status_code == 200
    report_data = rep_res.json()
    print(f"Generated Report ID: {report_data['report_id']}")
    print(f"Report Markdown Length: {len(report_data['markdown_report'])} characters")

    # Verify generated report is physically saved in storage/generated/
    generated_files = list(settings.resolved_generated_dir.glob("*.md"))
    print(f"Generated Reports in Storage: {[f.name for f in generated_files]}")
    assert len(generated_files) > 0, "Generated report not found in storage/generated/!"

    # 6. File Download & Deletion Verification
    print("\n--- Testing File Download & Deletion Lifecycle ---")
    dl_res = client.get(f"/api/v1/submissions/{sub1_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.content == code_v1
    print("Successfully downloaded source file matching exact upload bytes.")

    del_res = client.delete(f"/api/v1/submissions/{sub1_id}")
    assert del_res.status_code == 200
    print(f"Delete Response: {del_res.json()}")
    assert not physical_path_1.exists(), "Physical file was not cleaned up upon deletion!"
    print("Physical file safely purged from Storage.")

    print("\n" + "=" * 60)
    print("ALL INTEGRATION CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_live_e2e_verification()
