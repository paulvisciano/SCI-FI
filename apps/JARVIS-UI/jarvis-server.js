#!/usr/bin/env node
// JARVIS Voice Upload Server (whisper.cpp - direct transcription)
// Portable: No hardcoded paths, configurable via environment variables

// Set process name for Activity Monitor
const isPreview = process.env.JARVIS_PREVIEW === 'true';
process.title = isPreview ? 'JARVIS-preview' : 'JARVIS-production';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile, execSync, spawn } = require('child_process');
const QRCode = require('qrcode');
const os = require('os');

// CPU usage tracking
let previousCpuInfo = os.cpus().map(cpu => cpu.times);

// === HTTPS Configuration ===
const HTTPS_ENABLED = process.env.VOICE_HTTPS_ENABLED !== 'false';
const HTTPS_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, 'assets', 'https-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'assets', 'https-cert.pem'))
};


// === Configuration (Portable - No Hardcoded Paths) ===
// VERSION / BUILD_DATE: patch + build date updated by apps/JARVIS/scripts/bump-jarvis-versions.js when this file is staged (see .githooks/pre-commit).
const VERSION = '3.3.9';
const BUILD_DATE = '2026-04-09';

// Date formatting utility for consistent date handling
function formatDateForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + date.toTimeString().split(' ')[0].replace(/:/g, '');
}

