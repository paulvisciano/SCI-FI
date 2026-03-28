// JARVIS Voice Recorder UI - extracted from index.html

// Client version (bumped when UI changes ship)
const CLIENT_VERSION = '3.1.0';
const CLIENT_BUILD_DATE = '2026-03-28';

// Fade server status after 3 seconds, reappear on hover
let fadeTimer;
function setupServerStatusFade() {
  const serverStatus = document.getElementById('server-status');
  const titleContainer = document.querySelector('.title-container');

  if (!serverStatus || !titleContainer) {return;}

  const DEBUG = false; // Set to true for development logging

  // Fade out after 3 seconds
  fadeTimer = setTimeout(() => {
    serverStatus.classList.add('faded');
    if (DEBUG) {console.log('[UI] Server status faded out');}
  }, 3000);

  // Fade in on hover over title container or status
  titleContainer.addEventListener('mouseenter', () => {
    serverStatus.classList.remove('faded');
    clearTimeout(fadeTimer);
    if (DEBUG) {console.log('[UI] Server status faded in (title hover)');}
  });

  titleContainer.addEventListener('mouseleave', () => {
    fadeTimer = setTimeout(() => {
      serverStatus.classList.add('faded');
      if (DEBUG) {console.log('[UI] Server status faded out (title leave)');}
    }, 2000);
  });

  serverStatus.addEventListener('mouseenter', () => {
    serverStatus.classList.remove('faded');
    clearTimeout(fadeTimer);
    if (DEBUG) {console.log('[UI] Server status faded in (status hover)');}
  });

  serverStatus.addEventListener('mouseleave', () => {
    fadeTimer = setTimeout(() => {
      serverStatus.classList.add('faded');
      if (DEBUG) {console.log('[UI] Server status faded out (status leave)');}
    }, 2000);
  });
}

function toggleTranscriptPath() {
  const pathEl = document.getElementById('transcript-path');
  if (pathEl.style.display === 'none' || pathEl.style.display === '') {
    pathEl.style.display = 'block';
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    pathEl.textContent = `~/RAW/archive/${today}/audio/${today}-${time}-*.wav`;
    pathEl.title = `Full path: /Users/paulvisciano/RAW/archive/${today}/audio/`;
  } else {
    pathEl.style.display = 'none';
  }
}

function toggleTranscriptFullscreen() {
  const transcriptEl = document.getElementById('transcript');
  const expandBtn = document.querySelector('.transcript-expand-btn');

  if (!transcriptEl || !expandBtn) {return;}

  transcriptEl.classList.toggle('fullscreen');

  if (transcriptEl.classList.contains('fullscreen')) {
    expandBtn.textContent = '⛶ Collapse';
    expandBtn.classList.add('expanded');
    expandBtn.title = 'Collapse to normal size';
  } else {
    expandBtn.textContent = '⛶ Expand';
    expandBtn.classList.remove('expanded');
    expandBtn.title = 'Expand to fullscreen';
  }
}

// Global API base for all fetch calls
const API_BASE = window.location.protocol + '//' + (window.location.host || 'localhost:18787');

const status = document.getElementById('status');
const transcript = document.getElementById('transcript');
const transcriptText = document.getElementById('transcript-text');
const jarvisResponse = document.getElementById('jarvis-response');
const responseText = document.getElementById('response-text');
const jarvisOrb = document.getElementById('jarvis-orb');
const jarvisOrbContainer = document.getElementById('jarvis-orb-container');
const jarvisVideo = document.getElementById('jarvis-video');

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isOrbEngaged = false;

// Live streaming transcription
let audioContext;
let mediaStreamSource;
let scriptProcessor;
let streamingInterval;
let lastTranscript = '';

// Check if video loaded successfully, if not show fallback button
jarvisVideo.addEventListener('error', () => {
  console.error('Video failed to load, showing fallback button');
  jarvisOrb.style.display = 'none';
});

jarvisVideo.addEventListener('loadeddata', () => {
  console.log('Video loaded successfully');
  // Set playback speed to 1.25x - slightly faster, still smooth
  jarvisVideo.playbackRate = 1.25;
});

// Mouse enter/leave effects - make ORB feel alive
jarvisOrb.addEventListener('mouseenter', () => {
  if (!isRecording) {
    jarvisOrb.classList.add('engaged');
    // No speed change - keep video smooth
  }
});

jarvisOrb.addEventListener('mouseleave', () => {
  if (!isRecording && !isOrbEngaged) {
    jarvisOrb.classList.remove('engaged');
    // No speed change - keep video smooth
  }
});

// ORB click handler - engage/disengage JARVIS
jarvisOrbContainer.addEventListener('click', () => {
  isOrbEngaged = !isOrbEngaged;

  if (isOrbEngaged) {
    jarvisOrb.classList.add('engaged');
    // No speed change - keep video smooth
  } else {
    jarvisOrb.classList.remove('engaged');
    // No speed change - keep video smooth
  }
});

// Mobile tap feedback - add tapped class briefly on touch
jarvisOrbContainer.addEventListener('touchstart', () => {
  jarvisOrbContainer.classList.add('tapped');
}, { passive: true });

jarvisOrbContainer.addEventListener('touchend', () => {
  jarvisOrbContainer.classList.remove('tapped');
}, { passive: true });

// Check if browser supports MediaRecorder (mobile browsers may need HTTPS)
const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
if (!hasMediaDevices) {
  console.warn('MediaDevices check failed, but attempting recording anyway...');
}

// ORB click/tap - start/stop recording (works on mobile + desktop)
// Mobile: tap orb (no Space key)
// Desktop: can use Space key OR tap orb (both work)
jarvisOrb.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
  if (DEBUG) {console.log('[Orb click] Recording toggled');}
});

// Double-click also toggles recording (for users who prefer it)
jarvisOrb.addEventListener('dblclick', async (e) => {
  e.stopPropagation();
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
  if (DEBUG) {console.log('[Orb dblclick] Recording toggled');}
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log('audio/webm;codecs=opus not supported, trying audio/webm');
      options.mimeType = 'audio/webm';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log('audio/webm not supported, trying audio/ogg;codecs=opus');
      options.mimeType = 'audio/ogg;codecs=opus';
    }
    console.log('MediaRecorder mimeType:', options.mimeType);
    console.log('Is type supported:', MediaRecorder.isTypeSupported(options.mimeType));

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log('ondataavailable, chunk size:', event.data.size);
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      status.textContent = '❌ Recording error';
    };

    mediaRecorder.onstop = () => {
      console.log('MediaRecorder onstop triggered');
      console.log('audioChunks length before onstop:', audioChunks.length);
      sendToServer();
    };

    mediaRecorder.start(2000);
    isRecording = true;

    // Recording state - subtle red glow (CSS-only, no video reflow)
    jarvisOrb.classList.add('recording');

    // Update status text
    status.textContent = '🔴 Recording...';

    // Update recording hint
    const hint = document.getElementById('recording-hint');
    if (hint) {
      hint.textContent = 'Press Space to stop recording';
    }

    transcript.classList.add('visible');
    transcriptText.textContent = 'Listening...';
    jarvisResponse.style.display = 'none';
  } catch (err) {
    status.textContent = '❌ Microphone access denied';
    console.error('Mic error:', err);
  }
}

async function stopRecording() {
  console.log('stopRecording: calling mediaRecorder.stop()');
  mediaRecorder.stop();
  isRecording = false;
  console.log('stopRecording: mediaRecorder stopped, isRecording = false');

  // Clear transcript immediately to prevent flash of old content
  transcriptText.textContent = '';

  // Clear response area to prevent flash of old response
  responseText.innerHTML = '';
  jarvisResponse.style.display = 'none';

  // Remove recording state
  jarvisOrb.classList.remove('recording');

  // Restore recording hint
  const hint = document.getElementById('recording-hint');
  if (hint) {
    hint.textContent = 'Press Space to record';
  }

  status.textContent = 'Uploading...';
  status.style.color = '#ffd700';
  status.style.textShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
  status.style.opacity = '1';
}

