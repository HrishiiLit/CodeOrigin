import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.core.errors import ResourceNotFoundError
from app.core.logging import logger
from app.repositories.analysis_repository import (
    AnalysisRepository,
    analysis_repository,
)
from app.repositories.audit_repository import (
    AuditRepository,
    audit_repository,
)
from app.repositories.review_repository import (
    ReviewRepository,
    review_repository,
)
from app.repositories.submission_repository import (
    SubmissionRepository,
    submission_repository,
)
from app.schemas.analysis import AnalysisSummary
from app.schemas.review import ReviewReportResponse, ReviewResponse
from app.services.storage_service import StorageService, storage_service


class ReviewService:
    def __init__(
        self,
        rev_repo: Optional[ReviewRepository] = None,
        sub_repo: Optional[SubmissionRepository] = None,
        ana_repo: Optional[AnalysisRepository] = None,
        aud_repo: Optional[AuditRepository] = None,
        storage: Optional[StorageService] = None,
    ):
        self.rev_repo = rev_repo or review_repository
        self.sub_repo = sub_repo or submission_repository
        self.ana_repo = ana_repo or analysis_repository
        self.aud_repo = aud_repo or audit_repository
        self.storage = storage or storage_service

    def create_review(
        self,
        submission_id: str,
        notes: str,
        author_id: str = "demo-faculty",
    ) -> ReviewResponse:
        sub = self.sub_repo.find_by_id(submission_id)
        if not sub:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        review_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        doc = {
            "_id": review_id,
            "submission_id": submission_id,
            "author_id": author_id,
            "notes": notes.strip(),
            "created_at": now,
        }

        self.rev_repo.insert(doc)
        self.aud_repo.log_event(
            action="REVIEW_CREATED",
            actor_id=author_id,
            details={"submission_id": submission_id, "review_id": review_id},
        )

        return self._to_response(doc)

    def list_reviews_for_submission(self, submission_id: str) -> List[ReviewResponse]:
        docs = self.rev_repo.list_by_submission_id(submission_id)
        return [self._to_response(d) for d in docs]

    def generate_report(self, submission_id: str) -> ReviewReportResponse:
        sub = self.sub_repo.find_by_id(submission_id)
        if not sub:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        analysis_doc = self.ana_repo.find_by_submission_id(submission_id)
        reviews = self.list_reviews_for_submission(submission_id)
        now = datetime.now(timezone.utc)
        report_id = str(uuid.uuid4())

        # Build analysis summary
        analysis_summary = None
        findings_count = 0
        findings_list = []
        tool_versions = {}

        if analysis_doc:
            raw_sum = analysis_doc.get("summary", {})
            findings_list = analysis_doc.get("findings", [])
            findings_count = len(findings_list)
            tool_versions = analysis_doc.get("tool_versions", {})
            analysis_summary = AnalysisSummary(
                finding_count=raw_sum.get("finding_count", findings_count),
                error_count=raw_sum.get("error_count", 0),
                warning_count=raw_sum.get("warning_count", 0),
                info_count=raw_sum.get("info_count", 0),
            )

        # Build Markdown content
        md_lines = [
            "# CodeOrigin AI — Comprehensive Review & Evolution Report",
            f"\n> **Report ID:** `{report_id}`  ",
            f"> **Generated at:** {now.strftime('%Y-%m-%d %H:%M:%S UTC')}  ",
            f"> **Submission ID:** `{submission_id}`  ",
            f"> **Project ID:** `{sub.get('project_id')}`  ",
            "\n---\n",
            "## 1. Submission Overview",
            f"- **Filename / Title:** `{sub.get('original_filename')}`",
            f"- **Owner:** `{sub.get('owner_id')}`",
            f"- **Type:** `{sub.get('submission_type')}`",
            f"- **Source Integrity (SHA-256):** `{sub.get('source_sha256')}`",
            f"- **File Size:** {sub.get('size_bytes', 0)} bytes",
            f"- **Total Files:** {sub.get('total_files', 1)} ({sub.get('source_files_count', 1)} Python sources)",
            "\n---\n",
            "## 2. Static Analysis Findings",
        ]

        if analysis_summary:
            md_lines.extend([
                f"- **Overall Findings Count:** {analysis_summary.finding_count}",
                f"- **Errors:** {analysis_summary.error_count}",
                f"- **Warnings:** {analysis_summary.warning_count}",
                f"- **Informational:** {analysis_summary.info_count}",
                "\n### Tool Versions",
            ])
            for tool, ver in tool_versions.items():
                md_lines.append(f"- **{tool.upper()}:** {ver}")

            md_lines.append("\n### Detailed Findings")
            if findings_list:
                for idx, f in enumerate(findings_list, 1):
                    md_lines.extend([
                        f"#### {idx}. [{f['severity'].upper()}] {f['rule_id']} — {f['tool'].upper()} ({f['category']})",
                        f"- **File:** `{f['file']}` (Line {f['line']}, Col {f.get('column', 1)})",
                        f"- **Message:** {f['message']}",
                        f"- **Suggestion:** {f.get('suggestion') or 'N/A'}",
                        "",
                    ])
            else:
                md_lines.append("_No static analysis findings detected. Clean codebase._")
        else:
            md_lines.append("_Static analysis has not yet been executed for this submission._")

        md_lines.extend([
            "\n---\n",
            "## 3. Qualitative Faculty Reviews",
        ])

        if reviews:
            for r in reviews:
                md_lines.extend([
                    f"### Review by `{r.author_id}` ({r.created_at.strftime('%Y-%m-%d %H:%M:%S')})",
                    f"> {r.notes}",
                    "",
                ])
        else:
            md_lines.append("_No faculty review notes have been attached yet._")

        md_lines.extend([
            "\n---\n",
            "## 4. Educational Advisory Disclaimer",
            "> [!NOTE]",
            "> CodeOrigin AI provides bounded static analysis findings and educational feedback.",
            "> Static findings are advisory indicators to guide learning and maintainability.",
            "> They do not represent automated misconduct or grading decisions.",
        ])

        markdown_report = "\n".join(md_lines)

        # Save to Storage generated/
        report_filename = f"report_{submission_id[:8]}_{report_id[:8]}.md"
        self.storage.save_generated_file(markdown_report, report_filename)

        # Audit event
        self.aud_repo.log_event(
            action="REPORT_GENERATED",
            actor_id="system",
            details={"submission_id": submission_id, "report_id": report_id},
        )

        return ReviewReportResponse(
            report_id=report_id,
            submission_id=submission_id,
            generated_at=now,
            submission_metadata={
                "submission_id": submission_id,
                "project_id": sub.get("project_id"),
                "original_filename": sub.get("original_filename"),
                "submission_type": sub.get("submission_type"),
                "source_sha256": sub.get("source_sha256"),
            },
            analysis_summary=analysis_summary,
            findings_count=findings_count,
            findings=findings_list,
            reviews=reviews,
            markdown_report=markdown_report,
        )

    @staticmethod
    def _to_response(doc: dict) -> ReviewResponse:
        return ReviewResponse(
            review_id=doc["_id"],
            submission_id=doc["submission_id"],
            author_id=doc.get("author_id", "demo-faculty"),
            notes=doc["notes"],
            created_at=doc["created_at"],
        )


review_service = ReviewService()
