from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.core.database import DatabaseManager, get_db
from app.repositories.analysis_repository import analysis_repository
from app.repositories.audit_repository import audit_repository
from app.repositories.comparison_repository import comparison_repository
from app.repositories.review_repository import review_repository
from app.repositories.submission_repository import submission_repository
from app.schemas.admin import (
    AdminOverviewResponse,
    AnalysisStats,
    AuditEventItem,
    ComparisonStats,
    ReviewStats,
    SubmissionsStats,
    SystemStats,
)


class AdminService:
    @staticmethod
    def _fetch_all(repo) -> List[dict]:
        col = getattr(repo, "_collection", None)
        if col is not None:
            try:
                return list(col.find())
            except Exception:
                pass
        store = getattr(repo, "_store", None)
        if store is not None:
            return store.values()
        return []

    def get_overview_stats(self) -> AdminOverviewResponse:
        # 1. Submissions
        submissions = self._fetch_all(submission_repository)
        sub_total = len(submissions)
        sub_files = sum(1 for s in submissions if s.get("submission_type") == "file")
        sub_repos = sum(1 for s in submissions if s.get("submission_type") == "repository")
        sub_status = dict(Counter(str(s.get("status", "unknown")) for s in submissions))
        sub_bytes = sum(int(s.get("size_bytes", 0)) for s in submissions)
        unique_students = len(set(s.get("owner_id") for s in submissions if s.get("owner_id")))
        unique_projects = len(set(s.get("project_id") for s in submissions if s.get("project_id")))

        submissions_stats = SubmissionsStats(
            total=sub_total,
            files=sub_files,
            repositories=sub_repos,
            by_status=sub_status,
            total_storage_bytes=sub_bytes,
            unique_students=unique_students,
            unique_projects=unique_projects,
        )

        # 2. Static Analysis
        analyses = self._fetch_all(analysis_repository)
        analysis_runs = len(analyses)
        all_findings = []
        durations = []
        for a in analyses:
            findings = a.get("findings", [])
            all_findings.extend(findings)
            if "duration_ms" in a and isinstance(a["duration_ms"], (int, float)):
                durations.append(a["duration_ms"])

        total_findings = len(all_findings)
        by_severity = dict(Counter(str(f.get("severity", "unknown")).lower() for f in all_findings))
        by_tool = dict(Counter(str(f.get("tool", "unknown")).lower() for f in all_findings))
        by_category = dict(Counter(str(f.get("category", "unknown")).lower() for f in all_findings))
        avg_dur = round(sum(durations) / len(durations), 1) if durations else 0.0

        analysis_stats = AnalysisStats(
            total_runs=analysis_runs,
            total_findings=total_findings,
            by_severity=by_severity,
            by_tool=by_tool,
            by_category=by_category,
            avg_duration_ms=avg_dur,
        )

        # 3. Faculty Reviews
        reviews = self._fetch_all(review_repository)
        total_reviews = len(reviews)
        unique_reviewers = len(set(r.get("author_id") for r in reviews if r.get("author_id")))

        review_stats = ReviewStats(
            total_reviews=total_reviews,
            unique_reviewers=unique_reviewers,
        )

        # 4. Comparisons
        comparisons = self._fetch_all(comparison_repository)
        comp_total = len(comparisons)
        total_added = sum(int(c.get("summary", {}).get("added_lines", 0)) for c in comparisons)
        total_removed = sum(int(c.get("summary", {}).get("removed_lines", 0)) for c in comparisons)

        comparison_stats = ComparisonStats(
            total_comparisons=comp_total,
            total_added_lines=total_added,
            total_removed_lines=total_removed,
        )

        # 5. System Health
        db_status = "connected" if DatabaseManager.is_connected() else "persistent_file_store"
        system_stats = SystemStats(
            api="up",
            database=db_status,
            version="0.1.0",
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        # 6. Audit Trail
        raw_events = audit_repository.list_events(limit=25)
        recent_activity: List[AuditEventItem] = []
        for ev in raw_events:
            recent_activity.append(
                AuditEventItem(
                    event_id=ev.get("event_id", str(ev.get("_id", ""))),
                    action=ev.get("action", "UNKNOWN_ACTION"),
                    actor_id=ev.get("actor_id", "system"),
                    details=ev.get("details", {}),
                    created_at=str(ev.get("created_at", "")),
                )
            )

        return AdminOverviewResponse(
            submissions=submissions_stats,
            analysis=analysis_stats,
            reviews=review_stats,
            comparisons=comparison_stats,
            system=system_stats,
            recent_activity=recent_activity,
        )


admin_service = AdminService()
