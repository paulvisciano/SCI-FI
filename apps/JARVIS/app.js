// JARVIS Voice Recorder UI - extracted from index.html

// Client version (bumped when UI changes ship)
const CLIENT_VERSION = '2.8.6';
const CLIENT_BUILD_DATE = '2026-03-18';

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

// Global API base for all fetch calls
const API_BASE = window.location.protocol + '//' + (window.location.host || 'localhost:18787');

const recordBtn = document.getElementById('record-btn');
const status = document.getElementById('status');
const transcript = document.getElementById('transcript');
const transcriptText = document.getElementById('transcript-text');
const jarvisResponse = document.getElementById('jarvis-response');
const responseText = document.getElementById('response-text');
const jarvisOrb = document.getElementById('jarvis-orb');
const jarvisOrbContainer = document.getElementById('jarvis-orb').parentElement;
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
    recordBtn.style.display = 'block';
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
jarvisOrb.addEventListener('click', () => {
    isOrbEngaged = !isOrbEngaged;

    if (isOrbEngaged) {
        jarvisOrb.classList.add('engaged');
        // No speed change - keep video smooth
    } else {
        jarvisOrb.classList.remove('engaged');
        // No speed change - keep video smooth
    }
});

// Check if browser supports MediaRecorder (mobile browsers may need HTTPS)
const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
if (!hasMediaDevices) {
    console.warn('MediaDevices check failed, but attempting recording anyway...');
}

// Record button still works (for keyboard shortcut or mobile)
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
});

// Also allow ORB click to start/stop recording when not engaged
jarvisOrb.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    if (!isRecording) {
        await startRecording();
    } else {
        await stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
        }

        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = sendToServer;

        mediaRecorder.start(2000);
        isRecording = true;

        // Minimal DOM updates - don't touch orb classes (causes video reflow)
        recordBtn.textContent = 'STOP';
        // Removed: recordBtn.classList.add('recording');
        // Removed: jarvisOrb.classList.add('engaged', 'recording');
        // Removed: jarvisOrbContainer.classList.add('recording');
        
        // Update status text only (no inline style changes)
        status.textContent = '🔴 Recording...';
        transcript.classList.add('visible');
        transcriptText.textContent = 'Listening...';
        jarvisResponse.style.display = 'none';
    } catch (err) {
        status.textContent = '❌ Microphone access denied';
        console.error('Mic error:', err);
    }
}

async function stopRecording() {
    mediaRecorder.stop();
    isRecording = false;

    recordBtn.textContent = 'REC';
    // Removed: recordBtn.classList.remove('recording');
    // Removed: jarvisOrb.classList.remove('engaged', 'recording');
    // Removed: jarvisOrbContainer.classList.remove('recording');
    
    status.textContent = 'Uploading...';
    status.style.color = '#ffd700';
    status.style.textShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
    status.style.opacity = '1';
}

