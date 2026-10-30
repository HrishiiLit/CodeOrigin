import subprocess

def dangerous_command(user_input: str):
    # Triggers Bandit B602 (subprocess_popen_with_shell_equals_true)
    subprocess.Popen(f"ls {user_input}", shell=True)