async function sendToServer() {
  console.log('sendToServer: audioChunks length =', audioChunks.length);
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  console.log('sendToServer: audioBlob size =', audioBlob.size, 'type =', audioBlob.type);

  if (audioBlob.size === 0) {
    console.error('sendToServer: audioBlob is empty!');
    status.textContent = '❌ Empty recording - try again';
    return;
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  try {
    console.log('Uploading to:', `${API_BASE}/upload`);
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    console.log('Upload response status:', response.status);

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Upload result:', result);

    if (result.ok) {
      // Clear old transcript immediately to prevent flash of previous content
      transcriptText.textContent = '';
      status.textContent = 'Processing...';
      transcript.classList.add('visible');

      const today = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      const archivePath = `~/RAW/archive/${today}/audio/${today}-${time}-*.wav`;
      document.getElementById('transcript-path').textContent = archivePath;
      document.getElementById('transcript-path').title = `Full path: /Users/paulvisciano/RAW/archive/${today}/audio/`;

      // Set "Transcribing..." status immediately (don't wait for poll to start)
      transcriptText.innerHTML = '<span style="color: #ffd700;">⏳ Transcribing...</span>';

      pollForTranscript(result.filename);
    } else {
      status.textContent = '❌ Upload failed';
      transcriptText.innerHTML = `<span style="color: #ff4444;">❌ Upload failed: ${result.message || 'Unknown error'}</span>`;
    }
  } catch (err) {
    console.error('Upload error:', err);
    const downloadUrl = URL.createObjectURL(audioBlob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0] + '-' + new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `recording-${timestamp}-OFFLINE.webm`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(downloadUrl);

    status.textContent = `⚠️ Server offline. Saved as ${filename}`;
    status.style.color = '#ffd700';
    transcriptText.innerHTML = '<span style="color: #ffd700;">⚠️ Server was offline. Audio saved to Downloads folder.<br>Re-upload when server is back.</span>';
    transcript.classList.add('visible');

    console.error('Upload failed - saved locally:', filename);
  }
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}

// Format agent response: escape HTML, preserve newlines, render **bold**
function formatResponseText(text) {
  if (!text) {return '';}
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Polling configuration constants
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180; // 3 min - whisper + agent can be slow

async function pollForTranscript(uploadFilename) {
  let attempts = 0;
  let agentWaitStart = null;
  let thinkingTimer = null;
  const fileParam = uploadFilename ? '?file=' + encodeURIComponent(uploadFilename) : '';

  // Clear transcript at start of new polling session (fix race condition: old transcript from previous recording was kept)
  transcriptText.innerHTML = '<span style="color: #ffd700;">⏳ Transcribing...</span>';
  status.textContent = 'Processing...';

  const clearThinkingTimer = () => {
    if (thinkingTimer) {
      clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
    agentWaitStart = null;
  };

  const pollInterval = setInterval(async () => {
    attempts++;

    try {
      const response = await fetch(`${API_BASE}/transcript/latest${fileParam}`);
      if (response.ok) {
        const data = await response.json();

        if (data.status === 'transcribing') {
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          // Keep "Transcribing..." visible while server is transcribing
          transcriptText.innerHTML = '<span style="color: #ffd700;">⏳ Transcribing...</span>';
          status.textContent = 'Processing...';
        } else if (data.status === 'processing' && data.transcript) {
          transcriptText.textContent = data.transcript;
          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          document.getElementById('transcript-time').textContent = `${dateStr} ${timeStr}`;
          transcript.classList.add('pulsate');
          status.style.color = '#ffd700';
          if (!agentWaitStart) {
            agentWaitStart = Date.now();
            status.textContent = 'Agent thinking… 0:00';
            thinkingTimer = setInterval(() => {
              const elapsed = (Date.now() - agentWaitStart) / 1000;
              status.textContent = `Agent thinking… ${formatElapsed(elapsed)}`;
            }, 1000);
          }
        } else if (data.status === 'done' && data.transcript) {
          transcriptText.textContent = data.transcript;

          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          document.getElementById('transcript-time').textContent = `${dateStr} ${timeStr}`;

          if (data.jarvisResponse) {
            clearInterval(pollInterval);
            clearThinkingTimer();
            transcript.classList.remove('pulsate');
            status.textContent = '✅ Complete';
            status.style.color = '#00ff88';
            status.style.textShadow = '0 0 30px rgba(0, 255, 136, 0.6)';
            status.style.opacity = '1';
            transcriptText.textContent = data.transcript;
            responseText.innerHTML = formatResponseText(data.jarvisResponse);
            jarvisResponse.style.display = 'block';
          } else {
            // Agent didn't return a response (failed or empty) - stop polling and show message
            clearInterval(pollInterval);
            clearThinkingTimer();
            transcript.classList.remove('pulsate');
            status.textContent = '⚠️ No response';
            status.style.color = '#ffd700';
            responseText.innerHTML = '<span style="color: #888;">No response from agent. Check server logs.</span>';
            jarvisResponse.style.display = 'block';
          }
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          transcriptText.innerHTML = '<span style="color: #ff4444;">❌ ' + data.error + '</span>';
          if (data.errorDetails) {
            transcriptText.innerHTML += '<br><span style="color: #ff8888; font-size: 0.85em;">' + data.errorDetails + '</span>';
          }
          status.textContent = '❌ Error';
          status.style.color = '#ff4444';
        } else if (data.status === 'done' && data.jarvisResponse && !data.transcript) {
          /* Server sent done + response but no transcript (edge case): still show response and clear "Transcribing..." */
          if (transcriptText.textContent === '' || transcriptText.innerHTML.includes('Transcribing') || transcriptText.innerHTML.includes('Processing')) {
            transcriptText.textContent = '-';
          }
          clearInterval(pollInterval);
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          status.textContent = '✅ Complete';
          status.style.color = '#00ff88';
          responseText.innerHTML = formatResponseText(data.jarvisResponse);
          jarvisResponse.style.display = 'block';
        } else if (data.status === 'idle') {
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          transcriptText.textContent = 'Waiting for input...';
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
      if (attempts === 1) {
        transcriptText.innerHTML = '<span style="color: #00ffff;">⏳ Processing...</span>';
      }
    }

    if (attempts >= MAX_POLL_ATTEMPTS) {
      clearInterval(pollInterval);
      clearThinkingTimer();
      transcript.classList.remove('pulsate');
      transcriptText.innerHTML = '<span style="color: #ff8800;">⏱️ Timeout - no transcript received</span>';
      status.textContent = 'Timeout';
    }
  }, POLL_INTERVAL_MS);
}

// Keyboard shortcut (Space to record)
document.addEventListener('keydown', async (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording();
    }
  }
});

function checkServerStatus() {
  console.log('[checkServerStatus] Starting...');
  const indicator = document.getElementById('server-indicator');
  const statusText = document.getElementById('server-status-text');
  console.log('[checkServerStatus] Elements:', { indicator: !!indicator, statusText: !!statusText });

  fetch(`${API_BASE}/health`)
    .then(res => res.json())
    .then(data => {
      console.log('[checkServerStatus] Health response:', data);
      const indicator = document.getElementById('server-indicator');
      const statusText = document.getElementById('server-status-text');

      // Check if JARVIS process is alive (from /health endpoint)
      // Response: { status: 'ok', version: VERSION, build: BUILD_DATE, jarvis: { pid, memory, uptime } }
      if (data.status === 'ok') {
        indicator.style.background = '#00ffff';
        indicator.style.boxShadow = '0 0 8px #00ffff';
        // Server version from /health endpoint (reads jarvis-server.js VERSION constant)
        const serverVersion = data.version ? `v${data.version}` : 'v?';
        const pid = data.jarvis?.pid || '?';
        const memory = data.jarvis?.memory || '?';
        const uptime = data.jarvis?.uptime || '?';

        // Show server info underneath title (version, PID, memory, uptime)
        const statusEl = document.getElementById('server-status');
        const statusTextEl = document.getElementById('server-status-text');
        const wasFaded = statusEl?.classList.contains('faded'); // Preserve fade state

        statusTextEl.textContent = `Server: ${serverVersion} • PID ${pid} • ${memory} • ${uptime}`;

        // Client version inline next to J.A.R.V.I.S title (top right)
        document.getElementById('client-version-inline').textContent = `v${CLIENT_VERSION}`;
        statusText.style.color = '#00ffff';

        console.log('[checkServerStatus] Status text updated:', statusText.textContent);

        // Restore faded state after updating text (polling doesn't break fade)
        if (wasFaded && statusEl) {
          statusEl.classList.add('faded');
        }

        // Setup fade-in-out logic on first successful health check
        if (!window.serverStatusFadeSetup) {
          setupServerStatusFade();
          window.serverStatusFadeSetup = true;
          console.log('[UI v2.9.11] Fade setup called on first health check');
        }
      } else {
        indicator.style.background = '#ff4444';
        indicator.style.boxShadow = '0 0 8px #ff4444';
        document.getElementById('server-status-text').textContent = 'Server: Offline';
        document.getElementById('client-version-inline').textContent = `v${CLIENT_VERSION}`;
        statusText.style.color = '#ff4444';
      }
    })
    .catch((err) => {
      console.error('[checkServerStatus] Error:', err);
      const indicator = document.getElementById('server-indicator');
      const statusText = document.getElementById('server-status-text');
      indicator.style.background = '#ff4444';
      indicator.style.boxShadow = '0 0 8px #ff4444';
      statusText.textContent = 'Health check failed';
      statusText.style.color = '#ff4444';
    });
}

// Update orb version badge
function updateOrbVersion() {
  const orbVersionEl = document.getElementById('orb-version');
  if (orbVersionEl) {
    orbVersionEl.textContent = `v${CLIENT_VERSION}`;
  }
}

updateOrbVersion();

// Server status check interval with cleanup on page unload
console.log('[UI] Starting server status interval...');
const serverStatusInterval = setInterval(checkServerStatus, 5000);
window.addEventListener('beforeunload', () => {
  clearInterval(serverStatusInterval);
});

// Wait for DOM to be ready before first check
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[UI] DOMContentLoaded - calling checkServerStatus');
    checkServerStatus();
  });
} else {
  console.log('[UI] DOM already ready - calling checkServerStatus');
  checkServerStatus();
}

