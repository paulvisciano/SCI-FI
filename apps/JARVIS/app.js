// JARVIS Voice Recorder UI - extracted from index.html

// Client version (bumped when UI changes ship)
const CLIENT_VERSION = '3.2.0';
const CLIENT_BUILD_DATE = '2026-04-01';
let isRecording = false;
// Shared with pollForTranscript — cleared when starting a new recording
let thinkingTimer = null;
let agentWaitStart = null;
// Poll session guard to prevent overlapping polling from overwriting the UI
let activePollId = 0;
let activePollInterval = null;

// Auto-open state

/**
 * Open the Jarvis UI in a new tab
 * Uses window.open() which works because it's triggered by user gesture (sending message)
 */
// Fade server status after 3 seconds, reappear on hover
let fadeTimer;
function setupServerStatusFade() {
  const serverStatus = document.getElementById('server-status');

  if (!serverStatus) {return;}

  const DEBUG = false; // Set to true for development logging

  // Fade out after 3 seconds
  fadeTimer = setTimeout(() => {
    serverStatus.classList.add('faded');
    if (DEBUG) {console.log('[UI] Server status faded out');}
  }, 3000);

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

function cancelActivePolling() {
  // Invalidate any in-flight poll callbacks immediately.
  activePollId++;

  if (activePollInterval) {
    clearInterval(activePollInterval);
    activePollInterval = null;
  }

  // Clear any "agent thinking..." timer tied to poll updates.
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
  agentWaitStart = null;
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
    scheduleTranscriptBubblePosition();
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

/** Pin transcript panel to top-right of orb (chat bubble); skipped in fullscreen */
let transcriptBubbleRaf = null;
function scheduleTranscriptBubblePosition() {
  if (transcriptBubbleRaf !== null) {
    cancelAnimationFrame(transcriptBubbleRaf);
  }
  transcriptBubbleRaf = requestAnimationFrame(() => {
    transcriptBubbleRaf = null;
    positionTranscriptBubble();
  });
}

function positionTranscriptBubble() {
  const tr = document.getElementById('transcript');
  const orb = document.getElementById('jarvis-orb-container');
  if (!tr || !orb || tr.classList.contains('fullscreen')) {return;}
  const r = orb.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) {return;}
  // Close positioning: transcript feels like it's emerging from the orb
  const gapH = -2;  // Slight overlap (negative = bubble extends over orb)
  const gapV = -2;  // Slight overlap
  let left = r.right + gapH;
  const bottom = window.innerHeight - r.top + gapV;
  tr.style.left = `${Math.round(left)}px`;
  tr.style.bottom = `${Math.round(bottom)}px`;
  tr.style.top = 'auto';
  tr.style.right = 'auto';
  const tw = tr.getBoundingClientRect().width;
  if (tw > 0) {
    left = Math.min(left, window.innerWidth - tw - 10);
    left = Math.max(8, left);
    tr.style.left = `${Math.round(left)}px`;
  }
}

if (transcript && jarvisOrbContainer) {
  const transcriptBubbleObserver = new MutationObserver(() => scheduleTranscriptBubblePosition());
  transcriptBubbleObserver.observe(transcript, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', scheduleTranscriptBubblePosition);
  const dockStack = document.querySelector('.jarvis-bottom-left-stack');
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => scheduleTranscriptBubblePosition()).observe(jarvisOrbContainer);
    if (dockStack) {
      new ResizeObserver(() => scheduleTranscriptBubblePosition()).observe(dockStack);
    }
  }
  scheduleTranscriptBubblePosition();
}

let isOrbEngaged = false;

// Text input elements
let textInputContainer = null;
let jarvisTextInput = null;
let jarvisSendBtn = null;

// Text input state
let isTextInputVisible = false;

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

