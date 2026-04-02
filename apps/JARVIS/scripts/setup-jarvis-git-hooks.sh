#!/usr/bin/env sh
# Point this repo at tracked hooks under .githooks (run once per clone).
set -e
exec node "$(dirname "$0")/setup-jarvis-git-hooks.js"
