"""
Utility to generate standardized demo project archives for CodeOrigin AI.
"""

import zipfile
from pathlib import Path


def generate_demo_zip():
    project_root = Path(__file__).resolve().parent.parent.parent
    out_path = project_root / "fixtures" / "demo" / "sample_project.zip"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "README.md",
            "# Multi-File Math Parser\nStudent demo multi-file project for CodeOrigin AI analysis.\n",
        )
        zf.writestr(
            "main.py",
            '''"""CLI Entry point for student application."""
from calculator.core import Engine
from calculator.formatter import format_result


def run():
    engine = Engine()
    val = engine.compute("3 + 7")
    print(format_result(val))


if __name__ == "__main__":
    run()
''',
        )
        zf.writestr(
            "calculator/__init__.py",
            '"""Calculator package."""\n__version__ = "1.0.0"\n',
        )
        zf.writestr(
            "calculator/core.py",
            '''"""Core evaluation engine."""
import ast
import operator
from calculator.operations import OPERATORS


class Engine:
    def __init__(self):
        self.ops = OPERATORS

    def compute(self, expr: str) -> float:
        tree = ast.parse(expr, mode="eval")
        return self._walk(tree.body)

    def _walk(self, node):
        if isinstance(node, ast.Constant):
            return float(node.value)
        elif isinstance(node, ast.BinOp):
            l = self._walk(node.left)
            r = self._walk(node.right)
            op_fn = self.ops.get(type(node.op))
            if op_fn:
                return op_fn(l, r)
        raise ValueError("Invalid expression")
''',
        )
        zf.writestr(
            "calculator/operations.py",
            '''"""Supported operators map."""
import ast
import operator

OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}
''',
        )
        zf.writestr(
            "calculator/formatter.py",
            '''"""Output formatting utilities."""


def format_result(value: float, decimal_places: int = 2) -> str:
    return f"Result: {value:.{decimal_places}f}"
''',
        )

    print(f"Successfully generated demo archive: {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    generate_demo_zip()