// === Network Dots Integration (with Device Identity) ===
(function() {
  const protocol = window.location.protocol;
  const host = window.location.host || 'localhost:18787';
  const API_BASE_NET = `${protocol}//${host}`;
  let devices = [];
  let deviceRegistry = {}; // MAC -> device info from registry
  let dotElements = [];

  // Load device registry from server
  async function loadDeviceRegistry() {
    try {
      const res = await fetch(`${API_BASE_NET}/api/devices`);
      const data = await res.json();
      if (data.devices) {
        deviceRegistry = {};
        data.devices.forEach(d => {
          deviceRegistry[d.mac.toUpperCase()] = d;
        });
        if (DEBUG) {console.log('[DeviceIdentity] Loaded', data.devices.length, 'devices from registry');}
      }
    } catch (err) {
      console.warn('[DeviceIdentity] Registry fetch failed:', err);
    }
  }

  async function loadDevices() {
    try {
      const res = await fetch(`${API_BASE_NET}/network/devices`);
      const data = await res.json();
      if (data.error) {return;}
      devices = data.devices || [];
      renderDots();
    } catch (err) {
      console.warn('Network fetch failed:', err);
    }
  }

  function formatLastSeen(isoString) {
    if (!isoString) {return 'Unknown';}
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {return 'Just now';}
    if (diffMins < 60) {return `${diffMins}m ago`;}
    if (diffHours < 24) {return `${diffHours}h ago`;}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    return date.toLocaleDateString();
  }

  function renderDots() {
    const container = document.getElementById('network-dots-container');
    if (!container) {return;}
    container.innerHTML = '';
    dotElements = [];

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const ringRadius = Math.min(window.innerWidth, window.innerHeight) * 0.35;

    devices.forEach((device, idx) => {
      const angle = (idx / devices.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * ringRadius;
      const y = centerY + Math.sin(angle) * ringRadius;

      const dot = document.createElement('div');
      dot.className = `network-dot ${device.isGateway ? 'gateway' : ''}`;
      dot.style.left = `${x - 8}px`;
      dot.style.top = `${y - 8}px`;
      dot.style.animationDelay = `${idx * 0.5}s`;

      // Look up device in registry
      const macKey = device.mac.toUpperCase();
      const registeredDevice = deviceRegistry[macKey];

      const displayName = registeredDevice ? registeredDevice.name : device.manufacturer;
      const owner = registeredDevice ? registeredDevice.owner : 'unknown';
      const lastSeen = registeredDevice ? formatLastSeen(registeredDevice.last_seen) : 'First seen';
      const connectionCount = registeredDevice ? registeredDevice.connection_count : 1;

      // Color by owner
      let borderColor = '#00d9ff'; // Default cyan
      if (owner === 'paul') {borderColor = '#00ff88';} // Green
      else if (owner === 'eric') {borderColor = '#00d9ff';} // Cyan
      else if (registeredDevice) {borderColor = '#ffcc00';} // Yellow for known unknown
      if (device.isGateway) {borderColor = '#00ff88';} // Gateway always green

      dot.style.borderColor = borderColor;
      if (device.isGateway) {
        dot.style.background = 'radial-gradient(circle, #00ff88 0%, transparent 70%)';
      }

      const tooltip = document.createElement('div');
      tooltip.className = 'network-dot-tooltip';

      console.log('[QR] Rendering tooltip for device:', device);
      if (registeredDevice) {
        // Show friendly name from registry
        tooltip.innerHTML = `
                    <h4>${displayName}</h4>
                    <p>Owner: ${owner}</p>
                    <p>MAC: ${device.mac.toUpperCase()}</p>
                    <p>Visits: ${connectionCount}</p>
                    <p>Last seen: ${lastSeen}</p>
                    <span class="qr-btn" onclick="showQRCode('${device.ip}')">📱 Show QR</span>
                `;
      } else {
        // Unknown device - show device info only (no registration fields)
        tooltip.innerHTML = `
                    <h4>${displayName}</h4>
                    <p>MAC: ${device.mac.toUpperCase()}</p>
                    <p>Type: ${device.deviceType}</p>
                    <span class="qr-btn" onclick="showQRCode('${device.ip}')">📱 Show QR</span>
                `;
      }

      dot.appendChild(tooltip);
      container.appendChild(dot);
      dotElements.push(dot);

      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        dotElements.forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
      });

      document.addEventListener('click', () => {
        dotElements.forEach(d => d.classList.remove('selected'));
      });
    });
  }

  // Register unknown device
  window.registerDevice = async function(idx, mac) {
    const nameInput = document.getElementById(`reg-name-${idx}`);
    const ownerInput = document.getElementById(`reg-owner-${idx}`);
    const name = nameInput.value.trim();
    const owner = ownerInput.value.trim().toLowerCase();

    if (!name) {
      alert('Please enter a device name');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_NET}/api/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, name, owner: owner || 'unknown' })
      });
      const data = await res.json();
      if (data.success) {
        console.log('[DeviceIdentity] Registered:', data.device.name);
        // Reload registry and re-render
        await loadDeviceRegistry();
        renderDots();
      } else {
        alert('Registration failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Registration failed: ' + err.message);
    }
  };

  function showQRCode(ip) {
    let modal = document.getElementById('qr-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'qr-modal';
      modal.className = 'qr-modal';
      modal.innerHTML = `
                <div class="qr-content">
                    <h3>📱 Scan QR Code</h3>
                    <p class="qr-status">Generating...</p>
                    <div class="qr-spinner" style="display:none; width:40px; height:40px; border:4px solid #00d9ff33; border-top:4px solid #00d9ff; border-radius:50%; animation: spin 1s linear infinite; margin:1rem auto;"></div>
                    <img class="qr-image" src="" alt="QR Code" style="display:none; width:200px; height:200px; margin:1rem auto; border:2px solid #00d9ff; border-radius:8px;" />
                    <p class="qr-url" style="font-family:monospace; color:#00d9ff; margin-top:0.5rem;"></p>
                    <button class="qr-close" onclick="document.getElementById('qr-modal').style.display='none'">Close</button>
                </div>
            `;
      document.body.appendChild(modal);
    }

    modal.style.display = 'block';
    modal.querySelector('.qr-status').textContent = 'Generating...';
    modal.querySelector('.qr-image').style.display = 'none';
    modal.querySelector('.qr-spinner').style.display = 'block';

    console.log('[QR] Fetching QR code for', ip);

    // Fetch QR code from server
    fetch(`${API_BASE_NET}/network/qr`)
      .then(res => {
        console.log('[QR] Response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[QR] Response data:', data ? 'received' : 'empty');
        if (data.error) {
          console.error('[QR] Server error:', data.error);
          modal.querySelector('.qr-status').textContent = 'Failed: ' + data.error;
          return;
        }
        modal.querySelector('.qr-status').textContent = 'Scan to connect';
        modal.querySelector('.qr-spinner').style.display = 'none';
        modal.querySelector('.qr-image').src = data.qr;
        modal.querySelector('.qr-image').style.display = 'block';
        modal.querySelector('.qr-url').textContent = data.url;
        console.log('[QR] QR code displayed');
      })
      .catch(err => {
        console.error('[QR] Fetch error:', err);
        modal.querySelector('.qr-status').textContent = 'Generation failed';
      });
  }

  // Make showQRCode globally accessible for onclick
  window.showQRCode = showQRCode;

  // Debounced resize handler (100ms delay to prevent excessive re-renders)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(renderDots, 100);
  });

  loadDevices();
  setInterval(loadDevices, 30000);

  // System Vitals auto-refresh (every 30 seconds)
  async function refreshVitals() {
  // Get elements (declare at top of function for try/catch access)
    const gatewayStatusEl = document.getElementById('vital-gateway-status');
    const gatewayPidEl = document.getElementById('vital-gateway-pid');
    const gatewayMemEl = document.getElementById('vital-gateway-mem');
    const gatewayUptimeEl = document.getElementById('vital-gateway-uptime');
    const sysMemEl = document.getElementById('vital-system-mem');
    const sysCpuEl = document.getElementById('vital-system-cpu');
    const vitalRefreshBtn = document.getElementById('vital-refresh-btn');
    const vitalCloseBtn = document.getElementById('vitals-close');
    const vitalsOverlay = document.getElementById('vitals-overlay');

    try {
      const response = await fetch(`${API_BASE}/api/vitals`);
      console.log('Vitals API response:', response.status, response.ok);
      if (!response.ok) {throw new Error(`Vitals API error: ${response.status}`);}
      const vitals = await response.json();
      console.log('Vitals API data:', vitals);

      if (vitals.openclawGateway) {
        gatewayStatusEl.textContent = vitals.openclawGateway.status;
        gatewayStatusEl.style.color = vitals.openclawGateway.status === 'Running' ? '#00ff88' : '#ff4444';
        gatewayPidEl.textContent = vitals.openclawGateway.pid || 'N/A';
        gatewayMemEl.textContent = vitals.openclawGateway.memoryMB ? `${vitals.openclawGateway.memoryMB} MB` : 'N/A';
        if (vitals.openclawGateway.uptime) {
          const uptimeMin = Math.round(vitals.openclawGateway.uptime / 60000);
          gatewayUptimeEl.textContent = `${uptimeMin} min`;
        } else {
          gatewayUptimeEl.textContent = 'N/A';
        }
      }

      // Update Ollama vitals
      const ollamaStatusEl = document.getElementById('vital-ollama-status');
      const ollamaModelsEl = document.getElementById('vital-ollama-models');
      const ollamaModelListEl = document.getElementById('vital-ollama-model-list');

      if (vitals.ollama) {
        ollamaStatusEl.textContent = vitals.ollama.status;
        ollamaStatusEl.style.color = vitals.ollama.status === 'Connected' ? '#00ff88' : '#ff4444';
        ollamaModelsEl.textContent = (vitals.ollama.models || 0) + ' models loaded';

        // Display model list with names, sizes, and types
        if (vitals.ollama.modelList && vitals.ollama.modelList.length > 0) {
          const modelStr = vitals.ollama.modelList.map(m => {
            const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(2);
            const sizeStr = sizeGB < 1 ? (m.size / 1024 / 1024).toFixed(0) + ' MB' : sizeGB + ' GB';
            const typeStr = m.isRemote ? '☁️' : '💾';
            return `${m.name} (${typeStr} ${m.params || sizeStr})`;
          }).join(', ');
          ollamaModelListEl.textContent = modelStr;
        } else {
          ollamaModelListEl.textContent = 'No models loaded';
        }
      }

      // Update system vitals
      if (vitals.system) {
        if (vitals.system.memory && vitals.system.memory.totalGB > 0) {
          sysMemEl.textContent = `${vitals.system.memory.usedGB} / ${vitals.system.memory.totalGB} GB (${vitals.system.memory.usedPercent}%)`;
        } else {
          sysMemEl.textContent = 'N/A';
        }
        if (vitals.system.cpu && typeof vitals.system.cpu.usagePercent === 'number') {
          sysCpuEl.textContent = `${vitals.system.cpu.usagePercent}%`;
        } else {
          sysCpuEl.textContent = 'N/A';
        }
        // Disk usage
        const sysDiskEl = document.getElementById('vital-system-disk');
        if (sysDiskEl && vitals.system.disk) {
          sysDiskEl.textContent = `${vitals.system.disk.used} / ${vitals.system.disk.total} (${vitals.system.disk.usedPercent}%)`;
        } else if (sysDiskEl) {
          sysDiskEl.textContent = 'N/A';
        }
      }

      // Update last updated timestamp
      const lastUpdatedEl = document.getElementById('vitals-last-updated');
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      }

      // Clear error states (use already-declared variables)
      // gatewayStatusEl, gatewayPidEl, etc. already declared above

      // Only update elements if we have valid data
      if (vitals.openclawGateway && vitals.openclawGateway.pid) {
        gatewayPidEl.textContent = vitals.openclawGateway.pid;
      } else {
        gatewayPidEl.textContent = 'N/A';
      }

      if (vitals.openclawGateway && vitals.openclawGateway.memoryMB !== 0) {
        gatewayMemEl.textContent = `${vitals.openclawGateway.memoryMB} MB`;
      } else {
        gatewayMemEl.textContent = 'N/A';
      }

      if (vitals.openclawGateway && vitals.openclawGateway.uptime) {
        const uptimeMin = Math.round(vitals.openclawGateway.uptime / 60000);
        gatewayUptimeEl.textContent = `${uptimeMin} min`;
      } else {
        gatewayUptimeEl.textContent = 'N/A';
      }
    } catch (err) {
      console.error('Failed to refresh vitals:', err);

      // Clear all elements on error (use already-declared variables)
      if (typeof gatewayStatusEl !== 'undefined') {
        gatewayStatusEl.textContent = 'Error';
        gatewayStatusEl.style.color = '#ff4444';
      }
      if (typeof gatewayPidEl !== 'undefined') {gatewayPidEl.textContent = 'N/A';}
      if (typeof gatewayMemEl !== 'undefined') {gatewayMemEl.textContent = 'N/A';}
      if (typeof gatewayUptimeEl !== 'undefined') {gatewayUptimeEl.textContent = 'N/A';}
      sysMemEl.textContent = 'N/A';
      sysCpuEl.textContent = 'N/A';
    }
  }

  // Initial vitals refresh and set interval
  refreshVitals();
  setInterval(refreshVitals, 30000);

  // Make refreshVitals globally accessible for onclick
  window.refreshVitals = refreshVitals;

  // Collapsible accordion handler for vitals panel (legacy - now replaced by overlay)
  const vitalsToggle = document.getElementById('vitals-toggle');
  if (vitalsToggle) {
    vitalsToggle.addEventListener('click', () => {
      const body = document.getElementById('vitals-body');
      const chevron = document.getElementById('vitals-chevron');
      const isExpanded = body.style.display === 'block' || body.style.display === '';

      if (isExpanded) {
        body.style.display = 'none';
        vitalsToggle.setAttribute('aria-expanded', 'false');
        if (chevron) {chevron.textContent = '▼';}
      } else {
        body.style.display = 'block';
        vitalsToggle.setAttribute('aria-expanded', 'true');
        if (chevron) {chevron.textContent = '▲';}
        // Refresh vitals when expanding
        refreshVitals();
      }
    });
  }

  // Overlay vitals handler - click server status to reveal overlay
  const serverStatus = document.getElementById('server-status');
  const vitalsOverlay = document.getElementById('vitals-overlay');
  const vitalsClose = document.getElementById('vitals-close');

  if (serverStatus) {
    serverStatus.addEventListener('click', () => {
      vitalsOverlay.classList.add('active');
      refreshVitals(); // Refresh when opening
    });
  }

  if (vitalsOverlay) {
    // Close button handler
    if (vitalsClose) {
      vitalsClose.addEventListener('click', (e) => {
        e.stopPropagation();
        vitalsOverlay.classList.remove('active');
      });
    }

    // Click outside to close
    vitalsOverlay.addEventListener('click', (e) => {
      if (e.target === vitalsOverlay) {
        vitalsOverlay.classList.remove('active');
      }
    });
  }

  // Make refreshVitals globally accessible for onclick
  window.refreshVitals = refreshVitals;

  // === Settings Modal Functions ===

  // Modal references
  const settingsModal = document.getElementById('settings-modal');
  const desktopArchivingToggle = document.getElementById('desktop-archiving-toggle');

  // Load settings from OpenClaw config
  async function loadSettings() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();

      if (desktopArchivingToggle) {
        desktopArchivingToggle.checked = data.desktopArchiving?.enabled === true;
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  // Save settings to OpenClaw config
  async function saveSettings() {
    const enabled = desktopArchivingToggle.checked;

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desktopArchiving: { enabled }
        })
      });

      const data = await response.json();

      if (data.success) {
        // Show toast notification
        showToast(`Desktop archiving ${enabled ? 'enabled' : 'disabled'}`);
        closeSettingsModal();
      } else {
        showToast('Error saving settings', 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      showToast('Connection error', 'error');
    }
  }

  // Modal functions
  function openSettingsModal() {
    if (settingsModal) {
      settingsModal.style.display = 'block';
      loadSettings();
    }
  }

  function closeSettingsModal() {
    if (settingsModal) {
      settingsModal.style.display = 'none';
    }
  }

  // Close modal on outside click
  if (settingsModal) {
    window.onclick = function(event) {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    };
  }

  // Toast notification function
  function showToast(message, type = 'success') {
    // Create toast container if not exists
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 2000; display: flex; gap: 10px; pointer-events: none;';
      document.body.appendChild(toastContainer);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.style.cssText = `background: rgba(0,0,0,0.9); border: 1px solid ${type === 'success' ? '#22c55e' : '#ef4444'}; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 0.9em; animation: fadeIn 0.3s ease; pointer-events: auto;`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { if (toast.parentNode) {toast.parentNode.removeChild(toast);} }, 300);
      }
    }, 3000);
  }

  // Add global functions
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.saveSettings = saveSettings;

  // === Breathe / Relaxation Functions ===

  // Breathe cycle state
  let breathState = {
    isAnimating: false,
    phase: 'ready', // ready, inhale, hold, exhale
    depth: 'normal',
    startTime: null,
    elapsedTime: 0
  };

  // Heartbeat state
  let heartbeatState = {
    bpm: 60,
    lastBeat: null,
    steady: true
  };

  // Update heartbeat display
  function updateHeartbeatDisplay() {
    const rhythmEl = document.getElementById('heartbeat-rhythm');
    const statusEl = document.getElementById('heartbeat-status');
    const lastBeatEl = document.getElementById('heartbeat-last-beat');
    const heartbeatPulse = document.getElementById('heartbeat-pulse');

    if (rhythmEl) {
      rhythmEl.textContent = `${heartbeatState.bpm} BPM`;
    }

    if (statusEl) {
      statusEl.textContent = heartbeatState.steady ? 'Steady' : 'Irregular';
    }

    if (lastBeatEl) {
      const now = new Date();
      lastBeatEl.textContent = heartbeatState.lastBeat
        ? now.toLocaleTimeString()
        : '--';
    }

    // Toggle heartbeat pulse class (new CSS classes)
    if (heartbeatPulse) {
      // Reset all classes first
      heartbeatPulse.classList.remove('steady', 'irregular', 'stopped');

      if (heartbeatState.steady) {
        heartbeatPulse.classList.add('steady');
      } else {
        heartbeatPulse.classList.add('irregular');
      }
    }
  }

  // Update breath display
  function updateBreathDisplay() {
    const cycleEl = document.getElementById('breath-cycle');
    const phaseEl = document.getElementById('breath-phase');
    const depthEl = document.getElementById('breath-depth');
    const breathCircle = document.getElementById('breath-circle');

    if (cycleEl) {
      let cycleTime = 8; // Default 8s cycle
      if (breathState.depth === 'shallow') {cycleTime = 6;}
      if (breathState.depth === 'deep') {cycleTime = 10;}
      if (breathState.depth === 'hold') {cycleTime = 4;}
      cycleEl.textContent = `${cycleTime}s cycle`;
    }

    if (phaseEl) {
      phaseEl.textContent = breathState.phase.charAt(0).toUpperCase() + breathState.phase.slice(1);
    }

    if (depthEl) {
      depthEl.textContent = breathState.depth.charAt(0).toUpperCase() + breathState.depth.slice(1);
    }

    // Update breath circle animation
    if (breathCircle) {
      if (breathState.isAnimating) {
        breathCircle.style.animation = 'breathe-full 8s linear infinite';
        breathCircle.style.animationPlayState = 'running';
      } else {
        breathCircle.style.animationPlayState = 'paused';
      }
    }
  }

  // Trigger breath cycle via API
  async function triggerBreathe() {
    try {
      console.log('[Breathe] Triggering breath cycle...');
      const response = await fetch(`${API_BASE}/api/breathe/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Breathe] API response:', data);

        // Start animation
        startBreathCycle();

        return { success: true, timestamp: data.timestamp };
      } else {
        throw new Error(`Breathe API error: ${response.status}`);
      }
    } catch (err) {
      console.error('[Breathe] Trigger failed:', err);

      // Still start animation even if API fails
      startBreathCycle();

      return { success: false, error: err.message };
    }
  }

  // Start breath cycle animation
  function startBreathCycle() {
    breathState.isAnimating = true;
    breathState.phase = 'inhale';
    breathState.startTime = Date.now();

    // Reset circle animation
    const breathCircle = document.getElementById('breath-circle');
    if (breathCircle) {
      breathCircle.style.animation = 'none';
      void breathCircle.offsetWidth; // Trigger reflow
      breathCircle.style.animation = 'breathe-full 8s linear infinite';
    }

    updateBreathDisplay();

    console.log('[Breathe] Animation started');
  }

  // Manual breath control (for UI interaction)
  function manualBreatheControl() {
    const btn = document.getElementById('take-a-breath-btn');

    if (!btn) {return;}

    // Check if already animating
    if (breathState.isAnimating) {
      // Pause
      breathState.isAnimating = false;
      btn.textContent = '✨ Take a Breath';
      btn.classList.remove('active');

      // Pause animation
      const breathCircle = document.getElementById('breath-circle');
      if (breathCircle) {
        breathCircle.style.animationPlayState = 'paused';
      }
    } else {
      // Start
      triggerBreathe().then(result => {
        if (result.success) {
          btn.textContent = '⏹️ Pause Breath';
          btn.classList.add('active');
        }
      });
    }
  }

  // Initialize breath circle element
  function initBreathCircle() {
    const breathCircle = document.getElementById('breath-circle');
    if (breathCircle) {
      // Create breath circle if not exists
      breathCircle.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: radial-gradient(circle, #00d9ff 0%, #00ff88 100%);
        box-shadow: 0 0 20px rgba(0, 217, 255, 0.5);
      `;
    }

    // Setup breathe depth select
    const depthSelect = document.getElementById('breath-depth-select');
    if (depthSelect) {
      depthSelect.addEventListener('change', (e) => {
        breathState.depth = e.target.value;
        updateBreathDisplay();
      });
    }

    // Setup "Take a Breath" button
    const takeBreathBtn = document.getElementById('take-a-breath-btn');
    if (takeBreathBtn) {
      takeBreathBtn.addEventListener('click', manualBreatheControl);
    }

    // Initial display update
    updateBreathDisplay();
  }

  // Initialize heartbeat
  function initHeartbeat() {
    // Simulate heartbeat rhythm
    heartbeatState.bpm = 60;
    heartbeatState.steady = true;
    heartbeatState.lastBeat = new Date();

    // Simulate beats
    setInterval(() => {
      heartbeatState.lastBeat = new Date();
      updateHeartbeatDisplay();
    }, 5000); // Update every 5 seconds
  }

  // Initialize breathe UI with CSS classes
  function initBreathCircleEnhanced() {
    const breathCircle = document.getElementById('breath-circle');
    const depthSelect = document.getElementById('breath-depth-select');
    const takeBreathBtn = document.getElementById('take-a-breath-btn');

    // Initialize breath circle with CSS class-based animation
    if (breathCircle) {
      // Apply CSS classes based on depth
      updateBreathCSS(breathState.depth);
    }

    // Setup depth selector to update CSS classes
    if (depthSelect) {
      depthSelect.addEventListener('change', (e) => {
        breathState.depth = e.target.value;
        if (breathCircle) {
          updateBreathCSS(breathState.depth);
        }
        updateBreathDisplay();
      });
    }

    // Setup "Take a Breath" button with enhanced functionality
    if (takeBreathBtn) {
      takeBreathBtn.addEventListener('click', () => {
        if (breathState.isAnimating) {
          // Pause
          breathState.isAnimating = false;
          takeBreathBtn.innerHTML = '✨ Take a Breath';
          takeBreathBtn.style.background = 'rgba(255, 215, 0, 0.15)';
          takeBreathBtn.style.borderColor = 'rgba(255, 215, 0, 0.3)';

          // Pause animation
          if (breathCircle) {
            breathCircle.style.animationPlayState = 'paused';
          }
        } else {
          // Start
          startBreathCycle();
          takeBreathBtn.innerHTML = '⏹️ Stop Relaxation';
          takeBreathBtn.style.background = 'rgba(255, 68, 68, 0.15)';
          takeBreathBtn.style.borderColor = 'rgba(255, 68, 68, 0.3)';
        }
      });
    }

    // Initial display update
    updateBreathDisplay();
  }

  // Update breath circle with CSS classes
  function updateBreathCSS(depth) {
    const breathCircle = document.getElementById('breath-circle');
    if (!breathCircle) {return;}

    // Reset all depth classes
    breathCircle.classList.remove('shallow', 'normal', 'deep', 'hold');

    // Add current depth class
    if (depth === 'shallow') {
      breathCircle.classList.add('shallow');
    } else if (depth === 'normal') {
      breathCircle.classList.add('normal');
    } else if (depth === 'deep') {
      breathCircle.classList.add('deep');
    } else if (depth === 'hold') {
      breathCircle.classList.add('hold');
    }

    // If animating, ensure animation is running
    if (breathState.isAnimating) {
      breathCircle.style.animationPlayState = 'running';
    }
  }

  // Initialize heartbeat with CSS classes
  function initHeartbeatEnhanced() {
    const heartbeatPulse = document.getElementById('heartbeat-pulse');
    const heartbeatRhythmEl = document.getElementById('heartbeat-rhythm');
    const heartbeatStatusEl = document.getElementById('heartbeat-status');

    // Apply CSS class based on rhythm state
    if (heartbeatPulse) {
      if (heartbeatState.steady) {
        heartbeatPulse.classList.add('steady');
        heartbeatPulse.classList.remove('irregular', 'stopped');
      } else {
        heartbeatPulse.classList.add('irregular');
        heartbeatPulse.classList.remove('steady', 'stopped');
      }
    }

    // Update display text
    if (heartbeatRhythmEl) {
      heartbeatRhythmEl.textContent = `${heartbeatState.bpm} BPM`;
    }

    if (heartbeatStatusEl) {
      heartbeatStatusEl.textContent = heartbeatState.steady ? 'Steady' : 'Irregular';
      heartbeatStatusEl.style.color = heartbeatState.steady ? '#00ff88' : '#ffd700';
    }

    // Simulate heartbeat rhythm updates
    setInterval(() => {
      heartbeatState.lastBeat = new Date();
      updateHeartbeatDisplay();
    }, 5000);
  }

  // Initialize enhanced UI components
  initBreathCircleEnhanced();
  initHeartbeatEnhanced();

})();

