const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 180;

function shouldIgnoreSpaceTarget() {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'BUTTON' && el.id !== 'jarvis-pilot-orb') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

export function attachPilotVoiceRecorder(options) {
  const {
    apiBase,
    pilotHud,
    pilotOrbEl,
    pilotHintEl,
    setVoiceStatus,
    onRecordingStart,
    onUploadAccepted,
    onTranscriptionUpdate,
  } = options;

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let pollInterval = null;
  let pollGeneration = 0;

  const clearPoll = () => {
    pollGeneration += 1;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const stopTracks = () => {
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const sendToServer = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];

    if (audioBlob.size === 0) {
      setVoiceStatus('Empty recording — try again');
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    setVoiceStatus('Uploading…');

    try {
      const response = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }

      const result = await response.json();

      if (result.ok && result.filename) {
        setVoiceStatus('Processing…');
        if (typeof onUploadAccepted === 'function') {
          onUploadAccepted(result.filename);
        }
        startTranscriptPoll(result.filename);
      } else {
        setVoiceStatus(result.message ? `Upload: ${result.message}` : 'Upload failed');
      }
    } catch (_) {
      setVoiceStatus('Server unreachable — check JARVIS is running');
    }
  };

  const startTranscriptPoll = (uploadFilename) => {
    clearPoll();
    const generation = pollGeneration;
    const fileParam = `?file=${encodeURIComponent(uploadFilename)}`;
    let attempts = 0;

    pollInterval = setInterval(async () => {
      if (generation !== pollGeneration) {
        return;
      }

      attempts += 1;

      try {
        const response = await fetch(`${apiBase}/transcript/latest${fileParam}`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();

        if (generation !== pollGeneration) {
          return;
        }

        if (data.status === 'transcribing' || data.status === 'processing') {
          setVoiceStatus(data.transcript ? `Agent: ${data.transcript.slice(0, 120)}…` : 'Transcribing…');
          if (typeof onTranscriptionUpdate === 'function') {
            onTranscriptionUpdate({
              status: data.status,
              transcript: data.transcript || '',
            });
          }
        } else if (data.status === 'done' && data.transcript) {
          clearPoll();
          const snippet = `${data.transcript}`.slice(0, 160);
          setVoiceStatus(data.jarvisResponse ? `Done · ${snippet}` : `Transcript · ${snippet}`);
          if (typeof onTranscriptionUpdate === 'function') {
            onTranscriptionUpdate({
              status: 'done',
              transcript: data.transcript || '',
              jarvisResponse: data.jarvisResponse || '',
            });
          }
        } else if (data.status === 'error') {
          clearPoll();
          setVoiceStatus(data.error || 'Transcription error');
          if (typeof onTranscriptionUpdate === 'function') {
            onTranscriptionUpdate({
              status: 'error',
              error: data.error || 'Transcription error',
            });
          }
        } else if (data.status === 'idle') {
          setVoiceStatus('Waiting…');
        }
      } catch (_) {
        if (attempts === 1) {
          setVoiceStatus('Waiting for server…');
        }
      }

      if (attempts >= MAX_POLL_ATTEMPTS) {
        clearPoll();
        setVoiceStatus('Timeout waiting for transcript');
      }
    }, POLL_INTERVAL_MS);
  };

  const startRecording = async () => {
    try {
      await fetch(`${apiBase}/transcript/clear`, { method: 'POST' });
    } catch (_) {
      // Same as legacy UI: continue if clear is unavailable
    }

    clearPoll();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recOptions = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(recOptions.mimeType)) {
        recOptions.mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(recOptions.mimeType)) {
        recOptions.mimeType = 'audio/ogg;codecs=opus';
      }

      mediaRecorder = new MediaRecorder(stream, recOptions);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setVoiceStatus('Recording error');
        isRecording = false;
        pilotHud.classList.remove('pilot-orb-hud--recording');
        if (pilotHintEl) {
          pilotHintEl.textContent = 'Jarvis · Press Spacebar to talk';
        }
      };

      mediaRecorder.onstop = () => {
        stopTracks();
        sendToServer();
      };

      mediaRecorder.start(2000);
      isRecording = true;
      if (typeof onRecordingStart === 'function') {
        onRecordingStart();
      }
      pilotHud.classList.add('pilot-orb-hud--recording');
      if (pilotHintEl) {
        pilotHintEl.textContent = 'Jarvis · Press Spacebar to stop';
      }
      setVoiceStatus('Recording…');
    } catch (_) {
      setVoiceStatus('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder || !isRecording) {
      return;
    }
    mediaRecorder.stop();
    isRecording = false;
    pilotHud.classList.remove('pilot-orb-hud--recording');
    if (pilotHintEl) {
      pilotHintEl.textContent = 'Jarvis · Press Spacebar to talk';
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  };

  const onKeyDown = async (event) => {
    if (event.code !== 'Space') {
      return;
    }
    if (shouldIgnoreSpaceTarget()) {
      return;
    }
    event.preventDefault();
    await toggleRecording();
  };

  const onOrbPointerDown = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await toggleRecording();
  };

  window.addEventListener('keydown', onKeyDown);
  pilotOrbEl.addEventListener('pointerdown', onOrbPointerDown);

  return () => {
    clearPoll();
    window.removeEventListener('keydown', onKeyDown);
    pilotOrbEl.removeEventListener('pointerdown', onOrbPointerDown);
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }
    stopTracks();
    pilotHud.classList.remove('pilot-orb-hud--recording');
  };
}