// ORB pointerdown handler - engage/disengage JARVIS (works for both mouse click and mobile tap)
jarvisOrbContainer.addEventListener('pointerdown', () => {
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

// ORB pointerdown/tap - start/stop recording (works on mobile + desktop)
// Mobile: tap orb (no Space key)
// Desktop: can use Space key OR tap orb (both work)
jarvisOrb.addEventListener('pointerdown', async (e) => {
  e.preventDefault(); // Prevent default behavior and double-firing
  e.stopPropagation();
  if (!isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
  if (DEBUG) {console.log('[Orb pointerdown] Recording toggled');}
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
    // Clear current transcription state before starting new recording
    try {
      await fetch(`${API_BASE}/transcript/clear`, { method: 'POST' });
    } catch (clearErr) {
      console.log('[startRecording] Clear endpoint not available, continuing...');
    }
    cancelActivePolling();

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

    // Recording state — CSS on #jarvis-orb + sphere tint
    jarvisOrb.classList.add('recording');
    syncJarvisOrbRecordingMaterial();

    // Update status text
    status.textContent = '🔴 Recording...';

    // Update recording hint
    const hint = document.getElementById('recording-hint');
    if (hint) {
      hint.textContent = 'Press Space to stop recording';
    }

    transcript.classList.add('visible');
    // Clear transcript immediately and show "Recording..." to prevent showing old transcript
    transcriptText.innerHTML = '<span style="color: #00ffff;">🎤 Recording...</span>';
    // Clear the response area as well
    responseText.innerHTML = '';
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
  syncJarvisOrbRecordingMaterial();

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

// === TTS Audio Playback Functions ===
// TTS audio player element
let ttsAudioPlayer = null;

// Initialize TTS audio player
function initTtsPlayer() {
  if (ttsAudioPlayer) return;
  
  // Get the audio element from the DOM
  const audioEl = document.getElementById('jarvis-tts-player');
  if (audioEl) {
    ttsAudioPlayer = audioEl;
    console.log('[TTS] Audio player initialized');
    console.log('[TTS] Audio element state:', { 
      src: audioEl.src, 
      readyState: audioEl.readyState,
      paused: audioEl.paused,
      preload: audioEl.preload
    });
    
    // Add error handling
    ttsAudioPlayer.addEventListener('error', (e) => {
      console.error('[TTS] Audio playback error:', e);
      console.error('[TTS] Error details:', { 
        error: e.target.error, 
        readyState: e.target.readyState,
        networkState: e.target.networkState
      });
    });
    
    // Add ended event to show visual feedback
    ttsAudioPlayer.addEventListener('ended', () => {
      console.log('[TTS] Audio playback completed');
    });
    
    // Add waiting event (buffering)
    ttsAudioPlayer.addEventListener('waiting', () => {
      console.log('[TTS] Audio waiting for data...');
    });
    
    // Add canplay event
    ttsAudioPlayer.addEventListener('canplay', () => {
      console.log('[TTS] Audio ready to play');
    });
  } else {
    console.warn('[TTS] Audio player element not found in DOM');
  }
}

// Play TTS audio from filename
function playTtsAudio(filename) {
  if (!filename) return;
  
  // Store filename for click-to-play
  lastTtsFilename = filename;
  
  console.log('[TTS] playTtsAudio called with filename:', filename);
  
  // Initialize if not already done
  initTtsPlayer();
  
  if (!ttsAudioPlayer) {
    console.warn('[TTS] Audio player not available after initTtsPlayer');
    return;
  }
  
  // Construct the audio URL
  const audioUrl = `${API_BASE}/api/tts/${encodeURIComponent(filename)}`;
  console.log('[TTS] Audio URL:', audioUrl);
  console.log('[TTS] Calling playTtsAudio()...');
  
  // Log current state before changing src
  console.log('[TTS] Audio element state BEFORE update:', { 
    src: ttsAudioPlayer.src, 
    readyState: ttsAudioPlayer.readyState,
    paused: ttsAudioPlayer.paused,
    networkState: ttsAudioPlayer.networkState
  });
  
  // Set the source and play
  ttsAudioPlayer.src = audioUrl;
  ttsAudioPlayer.currentTime = 0;
  
  // Log state after setting src
  console.log('[TTS] Audio element state AFTER src update:', { 
    src: ttsAudioPlayer.src, 
    readyState: ttsAudioPlayer.readyState,
    paused: ttsAudioPlayer.paused
  });
  
  // Add visual indicator that audio is ready (not yet playing due to autoplay policy)
  showAudioReadyIndicator();
  
  // Play with error handling
  ttsAudioPlayer.play()
    .then(() => {
      console.log('[TTS] Audio playback started successfully');
      console.log('[TTS] Audio element state after play:', { 
        readyState: ttsAudioPlayer.readyState,
        paused: ttsAudioPlayer.paused,
        currentTime: ttsAudioPlayer.currentTime,
        duration: ttsAudioPlayer.duration
      });
      updateAudioIndicatorToPlaying();
    })
    .catch((err) => {
      console.error('[TTS] Audio playback failed:', err);
      console.error('[TTS] Playback error details:', { 
        name: err.name,
        message: err.message,
        readyState: ttsAudioPlayer.readyState
      });
      
      if (err.name === 'NotAllowedError') {
        console.warn('[TTS] Autoplay policy blocked playback - user interaction required');
        updateAudioIndicatorToClickToPlay();
      }
    });
}

// Show audio ready indicator (waiting for user to click)
function showAudioReadyIndicator() {
  // Remove existing indicators first
  removeAudioIndicators();
  
  // Create new indicator with "Ready" state
  const indicator = document.createElement('div');
  indicator.id = 'tts-ready-indicator';
  indicator.className = 'tts-ready-indicator';
  indicator.innerHTML = '<span>🔊 TTS ready - click to play</span>';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 215, 0, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    cursor: pointer;
    transition: opacity 0.3s ease, transform 0.2s ease;
    user-select: none;
  `;
  indicator.addEventListener('click', () => {
    // User clicked - try to play again
    playTtsAudio(lastTtsFilename);
  });
  indicator.addEventListener('mouseenter', () => {
    indicator.style.transform = 'scale(1.02)';
  });
  indicator.addEventListener('mouseleave', () => {
    indicator.style.transform = 'scale(1)';
  });
  document.body.appendChild(indicator);
  
  // Auto-hide after 10 seconds if user doesn't interact
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator.parentNode) {
          document.body.removeChild(indicator);
        }
      }, 300);
    }
  }, 10000);
}

// Update indicator to "Playing" state
function updateAudioIndicatorToPlaying() {
  const indicator = document.getElementById('tts-ready-indicator');
  if (indicator) {
    indicator.innerHTML = '<span>🔊 Playing</span>';
    indicator.style.background = 'rgba(0, 255, 0, 0.8)';
    indicator.style.cursor = 'default';
  }
}

// Update indicator to "Click to Play" state
function updateAudioIndicatorToClickToPlay() {
  const indicator = document.getElementById('tts-ready-indicator');
  if (indicator) {
    indicator.innerHTML = '<span>🔊 Click to play</span>';
    indicator.style.background = 'rgba(255, 100, 50, 0.9)';
    indicator.style.cursor = 'pointer';
  }
}

// Remove all audio indicators
function removeAudioIndicators() {
  ['tts-ready-indicator', 'tts-playing-indicator'].forEach(id => {
    const indicator = document.getElementById(id);
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  });
}

// Track last TTS filename for click-to-play
let lastTtsFilename = null;

// Show visual indicator that audio is playing (keep for backward compatibility)
// Show visual indicator that audio is playing
function showAudioPlayingIndicator() {
  // Create or update an indicator element
  let indicator = document.getElementById('tts-playing-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'tts-playing-indicator';
    indicator.className = 'tts-playing-indicator';
    indicator.innerHTML = '<span>🔊 Playing</span>';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 255, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(indicator);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator.parentNode) {
          document.body.removeChild(indicator);
        }
      }, 500);
    }, 5000);
  }
}

// Toggle TTS mute/unmute
let isTtsMuted = false;
function toggleTtsMute() {
  isTtsMuted = !isTtsMuted;
  
  if (ttsAudioPlayer) {
    ttsAudioPlayer.muted = isTtsMuted;
  }
  
  console.log(`[TTS] Mute: ${isTtsMuted ? 'ON' : 'OFF'}`);
  return isTtsMuted;
}

// Check if TTS is available
function isTtsAvailable() {
  return !!ttsAudioPlayer;
}

// Polling configuration constants
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180; // 3 min - whisper + agent can be slow

async function pollForTranscript(uploadFilename) {
  let attempts = 0;
  const pollId = ++activePollId;
  if (activePollInterval) {
    clearInterval(activePollInterval);
    activePollInterval = null;
  }
  // Ensure no leftover "agent thinking..." timer from a previous poll session.
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
  agentWaitStart = null;
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
    // Stop immediately if a newer poll session has started.
    if (pollId !== activePollId) {
      clearInterval(pollInterval);
      return;
    }

    attempts++;

    try {
      const response = await fetch(`${API_BASE}/transcript/latest${fileParam}`);
      if (response.ok) {
        const data = await response.json();

        // Ignore any responses that arrived after a newer poll started.
        if (pollId !== activePollId) {
          return;
        }

        // Log full poll response for debugging
        console.log('[TTS] Poll response:', data);
        console.log('[TTS] Poll response - status:', data.status);
        
        if (data.status === 'transcribing') {
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          // Keep "Transcribing..." visible while server is transcribing
          transcriptText.innerHTML = '<span style="color: #ffd700;">⏳ Transcribing...</span>';
          status.textContent = 'Processing...';
        } else if (data.status === 'processing' && data.transcript) {
          transcriptText.textContent = data.transcript;
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
          console.log('[TTS] Poll response - status: done, transcript available');
          console.log('[TTS] Poll response - full data:', data);
          
          if (data.jarvisResponse) {
            console.log('[TTS] Audio filename detected:', data.audioFilename || 'none');
            console.log('[TTS] Calling playTtsAudio()...');
            
            clearInterval(pollInterval);
            if (activePollInterval === pollInterval) activePollInterval = null;
            clearThinkingTimer();
            transcript.classList.remove('pulsate');
            status.textContent = '✅ Complete';
            status.style.color = '#00ff88';
            status.style.textShadow = '0 0 30px rgba(0, 255, 136, 0.6)';
            status.style.opacity = '1';
            transcriptText.textContent = data.transcript;
            responseText.innerHTML = formatResponseText(data.jarvisResponse);
            jarvisResponse.style.display = 'block';
            
            // Play TTS audio if available
            if (data.audioFilename) {
              console.log('[TTS] Audio filename found:', data.audioFilename);
              playTtsAudio(data.audioFilename);
            } else {
              console.log('[TTS] No audioFilename in response');
            }
          } else {
            // Agent didn't return a response (failed or empty) - stop polling and show message
            clearInterval(pollInterval);
            if (activePollInterval === pollInterval) activePollInterval = null;
            clearThinkingTimer();
            transcript.classList.remove('pulsate');
            status.textContent = '⚠️ No response';
            status.style.color = '#ffd700';
            responseText.innerHTML = '<span style="color: #888;">No response from agent. Check server logs.</span>';
            jarvisResponse.style.display = 'block';
          }
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          if (activePollInterval === pollInterval) activePollInterval = null;
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
          console.log('[TTS] Poll response - status: done (no transcript), jarvisResponse present');
          console.log('[TTS] Poll response - full data:', data);
          console.log('[TTS] Audio filename detected:', data.audioFilename || 'none');
          
          if (transcriptText.textContent === '' || transcriptText.innerHTML.includes('Transcribing') || transcriptText.innerHTML.includes('Processing')) {
            transcriptText.textContent = '-';
          }
          clearInterval(pollInterval);
          if (activePollInterval === pollInterval) activePollInterval = null;
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          status.textContent = '✅ Complete';
          status.style.color = '#00ff88';
          responseText.innerHTML = formatResponseText(data.jarvisResponse);
          jarvisResponse.style.display = 'block';
          
          // Play TTS audio if available
          if (data.audioFilename) {
            console.log('[TTS] Audio filename found (no transcript case):', data.audioFilename);
            playTtsAudio(data.audioFilename);
          } else {
            console.log('[TTS] No audioFilename in response (no transcript case)');
          }
        } else if (data.status === 'idle') {
          clearThinkingTimer();
          transcript.classList.remove('pulsate');
          transcriptText.textContent = 'Waiting for input...';
        }
      }
    } catch (err) {
      if (pollId !== activePollId) return;
      console.error('Poll error:', err);
      if (attempts === 1) {
        transcriptText.innerHTML = '<span style="color: #00ffff;">⏳ Processing...</span>';
      }
    }

    if (attempts >= MAX_POLL_ATTEMPTS) {
      clearInterval(pollInterval);
      if (activePollInterval === pollInterval) activePollInterval = null;
      clearThinkingTimer();
      transcript.classList.remove('pulsate');
      transcriptText.innerHTML = '<span style="color: #ff8800;">⏱️ Timeout - no transcript received</span>';
      status.textContent = 'Timeout';
    }
  }, POLL_INTERVAL_MS);

  activePollInterval = pollInterval;
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
      const drawerIndicator = document.getElementById('drawer-server-indicator');
      const drawerStatusText = document.getElementById('drawer-server-status-text');

      // Check if JARVIS process is alive (from /health endpoint)
      // Response: { status: 'ok', version: VERSION, build: BUILD_DATE, jarvis: { pid, memory, uptime } }
      if (data.status === 'ok') {
        // Update main status if elements exist
        if (indicator) {
          indicator.style.background = '#00ffff';
          indicator.style.boxShadow = '0 0 8px #00ffff';
        }
        if (statusText) {
          const serverVersion = data.version ? `v${data.version}` : 'v?';
          const pid = data.jarvis?.pid || '?';
          const memory = data.jarvis?.memory || '?';
          const uptime = data.jarvis?.uptime || '?';
          statusText.textContent = `Server: ${serverVersion} • PID ${pid} • ${memory} • ${uptime}`;
        }
        
        // Update drawer status if elements exist
        if (drawerIndicator) {
          drawerIndicator.style.background = '#00ffff';
          drawerIndicator.style.boxShadow = '0 0 8px #00ffff';
        }
        if (drawerStatusText) {
          const serverVersion = data.version ? `v${data.version}` : 'v?';
          const pid = data.jarvis?.pid || '?';
          const memory = data.jarvis?.memory || '?';
          const uptime = data.jarvis?.uptime || '?';
          drawerStatusText.textContent = `Server: ${serverVersion} • PID ${pid} • ${memory} • ${uptime}`;
        }

        console.log('[checkServerStatus] Status updated (main:', statusText?.textContent, 'drawer:', drawerStatusText?.textContent, ')');
        
        // Restore faded state after updating text (polling doesn't break fade)
        const mainStatusEl = document.getElementById('server-status');
        const wasFaded = mainStatusEl?.classList.contains('faded');
        if (wasFaded && mainStatusEl) {
          mainStatusEl.classList.add('faded');
        }

        // Setup fade-in-out logic on first successful health check
        if (!window.serverStatusFadeSetup) {
          setupServerStatusFade();
          window.serverStatusFadeSetup = true;
          console.log('[UI v2.9.11] Fade setup called on first health check');
        }
      } else {
        // Server offline - update both main and drawer status
        if (indicator) {
          indicator.style.background = '#ff4444';
          indicator.style.boxShadow = '0 0 8px #ff4444';
        }
        if (statusText) {
          statusText.textContent = 'Server: Offline';
          statusText.style.color = '#ff4444';
        }
        if (drawerIndicator) {
          drawerIndicator.style.background = '#ff4444';
          drawerIndicator.style.boxShadow = '0 0 8px #ff4444';
        }
        if (drawerStatusText) {
          drawerStatusText.textContent = 'Server: Offline';
          drawerStatusText.style.color = '#ff4444';
        }
      }
    })
    .catch((err) => {
      console.error('[checkServerStatus] Error:', err);
      if (indicator) {
        indicator.style.background = '#ff4444';
        indicator.style.boxShadow = '0 0 8px #ff4444';
      }
      if (statusText) {
        statusText.textContent = 'Health check failed';
        statusText.style.color = '#ff4444';
      }
      if (drawerIndicator) {
        drawerIndicator.style.background = '#ff4444';
        drawerIndicator.style.boxShadow = '0 0 8px #ff4444';
      }
      if (drawerStatusText) {
        drawerStatusText.textContent = 'Health check failed';
        drawerStatusText.style.color = '#ff4444';
      }
    });
}

// Update orb version badge
function updateOrbVersion() {
  const orbVersionEl = document.getElementById('orb-version');
  if (orbVersionEl) {
    orbVersionEl.textContent = `v${CLIENT_VERSION}`;
  }
  
  // Also update the main UI title (client-version-inline span)
  const clientVersionEl = document.getElementById('client-version-inline');
  if (clientVersionEl) {
    clientVersionEl.textContent = `v${CLIENT_VERSION}`;
  }
}

// Setup TTS toggle button
function setupTtsToggle() {
  const ttsToggleBtn = document.getElementById('tts-toggle');
  if (ttsToggleBtn) {
    ttsToggleBtn.addEventListener('click', () => {
      const isMuted = toggleTtsMute();
      document.getElementById('tts-status').textContent = isMuted ? '🔇 TTS: OFF' : '🔊 TTS: ON';
    });
    console.log('[TTS] Toggle button setup complete');
  }
}

updateOrbVersion();
setupTtsToggle();

// === Mobile Drawer Setup ===
function setupMobileDrawer() {
  const menuToggle = document.getElementById('menu-toggle');
  const menuClose = document.getElementById('menu-close');
  const menuBackdrop = document.getElementById('menu-backdrop');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const drawerServerStatus = document.getElementById('drawer-server-status');
  const drawerMemoryToggle = document.getElementById('drawer-memory-toggle');
  
  let isDrawerOpen = false;
  
  // Open drawer
  function openDrawer() {
    if (!menuToggle || !mobileDrawer || !menuBackdrop) return;
    
    isDrawerOpen = true;
    mobileDrawer.classList.add('open');
    menuBackdrop.classList.add('visible');
    
    // Update drawer elements with current state
    if (drawerServerStatus) {
      // Sync with main server status
      const indicator = document.getElementById('server-indicator');
      const text = document.getElementById('server-status-text');
      if (indicator && text) {
        drawerServerStatus.innerHTML = `
          <span class="indicator" id="drawer-server-indicator" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #00ffff; box-shadow: 0 0 8px #00ffff; margin-right: 10px;"></span>
          <span id="drawer-server-status-text" style="color: #00ffff;">${text.textContent}</span>
        `;
      }
    }
    
    // Update drawer memory toggle to match current state
    if (drawerMemoryToggle) {
      if (currentMemorySource === 'user') {
        drawerMemoryToggle.classList.add('active');
        document.getElementById('drawer-memory-label').textContent = '🧠 User Memory';
      } else {
        drawerMemoryToggle.classList.remove('active');
        document.getElementById('drawer-memory-label').textContent = '🧠 Jarvis Memory';
      }
    }
    
    // Update hidden main memory toggle for sync
    const mainMemoryToggle = document.getElementById('main-memory-toggle');
    const mainMemoryLabel = document.getElementById('main-memory-label');
    if (mainMemoryToggle && mainMemoryLabel) {
      if (currentMemorySource === 'user') {
        mainMemoryToggle.classList.add('active');
        mainMemoryLabel.textContent = '🧠 User Memory';
      } else {
        mainMemoryToggle.classList.remove('active');
        mainMemoryLabel.textContent = '🧠 Jarvis Memory';
      }
    }
    
    console.log('[MobileDrawer] Drawer opened');
  }
  
  // Close drawer
  function closeDrawer() {
    if (!mobileDrawer || !menuBackdrop) return;
    
    isDrawerOpen = false;
    mobileDrawer.classList.remove('open');
    menuBackdrop.classList.remove('visible');
    console.log('[MobileDrawer] Drawer closed');
  }
  
  // Toggle drawer
  function toggleDrawer() {
    if (isDrawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }
  
  // Attach event listeners
  if (menuToggle) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawer();
    });
    console.log('[MobileDrawer] Menu toggle listener attached');
  }
  
  if (menuClose) {
    menuClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
    console.log('[MobileDrawer] Menu close listener attached');
  }
  
  if (menuBackdrop) {
    menuBackdrop.addEventListener('click', () => {
      closeDrawer();
    });
    console.log('[MobileDrawer] Backdrop click listener attached');
  }
  
  // Drawer server status - click to open vitals
  if (drawerServerStatus) {
    drawerServerStatus.addEventListener('click', () => {
      // Trigger vitals toggle
      vitalsToggle.click();
      closeDrawer();
    });
    console.log('[MobileDrawer] Drawer server status listener attached');
  }
  
  // Drawer memory toggle - sync with main toggle
  if (drawerMemoryToggle) {
    drawerMemoryToggle.addEventListener('click', toggleMemorySource);
    console.log('[MobileDrawer] Drawer memory toggle listener attached');
  }
}

setupMobileDrawer();

// Server status check interval with cleanup on page unload
console.log('[UI] Starting server status interval...');
const serverStatusInterval = setInterval(checkServerStatus, 5000);
window.addEventListener('beforeunload', () => {
  clearInterval(serverStatusInterval);
});

// Detect preview mode (port 18788)
const currentPort = window.location.port || '80';
const IS_PREVIEW = currentPort === '18788' || 
                   new URLSearchParams(window.location.search).get('preview') === 'true';

console.log('[UI] Port detection:', { 
  currentPort, 
  locationPort: window.location.port, 
  locationHost: window.location.host, 
  isPreview: IS_PREVIEW,
  searchParams: Object.fromEntries(new URLSearchParams(window.location.search))
});

// Set page title for preview mode
if (IS_PREVIEW) {
  const originalTitle = document.title;
  if (!originalTitle.includes('[PREVIEW]')) {
    document.title = `[PREVIEW] ${originalTitle}`;
  }
  console.log('[UI] Running in PREVIEW MODE (port 18788)');
}

// Wait for DOM to be ready before first check
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[UI] DOMContentLoaded - calling checkServerStatus');
    checkServerStatus();
    
    // Set up memory toggle event listener (use pointerdown for mobile tap support)
    const memoryToggle = document.getElementById('memory-toggle');
    if (memoryToggle) {
      memoryToggle.addEventListener('pointerdown', () => {
        console.log('[MemoryToggle] pointerdown fired! Current source:', currentMemorySource);
        toggleMemorySource();
      });
      console.log('[MemoryToggle] pointerdown event listener attached');
    }
    
    // Show preview badge if in preview mode
    if (IS_PREVIEW) {
      const previewBadge = document.getElementById('preview-badge');
      if (previewBadge) {
        previewBadge.textContent = 'PREVIEW';
        previewBadge.style.display = 'block';
        console.log('[UI] Preview badge displayed');
      }
    }
  });
} else {
  console.log('[UI] DOM already ready - calling checkServerStatus');
  checkServerStatus();
  
  // Set up memory toggle event listener (DOM already ready case)
  const memoryToggle = document.getElementById('memory-toggle');
  if (memoryToggle) {
    memoryToggle.addEventListener('pointerdown', () => {
      console.log('[MemoryToggle] pointerdown fired (DOM ready)! Current source:', currentMemorySource);
      toggleMemorySource();
    });
    console.log('[MemoryToggle] pointerdown event listener attached (DOM already ready)');
  }
  
  // Add pointerleave handler to clear hover state on toggle
  memoryToggle.addEventListener('pointerleave', () => {
    memoryToggle.classList.remove('hovered');
  });
  
  // Also add handler to inner toggle handle for better mobile tap response
  const toggleSwitch = document.getElementById('memory-toggle-switch');
  if (toggleSwitch) {
    toggleSwitch.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); // Prevent bubbling
      toggleMemorySource();
    });
    console.log('[MemoryToggle] Toggle switch pointerdown handler attached');
  }
  
  const toggleHandle = document.getElementById('memory-toggle-handle');
  if (toggleHandle) {
    toggleHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); // Prevent bubbling
      toggleMemorySource();
    });
    console.log('[MemoryToggle] Toggle handle pointerdown handler attached');
  }
  
  console.log('[MemoryToggle] Event listener attached (DOM already ready)');
  
  // Show preview badge if in preview mode
  if (IS_PREVIEW) {
    const previewBadge = document.getElementById('preview-badge');
    if (previewBadge) {
      previewBadge.textContent = 'PREVIEW';
      previewBadge.style.display = 'block';
      console.log('[UI] Preview badge displayed (DOM already ready)');
    }
  }
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

    const cs = getComputedStyle(container);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const innerW = container.clientWidth - pl - pr;
    const innerH = container.clientHeight - pt - pb;
    if (innerW < 24 || innerH < 24) {return;}

    const centerX = pl + innerW / 2;
    const centerY = pt + innerH / 2;
    const ringRadius = Math.min(innerW, innerH) * 0.36;
    const dotHalf = container.closest('.vitals-network-card') ? 6 : 8;

    devices.forEach((device, idx) => {
      const angle = (idx / devices.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * ringRadius;
      const y = centerY + Math.sin(angle) * ringRadius;

      const dot = document.createElement('div');
      dot.className = `network-dot ${device.isGateway ? 'gateway' : ''}`;
      dot.style.left = `${x - dotHalf}px`;
      dot.style.top = `${y - dotHalf}px`;
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
    });

    container.onclick = (e) => {
      if (!e.target.closest('.network-dot')) {
        dotElements.forEach(d => d.classList.remove('selected'));
      }
    };
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

      requestAnimationFrame(() => { renderDots(); });
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
    const enabled = desktopArchivingToggle?.checked ?? false;
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

  // Initialize text input
  function initTextInput() {
    console.log('[TextInput] Initializing text input handlers');
    
    // DOM element references - lookup after DOM is loaded
    textInputContainer = document.getElementById('text-input-container');
    jarvisTextInput = document.getElementById('jarvis-text-input');
    jarvisSendBtn = document.getElementById('jarvis-send-btn');
    
    if (!textInputContainer || !jarvisTextInput || !jarvisSendBtn) {
      console.warn('[TextInput] DOM elements not found - text input disabled');
      console.warn('  textInputContainer:', !!textInputContainer);
      console.warn('  jarvisTextInput:', !!jarvisTextInput);
      console.warn('  jarvisSendBtn:', !!jarvisSendBtn);
      return;
    }
    
    // Orb pointerdown - show text input if hidden, or hide if visible (works for both mouse and touch)
    jarvisOrbContainer.addEventListener('pointerdown', () => {
      if (!isTextInputVisible) {
        console.log('[TextInput] Showing text input');
      // Also toggle engagement (visual feedback)
      isOrbEngaged = !isOrbEngaged;
      if (isOrbEngaged) {
        jarvisOrb.classList.add('engaged');
      } else {
        jarvisOrb.classList.remove('engaged');
      }
        isTextInputVisible = true;
        textInputContainer.classList.remove('hidden');
        jarvisTextInput.focus();
      } else {
        console.log('[TextInput] Hiding text input');
        isTextInputVisible = false;
        textInputContainer.classList.add('hidden');
        jarvisTextInput.value = '';
        // Return focus to orb
        jarvisOrb.focus();
      }
    }, { passive: true });
    
    // Text input Enter key - send message
    jarvisTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendTextMessage();
      }
    });
    
    // Send button click - send message
    jarvisSendBtn.addEventListener('click', () => {
      sendTextMessage();
    });
    
    // Escape key - hide text input
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isTextInputVisible) {
        console.log('[TextInput] Hiding via Escape key');
        isTextInputVisible = false;
        textInputContainer.classList.add('hidden');
        jarvisTextInput.value = '';
        jarvisOrb.focus();
      }
    });
    
    // Click outside input - hide text input
    document.addEventListener('click', (e) => {
      if (isTextInputVisible && 
          !textInputContainer.contains(e.target) && 
          !jarvisOrbContainer.contains(e.target)) {
        console.log('[TextInput] Hiding via outside click');
        isTextInputVisible = false;
        textInputContainer.classList.add('hidden');
        jarvisTextInput.value = '';
        jarvisOrb.focus();
      }
    });
  }

  // Initialize text input on page load
  setTimeout(() => {
    initTextInput();
  }, 100);

  // Send text message to OpenClaw
  async function sendTextMessage() {
    if (!jarvisTextInput) {
      console.error('[TextInput] Text input not found');
      return;
    }
    
    const message = jarvisTextInput.value.trim();
    
    // Validation
    if (message.length === 0) {
      console.warn('[TextInput] Empty message - focusing input');
      if (jarvisTextInput) {
        jarvisTextInput.focus();
      }
      return;
    }
    
    if (message.length > 5000) {
      alert('Message too long. Max 5000 characters.');
      return;
    }
    
    // Check for dangerous characters (basic validation)
    const dangerousPatterns = [/;.*--/, /'.*or.*'.*=.*'/, /.*eval.*/, /.*exec.*/];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(message.toLowerCase())) {
        alert('Message contains potentially dangerous content.');
        return;
      }
    }
    
    console.log(`[TextInput] Sending message: ${message.substring(0, 50)}...`);
    
    // Show loading state
    if (jarvisSendBtn) {
      jarvisSendBtn.innerHTML = '⏳';
      jarvisSendBtn.style.background = 'rgba(255, 165, 0, 0.2)';
    }
    
    try {
      // Send to server endpoint
      const response = await fetch(`${API_BASE}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`[TextInput] Message sent successfully`);
        console.log(`[TextInput] Jarvis response: ${result.jarvisResponse || ''}`);
        
        // Clear input on success
        if (jarvisTextInput) {
          jarvisTextInput.value = '';
        }
        
        // Show success feedback
        if (jarvisSendBtn) {
          jarvisSendBtn.innerHTML = '✅';
          jarvisSendBtn.style.background = 'rgba(68, 255, 68, 0.2)';
        }
        
        // Hide input after successful send
        setTimeout(() => {
          isTextInputVisible = false;
          if (textInputContainer) {
            textInputContainer.classList.add('hidden');
          }
          if (jarvisTextInput) {
            jarvisTextInput.value = '';
          }
        }, 500);
      } else {
        // Show error
        console.error('[TextInput] Send failed:', result.error);
        if (jarvisSendBtn) {
          jarvisSendBtn.innerHTML = '❌';
          jarvisSendBtn.style.background = 'rgba(255, 68, 68, 0.2)';
        }
      }
    } catch (error) {
      console.error('[TextInput] Network error:', error);
      if (jarvisSendBtn) {
        jarvisSendBtn.innerHTML = '❌';
        jarvisSendBtn.style.background = 'rgba(255, 68, 68, 0.2)';
      }
    }
    
    // Reset button after delay
    setTimeout(() => {
      if (jarvisSendBtn && (jarvisSendBtn.innerHTML === '✅' || jarvisSendBtn.innerHTML === '❌')) {
        jarvisSendBtn.innerHTML = '→';
        jarvisSendBtn.style.background = '';
      }
    }, 2000);
  }

})();

