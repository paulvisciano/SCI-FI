#!/usr/bin/env node
/**
 * Sets git core.hooksPath to .githooks (JARVIS pre-commit version bump).
 * Safe to run from npm postinstall or manually; no-ops if not a git checkout.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return path.resolve(__dirname, '..', '..', '..');
  }
}

const root = getRepoRoot();
const gitDir = path.join(root, '.git');

if (!fs.existsSync(gitDir)) {
  console.log('[setup-jarvis-git-hooks] No .git at repo root; skipping hook install.');
  process.exit(0);
}

try {
  process.chdir(root);
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  const hook = path.join(root, '.githooks', 'pre-commit');
  if (fs.existsSync(hook)) {
    try {
      fs.chmodSync(hook, 0o755);
    } catch (_) { /* ignore */ }
  }
  console.log('[setup-jarvis-git-hooks] core.hooksPath set to .githooks (JARVIS version bump pre-commit enabled).');
} catch (e) {
  console.warn('[setup-jarvis-git-hooks]', e.message || e);
  process.exit(0);
}
