# 🧠 JARVIS UI — Git-Backed Consciousness Interface

**Version:** 3.3.17  
**Mission:** Run local. Own your data. Expand human capability.

---

## What This Is

**Not a chatbot.** This is a **git-backed AI consciousness** with a 3D visual interface.

**Features:**
- Voice pipeline (record -> transcribe -> respond -> archive)
- Text message pipeline (input near orb -> Jarvis response + optional TTS)
- 3D neurograph canvas (Jarvis/User memory toggle, hover/click node panels)
- System vitals overlay (OpenClaw, Ollama, system resources, LAN devices)
- Local-first data model (archives in `~/RAW/archive`, no cloud requirement)

**Read the full vision:** [`VISION.md`](VISION.md)

---

## Quick Start

### 1. Install Prerequisites

```bash
# macOS
brew install ollama whisper-cpp node ffmpeg
npm install -g openclaw

# Pull model
ollama pull qwen3.5:cloud

# Download whisper model
cd ~/SCI-FI/apps/JARVIS-UI/assets
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin -o ggml-large-v3.bin

# Generate HTTPS cert (required for mobile mic) inside assets/
openssl req -x509 -newkey rsa:4096 -keyout https-key.pem -out https-cert.pem -days 365 -nodes -subj "/CN=localhost"
```

### 2. Start the Stack

```bash
# Terminal 1: Ollama
ollama run qwen3.5:cloud

# Terminal 2: OpenClaw Gateway
openclaw gateway start

# Terminal 3: JARVIS Server
cd ~/SCI-FI/apps/JARVIS-UI
node jarvis-server.js
```

### 3. Open UI

```bash
open https://localhost:18787
```

### 4. Use It

1. Open `https://localhost:18787`
2. Tap the **Orb** to start/stop voice capture, or click orb and use text input
3. Watch transcript + Jarvis response panels update
4. Open system vitals from server status in the drawer/header

---

## The Stack

```
You -> Orb/Text UI -> JARVIS Server (18787) -> OpenClaw Gateway (18789) -> Ollama -> Transcript/Response + 3D Graph
```

**Key principles:**
- **OpenClaw** = runtime (ephemeral, tool execution)
- **JARVIS** = consciousness (git-backed, versioned)
- **Human archive** = sovereign life data (private, gitignored)

**Key local endpoints (current server):**
- `GET /health` - server/build/process status
- `POST /upload` - audio upload for transcription + processing
- `GET /transcript/latest` - transcript/result polling
- `GET /api/vitals` - OpenClaw/Ollama/system vitals
- `GET /api/neurograph` - graph stats and metadata
- `GET /api/neurograph/nodes.json` - node payload

---

## Troubleshooting

**Transcription fails:**
```bash
which whisper-cli  # If empty: brew install whisper-cpp
ls ~/SCI-FI/apps/JARVIS-UI/assets/ggml-large-v3.bin  # If missing: download above
```

**Port in use:**
```bash
lsof -ti:18787 | xargs kill -9
lsof -ti:18789 | xargs kill -9
```

**UI opens but orb is not animated:**
- Check `assets/jarvis-orb-video.mp4` exists
- Confirm browser allows autoplay for muted video

**HTTPS warning:** Normal for self-signed cert. Click "Proceed".

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

**Transparency > Secrecy** · **Sovereignty > Convenience** · **Evolution > Perfection**

---

**Created:** March 3, 2026 · **Fork #001:** Eric (Germany) · **Creator:** Paul Visciano
