#!/usr/bin/env node
/**
 * Pre-commit helper: bump JARVIS client and/or server semver patch + build dates
 * based on staged files under apps/JARVIS/.
 *
 * Client bump when staging: app.js, index.html, or assets/**
 * Server bump when staging: jarvis-server.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function bumpPatch(ver) {
  const parts = String(ver).trim().split('.');
  if (parts.length !== 3) {
    throw new Error(`Expected semver x.y.z, got: ${ver}`);
  }
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid semver: ${ver}`);
  }
  nums[2] += 1;
  return nums.join('.');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const staged = execSync('git diff --cached --name-only', {
  encoding: 'utf8',
  cwd: root
})
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const isClientPath = (f) =>
  /^apps\/JARVIS\/(app\.js|index\.html)$/.test(f) || f.startsWith('apps/JARVIS/assets/');

const isServerPath = (f) => /^apps\/JARVIS\/jarvis-server\.js$/.test(f);

const bumpClient = staged.some(isClientPath);
const bumpServer = staged.some(isServerPath);

if (!bumpClient && !bumpServer) {
  process.exit(0);
}

const appJs = path.join(root, 'apps/JARVIS/app.js');
const indexHtml = path.join(root, 'apps/JARVIS/index.html');
const serverJs = path.join(root, 'apps/JARVIS/jarvis-server.js');

const toAdd = [];

if (bumpClient) {
  let txt = fs.readFileSync(appJs, 'utf8');
  const m = txt.match(/const CLIENT_VERSION = '([^']+)'/);
  if (!m) {
    console.error('[bump-jarvis-versions] CLIENT_VERSION not found in app.js');
    process.exit(1);
  }
  const oldV = m[1];
  const newV = bumpPatch(oldV);
  txt = txt.replace(/const CLIENT_VERSION = '[^']+'/, `const CLIENT_VERSION = '${newV}'`);
  txt = txt.replace(/const CLIENT_BUILD_DATE = '[^']+'/, `const CLIENT_BUILD_DATE = '${todayISO()}'`);
  fs.writeFileSync(appJs, txt);

  let html = fs.readFileSync(indexHtml, 'utf8');
  html = html.replace(
    /(<span id="client-version-inline"[^>]*>)v[\d.]+(<\/span>)/,
    `$1v${newV}$2`
  );
  html = html.replace(/app\.js\?v=[\d.]+/, `app.js?v=${newV}`);
  fs.writeFileSync(indexHtml, html);

  toAdd.push(appJs, indexHtml);
  console.log(`[bump-jarvis-versions] CLIENT ${oldV} → ${newV}`);
}

if (bumpServer) {
  let txt = fs.readFileSync(serverJs, 'utf8');
  const m = txt.match(/const VERSION = '([^']+)'/);
  if (!m) {
    console.error('[bump-jarvis-versions] VERSION not found in jarvis-server.js');
    process.exit(1);
  }
  const oldV = m[1];
  const newV = bumpPatch(oldV);
  txt = txt.replace(/const VERSION = '[^']+'/, `const VERSION = '${newV}'`);
  txt = txt.replace(/const BUILD_DATE = '[^']+'/, `const BUILD_DATE = '${todayISO()}'`);
  fs.writeFileSync(serverJs, txt);

  toAdd.push(serverJs);
  console.log(`[bump-jarvis-versions] SERVER ${oldV} → ${newV}`);
}

for (const f of toAdd) {
  const r = spawnSync('git', ['add', '--', f], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}
