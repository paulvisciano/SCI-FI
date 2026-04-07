#!/bin/bash
# JARVIS Git Hooks Setup — one-time install
# Sets git to use .githooks/ for pre-commit version bumping

cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks

echo "✅ Git hooks installed — version bump on commit enabled"