function formatDateForArchive(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// === SECURITY CONSTANTS ===
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FILE_SIZE = 52428800; // 50MB in bytes
const AGENT_TIMEOUT = 15000; // 15 seconds

// === SECURITY VALIDATION ===
function isValidInput(input) {
  if (typeof input !== 'string') {return false;}
  if (input.length > MAX_MESSAGE_LENGTH) {return false;}
  // Reject dangerous characters: ; | & $() \n \r
  if (/[;|&$\n\r]/.test(input)) {return false;}
  // Reject backticks and command substitution patterns
  if (/[`$]/.test(input)) {return false;}
  return true;
}

const CONFIG = {
  port: process.env.VOICE_PORT || 18787,
  inboxDir: process.env.VOICE_INBOX_DIR || path.join(process.env.HOME, 'JARVIS', 'inbox'),
  liveDir: process.env.VOICE_LIVE_DIR || path.join(process.env.HOME, 'JARVIS', 'live'),
  modelDir: process.env.VOICE_MODEL_DIR || path.join(__dirname, 'assets'),
  archiveBase: process.env.VOICE_ARCHIVE_BASE || path.join(process.env.HOME, 'RAW', 'archive'),
  gatewayUrl: process.env.VOICE_GATEWAY_URL || 'ws://127.0.0.1:18789',
  whisperModel: process.env.VOICE_WHISPER_MODEL || 'ggml-large-v3.bin',
  whisperCli: process.env.VOICE_WHISPER_CLI || findWhisperCli(),
  neurographDir: null // NeuroGraph merged into root view - no separate route
};

// Auto-detect whisper-cli from common locations
function findWhisperCli() {
  const candidates = [
    '/opt/homebrew/opt/whisper-cpp/libexec/bin/whisper-cli',
    '/usr/local/bin/whisper-cli',
    '/opt/homebrew/bin/whisper-cli',
    path.join(process.env.HOME, '.cargo', 'bin', 'whisper-cli')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {return candidate;}
  }
  return 'whisper-cli'; // Fallback to PATH
}

// Whisper.cpp health check - verify executable exists and is runnable
function checkWhisperHealth() {
  const whisperPath = CONFIG.whisperCli;
    
  if (!fs.existsSync(whisperPath)) {
    console.error(`❌ Whisper CLI not found: ${whisperPath}`);
    console.error('Set VOICE_WHISPER_CLI environment variable to point to the correct location');
    return false;
  }
    
  // Try to run whisper-cli with --help to verify it's executable
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync(whisperPath, ['--help'], { timeout: 5000 });
        
    if (result.error) {
      console.error(`❌ Whisper CLI is not executable: ${whisperPath}`);
      console.error(`Error: ${result.error.message}`);
      return false;
    }
        
    console.log(`✅ Whisper CLI verified: ${whisperPath}`);
    return true;
  } catch (err) {
    console.error(`❌ Whisper CLI check failed: ${err.message}`);
    return false;
  }
}

// Ensure directories exist
[CONFIG.inboxDir, CONFIG.liveDir, CONFIG.modelDir, CONFIG.archiveBase].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('✓ Created:', dir);
  }
});

// Validate model exists
const modelPath = path.join(CONFIG.modelDir, CONFIG.whisperModel);
if (!fs.existsSync(modelPath)) {
  console.error('❌ Model not found:', modelPath);
  console.error('Set VOICE_MODEL_DIR or VOICE_WHISPER_MODEL environment variable');
  process.exit(1);
}

// Track current transcription status
let currentTranscription = { status: 'idle' };

// === Network Scanner (MAC OUI Lookup) ===
const OUI_LOOKUP = {
  '22:86:b2': 'Unknown/Virtual',
  'a2:d5:32': 'Apple (Private MAC)',
  '00:1a:2b': 'Apple', '00:1c:b3': 'Apple', '00:1e:c2': 'Apple',
  '00:21:e9': 'Apple', '00:23:12': 'Apple', '00:25:00': 'Apple',
  '00:26:08': 'Apple', '00:26:b0': 'Apple', '00:26:cc': 'Apple',
  '00:26:df': 'Apple', '00:26:ee': 'Apple', '00:27:0d': 'Apple',
  '00:30:65': 'Apple', '00:40:d0': 'Apple', '00:50:e4': 'Apple',
  '00:61:77': 'Apple', '00:71:b2': 'Cisco', '00:7e:3a': 'Samsung',
  '00:80:41': 'Samsung', '00:90:4b': 'Nokia', '00:a0:02': 'Intel',
  '00:b0:d0': 'Cisco', '00:c0:9f': 'Apple', '00:d0:59': 'Broadcom',
  '00:e0:4b': 'HP', '00:f0:4c': 'Dell', '3c:22:fb': 'Apple',
  '40:6c:8f': 'Apple', '40:7a:91': 'Nokia', '44:d8:84': 'Apple',
  '50:06:04': 'Apple', '58:b0:35': 'Apple', '60:03:08': 'Apple',
  '70:56:81': 'Apple', '78:31:c1': 'Apple', '7c:7a:91': 'Nokia',
  '80:82:87': 'Huawei', '84:38:35': 'Apple', '88:66:a5': 'Apple',
  '90:84:0d': 'Apple', '94:b8:6d': 'Apple', '98:03:d8': 'Apple',
  'a8:66:7f': 'Apple', 'ac:87:a3': 'Apple', 'b0:65:63': 'Apple',
  'b8:17:c2': 'Apple', 'bc:52:b7': 'Apple', 'c0:84:7a': 'Apple',
  'c8:2a:14': 'Apple', 'cc:29:f5': 'Apple', 'd0:03:4b': 'Apple',
  'd8:30:62': 'Apple', 'dc:a9:04': 'Apple', 'e0:5f:45': 'Apple',
  'f0:27:2d': 'Amazon', 'f4:5c:89': 'Apple', 'f8:1a:67': 'Apple'
};

function getManufacturer(mac) {
  const prefix = mac.substring(0, 8).toLowerCase();
  return OUI_LOOKUP[prefix] || 'Unknown';
}

function getDeviceType(mac, ip, isGateway) {
  if (isGateway) {return 'router';}
  const manufacturer = getManufacturer(mac);
  if (manufacturer.includes('Apple')) {return 'laptop/phone';}
  if (manufacturer.includes('Samsung')) {return 'phone';}
  if (manufacturer.includes('Nokia')) {return 'phone';}
  if (manufacturer.includes('Huawei')) {return 'phone';}
  if (manufacturer.includes('Amazon')) {return 'smart device';}
  return 'device';
}

function getNetworkInfo(callback) {
  // Use full paths for macOS commands
  const ipconfigProcess = spawn('/usr/sbin/ipconfig', ['getpacket', 'en0'], { encoding: 'utf8' });
  let ipconfigOut = '';
  let ipconfigDone = false;
  let arpDone = false;
  
  ipconfigProcess.stdout.on('data', (data) => {
    ipconfigOut += data;
  });
  
  ipconfigProcess.stderr.on('data', (data) => {
    console.error(`ipconfig stderr: ${data}`);
  });
  
  ipconfigProcess.on('error', (err) => {
    return callback(err);
  });
  
  ipconfigProcess.on('close', (code) => {
    if (code !== 0) {
      return callback(new Error(`ipconfig failed with code ${code}`));
    }
    ipconfigDone = true;
    if (arpDone) {finishGetNetworkInfo(callback, ipconfigOut, arpOut);}
  });
  
  // Use full paths for macOS commands
  const arpProcess = spawn('/usr/sbin/arp', ['-a'], { encoding: 'utf8' });
  let arpOut = '';
  
  arpProcess.stdout.on('data', (data) => {
    arpOut += data;
  });
  
  arpProcess.stderr.on('data', (data) => {
    console.error(`arp stderr: ${data}`);
  });
  
  arpProcess.on('error', (err) => {
    return callback(err);
  });
  
  arpProcess.on('close', (code) => {
    if (code !== 0) {
      return callback(new Error(`arp failed with code ${code}`));
    }
    arpDone = true;
    if (ipconfigDone) {finishGetNetworkInfo(callback, ipconfigOut, arpOut);}
  });
}

function finishGetNetworkInfo(callback, ipconfigOut, arpOut) {
  const info = { ip: null, netmask: null, gateway: null, devices: [] };
      
  // Parse ipconfig for IP and gateway
  const ipLines = ipconfigOut.split('\n');
  ipLines.forEach(line => {
    if (line.includes('server_identifier')) {
      const match = line.match(/server_identifier.*?:\s*([\d.]+)/);
      if (match) {info.gateway = match[1];}
    }
    if (line.includes('ciaddr')) {
      const match = line.match(/ciaddr\s*=\s*([\d.]+)/);
      if (match && match[1] !== '0.0.0.0') {info.ip = match[1];}  // ciaddr = client IP
    }
    if (line.includes('yiaddr') && !info.ip) {
      const match = line.match(/yiaddr\s*=\s*([\d.]+)/);
      if (match) {info.ip = match[1];}  // yiaddr = your IP
    }
  });
      
  // Fallback: use first non-gateway device IP
  if (!info.ip && info.devices.length > 0) {
    const myDevice = info.devices.find(d => !d.isGateway);
    if (myDevice) {info.ip = myDevice.ip;}
  }
      
  // Parse arp for devices
  const arpLines = arpOut.split('\n');
  arpLines.forEach(line => {
    if (line.includes('at') && line.includes('en')) {
      const match = line.match(/\(([\d.]+)\).*at\s+([\w:]+)/);
      if (match && !match[1].includes('255') && !match[1].includes('224')) {
        info.devices.push({
          ip: match[1], mac: match[2],
          type: match[1] === info.gateway ? 'gateway' : 'device',
          manufacturer: getManufacturer(match[2]),
          deviceType: getDeviceType(match[2], match[1], match[1] === info.gateway),
          isGateway: match[1] === info.gateway
        });
      }
    }
  });
      
  callback(null, info);
}

// === Parse multipart form data ===
function parseMultipart(buffer, contentType) {
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) {return null;}
    
  const boundaryBuffer = Buffer.from('--' + boundary);
  const start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
  const end = buffer.indexOf(boundaryBuffer, start);
    
  if (start < boundaryBuffer.length || end === -1) {return null;}
    
  const headerEnd = buffer.indexOf('\r\n\r\n', start);
  if (headerEnd === -1) {return null;}
    
  return buffer.slice(headerEnd + 4, end - 2);
}

// === TTS Audio Helper Functions ===
// Extract TTS audio filename from response text
// Looks for [[audio_as_voice]] marker followed by MEDIA:/path/to/file.mp3
function extractTtsAudio(responseText) {
  if (!responseText) return null;
  
  // Check for [[audio_as_voice]] marker
  const audioMarkerMatch = responseText.match(/\[\[audio_as_voice\]\]/i);
  if (!audioMarkerMatch) return null;
  
  // Look for MEDIA: pattern in the response
  const mediaMatch = responseText.match(/MEDIA:\s*([^\s\]]+)/i);
  if (mediaMatch) {
    const mediaPath = mediaMatch[1].trim();
    // Extract just the filename from the path
    const filename = path.basename(mediaPath);
    console.log(`[TTS] Extracted audio filename from response: ${filename}`);
    return filename;
  }
  
  return null;
}

// Clean TTS audio marker from response text for display
function cleanTtsResponse(responseText) {
  if (!responseText) return responseText;
  
  // Remove [[audio_as_voice]] marker and MEDIA: line
  let cleaned = responseText.replace(/\[\[audio_as_voice\]\]/i, '');
  cleaned = cleaned.replace(/MEDIA:\s*[^\n]+/i, '');
  
  // Trim extra whitespace/newlines
  return cleaned.trim();
}

const bootstrapState = {
  phase: 'idle',
  progress: 0,
  message: 'Bootstrap idle',
  nodeCount: 0,
  commitCount: 0,
  updatedAt: new Date().toISOString(),
  toolCalls: []
};
let bootstrapNodes = [];
let bootstrapScanPromise = null;
const bootstrapClients = new Set();
const parsedGitBootstrapLimit = Number.parseInt(process.env.GIT_BOOTSTRAP_LIMIT || '5000', 10);
const GIT_BOOTSTRAP_LIMIT = Number.isFinite(parsedGitBootstrapLimit) && parsedGitBootstrapLimit > 0
  ? parsedGitBootstrapLimit
  : 5000;
const parsedRawArchiveBootstrapLimit = Number.parseInt(process.env.RAW_ARCHIVE_BOOTSTRAP_LIMIT || '5000', 10);
const RAW_ARCHIVE_BOOTSTRAP_LIMIT = Number.isFinite(parsedRawArchiveBootstrapLimit) && parsedRawArchiveBootstrapLimit > 0
  ? parsedRawArchiveBootstrapLimit
  : 5000;
const REQUIRED_BOOTSTRAP_REPO_ROOT = '/Users/paulvisciano/JARVIS';
const REQUIRED_BOOTSTRAP_ARCHIVE_BASE = '/Users/paulvisciano/RAW/archive';

function resolveBootstrapPath(envValue, requiredPath) {
  if (typeof envValue === 'string' && envValue.trim() && fs.existsSync(envValue.trim())) {
    return envValue.trim();
  }
  if (fs.existsSync(requiredPath)) {
    return requiredPath;
  }
  return requiredPath;
}

const BOOTSTRAP_REPO_ROOT = resolveBootstrapPath(process.env.BOOTSTRAP_REPO_ROOT, REQUIRED_BOOTSTRAP_REPO_ROOT);
const BOOTSTRAP_ARCHIVE_BASE = resolveBootstrapPath(process.env.BOOTSTRAP_ARCHIVE_BASE, REQUIRED_BOOTSTRAP_ARCHIVE_BASE);

function categoryForArchiveFile(extension, relativePath) {
  const ext = extension.toLowerCase();
  const rel = relativePath.toLowerCase();
  if (rel.includes('/audio/') || ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)) {
    return 'audio';
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp', '.svg'].includes(ext)) {
    return 'image';
  }
  if (['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(ext)) {
    return 'video';
  }
  if (['.md', '.txt', '.json', '.pdf', '.doc', '.docx', '.rtf'].includes(ext)) {
    return 'document';
  }
  return 'conversation';
}

const TEXT_PREVIEW_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.xml', '.csv', '.log', '.yaml', '.yml'
]);

function readArchivePreview(fullPath, extension) {
  if (!TEXT_PREVIEW_EXTENSIONS.has((extension || '').toLowerCase())) {
    return '';
  }
  try {
    const bytes = fs.readFileSync(fullPath);
    const slice = bytes.subarray(0, 2048).toString('utf8').replace(/\s+/g, ' ').trim();
    return slice.slice(0, 280);
  } catch (_) {
    return '';
  }
}

function scanRawArchiveNodes(archiveBase, limit = RAW_ARCHIVE_BOOTSTRAP_LIMIT) {
  if (!archiveBase || !fs.existsSync(archiveBase)) {
    return [];
  }

  const stack = [archiveBase];
  const files = [];
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (_) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      try {
        const stats = fs.statSync(fullPath);
        files.push({ fullPath, stats });
      } catch (_) {
        // Ignore file stat errors so one bad file does not block bootstrap.
      }
    }
  }

  return files
    .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)
    .slice(0, limit)
    .map(({ fullPath, stats }) => {
      const relativePath = path.relative(archiveBase, fullPath);
      const normalizedRelativePath = relativePath.split(path.sep).join('/');
      const extension = path.extname(fullPath);
      const type = categoryForArchiveFile(extension, normalizedRelativePath);
      const timestamp = stats.mtime.toISOString();
      const day = timestamp.slice(0, 10);
      const safeSlug = normalizedRelativePath.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64);
      const id = `raw-${stats.mtimeMs.toString(36)}-${safeSlug || 'node'}`;
      const contentPreview = readArchivePreview(fullPath, extension);

      return {
        id,
        title: path.basename(fullPath),
        stream: 'temporal',
        kind: 'raw-archive-node',
        type,
        day,
        timestamp,
        createdAt: timestamp,
        privacy: normalizedRelativePath.toLowerCase().includes('/private/') ? 'private' : 'public',
        sourcePath: normalizedRelativePath,
        absolutePath: fullPath,
        ext: extension.toLowerCase(),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        createdAtFs: stats.birthtime ? stats.birthtime.toISOString() : null,
        preview: contentPreview || `RAW archive file · ${normalizedRelativePath}`,
        content: contentPreview || `RAW archive file: ${normalizedRelativePath}`
      };
    });
}

function epochForNode(node) {
  const values = [node?.timestamp, node?.createdAt, node?.day];
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return Date.UTC(2020, 0, 1);
}

function dayKeyForNode(node) {
  if (typeof node?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(node.day)) {
    return node.day;
  }
  const epoch = epochForNode(node);
  return new Date(epoch).toISOString().slice(0, 10);
}

function filterBootstrapWindow(nodes, offsetDays, windowDays) {
  const safeWindowDays = Math.max(1, Math.min(windowDays, 3650));
  const safeOffsetDays = Math.max(0, Math.min(offsetDays, 3650));
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowEnd = todayStart - (safeOffsetDays * DAY_MS) + DAY_MS;
  const windowStart = windowEnd - (safeWindowDays * DAY_MS);

  const inWindow = nodes.filter((node) => {
    if (node.kind === 'day-anchor') {
      return false;
    }
    const epoch = epochForNode(node);
    return epoch >= windowStart && epoch < windowEnd;
  });
  const includedDays = new Set(inWindow.map((node) => dayKeyForNode(node)));
  const dayAnchors = nodes.filter((node) => node.kind === 'day-anchor' && includedDays.has(dayKeyForNode(node)));
  const filtered = [...dayAnchors, ...inWindow];

  const oldestEpoch = nodes.reduce((min, node) => Math.min(min, epochForNode(node)), Number.POSITIVE_INFINITY);
  const hasMore = Number.isFinite(oldestEpoch) ? windowStart > oldestEpoch : false;

  return {
    nodes: filtered,
    window: {
      offsetDays: safeOffsetDays,
      windowDays: safeWindowDays,
      hasMore,
    },
  };
}

function snapshotBootstrapState() {
  return {
    ...bootstrapState,
    toolCalls: bootstrapState.toolCalls.slice(-20)
  };
}

function logGatewayToolCall(name, payload = {}) {
  const call = {
    id: `tool-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    payload,
    at: new Date().toISOString()
  };
  bootstrapState.toolCalls = [...bootstrapState.toolCalls.slice(-19), call];
  // Structured log so gateway inspection tools can parse tool activity.
  console.log('[GatewayToolCall]', JSON.stringify(call));
}

function sendBootstrapEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastBootstrap(eventName, extra = {}) {
  const payload = {
    ...snapshotBootstrapState(),
    ...extra
  };
  for (const client of bootstrapClients) {
    sendBootstrapEvent(client, eventName, payload);
  }
}

function updateBootstrapState(patch, eventName = 'bootstrap:update') {
  Object.assign(bootstrapState, patch, { updatedAt: new Date().toISOString() });
  broadcastBootstrap(eventName);
}

async function runGitBootstrapScan() {
  if (bootstrapScanPromise) {
    return bootstrapScanPromise;
  }

  bootstrapScanPromise = new Promise((resolve, reject) => {
    updateBootstrapState({
      phase: 'loading_git_commits',
      progress: 15,
      message: 'Loading git commits...'
    });
    logGatewayToolCall('git.log.scan.start', { repoRoot: BOOTSTRAP_REPO_ROOT, limit: GIT_BOOTSTRAP_LIMIT });

    execFile(
      'git',
      ['-C', BOOTSTRAP_REPO_ROOT, 'log', `-n${GIT_BOOTSTRAP_LIMIT}`, '--date=iso-strict', '--pretty=format:%H|%ad|%s'],
      { encoding: 'utf8', timeout: 25000 },
      (error, stdout, stderr) => {
        if (error) {
          updateBootstrapState({
            phase: 'error',
            progress: 100,
            message: 'Git bootstrap failed'
          }, 'bootstrap:error');
          logGatewayToolCall('git.log.scan.error', { message: error.message, stderr: stderr || '' });
          reject(error);
          return;
        }

        const commits = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [hash, timestamp, ...subjectParts] = line.split('|');
            const parsedTimestamp = Date.parse(timestamp);
            const isoTimestamp = Number.isNaN(parsedTimestamp) ? null : new Date(parsedTimestamp).toISOString();
            const day = isoTimestamp ? isoTimestamp.slice(0, 10) : (timestamp || '').slice(0, 10);
            return {
              hash,
              timestamp: isoTimestamp || timestamp,
              day,
              subject: subjectParts.join('|').trim()
            };
          });

        updateBootstrapState({
          phase: 'merging_day_anchors',
          progress: 65,
          message: 'Merging day anchors...',
          commitCount: commits.length
        });
        logGatewayToolCall('git.log.scan.complete', { commitCount: commits.length });

        const archiveNodes = scanRawArchiveNodes(BOOTSTRAP_ARCHIVE_BASE);
        logGatewayToolCall('raw.archive.scan.complete', {
          archiveBase: BOOTSTRAP_ARCHIVE_BASE,
          archiveNodeCount: archiveNodes.length
        });

        const dayCounts = new Map();
        for (const commit of commits) {
          const current = dayCounts.get(commit.day) || { commits: 0, archive: 0 };
          current.commits += 1;
          dayCounts.set(commit.day, current);
        }
        for (const node of archiveNodes) {
          const day = node.day;
          if (!day) {
            continue;
          }
          const current = dayCounts.get(day) || { commits: 0, archive: 0 };
          current.archive += 1;
          dayCounts.set(day, current);
        }

        const dayAnchors = Array.from(dayCounts.entries())
          .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
          .map(([day, counts]) => ({
            id: `day-${day}`,
            title: day,
            day,
            timestamp: `${day}T12:00:00.000Z`,
            createdAt: `${day}T12:00:00.000Z`,
            stream: 'temporal',
            kind: 'day-anchor',
            commitCount: counts.commits,
            archiveCount: counts.archive
          }));

        const commitSatellites = commits.map((commit) => ({
          id: `commit-${commit.hash.slice(0, 12)}`,
          title: commit.subject || commit.hash.slice(0, 7),
          stream: 'memory',
          kind: 'commit-satellite',
          day: commit.day,
          timestamp: commit.timestamp,
          createdAt: commit.timestamp,
          hash: commit.hash,
          shortHash: commit.hash.slice(0, 7)
        }));

        bootstrapNodes = [...dayAnchors, ...commitSatellites, ...archiveNodes];
        updateBootstrapState({
          phase: 'ready',
          progress: 100,
          message: `Bootstrap ready (${commits.length} commits, ${archiveNodes.length} RAW nodes)`,
          nodeCount: bootstrapNodes.length
        }, 'bootstrap:ready');
        logGatewayToolCall('git.anchor.merge.complete', {
          dayAnchorCount: dayAnchors.length,
          nodeCount: bootstrapNodes.length,
          archiveNodeCount: archiveNodes.length
        });
        resolve(bootstrapNodes);
      }
    );
  })
    .finally(() => {
      bootstrapScanPromise = null;
    });

  return bootstrapScanPromise;
}