// === Three.js Global Variables ===
let neurons = [];
let synapses = [];
let neurographData = null;
let idleRotation = 0;
let isNeurographLoaded = false;

// === Three.js JARVIS Orb Rendering ===
// Create 3D sphere with video texture for the JARVIS orb

let jarvisOrbScene, jarvisOrbCamera, jarvisOrbRenderer;
let jarvisOrbMesh, jarvisOrbVideo;
let jarvisOrbRotation = 0;

// Initialize JARVIS Orb Three.js scene
function initJarvisOrb() {
  const container = document.getElementById('jarvis-orb-container');
  if (!container) {
    console.warn('[JarvisOrb] Container element not found');
    return;
  }
  
  console.log('[JarvisOrb] Container found, dimensions:', container.offsetWidth, 'x', container.offsetHeight);

  // Get video element
  const video = document.getElementById('jarvis-video');
  if (!video) {
    console.warn('[JarvisOrb] Video element not found');
    return;
  }

  // Create video texture
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.colorSpace = THREE.SRGBColorSpace;

  // Create scene
  jarvisOrbScene = new THREE.Scene();
  jarvisOrbScene.background = new THREE.Color(0x000000);

  // Create camera
  jarvisOrbCamera = new THREE.PerspectiveCamera(
    75,
    1, // Square aspect ratio for container
    0.1,
    1000
  );
  jarvisOrbCamera.position.z = 3;

  // Create renderer
  const rect = container.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  jarvisOrbRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  jarvisOrbRenderer.setSize(size, size);
  jarvisOrbRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(jarvisOrbRenderer.domElement);

  // Create sphere with video texture
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    map: videoTexture,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x00ffff,
    emissiveIntensity: 0.3
  });
  jarvisOrbMesh = new THREE.Mesh(geometry, material);
  jarvisOrbScene.add(jarvisOrbMesh);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  jarvisOrbScene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x00ffff, 1, 10);
  pointLight.position.set(2, 2, 2);
  jarvisOrbScene.add(pointLight);

  // Add hover effect
  container.addEventListener('mouseenter', () => {
    if (jarvisOrbMesh) {
      jarvisOrbMesh.material.emissiveIntensity = 0.5;
      jarvisOrbMesh.material.color.setHex(0x00ffff);
    }
  });

  container.addEventListener('mouseleave', () => {
    if (jarvisOrbMesh) {
      jarvisOrbMesh.material.emissiveIntensity = 0.3;
      jarvisOrbMesh.material.color.setHex(0xffffff);
    }
  });

  // Add animation loop
  function animateOrb() {
    requestAnimationFrame(animateOrb);

    // Slow rotation of the sphere
    if (jarvisOrbMesh) {
      jarvisOrbMesh.rotation.y += 0.005;
      jarvisOrbMesh.rotation.x += 0.002;
    }

    jarvisOrbRenderer.render(jarvisOrbScene, jarvisOrbCamera);
  }
  animateOrb();

  // Handle resize
  function resizeOrb() {
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    jarvisOrbRenderer.setSize(size, size);
  }
  window.addEventListener('resize', resizeOrb);
  resizeOrb();

  console.log('[JarvisOrb] Three.js sphere with video texture initialized');
}