// === Three.js Global Variables ===
console.log('[JARVIS] Three.js setup starting...');
let neurons = [];
let synapses = [];
let neurographData = null;
let idleRotation = 0;
let isNeurographLoaded = false;
let currentMemorySource = 'jarvis'; // 'jarvis' or 'user'
/** Repulsion is O(n²); throttle + pass budget cuts steady-state CPU without touching pointer/hover. */
let neurographAnimFrame = 0;
let neuroRepulsionPasses = 0;
const NEURO_REPULSION_MAX_PASSES = 600;
const NEURO_MAX_PIXEL_RATIO = 1.5;
/** When false, connection lines are not created (CPU/GPU experiment). */
const NEUROGRAPH_DRAW_SYNAPSES = false;

// === Three.js JARVIS Orb Rendering ===
// Video is hidden in DOM; texture maps onto a sphere in #jarvis-orb (.orb-glow-ring)

let jarvisOrbScene, jarvisOrbCamera, jarvisOrbRenderer;
let jarvisOrbMesh;
let jarvisOrbVideoTexture;

/** Keep sphere material in sync with #jarvis-orb recording class + CSS */
function syncJarvisOrbRecordingMaterial() {
  if (!jarvisOrbMesh || !jarvisOrbMesh.material) {return;}
  const m = jarvisOrbMesh.material;
  if (jarvisOrb.classList.contains('recording')) {
    m.color.setHex(0xff8888);
  } else {
    m.color.setHex(0xffffff);
  }
}

