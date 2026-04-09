#!/bin/bash
# J.A.R.V.I.S launcher - expands ~ to actual home directory
# Usage: Place in app repo, call from launchd plist

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Expand ~ to actual home directory
export HOME="${HOME:-$PWD}"
export VOICE_INBOX_DIR="${VOICE_INBOX_DIR:-$HOME/JARVIS/inbox}"
export VOICE_LIVE_DIR="${VOICE_LIVE_DIR:-$HOME/JARVIS/live}"
export VOICE_MODEL_DIR="${VOICE_MODEL_DIR:-$SCRIPT_DIR/assets}"
export VOICE_ARCHIVE_BASE="${VOICE_ARCHIVE_BASE:-$HOME/RAW/archive}"
export NEUROGRAPH_DIR="${NEUROGRAPH_DIR:-$HOME/SCI-FI/apps/neuro-graph}"

exec node "$SCRIPT_DIR/jarvis-server.js"
