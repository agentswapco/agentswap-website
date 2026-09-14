#!/bin/sh
# Build an explicit public directory and scan exactly what Pages uploads.
# Dependencies: local builder, security-guard and Wrangler.
set -eu
cd "$(dirname "$0")/.."
repo=$(pwd)
node scripts/build.mjs
security-guard publish "$repo/dist" --repo "$repo" -- \
  npx wrangler pages deploy dist --project-name agentswap-website
