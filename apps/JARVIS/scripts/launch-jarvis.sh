#!/bin/bash
# J.A.R.V.I.S launcher - expands ~ to actual home directory
# Usage: Place in app repo (scripts/), call from launchd plist

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
JARVIS_DIR="$(dirname "$SCRIPT_DIR")"
cd "$JARVIS_DIR"

# Expand ~ to actual home directory
export HOME="${HOME:-$PWD}"
export VOICE_INBOX_DIR="${VOICE_INBOX_DIR:-$HOME/JARVIS/inbox}"
export VOICE_LIVE_DIR="${VOICE_LIVE_DIR:-$HOME/JARVIS/live}"
export VOICE_MODEL_DIR="${VOICE_MODEL_DIR:-$HOME/SCI-FI/apps/JARVIS}"
export VOICE_ARCHIVE_BASE="${VOICE_ARCHIVE_BASE:-$HOME/RAW/archive}"
export NEUROGRAPH_DIR="${NEUROGRAPH_DIR:-$HOME/SCI-FI/apps/neuro-graph}"

exec node "$JARVIS_DIR/jarvis-server.js"