// === Request Handler (used by both HTTP and HTTPS) ===
function handleRequest(req, res) {
  // Restrict CORS to known origins (configurable via env var)
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:*', 'https://localhost:*'];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.some(o => origin.includes(o.replace('*', '')))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Range, Range');
  // Add CORS preflight support for all requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const routePath = requestUrl.pathname;
    
  // Standardized error response helper
  const sendError = (code, message, details = null) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message, code, details }));
  };

  if (req.method === 'GET' && routePath === '/api/bootstrap/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    res.write('\n');
    bootstrapClients.add(res);
    sendBootstrapEvent(res, 'bootstrap:snapshot', snapshotBootstrapState());

    req.on('close', () => {
      bootstrapClients.delete(res);
    });
    return;
  }

  if (req.method === 'GET' && routePath === '/api/bootstrap/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshotBootstrapState()));
    return;
  }

  if (req.method === 'GET' && routePath === '/api/bootstrap/nodes') {
    const offsetDays = Number.parseInt(requestUrl.searchParams.get('offsetDays') || '0', 10);
    const windowDays = Number.parseInt(requestUrl.searchParams.get('windowDays') || '7', 10);
    runGitBootstrapScan()
      .then((allNodes) => {
        const payload = filterBootstrapWindow(allNodes, offsetDays, windowDays);
        const nodes = payload.nodes;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          nodes,
          meta: {
            commitCount: bootstrapState.commitCount,
            dayAnchorCount: nodes.filter((node) => node.kind === 'day-anchor').length,
            generatedAt: new Date().toISOString(),
            window: payload.window,
          },
        }));
      })
      .catch((error) => {
        sendError(500, 'Bootstrap scan failed', error.message);
      });
    return;
  }

  if (req.method === 'GET' && routePath === '/api/bootstrap/archive-file') {
    const sourcePath = requestUrl.searchParams.get('sourcePath');
    if (!sourcePath || sourcePath.includes('\0')) {
      sendError(400, 'Missing sourcePath');
      return;
    }
    const normalized = sourcePath.split('\\').join('/');
    const resolvedPath = path.resolve(BOOTSTRAP_ARCHIVE_BASE, normalized);
    const baseWithSep = `${path.resolve(BOOTSTRAP_ARCHIVE_BASE)}${path.sep}`;
    if (!(resolvedPath === path.resolve(BOOTSTRAP_ARCHIVE_BASE) || resolvedPath.startsWith(baseWithSep))) {
      sendError(403, 'Invalid archive path');
      return;
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      sendError(404, 'Archive file not found');
      return;
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
    };
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=60',
    });
    fs.createReadStream(resolvedPath).pipe(res);
    return;
  }

  // Network scanner endpoints
  if (req.method === 'GET' && req.url === '/network/devices') {
    getNetworkInfo((err, info) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/network/qr') {
    getNetworkInfo((err, info) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      // Use ciaddr from ipconfig if yiaddr/ip is null
      const ip = info.ip || info.ciaddr || '127.0.0.1';
      const url = `https://${ip}:${CONFIG.port}`;
      QRCode.toDataURL(url, (qrErr, dataUrl) => {
        if (qrErr) {
          console.error('QR generation error:', qrErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'QR generation failed', details: qrErr.message }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url, qr: dataUrl, ip }));
      });
    });
    return;
  }

  // === Config API (JARVIS Config File Integration) ===
  // JARVIS_HOME is where the .jarvis-config.json file lives
  const JARVIS_HOME = process.env.JARVIS_HOME || process.env.HOME + '/JARVIS';
  const CONFIG_FILE = path.join(JARVIS_HOME, '.jarvis-config.json');
    
  // Helper: read config from file
  function getConfig() {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Config read error:', err.message);
      return null;
    }
  }
    
  // Helper: write config to file
  function saveConfig(config) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      return true;
    } catch (err) {
      console.error('Config write error:', err.message);
      return false;
    }
  }
    
  // API: GET /api/config - Get current config
  if (req.method === 'GET' && req.url === '/api/config') {
    try {
      const fullConfig = getConfig();
      const desktopArchiving = fullConfig?.desktopArchiving || { enabled: false };
      const autoOpen = fullConfig?.autoOpen ?? false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ desktopArchiving, autoOpen }));
    } catch (err) {
      console.error('Config GET error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get config', details: err.message }));
    }
    return;
  }
    
  // API: POST /api/config - Update config
  if (req.method === 'POST' && req.url === '/api/config') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        const data = JSON.parse(body);
        const newDesktopArchiving = data.desktopArchiving;
        const newAutoOpen = data.autoOpen;
          
        if (newDesktopArchiving === undefined || newDesktopArchiving === null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'desktopArchiving object required' }));
          return;
        }
          
        // Read existing config
        const existingConfig = getConfig();
        const updatedConfig = {
          ...existingConfig,
          desktopArchiving: newDesktopArchiving
        };
        
        // Add autoOpen if provided
        if (newAutoOpen !== undefined && newAutoOpen !== null) {
          updatedConfig.autoOpen = newAutoOpen;
        }
          
        const success = saveConfig(updatedConfig);
          
        if (success) {
          const responseConfig = { desktopArchiving: newDesktopArchiving };
          if (newAutoOpen !== undefined && newAutoOpen !== null) {
            responseConfig.autoOpen = newAutoOpen;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            config: responseConfig,
            message: `Desktop archiving ${newDesktopArchiving.enabled ? 'enabled' : 'disabled'}` + 
                     (newAutoOpen !== undefined ? ` | autoOpen ${newAutoOpen ? 'enabled' : 'disabled'}` : '')
          }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to save config' }));
        }
      } catch (err) {
        console.error('Config POST error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON or config error', details: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/upload') {
    // Rate limiting: simple per-IP counter
    const clientIp = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    const RATE_LIMIT_MAX = 10; // max 10 uploads per minute per IP
        
    if (!global.rateLimitCounts) {global.rateLimitCounts = {};}
    if (!global.rateLimitCounts[clientIp]) {
      global.rateLimitCounts[clientIp] = { count: 0, windowStart: now };
    }
        
    const clientData = global.rateLimitCounts[clientIp];
    if (now - clientData.windowStart > RATE_LIMIT_WINDOW) {
      clientData.count = 0;
      clientData.windowStart = now;
    }
        
    if (clientData.count >= RATE_LIMIT_MAX) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Rate limit exceeded. Max 10 uploads per minute.' }));
      return;
    }
        
    clientData.count++;
        
    // File size limit: 50MB max
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    let totalSize = 0;
        
    const chunks = [];
    req.on('data', chunk => {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'File too large. Max 50MB allowed.' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'];
            
      const audioData = parseMultipart(buffer, contentType);
            
      if (!audioData) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid upload' }));
        return;
      }
            
      // Detect format from first bytes
      let extension = '.webm';
      if (audioData[0] === 0x1a && audioData[1] === 0x45) {
        extension = '.webm';
      } else if (audioData.toString('utf8', 0, 4) === 'OggS') {
        extension = '.ogg';
      } else if (audioData[0] === 0xFF && audioData[1] === 0xFB) {
        extension = '.mp3';
      }
            
      const timestamp = Date.now();
      const filename = `recording-${timestamp}${extension}`;
      const filepath = path.join(CONFIG.liveDir, filename);
            
      // Note: timestamp uses Date.now() for uniqueness, not formatDateForFilename

      fs.writeFileSync(filepath, audioData);
      console.log('📥 Received:', filename, `(${audioData.length} bytes)`, '→ live/');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true, 
        filename, 
        filepath,
        message: 'Saved to live/. Processing conversation...'
      }));

      // Transcribe after saving (live conversation, not batch)
      processRecording(filepath, extension);
    });
    return;
  }

  // NeuroGraph merged into root view - no separate static route
  // Data API endpoints below remain for backward compatibility

  // NeuroGraph data API (decoupled from frontend paths, works from any cwd)
  // MUST be before generic static file handler
  function resolveNeurographBrainDir(reqUrl) {
    const base = process.env.HOME || '';
    const defaultDir = path.join(base, 'JARVIS', 'RAW', 'memories');
    try {
      const parsed = new URL(reqUrl, 'http://localhost');
      const brain = (parsed.searchParams.get('brain') || '').replace(/^\/+|\/+$/g, '');
      if (brain === 'RAW/memories') {return path.join(base, 'RAW', 'memories');}
      if (brain === 'JARVIS/RAW/memories') {return defaultDir;}
      return defaultDir;
    } catch (_) {
      return defaultDir;
    }
  }
  if (req.url.startsWith('/api/neurograph/nodes.json')) {
    const brainDir = resolveNeurographBrainDir(req.url);
    const nodesPath = path.join(brainDir, 'nodes.json');
    fs.readFile(nodesPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({error: 'Failed to load nodes.json'}));
        return;
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(data);
    });
    return;
  }
    
  if (req.url.startsWith('/api/neurograph/synapses.json')) {
    const brainDir = resolveNeurographBrainDir(req.url);
    const synapsesPath = path.join(brainDir, 'synapses.json');
    fs.readFile(synapsesPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({error: 'Failed to load synapses.json'}));
        return;
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(data);
    });
    return;
  }

  // === NEW NEUROGRAPH ENDPOINTS ===

  // GET /api/neurograph - return nodes + synapses combined
  if (req.method === 'GET' && req.url === '/api/neurograph') {
    const brainDir = resolveNeurographBrainDir(req.url);
    const nodesPath = path.join(brainDir, 'nodes.json');
    const synapsesPath = path.join(brainDir, 'synapses.json');
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const synapsesData = fs.readFileSync(synapsesPath, 'utf8');
      
      const nodes = JSON.parse(nodesData);
      const synapses = JSON.parse(synapsesData);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: nodes,
        synapses: synapses,
        meta: {
          nodeCount: nodes.length,
          synapseCount: synapses.length,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('Neurograph combined API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load neurograph data', details: err.message }));
    }
    return;
  }

  // === MEMORY SOURCE ENDPOINTS ===
  // /api/memory/jarvis - Jarvis consciousness graph (default)
  // /api/memory/user - Paul's personal memory graph

  // GET /api/learnings/by-date - return learning markdown files grouped by YYYY-MM-DD
  if (req.method === 'GET' && req.url === '/api/learnings/by-date') {
    const base = process.env.HOME || '';
    const learningsDir = path.join(base, 'JARVIS', 'RAW', 'learnings');

    try {
      if (!fs.existsSync(learningsDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ byDate: {}, meta: { dateCount: 0, learningCount: 0 } }));
        return;
      }

      const byDate = {};
      let learningCount = 0;
      const dateDirs = fs.readdirSync(learningsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();

      dateDirs.forEach((dateKey) => {
        const dayDir = path.join(learningsDir, dateKey);
        const learningFiles = fs.readdirSync(dayDir, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
          .map((entry) => entry.name)
          .sort();

        const entries = [];
        learningFiles.forEach((fileName) => {
          const fullPath = path.join(dayDir, fileName);
          const content = fs.readFileSync(fullPath, 'utf8');
          const slug = fileName.replace(/\.md$/i, '');
          const headingMatch = content.match(/^#\s+(.+)$/m);
          const title = headingMatch && headingMatch[1]
            ? headingMatch[1].trim()
            : slug.replace(/[-_]+/g, ' ').trim();
          entries.push({
            slug,
            fileName,
            title,
            content
          });
        });

        if (entries.length > 0) {
          byDate[dateKey] = entries;
          learningCount += entries.length;
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        byDate,
        meta: {
          dateCount: Object.keys(byDate).length,
          learningCount,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('Learnings by date API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load learnings', details: err.message }));
    }
    return;
  }

  // GET /api/memory/jarvis - return nodes + synapses for Jarvis memory
  if (req.method === 'GET' && req.url === '/api/memory/jarvis') {
    const base = process.env.HOME || '';
    const brainDir = path.join(base, 'JARVIS', 'RAW', 'memories');
    const nodesPath = path.join(brainDir, 'nodes.json');
    const synapsesPath = path.join(brainDir, 'synapses.json');
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const synapsesData = fs.readFileSync(synapsesPath, 'utf8');
      
      const nodes = JSON.parse(nodesData);
      const synapses = JSON.parse(synapsesData);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: nodes,
        synapses: synapses,
        meta: {
          source: 'jarvis',
          nodeCount: nodes.length,
          synapseCount: synapses.length,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('Jarvis memory API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load Jarvis memory data', details: err.message }));
    }
    return;
  }

  // GET /api/memory/user - return nodes + synapses for user (Paul) memory
  if (req.method === 'GET' && req.url === '/api/memory/user') {
    const base = process.env.HOME || '';
    const brainDir = path.join(base, 'RAW', 'memories');
    const nodesPath = path.join(brainDir, 'nodes.json');
    const synapsesPath = path.join(brainDir, 'synapses.json');
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const synapsesData = fs.readFileSync(synapsesPath, 'utf8');
      
      const nodes = JSON.parse(nodesData);
      const synapses = JSON.parse(synapsesData);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: nodes,
        synapses: synapses,
        meta: {
          source: 'user',
          nodeCount: nodes.length,
          synapseCount: synapses.length,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('User memory API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load user memory data', details: err.message }));
    }
    return;
  }

  // GET /api/neurograph/node/:id - return full context for a specific neuron
  if (req.method === 'GET' && req.url.startsWith('/api/neurograph/node/')) {
    const brainDir = resolveNeurographBrainDir(req.url);
    const nodesPath = path.join(brainDir, 'nodes.json');
    
    // Extract node ID from URL
    const nodeId = req.url.split('/api/neurograph/node/')[1];
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const nodes = JSON.parse(nodesData);
      
      // Find the node by ID
      const node = nodes.find(n => n.id === nodeId);
      
      if (!node) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Node not found', nodeId }));
        return;
      }
      
      // Find all synapses connected to this node
      const synapsesPath = path.join(brainDir, 'synapses.json');
      const synapsesData = fs.readFileSync(synapsesPath, 'utf8');
      const synapses = JSON.parse(synapsesData);
      
      const connectedSynapses = synapses.filter(s => 
        s.source === nodeId || s.target === nodeId
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        node: node,
        connectedSynapses: connectedSynapses,
        meta: {
          connectedCount: connectedSynapses.length,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('Neurograph node detail API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load node data', details: err.message }));
    }
    return;
  }

  // GET /api/neurograph/search?q=term - search neurons by text
  if (req.method === 'GET' && req.url.startsWith('/api/neurograph/search')) {
    const brainDir = resolveNeurographBrainDir(req.url);
    const nodesPath = path.join(brainDir, 'nodes.json');
    
    // Extract search query from URL
    const urlObj = new URL(req.url, 'http://localhost');
    const query = urlObj.searchParams.get('q') || '';
    const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const nodes = JSON.parse(nodesData);
      
      if (!query) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Search query required (q=term)' }));
        return;
      }
      
      const lowerQuery = query.toLowerCase();
      
      // Search in label, id, description, and category
      const matchingNodes = nodes.filter(node => {
        const labelMatch = (node.label || '').toLowerCase().includes(lowerQuery);
        const idMatch = (node.id || '').toLowerCase().includes(lowerQuery);
        const descriptionMatch = (node.attributes?.description || '').toLowerCase().includes(lowerQuery);
        const categoryMatch = (node.category || '').toLowerCase().includes(lowerQuery);
        
        return labelMatch || idMatch || descriptionMatch || categoryMatch;
      }).slice(0, limit);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        results: matchingNodes,
        query: query,
        count: matchingNodes.length,
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Neurograph search API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to search nodes', details: err.message }));
    }
    return;
  }

  // GET /api/memory/recent - return last N nodes created (default: 10)
  if (req.method === 'GET' && req.url === '/api/memory/recent') {
    const brainDir = resolveNeurographBrainDir(req.url);
    const nodesPath = path.join(brainDir, 'nodes.json');
    
    // Extract limit from query parameter
    const urlObj = new URL(req.url, 'http://localhost');
    const limit = parseInt(urlObj.searchParams.get('limit')) || 10;
    
    try {
      const nodesData = fs.readFileSync(nodesPath, 'utf8');
      const nodes = JSON.parse(nodesData);
      
      // Filter nodes that have creation date in attributes
      const nodesWithDate = nodes.filter(node => 
        node.attributes?.created || 
        node.attributes?.sourceDocument ||
        (node.moments && node.moments.length > 0)
      );
      
      // Sort by creation date (newest first)
      nodesWithDate.sort((a, b) => {
        const dateA = a.attributes?.created || 
                      (a.moments && a.moments[0]) || 
                      a.attributes?.sourceDocument || 
                      '';
        const dateB = b.attributes?.created || 
                      (b.moments && b.moments[0]) || 
                      b.attributes?.sourceDocument || 
                      '';
        return dateB.localeCompare(dateA);
      });
      
      // Take the most recent ones
      const recentNodes = nodesWithDate.slice(0, limit);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: recentNodes,
        limit: limit,
        totalAvailable: nodesWithDate.length,
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Memory recent API error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load recent nodes', details: err.message }));
    }
    return;
  }

  // Serve static files (index.html, CSS, JS, video)
  if (req.method === 'GET') {
    const urlPath = req.url.split('?')[0];
    const staticCandidates = [];

    // In preview mode, prefer Vite build output so /vite.html and /assets/*
    // resolve to dist-vite instead of source files.
    if (isPreview) {
      if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/vite.html') {
        staticCandidates.push(path.join(__dirname, 'dist-vite', 'vite.html'));
      }
      if (urlPath.startsWith('/assets/')) {
        staticCandidates.push(path.join(__dirname, 'dist-vite', urlPath));
      }
    }

    staticCandidates.push(path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath));

    const filePath = staticCandidates.find((candidatePath) => (
      fs.existsSync(candidatePath) && !candidatePath.includes('..')
    ));
        
    if (filePath) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.mp4': 'video/mp4'
      };
            
      // Cache control: video + images cache 1 year, HTML/JS/CSS NO CACHE (dev mode)
      const cacheHeaders = {};
      if (['.mp4', '.png', '.jpg', '.jpeg'].includes(ext)) {
        cacheHeaders['Cache-Control'] = 'public, max-age=31536000'; // 1 year
      } else if (['.html', '.js', '.css'].includes(ext)) {
        cacheHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate'; // Dev mode - always fresh
        cacheHeaders['Pragma'] = 'no-cache';
        cacheHeaders['Expires'] = '0';
      }
            
      // Add ETag and Last-Modified for cache validation
      const stats = fs.statSync(filePath);
      cacheHeaders['ETag'] = `"${stats.ino}-${stats.size}-${stats.mtimeMs}"`;
      cacheHeaders['Last-Modified'] = stats.mtime.toUTCString();
            
      if (urlPath === '/') {
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const ip = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        const cleanIp = ip.replace('::ffff:', '');
        console.log(`[index] UA: ${userAgent.substring(0, 80)}..., IP: ${cleanIp}`);
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('File read error');
          return;
        }
        res.writeHead(200, { 
          'Content-Type': contentTypes[ext] || 'text/plain',
          ...cacheHeaders
        });
        res.end(data);
      });
      return;
    }
  }

  // Health check - includes JARVIS process status
  if (req.url === '/health') {
    // Get JARVIS process info (PID 267 or find by name)
    let jarvisPid = null;
    let jarvisMemory = null;
    let jarvisUptime = null;
        
    try {
      // Find JARVIS process by name (PID is column 2, RSS is column 6, start time is column 10)
      const psOutput = execSync('ps aux | grep -i "JARVIS" | grep -v grep | grep -v "J.A.R.V.I.S" | head -1', { encoding: 'utf8' }).trim();
            
      if (psOutput) {
        const fields = psOutput.split(/\s+/);
        jarvisPid = parseInt(fields[1]); // PID is column 2
                
        // Get memory (RSS in KB, column 6)
        const rssKB = parseInt(fields[5]);
        jarvisMemory = Math.round(rssKB / 1024) + ' MB';
                
        // Start time is column 10 (e.g., "Tue08PM")
        const startTime = fields[9] || 'unknown';
        jarvisUptime = startTime;  // Just the time, no "Since" prefix
      }
    } catch (err) {
      console.warn('Process check failed:', err.message);
    }
        
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      version: VERSION, 
      build: BUILD_DATE,
      inbox: CONFIG.inboxDir, 
      model: CONFIG.whisperModel,
      jarvis: {
        pid: jarvisPid,
        memory: jarvisMemory,
        uptime: jarvisUptime,
        alive: jarvisPid !== null
      }
    }));
    return;
  }

  // System vitals endpoint - returns OpenClaw Gateway, Ollama, and system stats
  if (req.url === '/api/vitals') {
    // Use IIFE to handle async properly
    (async () => {
      try {
        const vitals = await getSystemVitals();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(vitals));
      } catch (err) {
        console.error('Vitals endpoint error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Failed to fetch vitals', 
          details: err.message 
        }));
      }
    })();
    return;
  }

  // Breathe trigger endpoint - simulates breath cycle
  if (req.method === 'POST' && req.url === '/api/breathe/trigger') {
    console.log('🔄 Breathe trigger received');
        
    // Send SSE event or update state
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Breath cycle triggered', 
      timestamp: new Date().toISOString() 
    }));
    return;
  }

  // Process inbox endpoint (auto-triggered after recording)
  if (req.method === 'POST' && req.url === '/api/process-inbox') {
    console.log('🔄 Processing inbox...');
        
    try {
      // Get the latest transcription from archive (inbox is already empty - files moved there)
      const today = new Date().toISOString().split('T')[0];
      const archiveDir = path.join(CONFIG.archiveBase, today, 'audio');
            
      const latestTranscript = fs.readdirSync(archiveDir)
        .filter(f => f.endsWith('.wav.txt') || f.endsWith('.txt'))
        .sort()
        .reverse()[0];
            
      let userMessage = 'Inbox processed';
      if (latestTranscript) {
        const transcriptPath = path.join(archiveDir, latestTranscript);
        userMessage = fs.readFileSync(transcriptPath, 'utf8').trim();
        console.log('📝 User message:', userMessage);
      }
            
      // Run openclaw agent asynchronously (non-blocking)
      const timestamp = new Date().toISOString();
      const agentStart = Date.now();
      console.log(`[${timestamp}] ⏱️ Agent START`);
            
      // Security fix: Use execFile instead of exec to prevent command injection
      execFile('openclaw', ['agent', '--agent', 'jarvis', '--message', userMessage], { encoding: 'utf8', timeout: 120000 },
        (agentErr, agentOutput) => {
          const agentDuration = Date.now() - agentStart;
          const agentTimestamp = new Date().toISOString();
                    
          if (agentErr) {
            console.error(`[${agentTimestamp}] ❌ Agent failed:`, agentErr.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: agentErr.message }));
            return;
          }
                    
          console.log(`[${agentTimestamp}] ⏱️ Agent COMPLETE (${agentDuration}ms)`);
                    
          // Extract response text (strip logs, get actual reply)
          const responseText = agentOutput.split('\n').filter(line => 
            !line.includes('[') && !line.includes('✅') && !line.includes('❌') && line.trim().length > 10
          ).join('\n').trim();
                    
          console.log(`[${agentTimestamp}] 🤖 My response: ${responseText}`);
                    
          // Extract TTS audio filename if present in response
          const audioFilename = extractTtsAudio(responseText);
          const cleanResponseText = audioFilename ? cleanTtsResponse(responseText) : responseText;
                    
          // Post to Jarvis agent session (OpenClaw)
          try {
            // Security fix: Use execFile instead of exec to prevent command injection
            execFile('openclaw', ['sessions', 'send', '--sessionKey', 'agent:jarvis:main', '--message', cleanResponseText], { encoding: 'utf8', timeout: 120000 },
              (sessionErr) => {
                if (sessionErr) {
                  console.error(`[${agentTimestamp}] ⚠️ Session send failed:`, sessionErr.message);
                } else {
                  console.log(`[${agentTimestamp}] ✅ Posted to Jarvis agent session`);
                }
              }
            );
          } catch (sessionErr) {
            console.error(`[${agentTimestamp}] ⚠️ Session send failed:`, sessionErr.message);
          }
                    
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'processed', 
            userMessage: userMessage,
            myResponse: cleanResponseText || 'Message processed',
            audioFilename: audioFilename || null
          }));
        }
      );
      return; // Exit early - response sent in callback
    } catch (error) {
      console.error('❌ Processing failed:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: error.message }));
    }
    return;
  }

  // TTS audio playback endpoint - serves audio files for Jarvis's voice responses
  if (req.method === 'GET' && req.url.startsWith('/api/tts/')) {
    try {
      // Extract filename from URL (e.g., /api/tts/voice-1234567890.mp3)
      const urlParts = req.url.split('/');
      const filename = urlParts[urlParts.length - 1]; // Get last part
            
      // Security: Prevent directory traversal
      if (filename.includes('..') || filename.includes('/')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid filename' }));
        return;
      }
            
      // TTS files are stored in /tmp/openclaw/tts-<session-id>/ (created by OpenClaw TTS tool)
      // On macOS, /tmp is a symlink to /private/tmp, not os.tmpdir()
      const ttsBaseDir = '/private/tmp/openclaw';
            
      // Find the most recent TTS directory (by modification time, not alphabetically)
      let ttsDir = null;
      try {
        if (fs.existsSync(ttsBaseDir)) {
          const dirs = fs.readdirSync(ttsBaseDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith('tts-'))
            .map(d => ({ name: d.name, mtime: fs.statSync(path.join(ttsBaseDir, d.name)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
          if (dirs.length > 0) {
            ttsDir = path.join(ttsBaseDir, dirs[0].name);
          }
        }
      } catch (e) {
        console.log('[TTS] No TTS directories found yet');
      }
            
      // If no TTS directory exists, use liveDir as fallback
      if (!ttsDir || !fs.existsSync(ttsDir)) {
        ttsDir = CONFIG.liveDir;
      }
            
      const filePath = path.join(ttsDir, filename);
            
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`[TTS] Audio file not found: ${filename} (searched in ${ttsDir})`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Audio file not found' }));
        return;
      }
            
      // Determine content type from extension
      let contentType = 'audio/mpeg';
      if (filename.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (filename.endsWith('.wav')) {
        contentType = 'audio/wav';
      } else if (filename.endsWith('.webm')) {
        contentType = 'audio/webm';
      } else if (filename.endsWith('.ogg')) {
        contentType = 'audio/ogg';
      }
            
      // Read and serve file
      const fileContent = fs.readFileSync(filePath);
            
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileContent.length,
        'Cache-Control': 'no-cache'
      });
      res.end(fileContent);
            
      console.log(`[TTS] Serving audio: ${filename} from ${ttsDir}`);
            
    } catch (error) {
      console.error('[TTS] Error serving audio:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to serve audio', 
        details: error.message 
      }));
    }
    return;
  }

  // Clear current transcription state
  if (req.method === 'POST' && req.url === '/transcript/clear') {
    console.log('🚨 /transcript/clear - Clearing current transcription state');
    currentTranscription.transcriptPath = null;
    currentTranscription.transcript = '';
    pendingResponses.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Get latest transcription status (check both live/ and archive/, return most recent)
  if (req.url.startsWith('/transcript/status') || req.url.startsWith('/transcript/latest')) {
    try {
      const urlObj = new URL(req.url || '', 'http://localhost');
      const fileParam = urlObj.searchParams.get('file');
      const recordingBase = fileParam ? fileParam.replace(/\.[^.]+$/, '') : null;

      // If client asked for a specific upload, return that recording's result from memory (no file lookup)
      if (recordingBase && pendingResponses.has(recordingBase)) {
        const entry = pendingResponses.get(recordingBase);
        // Keep in map for 5 min so repeat polls still get the response (first response can be lost/raced)
        if (entry.at && Date.now() - entry.at > 300000) {
          pendingResponses.delete(recordingBase);
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          status: 'done',
          transcript: entry.transcript || '',
          jarvisResponse: entry.jarvisResponse ?? null,
          audioFilename: entry.audioFilename || null,
          file: fileParam
        }));
        return;
      }

      // Scoped request but not ready yet: report status for this file only
      if (recordingBase) {
        const DEBUG_TRANSCRIPT = process.env.TRANSCRIPT_DEBUG === 'true';
        const wavBase = recordingBase + '.wav';
        const txtName = wavBase + '.txt';
                
        const hasWavLive = fs.existsSync(path.join(CONFIG.liveDir, wavBase));
        const hasTxtLive = fs.existsSync(path.join(CONFIG.liveDir, txtName));
                
        if (lastError && (lastError.file || '').startsWith(recordingBase)) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            status: 'error',
            error: lastError.message,
            errorType: lastError.type,
            errorDetails: lastError.details || '',
            file: lastError.file
          }));
          return;
        }
        if (hasTxtLive) {
          const transcriptPath = path.join(CONFIG.liveDir, txtName);
          const transcript = fs.readFileSync(transcriptPath, 'utf8').trim();
          if (DEBUG_TRANSCRIPT) {
            console.log('[TranscriptLatest] scoped liveTxt', {
              recordingBase,
              file: fileParam,
              hasWavLive,
              hasTxtLive,
              at: new Date().toISOString()
            });
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'processing', transcript, message: 'Agent thinking...', file: fileParam }));
          return;
        }

        // If the transcript isn't in live/ yet, DO NOT fall back to unrelated archive transcripts.
        // Scoped polling is keyed to `?file=<uploadFilename>`, so returning "latest archive by mtime"
        // would often show the previous recording's transcript.
        if (hasWavLive) {
          if (DEBUG_TRANSCRIPT) {
            console.log('[TranscriptLatest] scoped waiting liveWav', {
              recordingBase,
              file: fileParam,
              hasWavLive,
              hasTxtLive,
              at: new Date().toISOString()
            });
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'transcribing', message: 'Transcription in progress...', file: fileParam }));
          return;
        }
        if (DEBUG_TRANSCRIPT) {
          console.log('[TranscriptLatest] scoped waiting file', {
            recordingBase,
            file: fileParam,
            hasWavLive,
            hasTxtLive,
            at: new Date().toISOString()
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'transcribing', message: 'Waiting for file...', file: fileParam }));
        return;
      }

      // No ?file: legacy "latest by mtime" behavior
      const allTranscripts = [];
      if (fs.existsSync(CONFIG.liveDir)) {
        const liveFiles = fs.readdirSync(CONFIG.liveDir)
          .filter(f => f.endsWith('.wav.txt'))
          .map(f => {
            const fullPath = path.join(CONFIG.liveDir, f);
            const mtimeMs = fs.statSync(fullPath).mtimeMs;
            return { name: f, mtimeMs, dir: 'live', path: CONFIG.liveDir };
          });
        allTranscripts.push(...liveFiles);
      }
            
      // Get transcripts from archive/ folder (today's date)
      const today = new Date().toISOString().split('T')[0];
      const archiveDir = path.join(CONFIG.archiveBase, today, 'audio');
      if (fs.existsSync(archiveDir)) {
        const archiveFiles = fs.readdirSync(archiveDir)
          .filter(f => f.endsWith('.wav.txt'))
          .map(f => {
            const fullPath = path.join(archiveDir, f);
            const mtimeMs = fs.statSync(fullPath).mtimeMs;
            return { name: f, mtimeMs, dir: 'archive', path: archiveDir };
          });
        allTranscripts.push(...archiveFiles);
      }
            
      // Sort by file mtime (most recently modified first)
      const latestFile = allTranscripts.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
            
      if (latestFile) {
        const dirPath = latestFile.dir === 'archive' ? latestFile.path : CONFIG.liveDir;
        const transcriptPath = path.join(dirPath, latestFile.name);
        const transcript = fs.readFileSync(transcriptPath, 'utf8').trim();
        const responsePath = path.join(dirPath, latestFile.name.replace('.wav.txt', '.response.txt'));
        let jarvisResponse = null;
        let audioFilename = null;
                
        // Check if response exists (server already processed this)
        if (fs.existsSync(responsePath)) {
          jarvisResponse = fs.readFileSync(responsePath, 'utf8').trim();
          // Extract TTS audio filename if present in response
          audioFilename = extractTtsAudio(jarvisResponse);
          // Clean response text for display
          jarvisResponse = audioFilename ? cleanTtsResponse(jarvisResponse) : jarvisResponse;
        }
                
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ 
          status: 'done', 
          transcript, 
          jarvisResponse,
          audioFilename: audioFilename,
          file: latestFile.name,
          timestamp: latestFile.mtimeMs
        }));
      } else {
        // No transcript yet - check for pending recordings or errors
        const wavFiles = fs.readdirSync(CONFIG.liveDir)
          .filter(f => f.endsWith('.wav') && !f.endsWith('.wav.txt'))
          .sort().reverse()[0];
                
        if (lastError) {
          // Return error to UI
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ 
            status: 'error',
            error: lastError.message,
            errorType: lastError.type,
            errorDetails: lastError.details || '',
            file: lastError.file,
            message: 'Transcription failed. Check error details.'
          }));
        } else if (wavFiles) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ 
            status: 'transcribing',
            message: 'Transcription in progress...',
            file: wavFiles
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'idle' }));
        }
      }
    } catch (err) {
      console.error('❌ Transcript endpoint error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ 
        status: 'error', 
        error: err.message,
        message: 'Failed to fetch transcript'
      }));
    }
    return;
  }

  // Get last error details (for debugging)
  if (req.url === '/error/last') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(lastError || { status: 'no_error' }));
    return;
  }

  // Serve static files
  if (req.method === 'GET') {
    let filePath = path.join(__dirname, req.url === '/' ? 'voice-recorder-simple.html' : req.url);
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    };
        
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// === Whisper Transcription ===
// Track last error for UI display
let lastError = null;
// In-memory responses for the upload that just finished (key = recording base e.g. "recording-1733")
const pendingResponses = new Map();

