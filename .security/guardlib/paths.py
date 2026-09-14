"""Detect publishable credential files and inspect public trees without following symlinks.
Exports: forbidden, inspect_tree, local_secrets. Dependencies: pathlib, regular expressions.
"""
import os
from pathlib import Path
import re
from .model import Finding

SENSITIVE_DIRS = {'.git', '.aws', '.ssh', '.gnupg', '.azure', '.kube', '.terraform'}
TEMPLATE_SUFFIXES = ('.example', '.sample', '.template')
SECRET_NAME = re.compile(r'(secret|password|passwd|private.?key|api.?key|access.?token|auth.?token|mnemonic|seed)', re.I)
MAX_FILE_BYTES = 128 * 1024 * 1024


def forbidden(path: str, artifact: bool) -> bool:
    parts = Path(path).parts
    name = Path(path).name.lower()
    if any(part.lower() in SENSITIVE_DIRS for part in parts):
        return True
    if name.startswith(('.env', '.dev.vars')):
        return artifact or not name.endswith(TEMPLATE_SUFFIXES)
    if artifact and name in {'.npmrc', '.pypirc'}:
        return True
    return (name in {'id_rsa', 'id_ed25519', '.netrc',
                     'gcloud-service-account.json', 'service-account.json', 'credentials.json'}
            or name.endswith(('.tfstate', '.tfstate.backup', '.p12', '.pfx', '.key', '.keystore')))


def local_secrets(repo: Path) -> list[bytes]:
    values: set[bytes] = set()
    for pattern in ('.env*', '.dev.vars*'):
        for path in repo.glob(pattern):
            if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_FILE_BYTES:
                continue
            for line in path.read_text(errors='replace').splitlines():
                key, separator, raw = line.partition('=')
                value = raw.strip().strip('\"\'')
                if separator and SECRET_NAME.search(key) and len(value) >= 12:
                    if not value.startswith(('$', 'YOUR_', 'your_', '<')):
                        values.add(value.encode())
    return list(values)


def inspect_tree(root: Path, secrets: list[bytes] | None = None) -> list[Finding]:
    findings: list[Finding] = []
    if not root.is_dir() or root.is_symlink():
        return [Finding('missing-or-linked-artifact', str(root))]
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = Path(base) / name
            relative = str(path.relative_to(root))
            if path.is_symlink():
                findings.append(Finding('artifact-symlink', relative))
                continue
            if forbidden(relative, True):
                findings.append(Finding('sensitive-path', relative))
            if path.is_file():
                findings.extend(inspect_file(path, relative, secrets or []))
    return findings


def inspect_file(path: Path, relative: str, secrets: list[bytes]) -> list[Finding]:
    if path.stat().st_size > MAX_FILE_BYTES:
        return [Finding('artifact-too-large-to-scan', relative)]
    if not secrets:
        return []
    data = path.read_bytes()
    return [Finding('local-secret-in-artifact', relative)] if any(value in data for value in secrets) else []
