#!/usr/bin/env node

/**
 * Preview Server Script (SCI-FI repo)
 *
 * Starts a JARVIS preview instance on port 18788 by default (production is 18787).
 * Runs jarvis-server.js from this package (apps/JARVIS-UI).
 *
 * Usage: node start-preview-server.js [port] [workspace]
 *
 * Environment variables:
 * - PREVIEW_PORT: Port to run preview server (default: 18788)
 * - PREVIEW_WORKSPACE: Path to apps/JARVIS-UI directory (default: directory containing this script's parent)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 18788;
const DEFAULT_WORKSPACE = path.resolve(__dirname, '..');

const argvPort = process.argv[2];
const argvWorkspace = process.argv[3];

let port = DEFAULT_PORT;
if (argvPort !== undefined) {
  const n = Number.parseInt(argvPort, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    console.error(`[Preview Server] ERROR: Invalid port: ${argvPort}`);
    process.exit(1);
  }
  port = n;
}

const PORT = process.env.PREVIEW_PORT ? Number.parseInt(process.env.PREVIEW_PORT, 10) : port;
if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[Preview Server] ERROR: Invalid PREVIEW_PORT: ${process.env.PREVIEW_PORT}`);
  process.exit(1);
}

const WORKSPACE = argvWorkspace
  ? path.resolve(argvWorkspace)
  : (process.env.PREVIEW_WORKSPACE
    ? path.resolve(process.env.PREVIEW_WORKSPACE)
    : DEFAULT_WORKSPACE);

const SERVER_SCRIPT = path.join(WORKSPACE, 'jarvis-server.js');

console.log(`[Preview Server] Starting JARVIS preview on port ${PORT}`);
console.log(`[Preview Server] Workspace: ${WORKSPACE}`);
console.log(`[Preview Server] Server script: ${SERVER_SCRIPT}`);

if (!fs.existsSync(WORKSPACE)) {
  console.error(`[Preview Server] ERROR: Workspace not found: ${WORKSPACE}`);
  process.exit(1);
}

if (!fs.existsSync(SERVER_SCRIPT)) {
  console.error(`[Preview Server] ERROR: Server script not found: ${SERVER_SCRIPT}`);
  console.error('[Preview Server] Expected jarvis-server.js in apps/JARVIS-UI (SCI-FI repo layout).');
  process.exit(1);
}

const env = {
  ...process.env,
  JARVIS_PREVIEW: 'true',
  VOICE_PORT: String(PORT),
  NODE_ENV: 'preview'
};

console.log('[Preview Server] Launching jarvis-server.js...');
const serverProcess = spawn('node', [SERVER_SCRIPT], {
  env,
  cwd: WORKSPACE,
  stdio: 'inherit'
});

serverProcess.on('error', (err) => {
  console.error(`[Preview Server] Failed to start server: ${err.message}`);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`[Preview Server] Server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('\n[Preview Server] Shutting down...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n[Preview Server] Shutting down...');
  serverProcess.kill('SIGTERM');
});

setTimeout(() => {
  const browserUrl = `https://localhost:${PORT}`;
  console.log(`\n[Preview Server] Opening browser to ${browserUrl}...`);
  spawn('open', [browserUrl], {
    stdio: 'ignore',
    detached: true
  });
}, 2000);