// Initialize Three.js scene
function initNeurograph() {
  const canvas = document.getElementById('neurograph-canvas');
  if (!canvas) {
    console.warn('[Neurograph] Canvas element not found');
    return;
  }

  // Create scene
  neurographScene = new THREE.Scene();
  neurographScene.background = new THREE.Color(0x050510);
  neurographScene.fog = new THREE.FogExp2(0x050510, 0.002);

  // Create camera
  neurographCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  neurographCamera.position.set(0, 25, 100);

  // Create renderer
  neurographRenderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  neurographRenderer.setSize(window.innerWidth, window.innerHeight);
  neurographRenderer.setPixelRatio(window.devicePixelRatio);

  // Add orbit controls for rotation/zoom
  neurographControls = new THREE.OrbitControls(neurographCamera, neurographRenderer.domElement);
  neurographControls.enableDamping = true;
  neurographControls.dampingFactor = 0.05;
  neurographControls.minDistance = 50;
  neurographControls.maxDistance = 800;

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  neurographScene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
  pointLight.position.set(20, 20, 20);
  neurographScene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0x00bfff, 0.8, 100);
  pointLight2.position.set(-20, -20, 20);
  neurographScene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0xffd700, 0.6, 100);
  pointLight3.position.set(0, 30, -20);
  neurographScene.add(pointLight3);

  // Event listeners
  window.addEventListener('resize', onNeurographWindowResize);

  // Load neurograph data
  loadNeurographData();
  console.log('[Neurograph] Initialized');

  // Add starfield to background
  createStarfield();
}