async function sendToServer() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.ok) {
            status.textContent = '✅ Uploaded! Processing...';
            transcript.classList.add('visible');

            const today = new Date().toISOString().split('T')[0];
            const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            const archivePath = `~/RAW/archive/${today}/audio/${today}-${time}-*.wav`;
            document.getElementById('transcript-path').textContent = archivePath;
            document.getElementById('transcript-path').title = `Full path: /Users/paulvisciano/RAW/archive/${today}/audio/`;

            transcriptText.innerHTML = '<span style="color: #00ff88;">✅ ' + result.message + '</span>';

            pollForTranscript(result.filename);
        } else {
            status.textContent = '❌ Upload failed';
            transcriptText.innerHTML = `<span style="color: #ff4444;">❌ Upload failed: ${result.message || 'Unknown error'}</span>`;
        }
    } catch (err) {
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
        transcriptText.innerHTML = `<span style="color: #ffd700;">⚠️ Server was offline. Audio saved to Downloads folder.<br>Re-upload when server is back.</span>`;
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
    if (!text) return '';
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

async function pollForTranscript(uploadFilename) {
    let attempts = 0;
    const maxAttempts = 180; // 3 min - whisper + agent can be slow
    let agentWaitStart = null;
    let thinkingTimer = null;
    const fileParam = uploadFilename ? '?file=' + encodeURIComponent(uploadFilename) : '';

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
                    // Don't overwrite the user's message with "Transcribing..." (race: server can return transcribing after moving file to archive)
                    const alreadyHaveTranscript = transcriptText.textContent.trim().length > 0
                        && !transcriptText.innerHTML.includes('Transcribing')
                        && !transcriptText.innerHTML.includes('Processing');
                    if (!alreadyHaveTranscript) {
                        transcriptText.innerHTML = '<span style="color: #ffd700;">⏳ Transcribing...</span>';
                    }
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
                        playResponse(data.jarvisResponse);
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
                    playResponse(data.jarvisResponse);
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

        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            clearThinkingTimer();
            transcript.classList.remove('pulsate');
            transcriptText.innerHTML = '<span style="color: #ff8800;">⏱️ Timeout - no transcript received</span>';
            status.textContent = 'Timeout';
        }
    }, 1000);
}

// Keyboard shortcut (Space to record)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        recordBtn.click();
    }
});

function playResponse(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English')) ||
                              voices.find(v => v.lang === 'en-US') ||
                              voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    }
}

function checkServerStatus() {
    fetch(`${API_BASE}/health`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('server-indicator').classList.remove('offline');
            document.getElementById('server-status-text').textContent = 'Server online';
            document.getElementById('server-version').textContent = `v${data.version} (${data.build})`;
            // Display client version
            document.getElementById('client-version').textContent = `UI: v${CLIENT_VERSION} (${CLIENT_BUILD_DATE})`;
        })
        .catch(() => {
            document.getElementById('server-indicator').classList.add('offline');
            document.getElementById('server-status-text').textContent = 'Server offline';
            document.getElementById('server-version').textContent = '';
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

checkServerStatus();
setInterval(checkServerStatus, 5000);

// === Network Dots Integration ===
(function() {
    const protocol = window.location.protocol;
    const host = window.location.host || 'localhost:18787';
    const API_BASE_NET = `${protocol}//${host}`;
    let devices = [];
    let dotElements = [];

    async function loadDevices() {
        try {
            const res = await fetch(`${API_BASE_NET}/network/devices`);
            const data = await res.json();
            if (data.error) return;
            devices = data.devices || [];
            renderDots();
        } catch (err) {
            console.warn('Network fetch failed:', err);
        }
    }

    function renderDots() {
        const container = document.getElementById('network-dots-container');
        if (!container) return;
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

            const tooltip = document.createElement('div');
            tooltip.className = 'network-dot-tooltip';
            tooltip.innerHTML = `
                <h4>${device.manufacturer}</h4>
                <p>IP: ${device.ip}</p>
                <p>MAC: ${device.mac.toUpperCase()}</p>
                <p>Type: ${device.deviceType}</p>
                <span class="qr-btn" data-ip="${device.ip}">📱 Show QR</span>
            `;

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

            const qrBtn = tooltip.querySelector('.qr-btn');
            qrBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showQRCode(device.ip);
            });
        });
    }

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

        fetch(`${API_BASE_NET}/network/qr`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    modal.querySelector('.qr-status').textContent = 'Failed to generate';
                    return;
                }
                modal.querySelector('.qr-status').textContent = `Scan to connect to ${ip}:18787`;
                modal.querySelector('.qr-image').src = data.qr;
                modal.querySelector('.qr-image').style.display = 'block';
                modal.querySelector('.qr-url').textContent = data.url;
            })
            .catch(() => {
                modal.querySelector('.qr-status').textContent = 'Generation failed';
            });
    }

    window.addEventListener('resize', renderDots);
    loadDevices();
    setInterval(loadDevices, 30000);
})();
