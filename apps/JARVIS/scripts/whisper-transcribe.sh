#!/bin/zsh
# Whisper transcription using ggml-large-v3.bin (local, no API)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]:-$0}" )" && pwd )"
JARVIS_DIR="$(dirname "$SCRIPT_DIR")"
MODEL="$JARVIS_DIR/ggml-large-v3.bin"
WHISPER_CLI="${WHISPER_CLI:-/opt/homebrew/bin/whisper-cli}"

if [ -z "$1" ]; then
  echo "Usage: $0 <audio-file>"
  exit 1
fi

"$WHISPER_CLI" -m "$MODEL" -otxt "$1"