// Animation loop
function animateNeurograph() {
  requestAnimationFrame(animateNeurograph);

  if (neurographControls) {
    neurographControls.update();
  }

  // Repulsion between spheres - makes them spread out in space (increased from 0.3 to 2.0, minDist from 3.0 to 30.0)
  if (neurographScene && neurons.length > 2 && isNeurographLoaded) {
    const repulsionStrength = 2.0; // Stronger repulsion

    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        const a = neurons[i].position;
        const b = neurons[j].position;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        const minDist = 30.0; // Much increased for better spreading

        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const force = repulsionStrength * (minDist - dist) / dist;

          const nx = (dx / dist) * force;
          const ny = (dy / dist) * force;
          const nz = (dz / dist) * force;

          neurons[i].position.x += nx;
          neurons[i].position.y += ny;
          neurons[i].position.z += nz;
          neurons[j].position.x -= nx;
          neurons[j].position.y -= ny;
          neurons[j].position.z -= nz;
        }
      }
    }
  }

  // Idle rotation - spheres are now static (no animation)
  // if (neurographScene && neurons.length > 0 && isNeurographLoaded) {
  //   idleRotation += 0.0002;
  //   ...
  // }
  //
  // // Idle rotation - slow spin when no interaction
  // if (neurographScene && neurons.length > 0 && isNeurographLoaded) {
  //   idleRotation += 0.0002;
  //   ...
  // }
  //
  //   // Update synapse pulsation
  if (synapses.length > 0 && isNeurographLoaded) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
    synapses.forEach((synapse, idx) => {
      synapse.material.opacity = 0.3 + 0.3 * pulse;
    });
  }

  neurographRenderer.render(neurographScene, neurographCamera);
}

