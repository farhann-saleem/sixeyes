#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
release_file=${1:?Usage: deploy/package-release.sh /absolute/output.tar.gz}
if [[ "$release_file" != /* ]]; then echo 'Use an absolute output path' >&2; exit 1; fi
# Explicit allowlist: no credentials, local user media, assignment logs, git history or node_modules.
tar -czf "$release_file" -C "$repo" \
  apps/backend/src apps/backend/package.json apps/backend/package-lock.json \
  apps/backend/tsconfig.json apps/backend/scripts \
  image-template video-template effects-template deploy
printf 'Release bundle created: %s\n' "$release_file"
