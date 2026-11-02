import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.analyzers.ast_analyzer import ASTAnalyzer
from app.analyzers.bandit_analyzer import BanditAnalyzer
from app.analyzers.radon_analyzer import RadonAnalyzer
from app.analyzers.ruff_analyzer import RuffAnalyzer
from app.core.errors import AppException, ResourceNotFoundError
from app.core.logging import logger
from app.repositories.analysis_repository import (
    AnalysisRepository,
    analysis_repository,
)
from app.repositories.submission_repository import (
    SubmissionRepository,
    submission_repository,
)
from app.schemas.analysis import (
    AnalysisRunResponse,
    AnalysisSummary,
    Finding,
    FindingCategory,
    FindingSeverity,
)
from app.schemas.submission import SubmissionStatus
from app.services.storage_service import StorageService, storage_service


class AnalysisService:
    def __init__(
        self,
        analysis_repo: Optional[AnalysisRepository] = None,
        submission_repo: Optional[SubmissionRepository] = None,
        storage: Optional[StorageService] = None,
    ):
        self.analysis_repo = analysis_repo or analysis_repository
        self.submission_repo = submission_repo or submission_repository
        self.storage = storage or storage_service

        # Initialize analyzer adapters
        self.ast_analyzer = ASTAnalyzer()
        self.ruff_analyzer = RuffAnalyzer()
        self.radon_analyzer = RadonAnalyzer()
        self.bandit_analyzer = BanditAnalyzer()

    def get_tool_versions(self) -> Dict[str, str]:
        return {
            "ast": self.ast_analyzer.version,
            "ruff": self.ruff_analyzer.version,
            "radon": self.radon_analyzer.version,
            "bandit": self.bandit_analyzer.version,
        }

    def analyze_submission(self, submission_id: str) -> AnalysisRunResponse:
        sub = self.submission_repo.find_by_id(submission_id)
        if not sub:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        storage_key = sub.get("storage_key")
        if not storage_key:
            raise ResourceNotFoundError(resource_type="Submission storage key", resource_id=submission_id)

        # Mark submission status as processing
        self.submission_repo.update_status(submission_id, SubmissionStatus.PROCESSING.value)
        start_time = time.perf_counter()

        target_base = self.storage._resolve_safe_path(storage_key)
        if not target_base.exists():
            self.submission_repo.update_status(
                submission_id,
                SubmissionStatus.FAILED.value,
                error_details="Target source storage directory does not exist on disk.",
            )
            raise ResourceNotFoundError(resource_type="Submission physical storage", resource_id=storage_key)

        # Identify all python files to analyze
        # List of tuples: (absolute_file_path, display_relative_path)
        python_files: List[tuple[Path, str]] = []

        if target_base.is_file():
            python_files.append((target_base, sub.get("original_filename", target_base.name)))
        else:
            # Tree scan for python files
            tree_info = self.storage.scan_repository_tree(storage_key)
            source_files = tree_info.get("source_files", [])

            for rel_f in source_files:
                f_path = (target_base / rel_f).resolve()
                if not f_path.is_file():
                    # Check nested root directory
                    from app.services.storage_service import IGNORED_DIRECTORIES
                    children = [c for c in target_base.iterdir() if c.is_dir() and c.name not in IGNORED_DIRECTORIES]
                    if children:
                        alt = (children[0] / rel_f).resolve()
                        if alt.is_file():
                            f_path = alt

                if f_path.is_file() and f_path.suffix.lower() == ".py":
                    python_files.append((f_path, rel_f))

        all_findings: List[Dict[str, Any]] = []

        # Execute analyzers across all target files
        for f_path, rel_label in python_files:
            str_path = str(f_path)

            # 1. AST Analyzer
            try:
                ast_res = self.ast_analyzer.analyze(str_path, display_filename=rel_label)
                all_findings.extend(ast_res)
            except Exception as e:
                logger.error(f"AST Analyzer failed on {rel_label}: {e}")

            # 2. Ruff Analyzer
            try:
                ruff_res = self.ruff_analyzer.analyze(str_path, display_filename=rel_label)
                all_findings.extend(ruff_res)
            except Exception as e:
                logger.error(f"Ruff Analyzer failed on {rel_label}: {e}")

            # 3. Radon Analyzer
            try:
                radon_res = self.radon_analyzer.analyze(str_path, display_filename=rel_label)
                all_findings.extend(radon_res)
            except Exception as e:
                logger.error(f"Radon Analyzer failed on {rel_label}: {e}")

            # 4. Bandit Analyzer
            try:
                bandit_res = self.bandit_analyzer.analyze(str_path, display_filename=rel_label)
                all_findings.extend(bandit_res)
            except Exception as e:
                logger.error(f"Bandit Analyzer failed on {rel_label}: {e}")

        # Compute summary
        error_count = sum(1 for f in all_findings if f["severity"] == "error")
        warning_count = sum(1 for f in all_findings if f["severity"] == "warning")
        info_count = sum(1 for f in all_findings if f["severity"] == "info")
        finding_count = len(all_findings)

        duration_ms = int((time.perf_counter() - start_time) * 1000)
        analysis_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        analysis_doc = {
            "_id": analysis_id,
            "submission_id": submission_id,
            "status": "completed",
            "tool_versions": self.get_tool_versions(),
            "summary": {
                "finding_count": finding_count,
                "error_count": error_count,
                "warning_count": warning_count,
                "info_count": info_count,
            },
            "findings": all_findings,
            "duration_ms": duration_ms,
            "created_at": now,
        }

        # Persist analysis
        self.analysis_repo.insert(analysis_doc)

        # Update submission status to completed
        self.submission_repo.update_status(submission_id, SubmissionStatus.COMPLETED.value)
        logger.info(f"Static analysis finished for submission {submission_id} in {duration_ms}ms with {finding_count} findings.")

        return self._to_response(analysis_doc)

    def get_analysis_for_submission(self, submission_id: str) -> Optional[AnalysisRunResponse]:
        doc = self.analysis_repo.find_by_submission_id(submission_id)
        if not doc:
            return None
        return self._to_response(doc)

    @staticmethod
    def _to_response(doc: dict) -> AnalysisRunResponse:
        summary_data = doc.get("summary", {})
        summary = AnalysisSummary(
            finding_count=summary_data.get("finding_count", 0),
            error_count=summary_data.get("error_count", 0),
            warning_count=summary_data.get("warning_count", 0),
            info_count=summary_data.get("info_count", 0),
        )

        findings: List[Finding] = []
        for raw_f in doc.get("findings", []):
            findings.append(Finding(
                finding_id=raw_f["finding_id"],
                tool=raw_f["tool"],
                rule_id=raw_f["rule_id"],
                category=FindingCategory(raw_f["category"]),
                severity=FindingSeverity(raw_f["severity"]),
                message=raw_f["message"],
                file=raw_f["file"],
                line=raw_f["line"],
                column=raw_f.get("column", 1),
                end_line=raw_f.get("end_line"),
                end_column=raw_f.get("end_column"),
                suggestion=raw_f.get("suggestion"),
            ))

        return AnalysisRunResponse(
            analysis_id=doc["_id"],
            submission_id=doc["submission_id"],
            status=doc.get("status", "completed"),
            tool_versions=doc.get("tool_versions", {}),
            summary=summary,
            findings=findings,
            duration_ms=doc.get("duration_ms", 0),
            created_at=doc["created_at"],
        )


analysis_service = AnalysisService()