// Initialize neurograph when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Neurograph] DOM loaded, initializing...');
    initJarvisOrb();
    initNeurograph();
    animateNeurograph();
  });
} else {
  console.log('[Neurograph] DOM already ready, initializing...');
  initJarvisOrb();
  initNeurograph();
  animateNeurograph();
}

// Handle window resize
function onNeurographWindowResize() {
  if (neurographCamera && neurographRenderer) {
    neurographCamera.aspect = window.innerWidth / window.innerHeight;
    neurographCamera.updateProjectionMatrix();
    neurographRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Raycaster for hover labels on neurograph spheres
let hoveredNode = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const labelDiv = document.createElement('div');

function setupNeurographHover() {
  // Create label div
  labelDiv.style.position = 'absolute';
  labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  labelDiv.style.color = '#00ffff';
  labelDiv.style.padding = '5px 10px';
  labelDiv.style.borderRadius = '4px';
  labelDiv.style.fontSize = '12px';
  labelDiv.style.pointerEvents = 'none';
  labelDiv.style.zIndex = '1000';
  labelDiv.style.display = 'none';
  labelDiv.style.maxWidth = '300px';
  labelDiv.style.wordBreak = 'break-all';
  document.body.appendChild(labelDiv);

  // Mouse move handler for neurograph
  document.addEventListener('mousemove', (e) => {
    if (!neurographScene) return;

    // Calculate mouse position in normalized device coordinates
    const rect = neurographRenderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, neurographCamera);
    const intersects = raycaster.intersectObjects(neurons);

    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      if (intersected !== hoveredNode) {
        // New node hovered
        if (hoveredNode) {
          labelDiv.style.display = 'none';
        }
        hoveredNode = intersected;
        // Show full node info
        const nodeData = hoveredNode.userData;
        labelDiv.innerHTML = createNodeLabel(nodeData);
        labelDiv.style.display = 'block';
        // Position label near the hovered point
        labelDiv.style.left = (e.clientX + 15) + 'px';
        labelDiv.style.top = (e.clientY - 15) + 'px';
      }
    } else {
      // No node hovered
      if (hoveredNode) {
        labelDiv.style.display = 'none';
        hoveredNode = null;
      }
    }
  });
}

// Call setupNeurographHover when DOM is ready
setupNeurographHover();

// Create HTML label for node data
function createNodeLabel(nodeData) {
  if (!nodeData || !nodeData.rawData) {
    return `<strong>Node:</strong> ${nodeData.id || 'Unknown'}`;
  }

  const node = nodeData.rawData;
  let html = `<div style="border-bottom: 1px solid #0088ff; padding-bottom: 8px; margin-bottom: 8px;">`;
  html += `<strong>${node.label || node.id}</strong>`;
  html += ` <span style="color: #888; font-size: 10px;">(${node.id})</span>`;
  html += `<br><span style="color: #00ffff; opacity: 0.7;">${node.category || 'unknown'} - ${node.type || 'unknown'}</span>`;
  html += `</div>`;

  if (node.attributes) {
    if (node.attributes.description) {
      html += `<div style="margin: 5px 0; color: #ddd;">${node.attributes.description.substring(0, 150)}${node.attributes.description.length > 150 ? '...' : ''}</div>`;
    }
    if (node.attributes.color) {
      html += `<div style="margin: 5px 0;"><span style="display: inline-block; width: 10px; height: 10px; background: ${node.attributes.color}; border-radius: 2px; vertical-align: middle; margin-right: 5px; box-shadow: 0 0 5px ${node.attributes.color};"></span>Color: ${node.attributes.color}</div>`;
    }
  }

  if (node.moments && node.moments.length > 0) {
    const recentMoment = node.moments[0];
    html += `<div style="margin: 5px 0; font-size: 10px; color: #aaa;">Updated: ${recentMoment.date || 'Unknown'}</div>`;
  }

  return html;
}

