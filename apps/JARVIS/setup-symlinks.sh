#!/bin/bash
# Setup symlinks for JARVIS deployment
# Auto-detects repo locations

echo "🔧 Setting up JARVIS symlinks..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Auto-detect SCI-FI location (go up 2 levels from apps/JARVIS)
SCI_FI_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Define paths
MEMORIES_TARGET="$HOME/JARVIS/RAW/memories"
ARCHIVE_TARGET="$HOME/RAW/archive"
NEUROGRAPH_TARGET="$SCI_FI_DIR/apps/neuro-graph"

# Check if targets exist
if [ ! -d "$MEMORIES_TARGET" ]; then
    echo "❌ Error: $MEMORIES_TARGET does not exist"
    echo "   Make sure you've cloned the JARVIS repo to ~/JARVIS/"
    exit 1
fi

if [ ! -d "$NEUROGRAPH_TARGET" ]; then
    echo "❌ Error: $NEUROGRAPH_TARGET does not exist"
    echo "   SCI-FI repo detected at: $SCI_FI_DIR"
    echo "   Make sure neuro-graph folder exists at: $NEUROGRAPH_TARGET"
    exit 1
fi

if [ ! -d "$ARCHIVE_TARGET" ]; then
    echo "⚠️  Creating $ARCHIVE_TARGET..."
    mkdir -p "$ARCHIVE_TARGET"
fi

# Create symlinks in JARVIS folder
cd "$SCRIPT_DIR"
rm -f data memories neuro-graph archive 2>/dev/null

ln -s "$MEMORIES_TARGET" memories
echo "✅ memories -> $MEMORIES_TARGET"

ln -s "$NEUROGRAPH_TARGET" neuro-graph  
echo "✅ neuro-graph -> $NEUROGRAPH_TARGET"

ln -s "$ARCHIVE_TARGET" archive
echo "✅ archive -> $ARCHIVE_TARGET"

# Create symlink in neuro-graph folder for memories (shared = same content)
cd "$NEUROGRAPH_TARGET"
rm -f shared 2>/dev/null
ln -s "../JARVIS/memories" shared
echo "✅ neuro-graph/shared -> ../JARVIS/memories"

echo ""
echo "🎉 All symlinks created successfully!"
echo ""
echo "Next steps:"
echo "1. cd $SCRIPT_DIR"
echo "2. npm install"
echo "3. node jarvis-server.js"
