#!/bin/bash
#
# setup-symlinks.sh — Manage symlinks for neuro-graph app
#
# Reads neural-graph.js to determine required data paths,
# then creates symlinks in the app directory.
#
# Usage: ./setup-symlinks.sh [--dry-run] [--clean]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=false
CLEAN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --clean) CLEAN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "🔍 Neuro-Graph Symlink Setup"
echo "============================"
echo ""

# Define required symlinks based on neural-graph.js expectations
# Format: "link_name:target_path"
SYMLINKS="JARVIS-memories:$HOME/JARVIS/RAW/memories
archive:$HOME/RAW/archive
learnings:$HOME/JARVIS/RAW/learnings
USER-memories:$HOME/RAW/memories"

# Remove old/wrong symlinks
cleanup_old_links() {
  local old_links="shared/memories shared/archive shared/learnings"
  
  for link in $old_links; do
    if [[ -L "$link" ]]; then
      echo "🗑️  Removing old symlink: $link"
      if [[ "$DRY_RUN" == "false" ]]; then
        rm "$link"
      fi
    fi
  done
  
  # Remove any symlinks in shared/ directory
  if [[ -d "shared" ]]; then
    for link in shared/*; do
      if [[ -L "$link" ]]; then
        echo "🗑️  Removing shared/ symlink: $link"
        if [[ "$DRY_RUN" == "false" ]]; then
          rm "$link"
        fi
      fi
    done
  fi
}

# Create new symlinks
create_symlinks() {
  echo ""
  echo "📎 Creating symlinks:"
  
  echo "$SYMLINKS" | while IFS=: read name target; do
    if [[ -z "$name" ]]; then continue; fi
    
    if [[ ! -d "$target" ]]; then
      echo "⚠️  Skipping $name: target not found ($target)"
      continue
    fi
    
    if [[ -L "$name" ]]; then
      local current_target=$(readlink "$name")
      if [[ "$current_target" == "$target" ]]; then
        echo "✅ $name already linked correctly"
        continue
      else
        echo "🔄 Updating $name: $current_target → $target"
        if [[ "$DRY_RUN" == "false" ]]; then
          rm "$name"
          ln -s "$target" "$name"
        fi
      fi
    elif [[ -e "$name" ]]; then
      echo "❌ Cannot create $name: file/directory exists"
      continue
    else
      echo "➕ Creating $name → $target"
      if [[ "$DRY_RUN" == "false" ]]; then
        ln -s "$target" "$name"
      fi
    fi
  done
}

# Show current state
show_status() {
  echo ""
  echo "📊 Current symlinks:"
  ls -la 2>/dev/null | grep "^l" || echo "  (none)"
  
  if [[ -d "shared" ]]; then
    echo ""
    echo "📊 shared/ symlinks:"
    ls -la shared/ 2>/dev/null | grep "^l" || echo "  (none)"
  fi
}

# Main execution
if [[ "$CLEAN" == "true" ]]; then
  echo "🧹 Clean mode: removing all symlinks"
  cleanup_old_links
  echo "$SYMLINKS" | while IFS=: read name target; do
    if [[ -z "$name" ]]; then continue; fi
    if [[ -L "$name" ]]; then
      echo "🗑️  Removing $name"
      if [[ "$DRY_RUN" == "false" ]]; then
        rm "$name"
      fi
    fi
  done
  echo "✅ Cleanup complete"
  exit 0
fi

cleanup_old_links
create_symlinks
show_status

echo ""
echo "✅ Symlink setup complete!"