// Initialize JARVIS Orb Three.js scene (canvas appended to #jarvis-orb)
function initJarvisOrb() {
  const outer = document.getElementById('jarvis-orb-container');
  const mount = document.getElementById('jarvis-orb');
  if (!outer || !mount) {
    console.warn('[JarvisOrb] orb container or #jarvis-orb mount not found');
    return;
  }

  const video = document.getElementById('jarvis-video');
  if (!video) {
    console.warn('[JarvisOrb] Video element not found');
    return;
  }

  jarvisOrbScene = new THREE.Scene();
  jarvisOrbScene.background = null;

  jarvisOrbCamera = new THREE.PerspectiveCamera(68, 1, 0.1, 1000);
  /* Closer camera = larger sphere in frame; canvas pixel size unchanged (resizeOrb still uses #jarvis-orb). */
  jarvisOrbCamera.position.set(0, 0, 2.58);

  jarvisOrbRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false
  });
  jarvisOrbRenderer.setClearColor(0x000000, 0);
  if (jarvisOrbRenderer.outputEncoding !== undefined && THREE.sRGBEncoding !== undefined) {
    jarvisOrbRenderer.outputEncoding = THREE.sRGBEncoding;
  }
  jarvisOrbRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.appendChild(jarvisOrbRenderer.domElement);

  function createVideoSphere() {
    if (jarvisOrbMesh) {return;}
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {return;}

    jarvisOrbVideoTexture = new THREE.VideoTexture(video);
    jarvisOrbVideoTexture.minFilter = THREE.LinearFilter;
    jarvisOrbVideoTexture.magFilter = THREE.LinearFilter;
    jarvisOrbVideoTexture.flipY = false;
    if (THREE.SRGBColorSpace !== undefined) {
      jarvisOrbVideoTexture.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      jarvisOrbVideoTexture.encoding = THREE.sRGBEncoding;
    }
    const maxA = jarvisOrbRenderer.capabilities.getMaxAnisotropy
      ? jarvisOrbRenderer.capabilities.getMaxAnisotropy()
      : 1;
    jarvisOrbVideoTexture.anisotropy = Math.min(8, maxA);

    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const material = new THREE.MeshBasicMaterial({
      map: jarvisOrbVideoTexture,
      color: 0xffffff
    });
    jarvisOrbMesh = new THREE.Mesh(geometry, material);
    jarvisOrbMesh.scale.x = -1;
    jarvisOrbScene.add(jarvisOrbMesh);
    syncJarvisOrbRecordingMaterial();
    console.log('[JarvisOrb] Video mapped onto sphere', video.videoWidth, 'x', video.videoHeight);
  }

  function kickPlayback() {
    video.play().catch((err) => {
      console.warn('[JarvisOrb] video.play() failed (autoplay policy?):', err);
    });
  }

  video.addEventListener('loadeddata', () => {
    createVideoSphere();
    kickPlayback();
  });
  video.addEventListener('canplay', () => {
    createVideoSphere();
  });
  createVideoSphere();
  kickPlayback();

  function resizeOrb() {
    const rect = mount.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    jarvisOrbCamera.aspect = 1;
    jarvisOrbCamera.updateProjectionMatrix();
    jarvisOrbRenderer.setSize(size, size);
  }

  outer.addEventListener('mouseenter', () => {
    if (!jarvisOrbMesh || jarvisOrb.classList.contains('recording')) {return;}
    jarvisOrbMesh.material.color.setHex(0xaaffff);
  });

  outer.addEventListener('mouseleave', () => {
    syncJarvisOrbRecordingMaterial();
  });

  function animateOrb() {
    requestAnimationFrame(animateOrb);
    if (document.hidden) {
      return;
    }
    if (jarvisOrbVideoTexture && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      jarvisOrbVideoTexture.needsUpdate = true;
    }
    if (jarvisOrbMesh) {
      jarvisOrbMesh.rotation.y += 0.00022;
      jarvisOrbMesh.rotation.x += 0.00008;
    }
    if (jarvisOrbRenderer && jarvisOrbScene && jarvisOrbCamera) {
      jarvisOrbRenderer.render(jarvisOrbScene, jarvisOrbCamera);
    }
  }
  animateOrb();

  window.addEventListener('resize', resizeOrb);
  resizeOrb();

  console.log('[JarvisOrb] Three.js orb host ready (sphere attaches when video has frames)');
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
  neurographScene.fog = new THREE.FogExp2(0x050510, 0.0014);

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
    alpha: true,
    powerPreference: 'low-power'
  });
  neurographRenderer.setSize(window.innerWidth, window.innerHeight);
  neurographRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, NEURO_MAX_PIXEL_RATIO));

  // Add orbit controls for rotation/zoom
  neurographControls = new THREE.OrbitControls(neurographCamera, neurographRenderer.domElement);
  neurographControls.enableDamping = true;
  neurographControls.dampingFactor = 0.05;
  neurographControls.minDistance = 50;
  neurographControls.maxDistance = 1100;

  const ngDom = neurographRenderer.domElement;
  ngDom.style.touchAction = 'none';
  ngDom.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
    },
    { passive: false }
  );

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

// Raycaster + floating label (hover + click-to-focus)
let hoveredNode = null;
let neuroHoverHighlightedMesh = null;
let neuroHoverDesiredMesh = null;
let neuroHoverAnimMesh = null;
let neuroHoverBlend = 0;
let neurographHoverLastTime = null;
let neuroFocusStyledMesh = null;
const NEURO_HOVER_EMISSIVE_TINT = new THREE.Color(0x4a7088);
const NEURO_HOVER_DIFFUSE_TINT = new THREE.Color(0xa8c8d8);
const _neuroHoverEm0 = new THREE.Color();
const _neuroHoverEm1 = new THREE.Color();
const _neuroHoverCol0 = new THREE.Color();
const _neuroHoverCol1 = new THREE.Color();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Single info panel (collapsed on hover, expanded on click)
let neuroInfoPanel = null;
let isPanelExpanded = false;

