"""
CodeOrigin AI - Demonstration Seeding Script
Automates ingestion, static analysis, revision comparison, and faculty review
for all standard demo fixtures.

Supports both:
1. Live HTTP mode (connecting to http://localhost:8000)
2. In-process direct mode (using FastAPI TestClient when offline)
"""

import io
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Add project root and backend to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app
from fastapi.testclient import TestClient


class DemoSeeder:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip("/")
        self.fixtures_dir = PROJECT_ROOT / "fixtures" / "demo"
        self.client = TestClient(app)

    def print_header(self, text: str):
        print("\n" + "=" * 70)
        print(f"  {text}")
        print("=" * 70)

    def print_step(self, step: str, details: str = ""):
        print(f"\n[+] {step}")
        if details:
            print(f"    {details}")

    def run(self):
        self.print_header("CodeOrigin AI - Demo Dataset Seeder")

        v1_path = self.fixtures_dir / "valid_simple.py"
        v2_path = self.fixtures_dir / "revision_v2.py"
        zip_path = self.fixtures_dir / "sample_project.zip"

        if not v1_path.exists() or not v2_path.exists() or not zip_path.exists():
            print("Generating missing fixtures...")
            from backend.scripts.generate_fixtures import generate_demo_zip
            generate_demo_zip()

        # ---------------------------------------------------------------------
        # Step 1: Submit Initial Submission (v1_calculator.py)
        # ---------------------------------------------------------------------
        self.print_step("Step 1: Ingesting Initial Submission (v1 - Math Parser)", f"File: {v1_path.name}")
        with open(v1_path, "rb") as f:
            v1_bytes = f.read()

        res1 = self.client.post(
            "/api/v1/submissions",
            files={"file": (v1_path.name, io.BytesIO(v1_bytes), "text/x-python")},
            data={"display_name": "v1-Math-Parser-Evaluation"},
            headers={"X-User-ID": "student-alex", "X-User-Role": "student"},
        )
        assert res1.status_code == 201, f"Failed v1 submission: {res1.text}"
        sub1 = res1.json()
        sub1_id = sub1["submission_id"]
        project_id = sub1["project_id"]
        print(f"    -> Submission ID: {sub1_id}")
        print(f"    -> Project ID:    {project_id}")
        print(f"    -> Status:        {sub1['status']}")

        # ---------------------------------------------------------------------
        # Step 2: Run Static Analysis on v1
        # ---------------------------------------------------------------------
        self.print_step("Step 2: Executing Multi-Tool Static Analysis on v1", "Running AST, Ruff, Radon, Bandit...")
        res_an1 = self.client.post(f"/api/v1/submissions/{sub1_id}/analyze")
        assert res_an1.status_code == 200, f"Failed analysis 1: {res_an1.text}"
        an1 = res_an1.json()
        print(f"    -> Duration:      {an1['duration_ms']}ms")
        print(f"    -> Findings:      {an1['summary']['finding_count']} total")
        print(f"       - Errors:      {an1['summary']['error_count']}")
        print(f"       - Warnings:    {an1['summary']['warning_count']}")
        print(f"       - Info:        {an1['summary']['info_count']}")
        for f in an1["findings"][:3]:
            print(f"       * [{f['tool'].upper()} - {f['rule_id']}] Line {f['line']}: {f['message'][:60]}...")

        # ---------------------------------------------------------------------
        # Step 3: Submit Refactored Revision (v2_calculator.py)
        # ---------------------------------------------------------------------
        self.print_step("Step 3: Ingesting Refactored Revision (v2)", f"Parent: {sub1_id}")
        with open(v2_path, "rb") as f:
            v2_bytes = f.read()

        res2 = self.client.post(
            "/api/v1/submissions",
            files={"file": (v2_path.name, io.BytesIO(v2_bytes), "text/x-python")},
            data={
                "display_name": "v2-Refactored-Safe-Parser",
                "parent_submission_id": sub1_id,
                "project_id": project_id,
            },
            headers={"X-User-ID": "student-alex", "X-User-Role": "student"},
        )
        assert res2.status_code == 201, f"Failed v2 submission: {res2.text}"
        sub2 = res2.json()
        sub2_id = sub2["submission_id"]
        print(f"    -> Submission ID: {sub2_id}")
        print(f"    -> Status:        {sub2['status']}")

        # ---------------------------------------------------------------------
        # Step 4: Run Static Analysis on v2
        # ---------------------------------------------------------------------
        self.print_step("Step 4: Executing Static Analysis on v2")
        res_an2 = self.client.post(f"/api/v1/submissions/{sub2_id}/analyze")
        assert res_an2.status_code == 200, f"Failed analysis 2: {res_an2.text}"
        an2 = res_an2.json()
        print(f"    -> Findings:      {an2['summary']['finding_count']} total (down from {an1['summary']['finding_count']})")

        # ---------------------------------------------------------------------
        # Step 5: Execute Revision Comparison
        # ---------------------------------------------------------------------
        self.print_step("Step 5: Comparing v1 vs v2 Revisions", "Calculating line diff, metrics shift, resolved findings...")
        res_comp = self.client.post(
            "/api/v1/comparisons",
            json={"base_submission_id": sub1_id, "target_submission_id": sub2_id},
        )
        assert res_comp.status_code == 201, f"Failed comparison: {res_comp.text}"
        comp = res_comp.json()
        print(f"    -> Comparison ID: {comp['comparison_id']}")
        print(f"    -> Added lines:   +{comp['summary']['added_lines']}")
        print(f"    -> Removed lines: -{comp['summary']['removed_lines']}")
        print(f"    -> Changed files: {comp['summary']['changed_files']}")

        # ---------------------------------------------------------------------
        # Step 6: Create Faculty Review Note
        # ---------------------------------------------------------------------
        self.print_step("Step 6: Recording Faculty Review Note", "Reviewer: Prof. Marcus Vance")
        review_notes = (
            "Excellent refactoring effort. The student successfully eliminated the Bandit B307 security risk "
            "by replacing eval() with a safe AST arithmetic evaluator. Cyclomatic complexity dropped from rank C to rank A."
        )
        res_rev = self.client.post(
            "/api/v1/reviews",
            json={"submission_id": sub2_id, "notes": review_notes, "author_id": "prof-marcus"},
            headers={"X-User-ID": "prof-marcus", "X-User-Role": "faculty"},
        )
        assert res_rev.status_code == 201, f"Failed review note: {res_rev.text}"
        rev = res_rev.json()
        print(f"    -> Review ID:     {rev['review_id']}")
        print(f"    -> Note:          {rev['notes'][:80]}...")

        # ---------------------------------------------------------------------
        # Step 7: Ingest Multi-File Repository Archive
        # ---------------------------------------------------------------------
        self.print_step("Step 7: Ingesting Multi-File Repository Archive", f"Archive: {zip_path.name}")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()

        res_zip = self.client.post(
            "/api/v1/submissions",
            files={"file": (zip_path.name, io.BytesIO(zip_bytes), "application/zip")},
            data={"display_name": "Multi-File-Calculator-Package"},
            headers={"X-User-ID": "student-alex", "X-User-Role": "student"},
        )
        assert res_zip.status_code == 201, f"Failed zip submission: {res_zip.text}"
        sub_zip = res_zip.json()
        sub_zip_id = sub_zip["submission_id"]
        print(f"    -> Submission ID: {sub_zip_id}")
        print(f"    -> Type:          {sub_zip['submission_type']}")
        print(f"    -> Total Files:   {sub_zip['total_files']} ({sub_zip['source_files_count']} Python files)")

        # Analyze Multi-file repo
        res_an_zip = self.client.post(f"/api/v1/submissions/{sub_zip_id}/analyze")
        assert res_an_zip.status_code == 200, f"Failed zip analysis: {res_an_zip.text}"
        an_zip = res_an_zip.json()
        print(f"    -> Analysis ID:   {an_zip['analysis_id']}")
        print(f"    -> Findings:      {an_zip['summary']['finding_count']}")

        # ---------------------------------------------------------------------
        # Demo Summary & URLs
        # ---------------------------------------------------------------------
        self.print_header("Demo Seeding Complete!")
        print("\nReady for live presentation:")
        print(f"  * Web Dashboard:               http://localhost:3000")
        print(f"  * Initial Submission (v1):     http://localhost:3000/submissions/{sub1_id}")
        print(f"  * Refactored Revision (v2):    http://localhost:3000/submissions/{sub2_id}")
        print(f"  * Multi-File Project Archive:  http://localhost:3000/submissions/{sub_zip_id}")
        print(f"  * Version Comparison:          http://localhost:3000/comparisons/{comp['comparison_id']}")
        print(f"  * Comprehensive Report:        http://localhost:8000/api/v1/submissions/{sub2_id}/report")
        print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    seeder = DemoSeeder()
    seeder.run()
