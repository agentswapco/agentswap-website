#!/bin/sh
# Scan the exact public output with a checksum-pinned scanner and enforced rules.
# Dependencies: Python, curl, tar, sha256sum; GitHub Linux x64 build runners.
set -eu
cd "$(dirname "$0")/.."
cache=$(mktemp -d)
trap 'rm -rf "$cache"' EXIT
curl --fail --silent --show-error --location https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz -o "$cache/gitleaks.tar.gz"
printf '%s  %s\n' 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb "$cache/gitleaks.tar.gz" | sha256sum --check --status
tar -xzf "$cache/gitleaks.tar.gz" -C "$cache" gitleaks
export SECURITY_GUARD_GITLEAKS="$cache/gitleaks"
python3 .security/guard.py artifact dist --repo .
