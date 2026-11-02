import ast
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List

from app.core.logging import logger


class ASTAnalyzer:
    name: str = "ast"
    version: str = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    def analyze(self, source_path: str, display_filename: str = "") -> List[Dict[str, Any]]:
        findings: List[Dict[str, Any]] = []
        path_obj = Path(source_path)
        rel_name = display_filename or path_obj.name

        try:
            with open(path_obj, "r", encoding="utf-8", errors="replace") as f:
                code_content = f.read()
        except Exception as err:
            logger.error(f"ASTAnalyzer could not read {source_path}: {err}")
            return findings

        # 1. Check syntax errors
        try:
            tree = ast.parse(code_content, filename=rel_name)
        except SyntaxError as err:
            findings.append({
                "finding_id": str(uuid.uuid4()),
                "tool": self.name,
                "rule_id": "AST_SYNTAX_ERROR",
                "category": "correctness",
                "severity": "error",
                "message": f"SyntaxError: {err.msg}",
                "file": rel_name,
                "line": err.lineno or 1,
                "column": err.offset or 1,
                "end_line": err.end_lineno,
                "end_column": err.end_offset,
                "suggestion": "Check for missing colons, unbalanced brackets, or unclosed string literals.",
            })
            return findings

        # 2. Walk AST to detect design, maintainability, and security patterns
        class LintVisitor(ast.NodeVisitor):
            def __init__(self, tool_name: str, file_label: str):
                self.tool_name = tool_name
                self.file_label = file_label
                self.found: List[Dict[str, Any]] = []
                self.loop_depth = 0

            def visit_ImportFrom(self, node: ast.ImportFrom):
                for alias in node.names:
                    if alias.name == "*":
                        mod_name = node.module or "..."
                        self.found.append({
                            "finding_id": str(uuid.uuid4()),
                            "tool": self.tool_name,
                            "rule_id": "AST_WILDCARD_IMPORT",
                            "category": "maintainability",
                            "severity": "warning",
                            "message": f"Wildcard import 'from {mod_name} import *' pollutes namespace.",
                            "file": self.file_label,
                            "line": node.lineno,
                            "column": node.col_offset + 1,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                            "end_column": getattr(node, "end_col_offset", None),
                            "suggestion": "Explicitly import required names instead of using '*'.",
                        })
                self.generic_visit(node)

            def visit_ExceptHandler(self, node: ast.ExceptHandler):
                is_bare = node.type is None
                is_pass = False
                if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    is_pass = True

                if is_bare or is_pass:
                    self.found.append({
                        "finding_id": str(uuid.uuid4()),
                        "tool": self.tool_name,
                        "rule_id": "AST_SILENT_EXCEPT",
                        "category": "maintainability",
                        "severity": "warning",
                        "message": "Empty or bare exception handler silently suppresses exceptions.",
                        "file": self.file_label,
                        "line": node.lineno,
                        "column": node.col_offset + 1,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "end_column": getattr(node, "end_col_offset", None),
                        "suggestion": "Catch specific exception types and log or re-raise errors instead of using 'pass'.",
                    })
                self.generic_visit(node)

            def visit_Call(self, node: ast.Call):
                # Check eval/exec call
                if isinstance(node.func, ast.Name) and node.func.id in {"eval", "exec"}:
                    self.found.append({
                        "finding_id": str(uuid.uuid4()),
                        "tool": self.tool_name,
                        "rule_id": "AST_DYNAMIC_EXECUTION",
                        "category": "security",
                        "severity": "error",
                        "message": f"Use of dynamic evaluation function '{node.func.id}()' is hazardous.",
                        "file": self.file_label,
                        "line": node.lineno,
                        "column": node.col_offset + 1,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "end_column": getattr(node, "end_col_offset", None),
                        "suggestion": "Avoid eval() and exec(); parse input with safe structured formats like ast.literal_eval or json.loads.",
                    })
                self.generic_visit(node)

            def visit_FunctionDef(self, node: ast.FunctionDef):
                num_args = len(node.args.args)
                if num_args > 6:
                    self.found.append({
                        "finding_id": str(uuid.uuid4()),
                        "tool": self.tool_name,
                        "rule_id": "AST_TOO_MANY_ARGS",
                        "category": "complexity",
                        "severity": "warning",
                        "message": f"Function '{node.name}' has {num_args} parameters (threshold: 6).",
                        "file": self.file_label,
                        "line": node.lineno,
                        "column": node.col_offset + 1,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "end_column": getattr(node, "end_col_offset", None),
                        "suggestion": "Refactor parameter list into a dataclass, dictionary, or configuration object.",
                    })
                self.generic_visit(node)

            def visit_For(self, node: ast.For):
                self.loop_depth += 1
                if self.loop_depth >= 4:
                    self.found.append({
                        "finding_id": str(uuid.uuid4()),
                        "tool": self.tool_name,
                        "rule_id": "AST_DEEP_LOOP_NESTING",
                        "category": "complexity",
                        "severity": "warning",
                        "message": f"Deeply nested loop structure (depth {self.loop_depth}). High time complexity risk.",
                        "file": self.file_label,
                        "line": node.lineno,
                        "column": node.col_offset + 1,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "end_column": getattr(node, "end_col_offset", None),
                        "suggestion": "Extract inner loop logic into a helper function or optimize with list comprehensions/generators.",
                    })
                self.generic_visit(node)
                self.loop_depth -= 1

            def visit_While(self, node: ast.While):
                self.loop_depth += 1
                if self.loop_depth >= 4:
                    self.found.append({
                        "finding_id": str(uuid.uuid4()),
                        "tool": self.tool_name,
                        "rule_id": "AST_DEEP_LOOP_NESTING",
                        "category": "complexity",
                        "severity": "warning",
                        "message": f"Deeply nested loop structure (depth {self.loop_depth}).",
                        "file": self.file_label,
                        "line": node.lineno,
                        "column": node.col_offset + 1,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "end_column": getattr(node, "end_col_offset", None),
                        "suggestion": "Extract nested loop logic into dedicated helper functions.",
                    })
                self.generic_visit(node)
                self.loop_depth -= 1

        visitor = LintVisitor(self.name, rel_name)
        visitor.visit(tree)
        findings.extend(visitor.found)
        return findings
