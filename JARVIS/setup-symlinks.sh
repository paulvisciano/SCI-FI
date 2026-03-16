#!/bin/bash
# Setup symlinks for JARVIS deployment
# Assumes ~/JARVIS/ and ~/SCI-FI/ are at the same root level

echo "🔧 Setting up JARVIS symlinks..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCI_FI_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Define paths (sibling directories)
MEMORIES_TARGET="$HOME/JARVIS/RAW/memories"
ARCHIVE_TARGET="$HOME/RAW/archive"
NEUROGRAPH_DIR="$SCI_FI_DIR/SCI-FI/apps/neuro-graph"

# Check if targets exist
if [ ! -d "$MEMORIES_TARGET" ]; then
    echo "❌ Error: $MEMORIES_TARGET does not exist"
    echo "   Make sure you've cloned the JARVIS repo to ~/JARVIS/"
    exit 1
fi

if [ ! -d "$ARCHIVE_TARGET" ]; then
    echo "⚠️  Creating $ARCHIVE_TARGET..."
    mkdir -p "$ARCHIVE_TARGET"
fi

# Create symlinks in JARVIS folder
cd "$SCRIPT_DIR"
rm -f data neuro-graph archive 2>/dev/null

ln -s "$MEMORIES_TARGET" data
echo "✅ data -> $MEMORIES_TARGET"

ln -s "../neuro-graph" neuro-graph  
echo "✅ neuro-graph -> ../neuro-graph"

ln -s "$ARCHIVE_TARGET" archive
echo "✅ archive -> $ARCHIVE_TARGET"

echo ""
echo "🎉 Symlinks created successfully!"
echo ""
echo "Next steps:"
echo "1. npm install"
echo "2. node jarvis-server.js"
