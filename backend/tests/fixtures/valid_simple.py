"""
Simple, clean Python module for testing CodeOrigin AI submission and static analysis.
"""

def calculate_factorial(n: int) -> int:
    """Computes factorial of a non-negative integer iteratively."""
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers.")
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


if __name__ == "__main__":
    print(f"5! = {calculate_factorial(5)}")
