import uuid
from pathlib import Path
from typing import Any, Dict, List
import radon
from radon.complexity import cc_visit, cc_rank

from app.core.logging import logger


class RadonAnalyzer:
    name: str = "radon"
    version: str = getattr(radon, "__version__", "6.0.1")

    def analyze(self, source_path: str, display_filename: str = "") -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        path_obj = Path(source_path)
        rel_name = display_filename or path_obj.name

        try:
            with open(path_obj, "r", encoding="utf-8", errors="replace") as f:
                code_content = f.read()
        except Exception as err:
            logger.error(f"RadonAnalyzer could not read {source_path}: {err}")
            return findings

        try:
            blocks = cc_visit(code_content)
        except Exception as err:
            logger.warning(f"Radon complexity parsing error in {source_path}: {err}")
            return findings

        for block in blocks:
            complexity = block.complexity
            rank = cc_rank(complexity)

            # Flag blocks with moderate-to-high complexity (rank C, D, E, F; score > 10)
            if complexity > 10 or rank in {"C", "D", "E", "F"}:
                severity = "error" if rank in {"E", "F"} else "warning"
                block_type = getattr(block, "letter", "F")
                label = "Function" if block_type == "F" else "Method" if block_type == "M" else "Class"

                findings.append({
                    "finding_id": str(uuid.uuid4()),
                    "tool": self.name,
                    "rule_id": f"RADON_CC_{rank}",
                    "category": "complexity",
                    "severity": severity,
                    "message": f"{label} '{block.name}' has high cyclomatic complexity (score: {complexity}, rank: {rank}).",
                    "file": rel_name,
                    "line": block.lineno,
                    "column": block.col_offset + 1,
                    "end_line": getattr(block, "endline", block.lineno),
                    "end_column": None,
                    "suggestion": "Decompose into smaller single-responsibility functions or simplify conditional logic.",
                })

        return findings