// Create or get the single info panel
function getNeuroInfoPanel() {
  if (!neuroInfoPanel) {
    neuroInfoPanel = document.createElement('div');
    neuroInfoPanel.className = 'neuro-node-panel';
    neuroInfoPanel.style.cssText = `
      position: fixed;
      background: rgba(5, 5, 16, 0.96);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 255, 255, 0.4);
      border-radius: 12px;
      padding: 16px;
      min-width: 280px;
      max-width: 420px;
      max-height: 60vh;
      overflow-y: auto;
      z-index: 6000;
      pointer-events: auto;
      opacity: 0;
      transform: scale(0.95) translateY(10px);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    `;
    document.body.appendChild(neuroInfoPanel);
    console.log('[NeuroInfoPanel] Panel created');
  }
  return neuroInfoPanel;
}

// Clear the single info panel
function clearNeuroInfoPanel() {
  if (neuroInfoPanel && neuroInfoPanel.parentNode) {
    document.body.removeChild(neuroInfoPanel);
  }
  neuroInfoPanel = null;
  isPanelExpanded = false;
}

// Click-to-focus: fly camera to a node and pin the same label as hover
let neurographFocusTarget = null;
let neurographFlyActive = false;
const neurographFocusDir = new THREE.Vector3(0, 0, 1);
const NEUROGRAPH_FOCUS_DISTANCE = 44;
const NEUROGRAPH_FLY_DURATION_MS = 3400;
const _neuroDesiredCam = new THREE.Vector3();
const neurographFlyFromCam = new THREE.Vector3();
const neurographFlyFromTarget = new THREE.Vector3();
let neurographFlyStartTime = 0;

function easeInOutCubicNeuro(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function captureNeurographMaterialBase(mesh) {
  if (!mesh || !mesh.material || mesh.userData._neuroMatBase) {return;}
  const m = mesh.material;
  mesh.userData._neuroMatBase = {
    emissive: m.emissive.getHex(),
    emissiveIntensity: m.emissiveIntensity,
    color: m.color.getHex()
  };
}

function restoreNeurographSphereMaterial(mesh) {
  if (!mesh || !mesh.material || !mesh.userData._neuroMatBase) {return;}
  const m = mesh.material;
  const b = mesh.userData._neuroMatBase;
  m.emissive.setHex(b.emissive);
  m.emissiveIntensity = b.emissiveIntensity;
  m.color.setHex(b.color);
  mesh.scale.set(1, 1, 1);
}

/** Smooth hover look: larger scale, gentle emissive + tint (strength driven by u 0..1). */
function applyNeurographHoverLerp(mesh, u) {
  if (!mesh || !mesh.material) {return;}
  captureNeurographMaterialBase(mesh);
  const m = mesh.material;
  const b = mesh.userData._neuroMatBase;
  _neuroHoverEm0.setHex(b.emissive);
  _neuroHoverEm1.copy(_neuroHoverEm0).lerp(NEURO_HOVER_EMISSIVE_TINT, 0.42);
  m.emissive.copy(_neuroHoverEm0).lerp(_neuroHoverEm1, u);
  const i0 = b.emissiveIntensity;
  const i1 = Math.min(1.12, i0 + 0.32);
  m.emissiveIntensity = THREE.MathUtils.lerp(i0, i1, u);
  _neuroHoverCol0.setHex(b.color);
  _neuroHoverCol1.copy(_neuroHoverCol0).lerp(NEURO_HOVER_DIFFUSE_TINT, 0.18);
  m.color.copy(_neuroHoverCol0).lerp(_neuroHoverCol1, u);
  const hoverScale = 1.2;
  mesh.scale.setScalar(THREE.MathUtils.lerp(1, hoverScale, u));
}

function setNeurographSphereFocusVisual(mesh, on) {
  if (!mesh || !mesh.material) {return;}
  captureNeurographMaterialBase(mesh);
  const m = mesh.material;
  const b = mesh.userData._neuroMatBase;
  if (on) {
    m.emissive.setHex(0x88ffff);
    m.emissiveIntensity = Math.min(2.85, b.emissiveIntensity + 1.4);
    m.color.copy(new THREE.Color(b.color)).lerp(new THREE.Color(0xffffff), 0.52);
    mesh.scale.setScalar(1.26);
  } else {
    restoreNeurographSphereMaterial(mesh);
  }
}

function clearNeurographHoverVisual() {
  neuroHoverDesiredMesh = null;
  neuroHoverHighlightedMesh = null;
}

function applyNeurographHoverVisual(mesh) {
  if (!mesh || neurographFocusTarget) {return;}
  neuroHoverDesiredMesh = mesh;
  if (neuroHoverHighlightedMesh !== mesh) {
    neuroHoverHighlightedMesh = mesh;
  }
}

// === NeuroTooltip Helper Functions ===

function updateNeuroTooltipPosition(node) {
  if (!node || !neuroTooltipMinimized) return;
  
  // Get node position in 3D space
  const pos = node.position.clone();
  
  // Project to 2D screen coordinates
  pos.project(neurographCamera);
  
  // Convert from WebGL coordinates (-1 to 1) to screen coordinates
  const x = (pos.x * 0.5 + 0.5) * neurographRenderer.domElement.clientWidth;
  const y = (-(pos.y * 0.5) + 0.5) * neurographRenderer.domElement.clientHeight;
  
  // Add offset so tooltip doesn't cover the node
  const offsetX = 16;
  const offsetY = 16;
  
  neuroTooltipMinimized.style.left = `${Math.round(x + offsetX)}px`;
  neuroTooltipMinimized.style.top = `${Math.round(y - offsetY)}px`;
}

function showNeuroTooltipMinimized(node, data) {
  if (!neuroTooltipMinimized) return;
  
  neuroTooltipMinimized.innerHTML = createMinimizedNodeLabel(data);
  neuroTooltipMinimized.style.opacity = '1';
  neuroTooltipMinimized.style.transform = 'scale(1)';
  
  updateNeuroTooltipPosition(node);
  tooltipLastNode = node;
}

function hideNeuroTooltipMinimized() {
  if (!neuroTooltipMinimized) return;
  
  neuroTooltipMinimized.style.opacity = '0';
  neuroTooltipMinimized.style.transform = 'scale(0.9)';
  
}

function showNeuroTooltipFull(node, data) {
  if (!neuroTooltipFull) return;
  
  neuroTooltipFull.innerHTML = createNodeLabel(data);
  neuroTooltipFull.style.opacity = '1';
  neuroTooltipFull.style.transform = 'scale(1) translateY(0)';
  
  // Position near the node but adjust if it would go off-screen
  if (node) {
    updateNeuroTooltipPosition(node);
    
    // Adjust if tooltip would go off right edge
    const rect = neuroTooltipFull.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      const offset = rect.right - window.innerWidth + 10;
      neuroTooltipFull.style.left = `calc(${neuroTooltipFull.style.left} - ${offset}px)`;
    }
    
    // Adjust if tooltip would go off bottom edge
    if (rect.bottom > window.innerHeight) {
      const currentTop = parseFloat(neuroTooltipFull.style.top) || 0;
      const offset = rect.bottom - window.innerHeight + 10;
      neuroTooltipFull.style.top = `${Math.round(currentTop - offset - 100)}px`;
    }
  }
  
  isTooltipExpanded = true;
}

function hideNeuroTooltipFull() {
  if (!neuroTooltipFull) return;
  
  neuroTooltipFull.style.opacity = '0';
  neuroTooltipFull.style.transform = 'scale(0.95) translateY(10px)';
  isTooltipExpanded = false;
}

function clearNeuroTooltip() {
  hideNeuroTooltipMinimized();
  hideNeuroTooltipFull();
}

function clearNeurographNodeFocus() {
  neurographFocusTarget = null;
  neurographFlyActive = false;
  if (neurographControls) {
    neurographControls.enabled = true;
  }
  // Do not move camera or orbit target — user stays in the same view (first-person continuity)
  clearNeuroInfoPanel();
  hoveredNode = null;
  hoveredNode = null;
  
  if (neuroFocusStyledMesh) {
    setNeurographSphereFocusVisual(neuroFocusStyledMesh, false);
    neuroFocusStyledMesh = null;
  }
  clearNeurographHoverVisual();
}

function focusNeurographNode(neuron) {
  if (!neuron || !neurographCamera || !neurographControls) {return;}
  clearNeurographHoverVisual();
  if (neuroHoverAnimMesh) {
    restoreNeurographSphereMaterial(neuroHoverAnimMesh);
    neuroHoverAnimMesh = null;
    neuroHoverBlend = 0;
  }
  if (neuroFocusStyledMesh && neuroFocusStyledMesh !== neuron) {
    setNeurographSphereFocusVisual(neuroFocusStyledMesh, false);
    neuroFocusStyledMesh = null;
  }
  neurographFocusTarget = neuron;
  neurographFlyActive = true;
  neurographFlyFromCam.copy(neurographCamera.position);
  neurographFlyFromTarget.copy(neurographControls.target);
  neurographFlyStartTime = performance.now();
  _neuroDesiredCam.subVectors(neurographCamera.position, neuron.position);
  if (_neuroDesiredCam.lengthSq() < 0.01) {
    _neuroDesiredCam.set(0.35, 0.2, 1);
  }
  neurographFocusDir.copy(_neuroDesiredCam.normalize());
  hoveredNode = neuron;
  setNeurographSphereFocusVisual(neuron, true);
  neuroFocusStyledMesh = neuron;
  const panel = getNeuroInfoPanel();
  panel.innerHTML = createNodeLabel(neuron.userData);
  panel.style.opacity = '1';
  panel.style.transform = 'scale(1) translateY(0)';
  panel.style.pointerEvents = 'auto';
  panel.style.display = 'block';
  panel.style.visibility = 'visible';
  isPanelExpanded = true;
  console.log('[NeuroInfoPanel] Panel shown for focused node, opacity=1, display=block');
}

