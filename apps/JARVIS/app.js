// JARVIS Voice Recorder UI - extracted from index.html

// Client version (bumped when UI changes ship)
const CLIENT_VERSION = '3.0.0';
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
            // Agent didn't return a response (failed or empty) – stop polling and show message
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
            transcriptText.textContent = '—';
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
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
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
      if (breathState.depth === 'shallow') cycleTime = 6;
      if (breathState.depth === 'deep') cycleTime = 10;
      if (breathState.depth === 'hold') cycleTime = 4;
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
    
    if (!btn) return;
    
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
    if (!breathCircle) return;
    
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
