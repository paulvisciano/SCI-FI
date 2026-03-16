#!/bin/zsh
# Whisper transcription using ggml-large-v3.bin (local, no API)
MODEL="/Users/paulvisciano/SCI-FI/apps/JARVIS/ggml-large-v3.bin"
WHISPER_CLI="/opt/homebrew/bin/whisper-cli"

if [ -z "$1" ]; then
  echo "Usage: $0 <audio-file>"
  exit 1
fi

"$WHISPER_CLI" -m "$MODEL" -otxt "$1"