// Animation loop
function animateNeurograph() {
  requestAnimationFrame(animateNeurograph);
  neurographAnimFrame++;

  if (document.hidden) {
    return;
  }

  // Repulsion between spheres — push apart until at least minDist (higher = more spread)
  if (neurographScene && neurons.length > 2 && isNeurographLoaded) {
    const repulsionStrength = 6.2;
    const minDist = 78.0;
    const runRepulsion =
      neuroRepulsionPasses < NEURO_REPULSION_MAX_PASSES && (neurographAnimFrame % 2 === 0);

    if (runRepulsion) {
      for (let i = 0; i < neurons.length; i++) {
        for (let j = i + 1; j < neurons.length; j++) {
          const a = neurons[i].position;
          const b = neurons[j].position;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dz = a.z - b.z;
          const distSq = dx * dx + dy * dy + dz * dz;

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
      neuroRepulsionPasses++;
    }
  }

  if (neurographFlyActive && neurographFocusTarget && neurographCamera && neurographControls) {
    neurographControls.enabled = false;
    const tpos = neurographFocusTarget.position;
    _neuroDesiredCam.copy(tpos).addScaledVector(neurographFocusDir, NEUROGRAPH_FOCUS_DISTANCE);
    const elapsed = performance.now() - neurographFlyStartTime;
    const u = Math.min(1, elapsed / NEUROGRAPH_FLY_DURATION_MS);
    const e = easeInOutCubicNeuro(u);
    neurographCamera.position.copy(neurographFlyFromCam).lerp(_neuroDesiredCam, e);
    neurographControls.target.copy(neurographFlyFromTarget).lerp(tpos, e);
    neurographControls.update();
    if (u >= 1) {
      neurographCamera.position.copy(_neuroDesiredCam);
      neurographControls.target.copy(tpos);
      neurographFlyActive = false;
      neurographControls.enabled = true;
    }
  } else if (neurographControls) {
    neurographControls.enabled = true;
    neurographControls.update();
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
  //   // Update synapse pulsation (only when lines exist)
  if (neurons.length > 0 && isNeurographLoaded) {
    const temporalPulse = 0.56 + 0.24 * Math.sin(Date.now() * 0.0024);
    for (let i = 0; i < neurons.length; i++) {
      const neuron = neurons[i];
      if (neuron.userData && neuron.userData.isTemporal && neuron.material) {
        neuron.material.emissiveIntensity = temporalPulse;
      }
    }
  }

  if (NEUROGRAPH_DRAW_SYNAPSES && synapses.length > 0 && isNeurographLoaded && (neurographAnimFrame % 2 === 0)) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
    const opacity = 0.3 + 0.3 * pulse;
    for (let s = 0; s < synapses.length; s++) {
      synapses[s].material.opacity = opacity;
    }
  }

  // Smooth hover: ease scale + material (avoids abrupt pop)
  const now = performance.now();
  const dt = neurographHoverLastTime === null
    ? 0
    : Math.min(0.08, (now - neurographHoverLastTime) / 1000);
  neurographHoverLastTime = now;
  if (neurographFocusTarget) {
    neuroHoverDesiredMesh = null;
  }
  if (dt > 0 && neurographScene && neurons.length > 0) {
    const speedIn = 5.2;
    const speedOut = 4.2;
    if (neuroHoverDesiredMesh) {
      if (neuroHoverAnimMesh !== neuroHoverDesiredMesh) {
        if (neuroHoverAnimMesh) {
          restoreNeurographSphereMaterial(neuroHoverAnimMesh);
        }
        neuroHoverAnimMesh = neuroHoverDesiredMesh;
        captureNeurographMaterialBase(neuroHoverAnimMesh);
        neuroHoverBlend = 0;
      }
      neuroHoverBlend = Math.min(1, neuroHoverBlend + speedIn * dt);
    } else {
      neuroHoverBlend = Math.max(0, neuroHoverBlend - speedOut * dt);
      if (neuroHoverBlend === 0 && neuroHoverAnimMesh) {
        restoreNeurographSphereMaterial(neuroHoverAnimMesh);
        neuroHoverAnimMesh = null;
      }
    }
    if (neuroHoverAnimMesh && neuroHoverBlend > 0 && !neurographFocusTarget) {
      const u = easeInOutCubicNeuro(neuroHoverBlend);
      applyNeurographHoverLerp(neuroHoverAnimMesh, u);
    }
  }

  neurographRenderer.render(neurographScene, neurographCamera);
}

// Initialize neurograph when DOM is ready
console.log('[Neurograph] DOM loaded, initializing...');
initJarvisOrb();
initNeurograph();
animateNeurograph();

// Handle window resize
function onNeurographWindowResize() {
  if (neurographCamera && neurographRenderer) {
    neurographCamera.aspect = window.innerWidth / window.innerHeight;
    neurographCamera.updateProjectionMatrix();
    neurographRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, NEURO_MAX_PIXEL_RATIO));
    neurographRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function setupNeurographHover() {
  // Initialize the single info panel
  getNeuroInfoPanel();

  // Double-tap tracking for mobile navigation (smooth animated fly-through)
let lastTapTime = 0;
let lastTapPosition = { x: 0, y: 0 };
let isFlyingThroughSpace = false;

// Smooth fly-through animation for double-tap navigation
function flyThroughSpace(distance = 50, duration = 1200) {
  if (isFlyingThroughSpace) return; // Prevent overlapping flights
  isFlyingThroughSpace = true;
  
  const startPos = neurographCamera.position.clone();
  const startTarget = neurographControls.target.clone();
  
  // Calculate forward direction
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(neurographCamera.quaternion);
  forward.normalize();
  
  const endPos = startPos.clone().add(forward.clone().multiplyScalar(distance));
  const endTarget = startTarget.clone().add(forward.clone().multiplyScalar(distance));
  
  const startTime = performance.now();
  
  function animateFlight() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    
    // Smooth ease-in-out cubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    
    neurographCamera.position.lerpVectors(startPos, endPos, eased);
    neurographControls.target.lerpVectors(startTarget, endTarget, eased);
    
    if (t < 1) {
      requestAnimationFrame(animateFlight);
    } else {
      isFlyingThroughSpace = false;
      console.log('[Neurograph] Flight complete');
    }
  }
  
  animateFlight();
  console.log(`[Neurograph] Flying through space: ${distance} units over ${duration}ms`);
}

// Handle canvas click (node selection) - use pointerdown for unified mouse/touch support
neurographRenderer.domElement.addEventListener('pointerdown', (e) => {
  if (!neurographScene || neurons.length === 0) {return;}
  e.preventDefault(); // Prevent default behavior (zoom, etc.) and avoid double-firing with click
  e.stopPropagation(); // Stop event from bubbling to document
  
  const rect = neurographRenderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, neurographCamera);
  const hits = raycaster.intersectObjects(neurons);
  
  // Check for double-tap (mobile navigation through space)
  const now = Date.now();
  const tapDistance = Math.sqrt(
    Math.pow(e.clientX - lastTapPosition.x, 2) + 
    Math.pow(e.clientY - lastTapPosition.y, 2)
  );
  const isDoubleTap = (now - lastTapTime < 300) && (tapDistance < 50);
  
  if (isDoubleTap && hits.length === 0) {
    // Double-tap on empty space - smooth fly through space
    console.log('[Neurograph] Double-tap detected - smooth navigation through space');
    flyThroughSpace(50, 1200); // Fly 50 units over 1.2 seconds
    lastTapTime = 0; // Reset
    return;
  }
  
  lastTapTime = now;
  lastTapPosition = { x: e.clientX, y: e.clientY };
  
  if (hits.length > 0) {
    const clickedNode = hits[0].object;
    console.log('[Neurograph] Node tapped:', clickedNode.userData.id);
    focusNeurographNode(clickedNode);
  } else {
    // Click on empty space - clear focus
    console.log('[Neurograph] Empty space tapped - clearing focus');
    clearNeurographNodeFocus();
  }
});

  // Clear hover when pointer leaves canvas
  neurographRenderer.domElement.addEventListener('pointerleave', () => {
    clearNeurographHoverVisual();
    if (hoveredNode) {
      const panel = getNeuroInfoPanel();
      if (panel) {
        panel.style.opacity = '0';
      }
      hoveredNode = null;
    }
  });

  // Escape key - collapse the panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && neurographFocusTarget) {
      clearNeurographNodeFocus();
    }
  });

  // Pointerdown outside the info panel (e.g. dock, transcript) - hide panel (works for both mouse and touch)
  // Use longer timeout to prevent premature closing on mobile
  document.addEventListener('pointerdown', (e) => {
    if (!neurographFocusTarget) {return;}
    
    // Don't hide if clicking inside panel
    const panel = getNeuroInfoPanel();
    if (panel && panel.contains(e.target)) {
      console.log('[NeuroInfoPanel] Click inside panel - keeping open');
      return;
    }
    
    // Don't hide if clicking on canvas (canvas has its own handler)
    const canvasEl = neurographRenderer && neurographRenderer.domElement;
    if (canvasEl && canvasEl.contains(e.target)) {
      console.log('[NeuroInfoPanel] Click on canvas - keeping open');
      return;
    }
    
    // Don't hide if clicking on UI elements (dock, toggle, etc.)
    const bottomDock = document.querySelector('.jarvis-bottom-dock');
    if (bottomDock && bottomDock.contains(e.target)) {
      console.log('[NeuroInfoPanel] Click on dock - keeping open');
      return;
    }
    if (e.target.closest('#memory-toggle')) {
      console.log('[NeuroInfoPanel] Click on toggle - keeping open');
      return;
    }
    if (e.target.closest('#server-status')) {
      console.log('[NeuroInfoPanel] Click on server-status - keeping open');
      return;
    }
    
    // Click outside - clear focus after a longer delay (300ms for mobile)
    console.log('[NeuroInfoPanel] Click outside - will clear focus in 300ms');
    setTimeout(() => {
      if (neurographFocusTarget) {
        console.log('[NeuroInfoPanel] Clearing focus (timeout)');
        clearNeurographNodeFocus();
      }
    }, 300);
  });

  // Document-level pointermove for hover - unified mouse/touch support
  document.addEventListener('pointermove', (e) => {
    if (!neurographScene) return;
    
    // Don't update hover while focus/camera is active
    if (neurographFocusTarget) {return;}

    // Calculate mouse position in normalized device coordinates
    const rect = neurographRenderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, neurographCamera);
    const intersects = raycaster.intersectObjects(neurons);

    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      applyNeurographHoverVisual(intersected);
      if (intersected !== hoveredNode) {
        // New node hovered - show collapsed panel
        const panel = getNeuroInfoPanel();  // Create panel if it doesn't exist
        if (panel) {
          if (hoveredNode) {
            panel.style.opacity = '0';
          }
          hoveredNode = intersected;
          // Show collapsed panel with minimal content
          const nodeData = hoveredNode.userData;
          panel.innerHTML = createCollapsedNodeLabel(nodeData);
          panel.style.opacity = '1';
          isPanelExpanded = false;
        }
      }
    } else {
      clearNeurographHoverVisual();
      if (hoveredNode) {
        const panel = getNeuroInfoPanel();
        if (panel) {
          panel.style.opacity = '0';
        }
        hoveredNode = null;
      }
    }
  });

  // Document-level move so hover clears when cursor is over UI above the canvas
  document.addEventListener('mousemove', (e) => {
    if (!neurographScene) return;
    
    // Don't update hover while focus/camera is active
    if (neurographFocusTarget) {return;}

    // Calculate mouse position in normalized device coordinates
    const rect = neurographRenderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, neurographCamera);
    const intersects = raycaster.intersectObjects(neurons);

    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      applyNeurographHoverVisual(intersected);
      if (intersected !== hoveredNode) {
        // New node hovered - show collapsed panel
        const panel = getNeuroInfoPanel();  // Create panel if it doesn't exist
        if (panel) {
          if (hoveredNode) {
            panel.style.opacity = '0';
          }
          hoveredNode = intersected;
          // Show collapsed panel with minimal content
          const nodeData = hoveredNode.userData;
          panel.innerHTML = createCollapsedNodeLabel(nodeData);
          panel.style.opacity = '1';
          isPanelExpanded = false;
        }
      }
    } else {
      clearNeurographHoverVisual();
      if (hoveredNode) {
        const panel = getNeuroInfoPanel();
        if (panel) {
          panel.style.opacity = '0';
        }
        hoveredNode = null;
      }
    }
  });
}

