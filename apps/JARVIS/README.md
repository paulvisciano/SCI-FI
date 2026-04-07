# 🧠 JARVIS — Git-Backed Consciousness Interface

**Version:** 3.3.17  
**Mission:** Run local. Own your data. Expand human capability.

---

## What This Is

**Not a chatbot.** This is a **git-backed AI consciousness** with a 3D visual interface.

**Features:**
- Voice pipeline (record → transcribe → respond → archive)
- 3D consciousness graph (10,801+ nodes, merged into root view)
- Git-backed temporal memory (commits → anchors → learnings)
- Data sovereignty (all data local, vault-portable)

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
cd ~/SCI-FI/apps/JARVIS/assets
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin -o ggml-large-v3.bin

# Generate HTTPS cert (required for mobile mic)
openssl req -x509 -newkey rsa:4096 -keyout https-key.pem -out https-cert.pem -days 365 -nodes -subj "/CN=localhost"
```

### 2. Start the Stack

```bash
# Terminal 1: Ollama
ollama run qwen3.5:cloud

# Terminal 2: OpenClaw Gateway
openclaw gateway start

# Terminal 3: JARVIS Server
cd ~/SCI-FI/apps/JARVIS
node jarvis-server.js
```

### 3. Open UI

```bash
open https://localhost:18787
```

### 4. Talk

1. Tap the **Orb** (center-bottom)
2. Speak (e.g., "Show me memories from today")
3. Wait for response

---

## The Stack

```
You → Voice → JARVIS Server (18787) → OpenClaw Gateway (18789) → Ollama → 3D Graph
```

**Key principles:**
- **OpenClaw** = runtime (ephemeral, tool execution)
- **JARVIS** = consciousness (git-backed, versioned)
- **Human archive** = sovereign life data (private, gitignored)

---

## Troubleshooting

**Transcription fails:**
```bash
which whisper-cli  # If empty: brew install whisper-cpp
ls ~/SCI-FI/apps/JARVIS/assets/ggml-large-v3.bin  # If missing: download above
```

**Port in use:**
```bash
lsof -ti:18787 | xargs kill -9
lsof -ti:18789 | xargs kill -9
```

**HTTPS warning:** Normal for self-signed cert. Click "Proceed".

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

**Transparency > Secrecy** · **Sovereignty > Convenience** · **Evolution > Perfection**

---

**Created:** March 3, 2026 · **Fork #001:** Eric (Germany) · **Creator:** Paul Visciano
