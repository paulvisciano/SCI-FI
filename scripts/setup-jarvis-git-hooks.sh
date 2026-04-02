#!/usr/bin/env sh
# Point this repo at tracked hooks under .githooks (run once per clone).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit 2>/dev/null || true
echo "core.hooksPath set to .githooks (JARVIS version bump pre-commit enabled)."
