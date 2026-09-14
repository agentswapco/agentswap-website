#!/usr/bin/env python3
"""Block credential publication at Git and artifact boundaries.
Exports: CLI entry point. Dependencies: guardlib and pinned Gitleaks.
"""
import argparse
from pathlib import Path
import subprocess
import sys
from guardlib import artifact, emit, push, repository, staged


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['staged', 'push', 'repo', 'artifact', 'publish'])
    parser.add_argument('path', nargs='?', default='.')
    parser.add_argument('--repo', default='.')
    arguments = sys.argv[1:]
    command: list[str] = []
    if '--' in arguments:
        split = arguments.index('--')
        arguments, command = arguments[:split], arguments[split + 1:]
    args = parser.parse_args(arguments)
    repo = Path(args.repo).resolve()
    try:
        if args.mode == 'staged':
            findings = staged(repo)
        elif args.mode == 'push':
            findings = push(repo, sys.stdin.read())
        elif args.mode == 'repo':
            findings = repository(Path(args.path).resolve())
        else:
            findings = artifact(Path(args.path).resolve(), repo)
        result = emit(findings)
        if args.mode != 'publish' or result:
            return result
        if not command:
            raise RuntimeError('publish requires an explicit command after --')
        return subprocess.run(command, check=False).returncode
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
        print('security-guard: scan could not complete (' + type(error).__name__ + '); refusing', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
