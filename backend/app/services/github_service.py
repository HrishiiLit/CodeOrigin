import re
import urllib.parse
from typing import Optional, Tuple
import httpx

from app.core.config import settings
from app.core.errors import AppException, ResourceNotFoundError
from app.core.logging import logger


class GitHubService:
    @staticmethod
    def parse_github_url(url: str) -> Tuple[str, str, Optional[str]]:
        """
        Parses GitHub URLs like:
          - https://github.com/owner/repo
          - https://github.com/owner/repo.git
          - https://github.com/owner/repo/tree/branch-or-tag
        Returns (owner, repo, ref)
        """
        clean_url = url.strip()
        parsed = urllib.parse.urlparse(clean_url)
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]

        parts = path.split("/")
        if len(parts) < 2:
            raise AppException(
                code="INVALID_GITHUB_URL",
                message=f"Invalid GitHub repository URL: '{url}'. Expected format: https://github.com/owner/repo",
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


github_service = GitHubService()
