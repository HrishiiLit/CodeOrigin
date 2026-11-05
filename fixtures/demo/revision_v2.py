"""
CodeOrigin AI Demo Fixture - Refactored Revision (v2)
Assignment: Python Command-Line Math Parser & Calculator
Author: Alex Chen (Student ID: STU-2026-0814)

Changes from v1:
- Removed unused imports (math, os, sys).
- Replaced insecure eval() with safe AST-based literal arithmetic evaluator.
- Refactored high-complexity dispatcher into dictionary lookup (Radon CC rank A).
- Added comprehensive docstrings and structured error handling.
"""

import ast
import operator
from typing import Callable, Dict, List


# Safe operator lookup map replacing branching logic
SAFE_OPERATORS: Dict[type, Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

OPERATION_NAMES: Dict[str, Callable[[float, float], float]] = {
    "add": operator.add,
    "sub": operator.sub,
    "mul": operator.mul,
    "div": operator.truediv,
    "mod": operator.mod,
    "pow": operator.pow,
}


class SafeCalculator:
    """A hardened arithmetic processor with safe AST expression parsing."""

    def __init__(self, precision: int = 2):
        self.precision = precision
        self.history: List[float] = []

    def evaluate_safe(self, expression: str) -> float:
        """
        Safely evaluates arithmetic expressions using Python AST nodes.
        Completely eliminates arbitrary code execution risks (Bandit clean).
        """
        tree = ast.parse(expression, mode="eval")
        result = self._eval_node(tree.body)
        rounded = round(result, self.precision)
        self.history.append(rounded)
        return rounded

    def _eval_node(self, node: ast.AST) -> float:
        """Recursive AST arithmetic evaluator allowing only numeric literals and safe ops."""
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        elif isinstance(node, ast.BinOp):
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            op_type = type(node.op)
            if op_type in SAFE_OPERATORS:
                if op_type in (ast.Div, ast.Mod) and right == 0.0:
                    raise ZeroDivisionError("Cannot divide or modulo by zero.")
                return SAFE_OPERATORS[op_type](left, right)
            raise ValueError(f"Unsupported operator: {op_type.__name__}")
        raise ValueError(f"Disallowed expression node: {type(node).__name__}")

    def dispatch_operation(self, op: str, a: float, b: float) -> float:
        """
        Dispatches arithmetic operations via dictionary lookup.
        Refactored: Cyclomatic complexity score: 2 (Rank A).
        """
        handler = OPERATION_NAMES.get(op.lower())
        if not handler:
            raise ValueError(f"Unknown operation: {op}")
        if op.lower() in ("div", "mod") and b == 0.0:
            raise ZeroDivisionError(f"Operation '{op}' cannot be performed with divisor zero.")
        return round(handler(a, b), self.precision)


def main():
    calc = SafeCalculator(precision=3)
    res = calc.evaluate_safe("2 * 10 + 5")
    print(f"Safely Calculated: {res}")


if __name__ == "__main__":
    main()