function processRecording(filepath, extension) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🎤 Transcribing: ${path.basename(filepath)}`);
  activeTranscriptions++;
  currentTranscription = { status: 'transcribing', file: path.basename(filepath) };
  lastError = null; // Clear previous error

  if (!fs.existsSync(modelPath)) {
    const errMsg = '❌ Model not found: ' + modelPath;
    console.error(`[${timestamp}] ${errMsg}`);
    currentTranscription = { status: 'error', error: 'Model not found' };
    lastError = { type: 'model', message: 'Model not found', file: path.basename(filepath) };
    return;
  }

  // Convert WebM to WAV for whisper.cpp reliability
  if (extension === '.webm') {
    const wavPath = filepath.replace('.webm', '.wav');
    const ffmpegPath = process.env.FMPEG_PATH || 'ffmpeg'; // Configurable via env var
    // Security fix: Use execFile instead of exec to prevent command injection
    execFile(ffmpegPath, ['-i', filepath, '-ar', '16000', '-ac', '1', wavPath, '-y'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      (convError, stdout, stderr) => {
        if (convError) {
          const errMsg = '❌ FFmpeg conversion failed: ' + convError.message;
          console.error(`[${new Date().toISOString()}] ${errMsg}`);
          currentTranscription = { status: 'error', error: 'Conversion failed' };
          lastError = { 
            type: 'ffmpeg', 
            message: 'FFmpeg conversion failed', 
            details: convError.message,
            stderr: stderr || '',
            file: path.basename(filepath)
          };
        } else {
          console.log(`[${new Date().toISOString()}] ✓ Converted WebM → WAV`);
          transcribeWithWhisper(wavPath, modelPath, '.wav');
        }
      }
    );
  } else {
    transcribeWithWhisper(filepath, modelPath, extension);
  }
}

function transcribeWithWhisper(audioPath, modelPath, extension) {
  const timestamp = new Date().toISOString();
  // Security fix: Use execFile instead of exec to prevent command injection
  // Added --language auto for multilingual auto-detection (Burmese + English support)
  execFile(CONFIG.whisperCli, ['-m', modelPath, '-otxt', audioPath, '--language', 'auto'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    (error, stdout, stderr) => {
      const txtFile = audioPath + '.txt';
            
      setTimeout(() => {
        if (fs.existsSync(txtFile)) {
          const transcript = fs.readFileSync(txtFile, 'utf8').trim();
          console.log(`[${timestamp}] 📝 Transcript: ${transcript}`);
          currentTranscription = { status: 'done', transcript };
          handleTranscript(audioPath, transcript, extension);
        } else {
          console.error(`[${timestamp}] ❌ No transcript created`);
          currentTranscription = { status: 'error', error: 'Transcription failed' };
          activeTranscriptions--;
        }
      }, 500);
    }
  );
}

function handleTranscript(filepath, transcript, extension) {
  console.log('🚨 handleTranscript CALLED!');
  console.log('📁 Filepath:', filepath);
  console.log('📝 Transcript:', transcript);
  // Save transcript alongside audio in live/
  const transcriptPath = filepath + '.txt';
  fs.writeFileSync(transcriptPath, transcript.trim());
    
  console.log('💾 Saved to live/:', filepath);
  console.log('📝 Transcript:', transcript.trim());
  currentTranscription.transcriptPath = transcriptPath;
    
  // DO NOT archive yet - wait until AFTER agent responds so UI can poll successfully
  // Archive will happen in the agent callback below

  // Extract user message from transcript and send it to the main agent
  const userMessage = transcript.trim();
  console.log('🤖 User message:', userMessage);

  // Run openclaw agent asynchronously (non-blocking)
  console.log(`[${new Date().toISOString()}] ⏱️ Agent START (handleTranscript)`);
    
  // Security fix: Use spawn instead of execFile to prevent command injection
  const agentProcess = spawn('openclaw', ['agent', '--agent', 'jarvis', '--message', userMessage], { encoding: 'utf8' });
  let agentOutput = '';
  let agentErr = null;
  const agentStart = Date.now();
    
  agentProcess.stdout.on('data', (data) => {
    agentOutput += data;
  });
    
  agentProcess.stderr.on('data', (data) => {
    console.error(`agent stderr: ${data}`);
  });
    
  agentProcess.on('error', (error) => {
    agentErr = error;
  });
    
  agentProcess.on('close', (code) => {
    const agentDuration = Date.now() - agentStart;
    const agentTimestamp = new Date().toISOString();
        
    if (code !== 0) {
      console.error(`[${agentTimestamp}] ❌ Agent failed with code ${code}`);
      // Still archive on error so we don't leave files in live/
      archiveRecording(filepath, extension, transcript);
      activeTranscriptions--;
      return;
    }
        
    console.log(`[${agentTimestamp}] ⏱️ Agent COMPLETE (${agentDuration}ms)`);
    console.log(`[${agentTimestamp}] ✅ Sent user message to jarvis agent`);
        
    let responseText = agentOutput.split('\n')
      .filter(line => !line.includes('[') && !line.includes('✅') && !line.includes('❌') && line.trim().length > 10)
      .join('\n').trim();
        
    // Archive AFTER agent completes - transcript is now available in liveDir for UI polling
    const responsePath = archiveRecording(filepath, extension, transcript);
        
    if (responsePath && responseText) {
      fs.writeFileSync(responsePath, responseText);
    }
        
    // Extract TTS audio filename if present in response
    const audioFilename = extractTtsAudio(responseText);
    const cleanResponseText = audioFilename ? cleanTtsResponse(responseText) : responseText;
        
    // So client can get this recording's response in the poll body (no file lookup); keep for 5 min so repeat polls get it
    const recordingBase = path.basename(filepath).replace(/\.[^.]+$/, '');
    pendingResponses.set(recordingBase, { 
      transcript, 
      jarvisResponse: cleanResponseText || null, 
      audioFilename: audioFilename,
      at: Date.now() 
    });
    activeTranscriptions--;
  });
}

function archiveRecording(filepath, extension, transcript) {
  const datePart = formatDateForArchive();
  const archiveDir = path.join(CONFIG.archiveBase, datePart, 'audio');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
    
  const timestamp = formatDateForFilename();
  const archivedName = `convo-jarvis-${timestamp}${extension}`;
  const responsePath = path.join(archiveDir, archivedName.replace('.wav', '.response.txt'));

  // Move audio files
  try {
    fs.renameSync(filepath, path.join(archiveDir, archivedName));
    fs.renameSync(filepath + '.txt', path.join(archiveDir, `${archivedName}.txt`));

    // Also move webm if exists
    const webmPath = filepath.replace('.wav', '.webm');
    if (fs.existsSync(webmPath)) {
      fs.renameSync(webmPath, path.join(archiveDir, archivedName.replace('.wav', '.webm')));
    }

    console.log('💾 Archived to:', archiveDir);
    console.log('📁 Files:', archivedName);
  } catch (err) {
    console.error('⚠️ Archive failed:', err.message);
    return null;
  }
  return responsePath;
}

// === SYSTEM VITALS CACHING ===
let vitalsCache = { data: null, timestamp: 0 };
const VITALS_CACHE_TTL = 30000; // 30 seconds

async function getSystemVitals() {
  const now = Date.now();
  if (vitalsCache.data && (now - vitalsCache.timestamp < VITALS_CACHE_TTL)) {
    return vitalsCache.data;
  }
    
  const data = {
    openclawGateway: { status: 'Unknown', pid: null, memoryMB: null, uptime: null },
    ollama: { status: 'Unknown', models: 0, modelList: [], error: null },
    system: { cpu: { usagePercent: null }, memory: { totalGB: null, usedGB: null, usedPercent: null }, disk: { total: null, used: null, usedPercent: null } }
  };
    
  // Check OpenClaw Gateway process (more robust detection)
  try {
    const psOutput = execSync('ps aux | grep -i "openclaw" | grep -v grep | grep -v "grep"', { encoding: 'utf8' }).trim();
    if (psOutput) {
      const lines = psOutput.split('\n');
      const gatewayLine = lines.find(line => line.toLowerCase().includes('gateway'));
            
      if (gatewayLine) {
        const fields = gatewayLine.split(/\s+/);
        const pid = parseInt(fields[1]);
        const rssKB = parseInt(fields[5]);
                
        // Get process start time
        const startTimeOutput = execSync(`ps -o lstart= -p ${pid}`, { encoding: 'utf8' }).trim();
        const startDate = new Date(startTimeOutput);
        const uptimeMs = Date.now() - startDate.getTime();
                
        data.openclawGateway = {
          status: 'Running',
          pid: pid,
          memoryMB: Math.round(rssKB / 1024),
          uptime: uptimeMs
        };
      }
    }
  } catch (err) {
    console.log('Gateway detection error:', err.message);
  }
    
  // Check Ollama connection with better error handling
  try {
    const ollamaCheck = execSync('curl -s --connect-timeout 3 http://localhost:11434/api/tags', { 
      encoding: 'utf8',
      timeout: 5000 
    });
        
    const modelsData = JSON.parse(ollamaCheck);
        
    if (modelsData.models && modelsData.models.length > 0) {
      data.ollama = {
        status: 'Connected',
        models: modelsData.models.length,
        modelList: modelsData.models
      };
    } else {
      data.ollama = {
        status: 'Running (no models)',
        models: 0,
        modelList: []
      };
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      data.ollama = {
        status: 'Not Running',
        models: 0,
        modelList: [],
        error: 'Ollama not running on localhost:11434'
      };
    } else {
      data.ollama = {
        status: 'Unknown',
        models: 0,
        modelList: [],
        error: err.message
      };
    }
    console.log('Ollama detection error:', err.message);
  }
    
  // Get system stats - use os.totalmem() for actual RAM
  try {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
        
    data.system.memory.totalGB = (totalMemBytes / 1024 / 1024 / 1024).toFixed(2);
    data.system.memory.usedGB = (usedMemBytes / 1024 / 1024 / 1024).toFixed(2);
    data.system.memory.usedPercent = Math.round((usedMemBytes / totalMemBytes) * 100);
  } catch (err) {
    console.log('Memory stats error:', err.message);
  }
    
  // CPU usage calculation - first sample captures baseline, second sample returns value
  try {
    const currentCpuInfo = os.cpus().map(cpu => cpu.times);
    const totalIdle = currentCpuInfo.reduce((acc, cpu) => acc + cpu.idle, 0);
    const totalTick = currentCpuInfo.reduce((acc, cpu) => 
      acc + cpu.user + cpu.nice + cpu.sys + cpu.idle + cpu.irq + cpu.softirq, 0);
        
    const prevTotalIdle = previousCpuInfo.reduce((acc, cpu) => acc + cpu.idle, 0);
    const prevTotalTick = previousCpuInfo.reduce((acc, cpu) => 
      acc + cpu.user + cpu.nice + cpu.sys + cpu.idle + cpu.irq + cpu.softirq, 0);
        
    const idleDelta = totalIdle - prevTotalIdle;
    const tickDelta = totalTick - prevTotalTick;
        
    if (tickDelta > 0 && idleDelta >= 0) {
      const usagePercent = Math.round(Math.max(0, (1 - idleDelta / tickDelta) * 100));
      data.system.cpu.usagePercent = usagePercent;
      console.log('📊 CPU usage:', usagePercent + '%');
    } else {
      // First sample or edge case - return 0% as safe default
      data.system.cpu.usagePercent = 0;
      console.log('📊 CPU baseline captured (first sample)');
    }
        
    previousCpuInfo = currentCpuInfo;
  } catch (err) {
    console.log('CPU stats error:', err.message);
  }
    
  // Disk usage - parse df output with GB abbreviation fix
  try {
    const dfOutput = execSync('df -h /', { encoding: 'utf8' }).trim();
    const lines = dfOutput.split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const diskTotal = parts[1].replace('Gi', 'GB').replace('Mi', 'MB');
      const diskUsed = parts[2].replace('Gi', 'GB').replace('Mi', 'MB');
      const usedPercent = parseInt(parts[4].replace('%', '')) || null;
            
      data.system.disk.total = diskTotal;
      data.system.disk.used = diskUsed;
      data.system.disk.usedPercent = usedPercent;
    }
  } catch (err) {
    console.log('Disk stats error:', err.message);
  }
    
  vitalsCache = { data, timestamp: now };
  return data;
}

// === Start Server ===
const protocol = HTTPS_ENABLED ? 'https' : 'http';
const baseUrl = `${protocol}://localhost:${CONFIG.port}`;