// Call setupNeurographHover when DOM is ready
setupNeurographHover();



function escapeHtmlNeuro(s) {
  if (s === null || s === undefined) {return '';}
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNeuroFieldValue(v) {
  if (v === null || v === undefined) {
    return '<span class="neuro-node-panel__muted">—</span>';
  }
  if (typeof v === 'object') {
    const j = JSON.stringify(v, null, 2);
    return `<pre class="neuro-node-panel__json">${escapeHtmlNeuro(j)}</pre>`;
  }
  return `<span>${escapeHtmlNeuro(v)}</span>`;
}

function formatNeuroAttrCell(_key, val) {
  if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
    const c = escapeHtmlNeuro(val);
    return `<span class="neuro-swatch" style="background:${c};box-shadow:0 0 12px ${c}"></span><code>${c}</code>`;
  }
  return formatNeuroFieldValue(val);
}

function neuroPanelRow(label, valueHtml) {
  return `<div class="neuro-node-panel__row"><span class="neuro-node-panel__k">${escapeHtmlNeuro(label)}</span><span class="neuro-node-panel__v">${valueHtml}</span></div>`;
}

function getNeuroEdgesForNode(nodeId) {
  if (!neurographData || !nodeId) {return [];}
  const syn = neurographData.synapses || neurographData.connections || [];
  return syn.filter(s => {
    const src = s.source ?? s.from;
    const tgt = s.target ?? s.to;
    return src === nodeId || tgt === nodeId;
  });
}

function neuroEdgePeerId(edge, nodeId) {
  const s = edge.source ?? edge.from;
  const t = edge.target ?? edge.to;
  if (s === nodeId) {return t;}
  if (t === nodeId) {return s;}
  return '?';
}

// Minimized tooltip (on hover) - shows just title and category
function createMinimizedNodeLabel(nodeData) {
  const esc = escapeHtmlNeuro;

  if (!nodeData) {
    return '<div class="neuro-tooltip-content">No node selected</div>';
  }

  if (!nodeData.rawData) {
    const id = nodeData.id || 'Unknown';
    return `
      <div class="neuro-tooltip-content">
        <div class="neuro-tooltip-title">${esc(id)}</div>
        <div class="neuro-tooltip-subtitle">Click for details</div>
      </div>
    `;
  }

  const node = nodeData.rawData;
  const id = node.id || nodeData.id || '';
  const title = node.label || id || 'Node';
  const category = node.category || nodeData.category || '';
  const type = node.type || nodeData.type || '';
  const temporal = nodeData.isTemporal ? '<span class="neuro-tooltip-temporal">T</span>' : '';

  let content = `<div class="neuro-tooltip-content">
    <div class="neuro-tooltip-header">
      <div class="neuro-tooltip-title">${esc(title)}</div>
      ${temporal}
    </div>`;

  // Add category chip if available
  if (category) {
    content += `<div class="neuro-tooltip-category">${esc(category)}</div>`;
  }

  // Add type if available
  if (type && type !== category) {
    content += `<div class="neuro-tooltip-type">${esc(type)}</div>`;
  }

  content += `<div class="neuro-tooltip-hint">Click for details</div>
  </div>`;

  return content;
}

// Collapsed node label (minimal info for hover state)
function createCollapsedNodeLabel(nodeData) {
  const esc = escapeHtmlNeuro;

  if (!nodeData) {
    return '<div class="neuro-panel-collapsed"><div class="neuro-panel-title">No node selected</div><div class="neuro-panel-hint">Click for details</div></div>';
  }

  if (!nodeData.rawData) {
    const id = nodeData.id || 'Unknown';
    return `<div class="neuro-panel-collapsed">
      <div class="neuro-panel-title">${esc(id)}</div>
      <div class="neuro-panel-hint">Click for details</div>
    </div>`;
  }

  const node = nodeData.rawData;
  const id = node.id || nodeData.id || '';
  const title = node.label || id || 'Node';
  const description = node.description || '';

  let content = `<div class="neuro-panel-collapsed">
    <div class="neuro-panel-title">${esc(title)}</div>`;

  // Add description if available
  if (description) {
    content += `<div class="neuro-panel-description">${esc(description)}</div>`;
  }

  content += `<div class="neuro-panel-hint">Click for details</div>
  </div>`;

  return content;
}

function createNodeLabel(nodeData) {
  const esc = escapeHtmlNeuro;

  if (!nodeData) {
    return '<div class="neuro-node-panel"><div class="neuro-node-panel__head"><div class="neuro-node-panel__empty">No node selected</div></div></div>';
  }

  if (!nodeData.rawData) {
    const id = nodeData.id || 'Unknown';
    return `<div class="neuro-node-panel"><div class="neuro-node-panel__head"><h3 class="neuro-node-panel__title">${esc(id)}</h3><div class="neuro-node-panel__id">${esc(id)}</div></div></div>`;
  }

  const node = nodeData.rawData;
  const id = node.id || nodeData.id || '';
  const title = node.label || id || 'Node';
  const edges = getNeuroEdgesForNode(id);
  const parts = [];

  parts.push('<div class="neuro-node-panel">');
  parts.push('<div class="neuro-node-panel__head">');
  parts.push('<div class="neuro-node-panel__chips">');
  if (node.category) {
    parts.push(`<span class="neuro-chip">${esc(node.category)}</span>`);
  }
  if (node.type) {
    parts.push(`<span class="neuro-chip neuro-chip--dim">${esc(node.type)}</span>`);
  }
  if (nodeData.isTemporal) {
    parts.push('<span class="neuro-chip neuro-chip--accent">temporal</span>');
  }
  if (nodeData.isConnectedToTheme) {
    parts.push('<span class="neuro-chip neuro-chip--accent">theme link</span>');
  }
  parts.push('</div>');
  parts.push(`<h3 class="neuro-node-panel__title">${esc(title)}</h3>`);
  parts.push(`<div class="neuro-node-panel__id">${esc(id)}</div>`);
  parts.push('</div>');

  parts.push('<div class="neuro-node-panel__scroll">');

  parts.push('<section class="neuro-node-panel__sec">');
  parts.push('<div class="neuro-node-panel__sec-title">Graph context</div>');
  parts.push(neuroPanelRow('Connections (edges)', String(edges.length)));
  if (typeof nodeData.themeConnectionWeight === 'number') {
    parts.push(neuroPanelRow('Theme link weight', esc(String(nodeData.themeConnectionWeight))));
  }
  parts.push(neuroPanelRow('Temporal flag', nodeData.isTemporal ? 'yes' : 'no'));
  parts.push(neuroPanelRow('Linked to theme hub', nodeData.isConnectedToTheme ? 'yes' : 'no'));
  parts.push('</section>');

  const knownTop = new Set(['id', 'label', 'category', 'type', 'attributes', 'moments']);
  const extraKeys = Object.keys(node).filter(k => !knownTop.has(k));
  if (extraKeys.length > 0) {
    parts.push('<section class="neuro-node-panel__sec">');
    parts.push('<div class="neuro-node-panel__sec-title">Node fields</div>');
    extraKeys.forEach(k => {
      parts.push(neuroPanelRow(k, formatNeuroFieldValue(node[k])));
    });
    parts.push('</section>');
  }

  const attrs = node.attributes && typeof node.attributes === 'object' ? node.attributes : null;
  if (attrs && Object.keys(attrs).length > 0) {
    parts.push('<section class="neuro-node-panel__sec">');
    parts.push(`<div class="neuro-node-panel__sec-title">Attributes <span class="neuro-node-panel__count">${Object.keys(attrs).length}</span></div>`);
    Object.keys(attrs).forEach(k => {
      parts.push(neuroPanelRow(k, formatNeuroAttrCell(k, attrs[k])));
    });
    parts.push('</section>');
  }

  if (node.moments && node.moments.length > 0) {
    parts.push('<section class="neuro-node-panel__sec">');
    parts.push(`<div class="neuro-node-panel__sec-title">Moments <span class="neuro-node-panel__count">${node.moments.length}</span></div>`);
    node.moments.forEach((m, i) => {
      parts.push('<div class="neuro-node-panel__moment">');
      parts.push(`<span class="neuro-node-panel__moment-idx">#${i + 1}</span>`);
      parts.push(formatNeuroFieldValue(typeof m === 'object' && m !== null ? m : { value: m }));
      parts.push('</div>');
    });
    parts.push('</section>');
  }

  if (edges.length > 0) {
    const maxShow = 24;
    parts.push('<section class="neuro-node-panel__sec">');
    parts.push(`<div class="neuro-node-panel__sec-title">Synapses <span class="neuro-node-panel__count">${edges.length}</span></div>`);
    edges.slice(0, maxShow).forEach(edge => {
      const peer = neuroEdgePeerId(edge, id);
      const w = edge.weight ?? edge.strength ?? '—';
      const typ = edge.type || edge.label || '';
      const extra = Object.keys(edge).filter(k =>
        !['source', 'target', 'from', 'to', 'weight', 'strength', 'type', 'label'].includes(k)
      );
      let sub = `<div class="neuro-node-panel__edge-peer">↔ ${esc(peer)}</div>`;
      sub += `<div style="margin-top:4px;opacity:0.85;">weight: <code>${esc(String(w))}</code>`;
      if (typ) {sub += ` · ${esc(String(typ))}`;}
      sub += '</div>';
      if (extra.length) {
        const slice = {};
        extra.forEach(k => { slice[k] = edge[k]; });
        sub += formatNeuroFieldValue(slice);
      }
      parts.push(`<div class="neuro-node-panel__edge">${sub}</div>`);
    });
    if (edges.length > maxShow) {
      parts.push(`<div class="neuro-node-panel__muted" style="font-size:10px;margin-top:6px;">+ ${edges.length - maxShow} more connections</div>`);
    }
    parts.push('</section>');
  }

  if (neurographData && neurographData.meta) {
    parts.push('<section class="neuro-node-panel__sec">');
    parts.push('<div class="neuro-node-panel__sec-title">Dataset</div>');
    parts.push(neuroPanelRow('Nodes in graph', String(neurographData.meta.nodeCount ?? '—')));
    parts.push(neuroPanelRow('Synapses in graph', String(neurographData.meta.synapseCount ?? '—')));
    if (neurographData.meta.timestamp) {
      parts.push(neuroPanelRow('Snapshot', esc(neurographData.meta.timestamp)));
    }
    parts.push('</section>');
  }

  parts.push('</div></div>');
  return parts.join('');
}

