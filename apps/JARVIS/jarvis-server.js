#!/usr/bin/env node
// JARVIS Voice Upload Server (whisper.cpp - direct transcription)
// Portable: No hardcoded paths, configurable via environment variables

// Set process name for Activity Monitor
process.title = 'JARVIS';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const QRCode = require('qrcode');
const deviceRegistry = require('./device-registry');

// === HTTPS Configuration ===
const HTTPS_ENABLED = true;
const HTTPS_OPTIONS = {
    key: fs.readFileSync(path.join(__dirname, 'assets', 'https-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'assets', 'https-cert.pem'))
};


// === Configuration (Portable - No Hardcoded Paths) ===
const VERSION = '2.9.5';
const BUILD_DATE = '2026-03-18';

const CONFIG = {
    port: process.env.VOICE_PORT || 18787,
    inboxDir: process.env.VOICE_INBOX_DIR || path.join(process.env.HOME, 'JARVIS', 'inbox'),
    liveDir: process.env.VOICE_LIVE_DIR || path.join(process.env.HOME, 'JARVIS', 'live'),
    modelDir: process.env.VOICE_MODEL_DIR || path.join(__dirname, 'assets'),
    archiveBase: process.env.VOICE_ARCHIVE_BASE || path.join(process.env.HOME, 'RAW', 'archive'),
    gatewayUrl: process.env.VOICE_GATEWAY_URL || 'ws://127.0.0.1:18789',
    whisperModel: process.env.VOICE_WHISPER_MODEL || 'ggml-large-v3.bin',
    whisperCli: process.env.VOICE_WHISPER_CLI || findWhisperCli(),
    neurographDir: process.env.NEUROGRAPH_DIR || path.join(__dirname, 'neuro-graph')
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
        if (fs.existsSync(candidate)) return candidate;
    }
    return 'whisper-cli'; // Fallback to PATH
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
  if (isGateway) return 'router';
  const manufacturer = getManufacturer(mac);
  if (manufacturer.includes('Apple')) return 'laptop/phone';
  if (manufacturer.includes('Samsung')) return 'phone';
  if (manufacturer.includes('Nokia')) return 'phone';
  if (manufacturer.includes('Huawei')) return 'phone';
  if (manufacturer.includes('Amazon')) return 'smart device';
  return 'device';
}

function getNetworkInfo(callback) {
  // Use full paths for macOS commands
  exec('/usr/sbin/ipconfig getpacket en0', { timeout: 5000 }, (err1, ipconfigOut) => {
    if (err1) return callback(err1);
    
    exec('/usr/sbin/arp -a', { timeout: 5000 }, (err2, arpOut) => {
      if (err2) return callback(err2);
      
      const info = { ip: null, netmask: null, gateway: null, devices: [] };
      
      // Parse ipconfig for IP and gateway
      const ipLines = ipconfigOut.split('\n');
      ipLines.forEach(line => {
        if (line.includes('server_identifier')) {
          const match = line.match(/server_identifier.*?:\s*([\d.]+)/);
          if (match) info.gateway = match[1];
        }
        if (line.includes('ciaddr')) {
          const match = line.match(/ciaddr\s*=\s*([\d.]+)/);
          if (match && match[1] !== '0.0.0.0') info.ip = match[1];  // ciaddr = client IP
        }
        if (line.includes('yiaddr') && !info.ip) {
          const match = line.match(/yiaddr\s*=\s*([\d.]+)/);
          if (match) info.ip = match[1];  // yiaddr = your IP
        }
      });
      
      // Fallback: use first non-gateway device IP
      if (!info.ip && info.devices.length > 0) {
        const myDevice = info.devices.find(d => !d.isGateway);
        if (myDevice) info.ip = myDevice.ip;
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
    });
  });
}

// === Parse multipart form data ===
function parseMultipart(buffer, contentType) {
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return null;
    
    const boundaryBuffer = Buffer.from('--' + boundary);
    const start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
    const end = buffer.indexOf(boundaryBuffer, start);
    
    if (start < boundaryBuffer.length || end === -1) return null;
    
    const headerEnd = buffer.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) return null;
    
    return buffer.slice(headerEnd + 4, end - 2);
}

// === Request Handler (used by both HTTP and HTTPS) ===
function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
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

    // Device registry API - list all devices
    if (req.method === 'GET' && req.url === '/api/devices') {
      const devices = deviceRegistry.listDevices();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ devices }));
      return;
    }

    // Device registry API - register/update device
    if (req.method === 'POST' && req.url === '/api/register-device') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString();
          const data = JSON.parse(body);
          const { mac, name, owner } = data;
          
          if (!mac) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MAC address required' }));
            return;
          }
          
          const device = deviceRegistry.updateDevice(mac, { name, owner: owner || 'unknown' });
          if (device) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, device }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Device not found' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Device registry API - delete device
    if (req.method === 'DELETE' && req.url.startsWith('/api/delete-device')) {
      const mac = req.url.split('=')[1];
      if (!mac) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MAC address required' }));
        return;
      }
      
      const removed = deviceRegistry.deleteDevice(mac);
      if (removed) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, device: removed }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device not found' }));
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/upload') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
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

    // Serve neurograph static files
    if (req.method === 'GET' && req.url.startsWith('/neuro-graph/')) {
        // Strip query string and decode URL so filenames with spaces and unicode work
        const urlWithoutQuery = req.url.split('?')[0];
        const rawPath = urlWithoutQuery.replace('/neuro-graph/', '');
        const neuroPath = decodeURIComponent(rawPath);
        const filePath = path.join(CONFIG.neurographDir, neuroPath === '/' || neuroPath === '' ? 'index.html' : neuroPath);
        
        if (fs.existsSync(filePath) && !filePath.includes('..')) {
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
            
            const cacheHeaders = {};
            if (['.mp4', '.png', '.jpg', '.jpeg'].includes(ext)) {
                cacheHeaders['Cache-Control'] = 'public, max-age=31536000';
            } else if (['.html', '.js', '.css'].includes(ext)) {
                cacheHeaders['Cache-Control'] = 'public, max-age=3600';
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

    // Serve static files (index.html, CSS, JS, video)
    if (req.method === 'GET') {
        const urlPath = req.url.split('?')[0];
        const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
        
        if (fs.existsSync(filePath) && !filePath.includes('..')) {
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
            
            // Device fingerprinting on root path (index.html)
            if (urlPath === '/') {
                const userAgent = req.headers['user-agent'] || 'Unknown';
                const ip = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
                const cleanIp = ip.replace('::ffff:', ''); // Strip IPv6 prefix
                
                console.log(`[Device Fingerprint] UA: ${userAgent.substring(0, 80)}..., IP: ${cleanIp}`);
                
                // Get MAC from ARP table
                const mac = deviceRegistry.getMacFromArp(cleanIp);
                
                if (mac) {
                    const device = deviceRegistry.findOrCreateDevice(mac, userAgent, cleanIp);
                    console.log(`[Device] ${device.name} (${device.mac}) - Visit #${device.connection_count}`);
                    
                    // Pass device info to frontend via custom headers
                    cacheHeaders['X-Device-Id'] = device.id;
                    cacheHeaders['X-Device-Name'] = device.name;
                    cacheHeaders['X-Device-Mac'] = device.mac;
                    cacheHeaders['X-Device-Last-Seen'] = device.last_seen;
                    cacheHeaders['X-Device-Connection-Count'] = String(device.connection_count);
                } else {
                    console.log(`[Device] MAC lookup failed for IP: ${cleanIp}`);
                }
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
            
            // Run openclaw agent with the user's actual message (handles inbox processing + response)
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] 🤖 Running openclaw agent...`);
            const agentOutput = execSync(`openclaw agent --agent main --message "${userMessage.replace(/"/g, '\\"')}" 2>&1`, { encoding: 'utf8' });
            
            // Extract response text (strip logs, get actual reply)
            const responseText = agentOutput.split('\n').filter(line => 
                !line.includes('[') && !line.includes('✅') && !line.includes('❌') && line.trim().length > 10
            ).join('\n').trim();
            
            const responseTimestamp = new Date().toISOString();
            console.log(`[${responseTimestamp}] 🤖 My response: ${responseText}`);
            
            // Post to gateway chat (current channel - webchat)
            try {
                execSync(`openclaw message send --message "${responseText.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
                console.log(`[${responseTimestamp}] ✅ Posted to gateway chat`);
            } catch (msgErr) {
                console.error(`[${responseTimestamp}] ⚠️ Gateway post failed: ${msgErr.message}`);
            }
            
            // Send to current session (webchat)
            try {
                execSync(`openclaw message send --channel webchat --message "${responseText.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
                console.log(`[${responseTimestamp}] ✅ Sent to webchat`);
            } catch (webchatErr) {
                console.error(`[${responseTimestamp}] ⚠️ Webchat send failed: ${webchatErr.message}`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'processed', 
                userMessage: userMessage,
                myResponse: responseText || 'Message processed'
            }));
        } catch (error) {
            console.error('❌ Processing failed:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
        }
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
                    file: fileParam
                }));
                return;
            }

            // Scoped request but not ready yet: report status for this file only
            if (recordingBase) {
                const wavBase = recordingBase + '.wav';
                const txtName = wavBase + '.txt';
                const hasWav = fs.existsSync(path.join(CONFIG.liveDir, wavBase));
                const hasTxt = fs.existsSync(path.join(CONFIG.liveDir, txtName));
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
                if (hasTxt) {
                    const transcriptPath = path.join(CONFIG.liveDir, txtName);
                    const transcript = fs.readFileSync(transcriptPath, 'utf8').trim();
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ status: 'processing', transcript, message: 'Agent thinking...', file: fileParam }));
                    return;
                }
                if (hasWav) {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ status: 'transcribing', message: 'Transcription in progress...', file: fileParam }));
                    return;
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
                
                // Check if response exists (server already processed this)
                if (fs.existsSync(responsePath)) {
                    jarvisResponse = fs.readFileSync(responsePath, 'utf8').trim();
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ 
                    status: 'done', 
                    transcript, 
                    jarvisResponse,
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
        const ffmpegPath = '/opt/homebrew/bin/ffmpeg';
        exec(`ffmpeg -i "${filepath}" -ar 16000 -ac 1 "${wavPath}" -y 2>&1`, 
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
    exec(`${CONFIG.whisperCli} -m "${modelPath}" -otxt "${audioPath}" 2>&1`, 
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
    
    // Archive IMMEDIATELY - no timeout (server restarts lose files)
    const responsePath = archiveRecording(filepath, extension, transcript);

    // Extract user message from transcript and send it to the main agent
    const userMessage = transcript.trim();
    console.log('🤖 User message:', userMessage);

    let responseText = '';
    try {
        const agentOutput = execSync(
            `openclaw agent --agent main --message "${userMessage.replace(/"/g, '\\"')}" 2>&1`,
            { encoding: 'utf8' }
        );
        console.log('✅ Sent user message to main agent');
        responseText = agentOutput.split('\n')
            .filter(line => !line.includes('[') && !line.includes('✅') && !line.includes('❌') && line.trim().length > 10)
            .join('\n').trim();
        if (responsePath && responseText) {
            fs.writeFileSync(responsePath, responseText);
        }
    } catch (agentErr) {
        console.error('❌ Failed to send message to agent:', agentErr.message);
    }
    // So client can get this recording's response in the poll body (no file lookup); keep for 5 min so repeat polls get it
    const recordingBase = path.basename(filepath).replace(/\.[^.]+$/, '');
    pendingResponses.set(recordingBase, { transcript, jarvisResponse: responseText || null, at: Date.now() });
}

function archiveRecording(filepath, extension, transcript) {
    const datePart = new Date().toISOString().split('T')[0];
    const archiveDir = path.join(CONFIG.archiveBase, datePart, 'audio');
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
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
    console.log('║  Flow: Record → Upload → Transcribe → Archive            ║');
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
    console.log('');
    console.log('Paths / URLs:');
    console.log('  JARVIS UI:    ', baseUrl + '/');
    console.log('  Neuro graph:  ', baseUrl + '/neuro-graph/');
    console.log('');
    if (HTTPS_ENABLED) {
        console.log('🔒 HTTPS enabled (self-signed cert) — mobile mic access works');
    }
}

const server = HTTPS_ENABLED
    ? https.createServer(HTTPS_OPTIONS, handleRequest)
    : http.createServer(handleRequest);
server.listen(CONFIG.port, logStartup);

// Archive leftovers on startup (safety net for crashed timeouts)
function archiveLeftovers() {
    if (!fs.existsSync(CONFIG.liveDir)) return;
    const leftoverFiles = fs.readdirSync(CONFIG.liveDir)
        .filter(f => f.endsWith('.wav.txt') && !f.includes('OFFLINE'));
    if (leftoverFiles.length === 0) return;
    
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
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        const archivedName = `convo-jarvis-${timestamp}.wav`;
        
        try {
            if (fs.existsSync(wavPath)) fs.renameSync(wavPath, path.join(archiveDir, archivedName));
            fs.renameSync(txtPath, path.join(archiveDir, `${archivedName}.txt`));
            if (fs.existsSync(webmPath)) fs.renameSync(webmPath, path.join(archiveDir, archivedName.replace('.wav', '.webm')));
            console.log(`  ✅ Archived: ${f}`);
        } catch (err) {
            console.error(`  ⚠️ Failed: ${f} - ${err.message}`);
        }
    });
    console.log('✅ Leftover archive complete\n');
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => {
        console.log('✓ Server stopped');
        process.exit(0);
    });
});

// Run leftover archive on startup
archiveLeftovers();
