"""Define redacted findings and checked subprocess boundaries.
Exports: Finding, git, emit. Dependencies: Python standard library.
"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import subprocess


@dataclass(frozen=True)
class Finding:
    rule: str
    path: str
    line: int = 0


def git(repo: Path, *args: str) -> bytes:
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise RuntimeError('git operation failed: ' + args[0])
    return result.stdout


def emit(findings: list[Finding]) -> int:
    print(json.dumps({'status': 'blocked' if findings else 'passed',
                      'findings': [asdict(item) for item in findings]}))
    return 1 if findings else 0
