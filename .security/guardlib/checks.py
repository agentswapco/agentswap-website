"""Check staged content, outgoing history, current tracked files and final artifacts.
Exports: staged, push, repository, artifact. Dependencies: Git, Gitleaks, path policy.
"""
import os
from pathlib import Path
import re
import shutil
import tempfile
from .model import Finding, git
from .paths import forbidden, inspect_tree, local_secrets
from .scanner import scan
from .reviews import reviewed_artifact


def staged(repo: Path) -> list[Finding]:
    paths = git(repo, 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').decode().split('\0')
    findings = [Finding('sensitive-path', path) for path in paths if path and forbidden(path, False)]
    return findings + scan('git', repo, ['--pre-commit', '--staged'])


def push(repo: Path, refs: str) -> list[Finding]:
    findings: list[Finding] = []
    for line in refs.splitlines():
        fields = line.split()
        if len(fields) != 4:
            raise RuntimeError('invalid pre-push ref input')
        _, local, _, remote = fields
        if not all(re.fullmatch(r'[0-9a-f]{40,64}', value) for value in (local, remote)):
            raise RuntimeError('invalid pre-push object ID')
        if not local.strip('0'):
            continue
        revision = f'{remote}..{local}' if remote.strip('0') else local
        findings.extend(scan('git', repo, ['--log-opts=' + revision]))
        paths = git(repo, 'ls-tree', '-r', '--name-only', '-z', local).decode().split('\0')
        findings.extend(Finding('sensitive-path', path) for path in paths if path and forbidden(path, False))
    return findings


def repository(repo: Path) -> list[Finding]:
    paths = git(repo, 'ls-files', '-z').decode().split('\0')
    findings: list[Finding] = []
    with tempfile.TemporaryDirectory(prefix='security-source-') as temp:
        mirror = Path(temp)
        for name in paths:
            if not name:
                continue
            source = repo / name
            if forbidden(name, False):
                findings.append(Finding('sensitive-path', name))
            if source.is_symlink():
                continue
            if not source.is_file():
                continue
            destination = mirror / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
        findings.extend(scan('dir', mirror))
    return findings


def artifact(root: Path, repo: Path) -> list[Finding]:
    findings = inspect_tree(root, local_secrets(repo))
    if not root.is_dir() or root.is_symlink():
        return findings
    return findings + reviewed_artifact(root, scan('dir', root))
