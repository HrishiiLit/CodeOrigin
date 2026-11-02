import difflib
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.core.errors import ResourceNotFoundError
from app.core.logging import logger
from app.repositories.comparison_repository import (
    ComparisonRepository,
    comparison_repository,
)
from app.repositories.submission_repository import (
    SubmissionRepository,
    submission_repository,
)
from app.schemas.comparison import ComparisonResponse, ComparisonSummary
from app.services.storage_service import StorageService, storage_service


class ComparisonService:
    def __init__(
        self,
        comp_repo: Optional[ComparisonRepository] = None,
        sub_repo: Optional[SubmissionRepository] = None,
        storage: Optional[StorageService] = None,
    ):
        self.comp_repo = comp_repo or comparison_repository
        self.sub_repo = sub_repo or submission_repository
        self.storage = storage or storage_service

    def compare_submissions(
        self,
        base_submission_id: str,
        target_submission_id: str,
    ) -> ComparisonResponse:
        base_sub = self.sub_repo.find_by_id(base_submission_id)
        if not base_sub:
            raise ResourceNotFoundError(resource_type="Base submission", resource_id=base_submission_id)

        target_sub = self.sub_repo.find_by_id(target_submission_id)
        if not target_sub:
            raise ResourceNotFoundError(resource_type="Target submission", resource_id=target_submission_id)

        base_key = base_sub.get("storage_key")
        target_key = target_sub.get("storage_key")

        base_is_dir = self.storage._resolve_safe_path(base_key).is_dir()
        target_is_dir = self.storage._resolve_safe_path(target_key).is_dir()

        diff_chunks: List[str] = []
        total_added = 0
        total_removed = 0
        changed_files_count = 0

        if not base_is_dir and not target_is_dir:
            # Single file comparison
            base_text = self.storage.read_text(base_key)
            target_text = self.storage.read_text(target_key)
            base_filename = base_sub.get("original_filename", "base.py")
            target_filename = target_sub.get("original_filename", "target.py")

            diff_lines, added, removed = self._compute_diff(
                base_text, target_text, base_filename, target_filename
            )
            if diff_lines:
                diff_chunks.append("\n".join(diff_lines))
                changed_files_count = 1
                total_added += added
                total_removed += removed
        else:
            # Multi-file repository comparison
            base_tree = self.storage.scan_repository_tree(base_key)
            target_tree = self.storage.scan_repository_tree(target_key)

            base_files = set(base_tree.get("source_files", []))
            target_files = set(target_tree.get("source_files", []))
            all_files = sorted(list(base_files | target_files))

            for rel_path in all_files:
                base_text = ""
                target_text = ""
                in_base = rel_path in base_files
                in_target = rel_path in target_files

                if in_base:
                    try:
                        base_text = self.storage.read_text(base_key, relative_file_path=rel_path)
                    except Exception:
                        base_text = ""

                if in_target:
                    try:
                        target_text = self.storage.read_text(target_key, relative_file_path=rel_path)
                    except Exception:
                        target_text = ""

                from_name = f"a/{rel_path}" if in_base else "/dev/null"
                to_name = f"b/{rel_path}" if in_target else "/dev/null"

                diff_lines, added, removed = self._compute_diff(
                    base_text, target_text, from_name, to_name
                )

                if diff_lines:
                    changed_files_count += 1
                    total_added += added
                    total_removed += removed
                    diff_chunks.append("\n".join(diff_lines))

        full_diff = "\n\n".join(diff_chunks) if diff_chunks else "# No differences detected between revisions."
        comp_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        comparison_doc = {
            "_id": comp_id,
            "base_submission_id": base_submission_id,
            "target_submission_id": target_submission_id,
            "summary": {
                "added_lines": total_added,
                "removed_lines": total_removed,
                "changed_files": changed_files_count,
            },
            "diff": full_diff,
            "created_at": now,
        }

        self.comp_repo.insert(comparison_doc)
        logger.info(
            f"Compared revisions ({base_submission_id} vs {target_submission_id}): "
            f"+{total_added}/-{total_removed} across {changed_files_count} files."
        )

        return self._to_response(comparison_doc)

    def get_comparison(self, comparison_id: str) -> ComparisonResponse:
        doc = self.comp_repo.find_by_id(comparison_id)
        if not doc:
            raise ResourceNotFoundError(resource_type="Comparison", resource_id=comparison_id)
        return self._to_response(doc)

    @staticmethod
    def _compute_diff(
        base_text: str,
        target_text: str,
        from_label: str,
        to_label: str,
    ) -> Tuple[List[str], int, int]:
        base_lines = base_text.splitlines(keepends=True)
        target_lines = target_text.splitlines(keepends=True)

        diff = list(difflib.unified_diff(
            base_lines,
            target_lines,
            fromfile=from_label,
            tofile=to_label,
            lineterm="",
        ))

        added = 0
        removed = 0
        for line in diff:
            if line.startswith("+") and not line.startswith("+++"):
                added += 1
            elif line.startswith("-") and not line.startswith("---"):
                removed += 1

        # Strip line breaks for normalized string join
        cleaned_diff = [line.rstrip("\r\n") for line in diff]
        return cleaned_diff, added, removed

    @staticmethod
    def _to_response(doc: dict) -> ComparisonResponse:
        summary_data = doc.get("summary", {})
        return ComparisonResponse(
            comparison_id=doc["_id"],
            base_submission_id=doc["base_submission_id"],
            target_submission_id=doc["target_submission_id"],
            summary=ComparisonSummary(
                added_lines=summary_data.get("added_lines", 0),
                removed_lines=summary_data.get("removed_lines", 0),
                changed_files=summary_data.get("changed_files", 0),
            ),
            diff=doc.get("diff", ""),
            created_at=doc["created_at"],
        )


comparison_service = ComparisonService()
