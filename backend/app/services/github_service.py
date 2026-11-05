import re
import urllib.parse
from datetime import datetime, timezone
from typing import List, Optional, Tuple
import httpx

from app.core.config import settings
from app.core.errors import AppException, ResourceNotFoundError
from app.core.logging import logger
from app.repositories.analysis_repository import analysis_repository
from app.repositories.audit_repository import audit_repository
from app.repositories.submission_repository import submission_repository
from app.schemas.github_issue import (
    CreateIssueResponse,
    IssueDraftResponse,
)


class GitHubService:
    @staticmethod
    def parse_github_url(url: str) -> Tuple[str, str, Optional[str]]:
        """
        Parses GitHub URLs like:
          - https://github.com/owner/repo
          - https://github.com/owner/repo.git
          - https://github.com/owner/repo/tree/branch-or-tag
          - owner/repo
        Returns (owner, repo, ref)
        """
        clean_url = url.strip()
        if not clean_url:
            raise AppException(
                code="INVALID_GITHUB_URL",
                message="GitHub repository URL cannot be empty.",
                status_code=400,
            )

        # Allow plain "owner/repo" format
        if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
            parts = clean_url.strip("/").split("/")
            if len(parts) == 2 and parts[0] and parts[1]:
                repo_name = parts[1][:-4] if parts[1].endswith(".git") else parts[1]
                return parts[0], repo_name, None

        parsed = urllib.parse.urlparse(clean_url)
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]

        parts = path.split("/")
        if len(parts) < 2 or not parts[0] or not parts[1]:
            raise AppException(
                code="INVALID_GITHUB_URL",
                message=f"Invalid GitHub repository URL: '{url}'. Expected format: https://github.com/owner/repo or owner/repo",
                status_code=400,
            )

        owner = parts[0]
        repo = parts[1]
        ref = None

        if len(parts) >= 4 and parts[2] == "tree":
            ref = "/".join(parts[3:])

        return owner, repo, ref

    @classmethod
    async def fetch_repository_archive(
        cls,
        repo_url: str,
        ref: Optional[str] = None,
    ) -> Tuple[bytes, str, str]:
        """
        Downloads a GitHub repository archive (zipball).
        Returns (zip_bytes, archive_filename, default_display_name).
        """
        owner, repo, url_ref = cls.parse_github_url(repo_url)
        target_ref = ref or url_ref or "HEAD"

        archive_url = f"https://api.github.com/repos/{owner}/{repo}/zipball/{target_ref}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "CodeOrigin-AI-Evaluator",
        }
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

        logger.info(f"Fetching GitHub archive for {owner}/{repo} (ref: {target_ref})...")

        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            try:
                response = await client.get(archive_url, headers=headers)
            except httpx.RequestError as err:
                logger.error(f"GitHub network request failed: {err}")
                raise AppException(
                    code="GITHUB_NETWORK_ERROR",
                    message=f"Failed to communicate with GitHub: {str(err)}",
                    status_code=502,
                )

        if response.status_code == 404:
            raise ResourceNotFoundError(
                resource_type="GitHub repository or ref",
                resource_id=f"{owner}/{repo}@{target_ref}",
            )
        elif response.status_code == 401 or response.status_code == 403:
            raise AppException(
                code="GITHUB_AUTH_ERROR",
                message=f"Access denied by GitHub (status {response.status_code}). Provide a valid GITHUB_TOKEN if the repository is private or rate-limited.",
                status_code=response.status_code,
            )
        elif response.status_code != 200:
            raise AppException(
                code="GITHUB_API_ERROR",
                message=f"GitHub API returned error status {response.status_code}",
                status_code=response.status_code,
            )

        archive_bytes = response.content
        if len(archive_bytes) == 0:
            raise AppException(
                code="EMPTY_ARCHIVE",
                message="GitHub returned an empty archive.",
                status_code=400,
            )

        archive_filename = f"{owner}_{repo}_{target_ref}.zip"
        display_name = f"{owner}/{repo} ({target_ref})"

        return archive_bytes, archive_filename, display_name

    @classmethod
    def prepare_issue_draft(
        cls,
        submission_id: str,
        finding_ids: Optional[List[str]] = None,
        repository_url: Optional[str] = None,
        custom_title: Optional[str] = None,
        custom_notes: Optional[str] = None,
    ) -> IssueDraftResponse:
        """
        Builds a structured GitHub Issue draft from selected static analysis findings.
        Does NOT make external write calls.
        """
        sub = submission_repository.find_by_id(submission_id)
        if not sub:
            raise ResourceNotFoundError(resource_type="Submission", resource_id=submission_id)

        # Resolve target repo
        target_repo_raw = repository_url or settings.GITHUB_DEFAULT_REPOSITORY
        if not target_repo_raw:
            meta_repo = sub.get("metadata", {}).get("github_repo")
            target_repo_raw = meta_repo or "owner/repository"

        owner, repo, _ = cls.parse_github_url(target_repo_raw)
        canonical_repo = f"{owner}/{repo}"

        analysis_doc = analysis_repository.find_by_submission_id(submission_id)
        findings_to_include = []
        if analysis_doc:
            all_findings = analysis_doc.get("findings", [])
            if finding_ids:
                finding_id_set = set(finding_ids)
                findings_to_include = [f for f in all_findings if f.get("finding_id") in finding_id_set]
            else:
                findings_to_include = all_findings

        orig_name = sub.get("original_filename", "submission.py")

        # Draft title
        count = len(findings_to_include)
        plural = "s" if count != 1 else ""
        if custom_title and custom_title.strip():
            title = custom_title.strip()
        else:
            title = f"[CodeOrigin Review] Static Analysis Findings for {orig_name} ({count} issue{plural})"

        # Draft markdown body
        lines = [
            "## 📋 CodeOrigin AI — Static Code Review Findings",
            "",
            f"- **Submission ID:** `{submission_id}`",
            f"- **Target Artifact:** `{orig_name}`",
            f"- **Total Selected Findings:** {count}",
            f"- **Draft Prepared:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            "",
        ]

        if custom_notes and custom_notes.strip():
            lines.extend([
                "### 📝 Reviewer Instructions & Context",
                custom_notes.strip(),
                "",
            ])

        if findings_to_include:
            lines.extend([
                "### 🔍 Finding Details",
                "",
            ])
            for idx, f in enumerate(findings_to_include, 1):
                sev = f.get("severity", "info").upper()
                rule = f.get("rule_id", "UNKNOWN")
                tool = f.get("tool", "STATIC").upper()
                file_path = f.get("file", orig_name)
                line_no = f.get("line", 1)
                msg = f.get("message", "No message provided.")
                sugg = f.get("suggestion")

                emoji = "🚨" if sev == "ERROR" else "⚠️" if sev == "WARNING" else "ℹ️"
                lines.append(f"#### {emoji} {idx}. [{sev}] `{tool}:{rule}` in `{file_path}:{line_no}`")
                lines.append(f"> **Details:** {msg}")
                if sugg:
                    lines.append(f"> **Suggested Fix:** `{sugg}`")
                lines.append("")
        else:
            lines.append("_No specific findings were selected for inclusion in this issue._\n")

        lines.extend([
            "---",
            "*(This issue was drafted and verified through CodeOrigin AI Faculty Review Hub)*",
        ])

        body = "\n".join(lines)

        return IssueDraftResponse(
            submission_id=submission_id,
            repository=canonical_repo,
            title=title,
            body=body,
            finding_count=count,
            selected_finding_ids=[f.get("finding_id", "") for f in findings_to_include if "finding_id" in f],
        )

    @classmethod
    async def create_issue(
        cls,
        submission_id: str,
        repository: str,
        title: str,
        body: str,
        confirmed: bool,
        actor_id: str = "demo-faculty",
        finding_ids: Optional[List[str]] = None,
    ) -> CreateIssueResponse:
        """
        Creates an issue on the target GitHub repository upon explicit reviewer approval.
        Enforces approval exit gate and logs audit event.
        """
        if not confirmed:
            raise AppException(
                code="EXPLICIT_APPROVAL_REQUIRED",
                message="Creating a GitHub issue requires explicit reviewer approval.",
                status_code=400,
            )

        owner, repo, _ = cls.parse_github_url(repository)
        canonical_repo = f"{owner}/{repo}"

        if not settings.GITHUB_TOKEN:
            raise AppException(
                code="GITHUB_TOKEN_NOT_CONFIGURED",
                message="Server GITHUB_TOKEN is not configured. Please supply a valid GitHub Personal Access Token in the .env file.",
                status_code=503,
            )

        api_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
            "User-Agent": "CodeOrigin-AI-Evaluator",
        }
        payload = {
            "title": title,
            "body": body,
            "labels": ["code-review", "codeorigin-ai"],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(api_url, json=payload, headers=headers)
            except httpx.RequestError as err:
                logger.error(f"GitHub issue creation network request failed: {err}")
                raise AppException(
                    code="GITHUB_NETWORK_ERROR",
                    message=f"Failed to communicate with GitHub API: {str(err)}",
                    status_code=502,
                )

        if response.status_code == 401:
            raise AppException(
                code="GITHUB_AUTH_ERROR",
                message="GitHub token is invalid or unauthorized.",
                status_code=401,
            )
        elif response.status_code == 403:
            raise AppException(
                code="GITHUB_PERMISSION_DENIED",
                message="GitHub permission denied or API rate limit exceeded.",
                status_code=403,
            )
        elif response.status_code == 404:
            raise ResourceNotFoundError(
                resource_type="GitHub repository",
                resource_id=canonical_repo,
            )
        elif response.status_code != 201:
            raise AppException(
                code="GITHUB_API_ERROR",
                message=f"GitHub API returned error status {response.status_code}: {response.text}",
                status_code=response.status_code,
            )

        data = response.json()
        issue_id = data.get("id", 0)
        issue_number = data.get("number", 0)
        issue_url = data.get("html_url", "")
        created_at = datetime.now(timezone.utc)

        # Audit logging requirement: record approver, timestamp, issue URL and status
        audit_repository.log_event(
            action="GITHUB_ISSUE_CREATED",
            actor_id=actor_id,
            details={
                "submission_id": submission_id,
                "repository": canonical_repo,
                "issue_number": issue_number,
                "issue_url": issue_url,
                "finding_count": len(finding_ids or []),
                "title": title,
            },
        )

        logger.info(f"GitHub issue #{issue_number} successfully created for submission {submission_id} on {canonical_repo}")

        return CreateIssueResponse(
            issue_id=issue_id,
            issue_number=issue_number,
            issue_url=issue_url,
            title=title,
            repository=canonical_repo,
            created_at=created_at,
            actor_id=actor_id,
            status="created",
        )


github_service = GitHubService()
