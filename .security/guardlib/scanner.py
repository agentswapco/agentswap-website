"""Run pinned Gitleaks with enforced configuration and expose only redacted finding locations.
Exports: scan. Dependencies: Gitleaks CLI and Python standard library.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
from .model import Finding

ROOT = Path(__file__).resolve().parents[1]


def scan(mode: str, target: Path, options: list[str] | None = None) -> list[Finding]:
    executable = os.environ.get('SECURITY_GUARD_GITLEAKS') or str(ROOT / 'bin/gitleaks')
    if not Path(executable).is_file():
        raise RuntimeError('pinned Gitleaks executable unavailable; scan refused')
    with tempfile.TemporaryDirectory(prefix='security-guard-') as temp:
        report = Path(temp) / 'report.json'
        ignore = Path(temp) / 'empty-ignore'
        ignore.write_text('')
        command = [executable, mode, str(target), '--config', str(ROOT / 'gitleaks.toml'),
                   '--no-banner', '--no-color', '--redact=100', '--ignore-gitleaks-allow',
                   '--gitleaks-ignore-path', str(ignore), '--report-format', 'json',
                   '--report-path', str(report), '--max-archive-depth', '3', '--timeout', '120']
        result = subprocess.run(command + (options or []), capture_output=True, timeout=150)
        if result.returncode not in (0, 1) or not report.exists():
            raise RuntimeError('Gitleaks failed; no passing result is available')
        rows = json.loads(report.read_text())
        findings = []
        for row in rows:
            path = str(row['File'])
            if mode == 'dir' and Path(path).is_relative_to(target):
                path = str(Path(path).relative_to(target))
            findings.append(Finding(str(row['RuleID']), path, int(row['StartLine'])))
        if result.returncode and not findings:
            raise RuntimeError('Gitleaks failed without a finding report')
        return findings
