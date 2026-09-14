"""Apply exact artifact reviews without suppressing changed bytes or other rules.
Exports: reviewed_artifact. Dependencies: SHA-256 and the installed review registry.
"""
import hashlib
import json
from pathlib import Path
from .model import Finding

REGISTRY = Path(__file__).resolve().parents[1] / 'artifact-reviews.json'


def reviewed_artifact(root: Path, findings: list[Finding]) -> list[Finding]:
    if not REGISTRY.is_file():
        return findings
    reviews = json.loads(REGISTRY.read_text())
    remaining = []
    hashes: dict[str, str] = {}
    for finding in findings:
        matches = [row for row in reviews if row['rule'] == finding.rule
                   and row['path'] == finding.path and finding.line in row['lines']]
        path = root / finding.path
        if not matches or not path.is_file() or path.is_symlink():
            remaining.append(finding)
            continue
        if finding.path not in hashes:
            hashes[finding.path] = hashlib.sha256(path.read_bytes()).hexdigest()
        if not any(row['sha256'] == hashes[finding.path] for row in matches):
            remaining.append(finding)
    return remaining
