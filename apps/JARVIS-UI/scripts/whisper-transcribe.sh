#!/bin/zsh
# Whisper transcription using ggml-large-v3.bin (local, no API)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]:-$0}" )" && pwd )"
JARVIS_DIR="$(dirname "$SCRIPT_DIR")"
MODEL="$JARVIS_DIR/assets/ggml-large-v3.bin"
WHISPER_CLI="${WHISPER_CLI:-/opt/homebrew/bin/whisper-cli}"

if [ -z "$1" ]; then
  echo "Usage: $0 <audio-file>"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "ERROR: Audio file not found: $1"
  exit 1
fi

if [ ! -x "$WHISPER_CLI" ]; then
  echo "ERROR: whisper-cli not executable at: $WHISPER_CLI"
  echo "Set WHISPER_CLI to a valid executable path (example: /opt/homebrew/bin/whisper-cli)."
  exit 1
fi

if [ ! -f "$MODEL" ]; then
  echo "ERROR: Whisper model not found: $MODEL"
  echo "Download ggml-large-v3.bin into $JARVIS_DIR/assets/."
  exit 1
fi

"$WHISPER_CLI" -m "$MODEL" -otxt "$1"
