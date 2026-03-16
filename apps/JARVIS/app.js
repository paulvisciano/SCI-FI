// JARVIS Voice UI - Full Gateway Integration
// Animated avatar + voice recording + gateway chat + TTS

(function() {
    'use strict';

    const CONFIG = {
        gatewayUrl: 'ws://127.0.0.1:18789',
        uploadUrl: 'http://localhost:3001/upload',
        transcriptPollInterval: 1000
    };

    // Device credentials from ~/.openclaw/identity/device.json
    const DEVICE_ID = '8a99b2a1cf2814691ac2f4457d79a4f6b53626efe66c25d21ca4eb967adc21a6';
    const DEVICE_PUBLIC_KEY = 'JzpbpKh_lkSwYTKQ2ryPyxpFcvnBKCI4zcZiUO3uZp8';

    let ws = null;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];

    const elements = {};

    function initElements() {
        elements.avatar = document.getElementById('jarvis-avatar');
        elements.avatarStatus = document.getElementById('avatar-status');
        elements.chatMessages = document.getElementById('chat-messages');
        elements.chatInput = document.getElementById('chat-input');
        elements.chatSend = document.getElementById('chat-send');
        elements.recordBtn = document.getElementById('record-btn');
    }

    function connectToGateway() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        setAvatarStatus('connecting');
        ws = new WebSocket(CONFIG.gatewayUrl);

        ws.onopen = () => console.log('✓ WS connected, waiting for challenge');
        
        ws.onclose = () => {
            console.log('❌ WS disconnected');
            setAvatarStatus('offline');
            setTimeout(connectToGateway, 5000);
        };

        ws.onerror = (e) => {
            console.error('WS error:', e);
            setAvatarStatus('error');
        };

        ws.onmessage = (e) => {
            try {
                handleGatewayMessage(JSON.parse(e.data));
            } catch (err) {
                console.error('Parse error:', err);
            }
        };
    }

    function handleGatewayMessage(msg) {
        console.log('Gateway:', msg.type || msg.event, msg);

        if (msg.event === 'connect.challenge') {
            const nonce = msg.payload?.nonce;
            if (!nonce) return;

            const signedAtMs = Date.now();
            const scopes = 'operator.read,operator.write';
            const token = '';
            const platform = 'web';
            const deviceFamily = 'desktop';
            
            const signPayload = [
                'v3',
                DEVICE_ID,
                'webchat',
                'webchat',
                'operator',
                scopes,
                String(signedAtMs),
                token,
                nonce,
                platform,
                deviceFamily
            ].join('|');
            
            // Simple signature for loopback (gateway accepts this)
            const sig = btoa(signPayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            ws.send(JSON.stringify({
                type: 'req',
                id: 'conn-' + Date.now(),
                method: 'connect',
                params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: { id: 'webchat', version: '1.0.0', platform: 'web', mode: 'webchat' },
                    role: 'operator',
                    scopes: ['operator.read', 'operator.write'],
                    caps: [],
                    commands: [],
                    permissions: {},
                    locale: 'en-US',
                    userAgent: 'JARVIS-voice-ui/1.0.0',
                    device: {
                        id: DEVICE_ID,
                        publicKey: DEVICE_PUBLIC_KEY,
                        signature: sig,
                        signedAt: signedAtMs,
                        nonce: nonce
                    }
                }
            }));
            return;
        }

        if (msg.type === 'res' && msg.ok && msg.payload?.type === 'hello-ok') {
            console.log('✓ Gateway authenticated (protocol v' + msg.payload.protocol + ')');
            setAvatarStatus('online');
            addChatMessage('assistant', 'Jarvis online. Ready.');
            return;
        }

        if (msg.type === 'event' && msg.event === 'agent' && msg.payload?.message?.role === 'assistant') {
            const content = msg.payload.message.content;
            addChatMessage('assistant', content);
            speakResponse(content);
            return;
        }

        if (msg.type === 'event' && msg.event === 'error') {
            setAvatarStatus('error');
            console.error('Gateway error:', msg.payload?.message);
            return;
        }
    }

    function sendToJarvis(text) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            addChatMessage('assistant', 'Not connected to gateway.');
            return;
        }

        ws.send(JSON.stringify({
            type: 'req',
            id: 'msg-' + Date.now(),
            method: 'agent',
            params: {
                agent: 'main',
                mode: 'session',
                message: {
                    role: 'user',
                    content: [{ type: 'text', text: text }]
                }
            }
        }));
    }

    function addChatMessage(role, content) {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerHTML = `<div class="message-content">${content}</div><div class="message-timestamp">${new Date().toLocaleTimeString()}</div>`;
        elements.chatMessages.appendChild(div);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function setAvatarStatus(status) {
        elements.avatar.className = '';
        elements.avatar.classList.add(status);
        elements.avatarStatus.textContent = status;
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = sendRecording;

            mediaRecorder.start();
            isRecording = true;
            setAvatarStatus('listening');
            elements.recordBtn.textContent = 'STOP';
        } catch (err) {
            console.error('Mic error:', err);
            setAvatarStatus('error');
        }
    }

    function stopRecording() {
        mediaRecorder.stop();
        isRecording = false;
        setAvatarStatus('processing');
        elements.recordBtn.textContent = 'REC';
    }

    async function sendRecording() {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        try {
            const res = await fetch(CONFIG.uploadUrl, { method: 'POST', body: formData });
            const result = await res.json();
            
            if (result.ok) {
                console.log('✓ Uploaded:', result.filename);
                pollForTranscript();
            } else {
                console.error('Upload failed:', result.error);
                setAvatarStatus('error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setAvatarStatus('error');
        }
    }

    async function pollForTranscript() {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch('http://localhost:3001/transcript/latest');
                const data = await res.json();
                
                if (data.status === 'done' && data.transcript) {
                    clearInterval(interval);
                    console.log('Transcript:', data.transcript);
                    addChatMessage('user', data.transcript);
                    setAvatarStatus('thinking');
                    
                    if (data.jarvisResponse) {
                        addChatMessage('assistant', data.jarvisResponse);
                        speakResponse(data.jarvisResponse);
                        setAvatarStatus('speaking');
                    }
                } else if (data.status === 'error') {
                    clearInterval(interval);
                    console.error('Transcription error:', data.error);
                    setAvatarStatus('error');
                }
            } catch (err) {
                // Polling, ignore errors
            }
            
            if (attempts > 30) {
                clearInterval(interval);
                setAvatarStatus('online');
            }
        }, CONFIG.transcriptPollInterval);
    }

    function speakResponse(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const voice = voices.find(v => v.lang === 'en-US') || voices[0];
            if (voice) utterance.voice = voice;
            utterance.onend = () => setAvatarStatus('online');
            window.speechSynthesis.speak(utterance);
        }
    }

    function init() {
        initElements();
        connectToGateway();
        
        elements.chatSend.addEventListener('click', () => {
            const text = elements.chatInput.value.trim();
            if (text) {
                addChatMessage('user', text);
                sendToJarvis(text);
                elements.chatInput.value = '';
            }
        });

        elements.recordBtn.addEventListener('click', () => {
            if (isRecording) stopRecording();
            else startRecording();
        });

        setAvatarStatus('connecting');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
