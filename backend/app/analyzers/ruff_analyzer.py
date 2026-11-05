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


class RuffAnalyzer:
    name: str = "ruff"

    def __init__(self):
        self._executable = self._find_executable()
        self.version = self._detect_version()

    def _find_executable(self) -> str:
        # Check venv Scripts or bin
        venv_scripts = Path(sys.executable).parent / ("ruff.exe" if os.name == "nt" else "ruff")
        if venv_scripts.exists():
            return str(venv_scripts)

        which_path = shutil.which("ruff")
        if which_path:
            return which_path

        return "ruff"

    def _detect_version(self) -> str:
        try:
            res = subprocess.run([self._executable, "--version"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                # Output like 'ruff 0.4.0'
                parts = res.stdout.strip().split()
                return parts[1] if len(parts) > 1 else parts[0]
        except Exception as e:
            logger.warning(f"Could not determine ruff version: {e}")
        return "0.4.0"

    def analyze(self, source_path: str, display_filename: str = "") -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        path_obj = Path(source_path)
        rel_name = display_filename or path_obj.name

        cmd = [
            self._executable,
            "check",
            "--output-format=json",
            "--no-cache",
            "--isolated",
            str(path_obj.resolve()),
        ]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.ANALYSIS_TIMEOUT_SECONDS,
            )
            # Ruff returns exit code 1 if lint findings are present
            raw_output = res.stdout.strip()
            if not raw_output:
                return findings

            data = json.loads(raw_output)
            if not isinstance(data, list):
                return findings

            for item in data:
                code = item.get("code") or "RUFF_LINT"
                message = item.get("message", "Lint finding")
                location = item.get("location", {})
                end_location = item.get("end_location", {})
                line = location.get("row", 1)
                col = location.get("column", 1)
                end_line = end_location.get("row")
                end_col = end_location.get("column")

                # Category & Severity mapping
                category, severity = self._map_rule(code)

                # Fix suggestion if available
                suggestion = None
                fix = item.get("fix")
                if fix and fix.get("applicability") in {"Automatic", "Suggested"}:
                    suggestion = fix.get("message")

                findings.append({
                    "finding_id": str(uuid.uuid4()),
                    "tool": self.name,
                    "rule_id": code,
                    "category": category,
                    "severity": severity,
                    "message": message,
                    "file": rel_name,
                    "line": line,
                    "column": col,
                    "end_line": end_line,
                    "end_column": end_col,
                    "suggestion": suggestion or f"Review Ruff rule {code} for best practices.",
                })

        except subprocess.TimeoutExpired:
            logger.error(f"Ruff analysis timed out for {source_path}")
            findings.append({
                "finding_id": str(uuid.uuid4()),
                "tool": self.name,
                "rule_id": "RUFF_TIMEOUT",
                "category": "maintainability",
                "severity": "warning",
                "message": "Ruff linter execution exceeded bounded time limit.",
                "file": rel_name,
                "line": 1,
                "column": 1,
                "suggestion": "Check file size or complexity.",
            })
        except Exception as err:
            logger.error(f"Ruff analyzer error on {source_path}: {err}", exc_info=True)

        return findings

    @staticmethod
    def _map_rule(code: str) -> tuple[str, str]:
        if code.startswith("E999") or code.startswith("F82"):
            return "correctness", "error"
        if code.startswith("S"):
            return "security", "warning"
        if code.startswith("C") or code.startswith("SIM"):
            return "complexity", "warning"
        if code.startswith("F"):
            return "maintainability", "warning"
        if code.startswith("E") or code.startswith("W"):
            return "style", "info"
        return "maintainability", "info"