// Load neurograph data from API
function loadNeurographData() {
  loadNeurographFromSource(currentMemorySource);
}

// Load neurograph data from a specific memory source
function loadNeurographFromSource(source) {
  const endpoint = source === 'user' ? '/api/memory/user' : '/api/memory/jarvis';
  console.log(`[MemoryToggle] Loading ${source} memory from ${endpoint}`);
  
  fetch(endpoint)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Memory API error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log(`[MemoryToggle] Raw data loaded (${source}):`, data);
      console.log(`[MemoryToggle] Nodes count:`, (data.nodes || []).length);
      console.log(`[MemoryToggle] Synapses count:`, (data.synapses || data.connections || []).length);

      // Check for undefined sources in synapses
      const synapses = data.synapses || data.connections || [];
      const undefinedSources = synapses.filter(s => !s.source).length;
      const undefinedTargets = synapses.filter(s => !s.target).length;
      console.log(`[MemoryToggle] Synapses with undefined source:`, undefinedSources);
      console.log(`[MemoryToggle] Synapses with undefined target:`, undefinedTargets);

      neurographData = data;
      createNeurograph(data);
      isNeurographLoaded = true;
      
      // Hide loading overlay after graph is rendered
      setTimeout(() => {
        hideMemoryLoadingOverlay();
      }, 500);
    })
    .catch(err => {
      console.error(`[MemoryToggle] Failed to load ${source} data:`, err);
      // Create fallback neurograph if API fails
      createFallbackNeurograph();
      isNeurographLoaded = true;
      hideMemoryLoadingOverlay();
    });
}

// Toggle between Jarvis and User memory sources
function toggleMemorySource() {
  // Switch source
  currentMemorySource = currentMemorySource === 'jarvis' ? 'user' : 'jarvis';
  
  // Update UI toggle button (main - for desktop)
  const memoryToggle = document.getElementById('memory-toggle');
  const toggleHandle = document.getElementById('memory-toggle-handle');
  const toggleSwitch = document.getElementById('memory-toggle-switch');
  const memoryLabel = document.getElementById('memory-label');
  
  // Color scheme: Always cyan (#00ffff) - easy to read, consistent
  const memoryColor = '#00ffff';
  
  if (currentMemorySource === 'user') {
    if (memoryToggle) {
      memoryToggle.classList.add('active');
      memoryLabel.textContent = '🧠 User Memory';
      memoryLabel.style.color = memoryColor;
    }
    if (toggleSwitch) toggleSwitch.style.background = '#333';
    if (toggleHandle) {
      toggleHandle.style.left = '22px';
      toggleHandle.style.background = memoryColor;
    }
  } else {
    if (memoryToggle) {
      memoryToggle.classList.remove('active');
      memoryLabel.textContent = '🧠 Jarvis Memory';
      memoryLabel.style.color = memoryColor;
    }
    if (toggleSwitch) toggleSwitch.style.background = '#333';
    if (toggleHandle) {
      toggleHandle.style.left = '2px';
      toggleHandle.style.background = memoryColor;
    }
  }
  
  // Update drawer memory toggle
  const drawerMemoryToggle = document.getElementById('drawer-memory-toggle');
  const drawerMemoryLabel = document.getElementById('drawer-memory-label');
  if (drawerMemoryToggle && drawerMemoryLabel) {
    if (currentMemorySource === 'user') {
      drawerMemoryToggle.classList.add('active');
      drawerMemoryLabel.textContent = '🧠 User Memory';
    } else {
      drawerMemoryToggle.classList.remove('active');
      drawerMemoryLabel.textContent = '🧠 Jarvis Memory';
    }
  }
  
  // Update hidden main memory toggle for sync
  const mainMemoryToggle = document.getElementById('main-memory-toggle');
  const mainMemoryLabel = document.getElementById('main-memory-label');
  if (mainMemoryToggle && mainMemoryLabel) {
    if (currentMemorySource === 'user') {
      mainMemoryToggle.classList.add('active');
      mainMemoryLabel.textContent = '🧠 User Memory';
    } else {
      mainMemoryToggle.classList.remove('active');
      mainMemoryLabel.textContent = '🧠 Jarvis Memory';
    }
  }
  
  console.log('[MemoryToggle] Switched to', currentMemorySource);
  
  // Show loading overlay during memory switch
  showMemoryLoadingOverlay(currentMemorySource);
  
  // Reload neurograph data from new source
  loadNeurographFromSource(currentMemorySource);
}

// Show loading overlay when switching memory sources
function showMemoryLoadingOverlay(source) {
  let overlay = document.getElementById('memory-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'memory-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(5, 10, 20, 0.92);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(overlay);
  }
  
  const sourceName = source === 'user' ? 'User Memory' : 'Jarvis Memory';
  overlay.innerHTML = `
    <div style="width: 48px; height: 48px; border: 3px solid rgba(0, 255, 255, 0.3); border-top-color: #00ffff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <div style="color: #64ffda; font-size: 1.1em; font-weight: 500; letter-spacing: 0.5px;">Loading ${sourceName}...</div>
  `;
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
  
  // Add spin animation if not already present
  if (!document.getElementById('memory-loading-spin-style')) {
    const style = document.createElement('style');
    style.id = 'memory-loading-spin-style';
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
}

// Hide loading overlay
function hideMemoryLoadingOverlay() {
  const overlay = document.getElementById('memory-loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 300);
  }
}

// Create neurograph from data
function createNeurograph(data) {
  if (!neurographScene) return;

  // Clear existing objects
  neurons.forEach(neuron => neurographScene.remove(neuron));
  synapses.forEach(synapse => neurographScene.remove(synapse));
  neurons = [];
  synapses = [];
  neuroRepulsionPasses = 0;
  neurographAnimFrame = 0;
  neuroHoverHighlightedMesh = null;
  neuroHoverDesiredMesh = null;
  neuroHoverAnimMesh = null;
  neuroHoverBlend = 0;
  neurographHoverLastTime = null;
  neuroFocusStyledMesh = null;
  neurographFocusTarget = null;
  neurographFlyActive = false;
  hoveredNode = null;
  clearNeuroInfoPanel();
  hoveredNode = null;
  
  clearNeuroInfoPanel();
  hoveredNode = null;

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

    if (isTemporal) {
      // Temporal nodes use a warmer accent and stronger emission so they stand out.
      neuron.material.color.setHex(0xffa347);
      neuron.material.emissive.setHex(0xff7a00);
      neuron.material.emissiveIntensity = 0.72;
      neuron.scale.setScalar(1.14);
    }

    // Position nodes in molecule-like structure:
    // - Theme node at center (0, 0, 0)
    // - Connected nodes in orbiting planes around theme
    // - Other nodes in outer orbits

    if (node.id === themeNodeId) {
      // Theme node at center
      neuron.position.set(0, 0, 0);
    } else if (isConnectedToTheme) {
      // Orbiting nodes - arrange in orbital planes around center (wider orbits vs repulsion minDist)
      const orbitRadius = 22 + (themeConnectionWeight / 10);
      const planeAngle = (idx % 4) * (Math.PI / 2); // 4 orbital planes: 0, 90, 180, 270 degrees

      // Calculate position in orbital plane
      const angle = (idx / 4) * (Math.PI * 2); // Distribute nodes in each plane
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(planeAngle) * (orbitRadius * 0.35); // Slight tilt for 3D effect

      neuron.position.set(x, y, z);
    } else {
      // Other nodes - in outer orbits
      const orbitRadius = 48 + (maxWeight / 50);
      const angle = (idx / (nodes.length || 1)) * Math.PI * 2;
      neuron.position.set(
        Math.cos(angle) * orbitRadius,
        (Math.random() - 0.5) * 28,
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

  if (NEUROGRAPH_DRAW_SYNAPSES) {
    // Create connection lines (synapses) - straight lines between nodes
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00bfff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2 // Thicker lines for better visibility
    });

    const nodeMap = {};
    neurons.forEach((neuron) => {
      nodeMap[neuron.userData.id] = neuron;
    });

    console.log(`[Neurograph] Creating ${connections.length} connections from ${neurons.length} neurons`);

    connections.forEach(conn => {
      const sourceId = conn.source || conn.from;
      const targetId = conn.target || conn.to;

      if (!sourceId || !targetId) {
        console.warn(`[Neurograph] Skipping connection with empty source/target`);
        return;
      }

      const sourceNode = nodeMap[sourceId];
      const targetNode = nodeMap[targetId];

      if (sourceNode && targetNode) {
        if (sourceNode === targetNode) {
          return;
        }

        const weight = conn.weight || conn.strength || 1;

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
  } else {
    console.log(`[Neurograph] Synapse lines skipped (NEUROGRAPH_DRAW_SYNAPSES=false); ${connections.length} connections not drawn`);
  }

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
    const radiusPos = 40 + Math.random() * 48;
    neuron.position.set(
      Math.cos(angle) * radiusPos,
      (Math.random() - 0.5) * 32,
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

  if (NEUROGRAPH_DRAW_SYNAPSES) {
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
  }

  console.log('[Neurograph] Fallback neurograph created:', nodeCount, 'nodes');
}

// NOTE: Neurograph animation loop disabled - causing WebGL errors with 9549 nodes
// The UI should remain clean without a cluttered neural graph

// Create starfield background
function createStarfield() {
  const starCount = 280;
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
