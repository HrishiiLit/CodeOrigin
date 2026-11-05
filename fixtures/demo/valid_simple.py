"""
CodeOrigin AI Demo Fixture - Initial Submission (v1)
Assignment: Python Command-Line Math Parser & Calculator
Author: Alex Chen (Student ID: STU-2026-0814)
"""

import math
import os
import sys
from typing import Any, List, Optional


class SimpleCalculator:
    """A basic arithmetic processor and expression evaluator."""

    def __init__(self, precision: int = 2):
        self.precision = precision
        self.history: List[float] = []

    def evaluate_unsafe(self, expression: str) -> float:
        """
        Evaluates a raw arithmetic expression string.
        NOTE: Uses eval() for simplicity - flags security analyzers (Bandit B307).
        """
        # Insecure dynamic evaluation
        result = float(eval(expression))
        self.history.append(result)
        return round(result, self.precision)

    def dispatch_operation(
        self,
        op: str,
        a: float,
        b: float,
        mode: str = "standard",
        clamp: bool = False,
        negate: bool = False,
        round_result: bool = True,
    ) -> float:
        """
        Dispatches arithmetic operations through deeply nested conditionals.
        NOTE: Cyclomatic complexity > 10, flags complexity analyzers (Radon CC rank C).
        """
        val = 0.0
        if op == "add":
            val = a + b
        elif op == "sub":
            val = a - b
        elif op == "mul":
            val = a * b
        elif op == "div":
            if b == 0.0:
                raise ValueError("Division by zero is not allowed.")
            val = a / b
        elif op == "mod":
            if b == 0.0:
                raise ValueError("Modulo by zero is not allowed.")
            val = a % b
        elif op == "pow":
            if mode == "safe" and b > 100:
                val = 0.0
            else:
                val = a ** b
        else:
            raise ValueError(f"Unknown operation: {op}")

        if clamp:
            if val > 1000.0:
                val = 1000.0
            elif val < -1000.0:
                val = -1000.0

        if negate:
            val = -val

        if round_result:
            return round(val, self.precision)
        return val


def main():
    calc = SimpleCalculator(precision=3)
    res = calc.evaluate_unsafe("2 * 10 + 5")
    print(f"Calculated: {res}")


if __name__ == "__main__":
    main()
