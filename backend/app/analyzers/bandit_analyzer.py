import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List

from app.core.config import settings
from app.core.logging import logger


class BanditAnalyzer:
    name: str = "bandit"

    def __init__(self):
        self._executable = self._find_executable()
        self.version = self._detect_version()

    def _find_executable(self) -> str:
        venv_scripts = Path(sys.executable).parent / ("bandit.exe" if os.name == "nt" else "bandit")
        if venv_scripts.exists():
            return str(venv_scripts)

        which_path = shutil.which("bandit")
        if which_path:
            return which_path

        return "bandit"

    def _detect_version(self) -> str:
        try:
            res = subprocess.run([self._executable, "--version"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                # Output like 'bandit 1.9.4\n...'
                parts = res.stdout.strip().split()
                return parts[1] if len(parts) > 1 else parts[0]
        except Exception as e:
            logger.warning(f"Could not determine bandit version: {e}")
        return "1.9.4"

    def analyze(self, source_path: str, display_filename: str = "") -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        path_obj = Path(source_path)
        rel_name = display_filename or path_obj.name

        cmd = [
            self._executable,
            "-f",
            "json",
            "-q",
            str(path_obj.resolve()),
        ]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.ANALYSIS_TIMEOUT_SECONDS,
            )
            raw_output = res.stdout.strip()
            if not raw_output:
                return findings

            data = json.loads(raw_output)
            results = data.get("results", [])

            for issue in results:
                test_id = issue.get("test_id", "BANDIT_SEC")
                issue_text = issue.get("issue_text", "Security issue detected")
                raw_severity = issue.get("issue_severity", "MEDIUM").upper()
                line = issue.get("line_number", 1)
                more_info = issue.get("more_info")

                severity = "error" if raw_severity == "HIGH" else "warning" if raw_severity == "MEDIUM" else "info"

                findings.append({
                    "finding_id": str(uuid.uuid4()),
                    "tool": self.name,
                    "rule_id": test_id,
                    "category": "security",
                    "severity": severity,
                    "message": issue_text,
                    "file": rel_name,
                    "line": line,
                    "column": issue.get("col_offset", 1) + 1 if "col_offset" in issue else 1,
                    "end_line": line,
                    "end_column": issue.get("end_col_offset"),
                    "suggestion": f"Refer to Bandit security guidance: {more_info}" if more_info else "Review potential security vulnerability.",
                })

        except subprocess.TimeoutExpired:
            logger.error(f"Bandit analysis timed out for {source_path}")
            findings.append({
                "finding_id": str(uuid.uuid4()),
                "tool": self.name,
                "rule_id": "BANDIT_TIMEOUT",
                "category": "security",
                "severity": "warning",
                "message": "Bandit security scanner execution exceeded bounded time limit.",
                "file": rel_name,
                "line": 1,
                "column": 1,
                "suggestion": "Check file size or reduce scope of analysis.",
            })
        except Exception as err:
            logger.error(f"Bandit analyzer error on {source_path}: {err}", exc_info=True)

        return findings