function logStartup() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🎙️  JARVIS VOICE PIPELINE RUNNING                    ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Version: ${VERSION} (${BUILD_DATE})                            ║`);
  console.log(`║  Upload URL: ${baseUrl}/upload${HTTPS_ENABLED ? '                 ' : '                  '}║`);
  console.log('║                                                           ║');
  console.log('║  Flow: Record → Upload → Transcribe → Respond → Archive  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log('Config:');
  console.log('  port:', CONFIG.port);
  console.log('  inboxDir:', CONFIG.inboxDir);
  console.log('  liveDir:', CONFIG.liveDir);
  console.log('  modelDir:', CONFIG.modelDir);
  console.log('  archiveBase:', CONFIG.archiveBase);
  console.log('  gatewayUrl:', CONFIG.gatewayUrl);
  console.log('  whisperModel:', CONFIG.whisperModel);
  console.log('  whisperCli:', CONFIG.whisperCli);
  console.log('  neurographDir:', CONFIG.neurographDir);
    
  // Whisper.cpp health check
  console.log('');
  const whisperHealthy = checkWhisperHealth();
  if (!whisperHealthy) {
    console.error('\n⚠️ Whisper CLI check failed - transcription will likely fail');
    console.error('Please ensure whisper-cli is installed and accessible.');
  }
  console.log('');
  console.log('Paths / URLs:');
  console.log('  JARVIS UI:    ', baseUrl + '/');
  console.log('');
  if (HTTPS_ENABLED) {
    console.log('🔒 HTTPS enabled (self-signed cert) — mobile mic access works');
  }
    
  // Initialize CPU baseline on startup so first /vitals call returns valid value
  console.log('📊 Initializing CPU baseline...');
  const cpuSample = os.cpus().map(cpu => cpu.times);
  const totalIdle = cpuSample.reduce((acc, cpu) => acc + cpu.idle, 0);
  const totalTick = cpuSample.reduce((acc, cpu) => 
    acc + cpu.user + cpu.nice + cpu.sys + cpu.idle + cpu.irq + cpu.softirq, 0);
  previousCpuInfo = cpuSample;
  console.log('✅ CPU baseline initialized');
}

const server = HTTPS_ENABLED
  ? https.createServer(HTTPS_OPTIONS, handleRequest)
  : http.createServer(handleRequest);
server.listen(CONFIG.port, logStartup);

// Archive leftovers on startup (safety net for crashed timeouts)
function archiveLeftovers() {
  if (!fs.existsSync(CONFIG.liveDir)) {return;}
  const leftoverFiles = fs.readdirSync(CONFIG.liveDir)
    .filter(f => f.endsWith('.wav.txt') && !f.includes('OFFLINE'));
  if (leftoverFiles.length === 0) {return;}
    
  console.log(`\n🔄 Found ${leftoverFiles.length} leftover files in live/ - archiving...`);
  leftoverFiles.forEach(f => {
    const base = f.replace('.wav.txt', '');
    const wavPath = path.join(CONFIG.liveDir, base + '.wav');
    const webmPath = path.join(CONFIG.liveDir, base + '.webm');
    const txtPath = path.join(CONFIG.liveDir, f);
        
    // Read transcript
    const transcript = fs.readFileSync(txtPath, 'utf8').trim();
        
    // Archive
    const datePart = new Date().toISOString().split('T')[0];
    const archiveDir = path.join(CONFIG.archiveBase, datePart, 'audio');
    if (!fs.existsSync(archiveDir)) {fs.mkdirSync(archiveDir, { recursive: true });}
        
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const archivedName = `convo-jarvis-${timestamp}.wav`;
        
    try {
      if (fs.existsSync(wavPath)) {fs.renameSync(wavPath, path.join(archiveDir, archivedName));}
      fs.renameSync(txtPath, path.join(archiveDir, `${archivedName}.txt`));
      if (fs.existsSync(webmPath)) {fs.renameSync(webmPath, path.join(archiveDir, archivedName.replace('.wav', '.webm')));}
      console.log(`  ✅ Archived: ${f}`);
    } catch (err) {
      console.error(`  ⚠️ Failed: ${f} - ${err.message}`);
    }
  });
  console.log('✅ Leftover archive complete\n');
}

// === HELPER: Safe exec with timeout ===
function safeExecWithTimeout(command, args, options = {}, timeoutMs, callback) {
  const child = spawn(command, args, { ...options, encoding: 'utf8' });
    
  let timeoutId;
  let exited = false;
    
  const cleanup = (code, signal) => {
    if (exited) {return;}
    exited = true;
    clearTimeout(timeoutId);
    if (callback) {callback(code, signal);}
  };
    
  child.on('exit', cleanup);
  child.on('error', (err) => {
    if (!exited) {
      exited = true;
      clearTimeout(timeoutId);
      if (callback) {callback(err.code, err.signal);}
    }
  });
    
  timeoutId = setTimeout(() => {
    if (!exited) {
      exited = true;
      console.warn(`⚠️ Process timeout (${timeoutMs}ms): ${command}`);
      child.kill('SIGKILL');
      if (callback) {callback(null, 'timeout');}
    }
  }, timeoutMs);
}

// === HELPER: Spawn with timeout for long-running processes ===

// Track active transcriptions for graceful shutdown
let activeTranscriptions = 0;

// Graceful shutdown - wait for active transcriptions to complete
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
    
  if (activeTranscriptions > 0) {
    console.log(`⏳ Waiting for ${activeTranscriptions} active transcription(s) to complete...`);
    // Wait up to 30 seconds for active transcriptions
    const shutdownInterval = setInterval(() => {
      if (activeTranscriptions === 0) {
        clearInterval(shutdownInterval);
        server.close(() => {
          console.log('✓ Server stopped');
          process.exit(0);
        });
      }
    }, 500);
        
    // Force exit after 30 seconds
    setTimeout(() => {
      clearInterval(shutdownInterval);
      console.log('⚠️ Forced shutdown after timeout');
      server.close(() => {
        console.log('✓ Server stopped');
        process.exit(0);
      });
    }, 30000);
  } else {
    server.close(() => {
      console.log('✓ Server stopped');
      process.exit(0);
    });
  }
});

// Run leftover archive on startup
archiveLeftovers();
