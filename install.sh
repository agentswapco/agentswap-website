#!/bin/sh
# One-line installer for the agentswap CLI.
# Usage: curl -fsSL https://agentswap.co/install.sh | sh
set -eu

VERSION="${AGENTSWAP_VERSION:-latest}"
INSTALL_DIR="${AGENTSWAP_INSTALL_DIR:-${HOME}/.local/bin}"
DEFAULT_RELEASES="https://github.com/agentswapco/agentswap-cli/releases"

if [ -n "${AGENTSWAP_BASE_URL:-}" ]; then
  BASE_URL="${AGENTSWAP_BASE_URL%/}"
elif [ "$VERSION" = "latest" ]; then
  BASE_URL="${DEFAULT_RELEASES}/latest/download"
else
  BASE_URL="${DEFAULT_RELEASES}/download/v${VERSION}"
fi

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux)
    case "$arch" in
      x86_64) target="x86_64-unknown-linux-musl" ;;
      aarch64|arm64) target="aarch64-unknown-linux-musl" ;;
      *)
        echo "Unsupported architecture '$arch'. Use 'cargo install agentswap'." >&2
        exit 1
        ;;
    esac
    ;;
  Darwin)
    case "$arch" in
      x86_64) target="x86_64-apple-darwin" ;;
      arm64) target="aarch64-apple-darwin" ;;
      *)
        echo "Unsupported architecture '$arch'. Use 'cargo install agentswap'." >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "Unsupported OS '$os'. Use 'cargo install agentswap'." >&2
    exit 1
    ;;
esac

if command -v sha256sum >/dev/null 2>&1; then
  checksum_cmd="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  checksum_cmd="shasum -a 256"
else
  echo "Neither sha256sum nor shasum found. Use 'cargo install agentswap'." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT INT HUP TERM

sums_file="$tmpdir/SHA256SUMS"
curl -fsSL "${BASE_URL}/SHA256SUMS" -o "$sums_file"

if [ "$VERSION" = "latest" ]; then
  asset="$(
    awk -v t="$target" '
      $2 ~ ("^agentswap-v.+-") t "[.]tar[.]gz$" { print $2; exit }
    ' "$sums_file"
  )"
  if [ -z "$asset" ]; then
    echo "No release asset found for target $target." >&2
    exit 1
  fi
else
  asset="agentswap-v${VERSION}-${target}.tar.gz"
fi

expected="$(
  awk -v a="$asset" '$2 == a { print $1; exit }' "$sums_file"
)"
if [ -z "$expected" ]; then
  echo "SHA256SUMS has no entry for $asset." >&2
  exit 1
fi

tarball="$tmpdir/$asset"
curl -fsSL "${BASE_URL}/${asset}" -o "$tarball"

actual="$($checksum_cmd "$tarball" | awk '{ print $1 }')"
if [ "$actual" != "$expected" ]; then
  echo "Checksum mismatch for $asset." >&2
  exit 1
fi

tar -xzf "$tarball" -C "$tmpdir"
if [ ! -f "$tmpdir/agentswap" ]; then
  echo "Tarball did not contain an agentswap binary." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
mv "$tmpdir/agentswap" "$INSTALL_DIR/agentswap"
chmod +x "$INSTALL_DIR/agentswap"

"$INSTALL_DIR/agentswap" --version

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo "Add ${INSTALL_DIR} to your PATH to run agentswap."
    ;;
esac