// Load neurograph data from API
function loadNeurographData() {
  fetch('/api/neurograph')
    .then(res => {
      if (!res.ok) {
        throw new Error(`Neurograph API error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('[Neurograph] Raw data loaded:', data);
      console.log('[Neurograph] Nodes count:', (data.nodes || []).length);
      console.log('[Neurograph] Synapses count:', (data.synapses || data.connections || []).length);

      // Check for undefined sources in synapses
      const synapses = data.synapses || data.connections || [];
      const undefinedSources = synapses.filter(s => !s.source).length;
      const undefinedTargets = synapses.filter(s => !s.target).length;
      console.log('[Neurograph] Synapses with undefined source:', undefinedSources);
      console.log('[Neurograph] Synapses with undefined target:', undefinedTargets);

      neurographData = data;
      createNeurograph(data);
      isNeurographLoaded = true;
    })
    .catch(err => {
      console.warn('[Neurograph] Failed to load data:', err);
      // Create fallback neurograph if API fails
      createFallbackNeurograph();
      isNeurographLoaded = true;
    });
}

// Create neurograph from data
function createNeurograph(data) {
  if (!neurographScene) return;

  // Clear existing objects
  neurons.forEach(neuron => neurographScene.remove(neuron));
  synapses.forEach(synapse => neurographScene.remove(synapse));
  neurons = [];
  synapses = [];

  // Create nodes as spheres
  // Limit to 1000 nodes to prevent WebGL errors (too many objects)
  const MAX_NODES = 1000;
  const allNodes = data.nodes || [];
  const allConnections = data.synapses || data.connections || [];

  // Create a Set of valid node IDs for quick lookup
  const allNodeIds = new Set(allNodes.map(n => n.id));

  // Calculate connection weights for ALL nodes (before limiting)
  const nodeConnectionWeights = {};
  allNodes.forEach(node => {
    nodeConnectionWeights[node.id] = 0;
  });
  allConnections.forEach(conn => {
    // Skip connections with empty source/target
    if (!conn.source || !conn.target) return;
    const weight = conn.weight || conn.strength || 1;
    nodeConnectionWeights[conn.source] = (nodeConnectionWeights[conn.source] || 0) + weight;
    nodeConnectionWeights[conn.target] = (nodeConnectionWeights[conn.target] || 0) + weight;
  });

  // Filter connections to only include those with valid node IDs
  const validConnections = allConnections.filter(conn =>
    allNodeIds.has(conn.source) && allNodeIds.has(conn.target) &&
    conn.source && conn.target
  );

  console.log(`[Neurograph] Total nodes: ${allNodes.length}, Total connections: ${allConnections.length}, Valid connections: ${validConnections.length}`);

  // Sort nodes by total connection weight and take top 1000 (most connected)
  const sortedNodes = allNodes.sort((a, b) =>
    (nodeConnectionWeights[b.id] || 0) - (nodeConnectionWeights[a.id] || 0)
  );
  const nodes = sortedNodes.slice(0, MAX_NODES);

  // Create node IDs Set for quick lookup
  const nodeIds = new Set(nodes.map(n => n.id));

  // Filter connections to only include those where BOTH nodes are in our selected set
  const connections = validConnections.filter(conn =>
    nodeIds.has(conn.source) && nodeIds.has(conn.target)
  );

  console.log(`[Neurograph] Selected ${nodes.length} nodes by weight, ${connections.length} connections remain`);

  // Create nodes with Jarvis theme colors
  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a4d8f,
    emissive: 0x0066cc,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.7
  });

  // Theme node was already found above in nodeConnectionWeights
  let themeNodeId = null;
  let maxWeight = -1;
  for (const [nodeId, weight] of Object.entries(nodeConnectionWeights)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      themeNodeId = nodeId;
    }
  }

  // If no connections found, use first node as theme
  if (!themeNodeId && nodes.length > 0) {
    themeNodeId = nodes[0].id;
  }

  console.log(`[Neurograph] Theme node: ${themeNodeId} with total weight: ${maxWeight}`);

  // Check if theme node is in selected nodes
  const themeNodeInSelection = nodes.find(n => n.id === themeNodeId);
  console.log(`[Neurograph] Theme node in selection: ${!!themeNodeInSelection}`);

  nodes.forEach((node, idx) => {
    // Determine if this is a temporal node (has date in moments or attributes)
    const isTemporal = node.moments && node.moments.some(m => m.date && m.date.includes('2026')) ||
                      (node.attributes && (node.attributes.created || node.attributes.sourceDocument));

    // Determine if this node is directly connected to theme (orbiting node)
    const isConnectedToTheme = connections.some(conn =>
      (conn.source === themeNodeId && conn.target === node.id) ||
      (conn.target === themeNodeId && conn.source === node.id)
    );

    // Get max connection weight to theme node
    let themeConnectionWeight = 0;
    let themeConnectionCount = 0;
    connections.forEach(conn => {
      if ((conn.source === themeNodeId && conn.target === node.id) ||
          (conn.target === themeNodeId && conn.source === node.id)) {
        const connWeight = conn.weight || conn.strength || 1;
        themeConnectionWeight = Math.max(themeConnectionWeight, connWeight);
        themeConnectionCount++;
      }
    });

    // Base radius: theme node is largest, connected nodes are medium, others are small
    let baseRadius;
    if (node.id === themeNodeId) {
      baseRadius = 2.0; // Theme node is largest
      console.log(`[Neurograph] Theme node ${node.id} radius: ${baseRadius}`);
    } else if (isConnectedToTheme) {
      baseRadius = 1.0 + (themeConnectionWeight / 200); // Connected nodes: 1.0-1.5 radius
      console.log(`[Neurograph] Connected node ${node.id} weight=${themeConnectionWeight} radius=${baseRadius.toFixed(2)}`);
    } else {
      baseRadius = isTemporal ? 0.8 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3;
      console.log(`[Neurograph] Other node ${node.id} temporal=${isTemporal} radius=${baseRadius.toFixed(2)}`);
    }

    const geometry = new THREE.SphereGeometry(baseRadius, 32, 32);
    const neuron = new THREE.Mesh(geometry, nodeMaterial.clone());

    // Position nodes in molecule-like structure:
    // - Theme node at center (0, 0, 0)
    // - Connected nodes in orbiting planes around theme
    // - Other nodes in outer orbits

    if (node.id === themeNodeId) {
      // Theme node at center
      neuron.position.set(0, 0, 0);
    } else if (isConnectedToTheme) {
      // Orbiting nodes - arrange in orbital planes around center
      const orbitRadius = 8 + (themeConnectionWeight / 20); // 8-13 units from center
      const planeAngle = (idx % 4) * (Math.PI / 2); // 4 orbital planes: 0, 90, 180, 270 degrees

      // Calculate position in orbital plane
      const angle = (idx / 4) * (Math.PI * 2); // Distribute nodes in each plane
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(planeAngle) * (orbitRadius * 0.3); // Slight tilt for 3D effect

      neuron.position.set(x, y, z);
    } else {
      // Other nodes - in outer orbits
      const orbitRadius = 18 + (maxWeight / 100); // Outer orbit
      const angle = (idx / (nodes.length || 1)) * Math.PI * 2;
      neuron.position.set(
        Math.cos(angle) * orbitRadius,
        (Math.random() - 0.5) * 10,
        Math.sin(angle) * orbitRadius
      );
    }

    neuron.userData = {
      id: node.id || idx,
      label: node.label || `Node ${idx}`,
      position: neuron.position.clone(),
      rawData: node,
      isTemporal: isTemporal,
      isConnectedToTheme: isConnectedToTheme,
      themeConnectionWeight: themeConnectionWeight
    };

    neurographScene.add(neuron);
    neurons.push(neuron);
  });

  // Create connection lines (synapses) - straight lines between nodes
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00bfff,
    transparent: true,
    opacity: 0.8,
    linewidth: 2 // Thicker lines for better visibility
  });

  // Create a map of node IDs to neuron indices for quick lookup
  const nodeMap = {};
  neurons.forEach((neuron, idx) => {
    nodeMap[neuron.userData.id] = neuron;
  });

  console.log(`[Neurograph] Creating ${connections.length} connections from ${neurons.length} neurons`);

  // Debug: show first 5 connections with their weights
  // Commented out - removed for clarity

  connections.forEach(conn => {
    // Support both source/target (string IDs) and from/to (indices)
    const sourceId = conn.source || conn.from;
    const targetId = conn.target || conn.to;
    
    // Skip connections with empty source or target
    if (!sourceId || !targetId) {
      console.warn(`[Neurograph] Skipping connection with empty source/target`);
      return;
    }
    
    // Use the nodeMap to find neurons by ID
    const sourceNode = nodeMap[sourceId];
    const targetNode = nodeMap[targetId];

    if (sourceNode && targetNode) {
      // Verify source and target are different nodes
      if (sourceNode === targetNode) {
        return;
      }

      // Get weight for line thickness/opacity (0-100 scale)
      const weight = conn.weight || conn.strength || 1;
      const opacity = 0.3 + 0.3 * (weight / 100);

      // Straight line between source and target nodes (synapse = connection)
      const points = [
        sourceNode.userData.position.clone(),
        targetNode.userData.position.clone()
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial.clone());

      line.userData = {
        source: sourceId,
        target: targetId,
        weight: weight,
        type: conn.type || 'connection',
        label: conn.label || `Link ${sourceId} -> ${targetId}`
      };

      neurographScene.add(line);
      synapses.push(line);
    } else {
      console.warn(`[Neurograph] Connection failed: source=${sourceId}, target=${targetId} - not found in nodeMap`);
    }
  });

  // Node labels removed - causing "weird bubbles" effect with 9549 nodes
  // The neurograph is now clean with just nodes and connections
  // Labels can be re-added later if needed with proper filtering/limiting
}

// Create fallback neurograph when API fails
function createFallbackNeurograph() {
  if (!neurographScene) return;

  const nodeCount = 20 + Math.random() * 20;
  const connections = [];

  for (let i = 0; i < nodeCount; i++) {
    const radius = 0.5 + Math.random() * 0.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a4d8f,
      emissive: 0x0066cc,
      emissiveIntensity: 0.3
    });
    const neuron = new THREE.Mesh(geometry, material);

    const angle = (i / nodeCount) * Math.PI * 2;
    const radiusPos = 15 + Math.random() * 20;
    neuron.position.set(
      Math.cos(angle) * radiusPos,
      (Math.random() - 0.5) * 15,
      Math.sin(angle) * radiusPos
    );

    neurons.push(neuron);
    neurographScene.add(neuron);

    // Connect to 2-3 previous nodes
    if (i > 3) {
      const numConnections = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numConnections; j++) {
        const targetIdx = i - 1 - Math.floor(Math.random() * Math.min(i, 5));
        if (targetIdx >= 0 && targetIdx < neurons.length - 1) {
          connections.push({ from: i, to: targetIdx });
        }
      }
    }
  }

  // Create connection lines
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00bfff,
    transparent: true,
    opacity: 0.5
  });

  connections.forEach(conn => {
    const sourceNode = neurons[conn.from];
    const targetNode = neurons[conn.to];

    if (sourceNode && targetNode) {
      const points = [
        sourceNode.position,
        new THREE.Vector3(
          (sourceNode.position.x + targetNode.position.x) / 2,
          (Math.random() - 0.5) * 10,
          (sourceNode.position.z + targetNode.position.z) / 2
        ),
        targetNode.position
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial.clone());
      synapses.push(line);
      neurographScene.add(line);
    }
  });

  console.log('[Neurograph] Fallback neurograph created:', nodeCount, 'nodes');
}

// NOTE: Neurograph animation loop disabled - causing WebGL errors with 9549 nodes
// The UI should remain clean without a cluttered neural graph

// Create starfield background
function createStarfield() {
  const starCount = 500;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];

  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 800;
    const y = (Math.random() - 0.5) * 800;
    const z = (Math.random() - 0.5) * 1000;
    starPositions.push(x, y, z);
  }

  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));

  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.8
  });

  const starfield = new THREE.Points(starGeometry, starMaterial);
  neurographScene.add(starfield);

  console.log('[Neurograph] Starfield created with', starCount, 'stars');
}
