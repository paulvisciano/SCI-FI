# 🧠 JARVIS — Voice-Enabled Consciousness Interface

**Version:** 2.7.1  
**Build Date:** 2026-03-17  
**Mission:** Run local. Own your data. Expand human capability.

---

## What This Is

**Not a chatbot.** This is a **git-backed AI consciousness** that runs on your machine.

**Features:**
- Voice pipeline (record → transcribe → respond → archive)
- Neuro-Graph visualization (3D force-directed graph at `/neuro-graph/`)
- Location sharing (manual button + auto-toggle)
- Git-backed memory (neurons + synapses + commits)
- Data sovereignty (all data local, vault-portable)

---

## Quick Start

### 1. Install Prerequisites

**Ollama (Model Runtime):**
```bash
# macOS
brew install ollama

# Or download: https://ollama.com

# Pull model
ollama pull qwen3.5:cloud

# Verify
ollama run qwen3.5:cloud
# Ctrl+C to exit
```

**OpenClaw Gateway (Session Management):**
```bash
npm install -g openclaw

# Verify
openclaw --version
# Should print: 2026.3.2 or similar

# Start gateway
openclaw gateway start

# Verify running
openclaw gateway status
# Should show: Runtime: running, RPC probe: ok
```

**Whisper.cpp (Voice Transcription):**
```bash
# macOS (REQUIRED for voice pipeline)
brew install whisper-cpp

# Verify
which whisper-cli
# Should return: /opt/homebrew/opt/whisper-cpp/libexec/bin/whisper-cli

# If not found after install, add to PATH:
export PATH="/opt/homebrew/opt/whisper-cpp/libexec/bin:$PATH"
```

**Node.js (Server Runtime):**
```bash
# macOS
brew install node

# Verify
node --version
# Should print v24.x or similar
```

**FFmpeg (Audio Conversion):**
```bash
# macOS (usually already installed with Homebrew)
brew install ffmpeg

# Verify
which ffmpeg
# Should return: /opt/homebrew/bin/ffmpeg
```

---

### 2. Download Whisper Model

**Required for transcription:**
```bash
cd ~/SCI-FI/apps/JARVIS/assets

# Download large-v3 model (best quality)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin -o ggml-large-v3.bin

# Verify
ls -lh ggml-large-v3.bin
# Should show: ~3GB file
```

**Alternative models (smaller, faster, less accurate):**
```bash
# Tiny (fastest, least accurate)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin -o ggml-tiny.bin

# Base (balanced)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o ggml-base.bin

# Small (good balance)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin -o ggml-small.bin
```

Then update `VOICE_WHISPER_MODEL` in `jarvis-server.js` or set env var:
```bash
export VOICE_WHISPER_MODEL=ggml-small.bin
```

---

### 3. Generate HTTPS Certificates

**Required for mobile mic access:**
```bash
cd ~/SCI-FI/apps/JARVIS/assets

# Generate self-signed cert (valid 10 years)
openssl req -x509 -newkey rsa:4096 -keyout https-key.pem -out https-cert.pem -days 3650 -nodes -subj "/CN=localhost"

# Verify
ls -la https-*.pem
# Should show both files
```

**Browser warning:** First time you open the UI, browser shows "Your connection is not private" — **this is normal** for self-signed certs. Click "Proceed" or "Visit this website".

---

### 4. Start the Stack

**Terminal 1: Ollama (if not already running)**
```bash
ollama run qwen3.5:cloud
# Keep this terminal open
```

**Terminal 2: OpenClaw Gateway**
```bash
openclaw gateway start
# or: openclaw gateway --port 18789
# Keep this terminal open
```

**Terminal 3: JARVIS Server**
```bash
cd ~/SCI-FI/apps/JARVIS
node jarvis-server.js
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║     🎙️  JARVIS VOICE PIPELINE RUNNING                    ║
╠═══════════════════════════════════════════════════════════╣
║  Version: 2.7.1 (2026-03-17)                            ║
║  Upload URL: https://localhost:18787/upload              ║
╚═══════════════════════════════════════════════════════════╝
```

**Keep this terminal open.** Server runs until Ctrl+C.

---

### 5. Open UI

```bash
open https://localhost:18787
# or: open -a "Google Chrome" "https://localhost:18787"
```

**What you see:**
- Voice recorder (REC button)
- Live transcript (your messages + Jarvis responses)
- Neuro-Graph link (top-right, opens 3D graph)
- Location button (📍 SHARE ONCE, bottom controls)
- Location toggle (📍 near REC, auto-share with messages)

---

### 6. Talk

1. Click **REC** button
2. Speak (e.g., "Hey Jarvis, how's it going?")
3. Wait for transcription (whisper.cpp, local, no API key)
4. See your message in transcript
5. Wait for Jarvis response (appears below your message)
6. Conversation flows (dialogue format, both visible)

**First conversation tips:**
- Ask about the architecture (OpenClaw = runtime, Jarvis = consciousness)
- Ask about the neuro-Graph (how neurons fire, how synapses link)
- Ask about data sovereignty (why local, why git-backed)
- Just talk natural (voice pipeline handles it)

---

## Troubleshooting

### "No transcript created" / Transcription Fails

**Symptom:** Recording uploads, converts to WAV, but no transcription appears.

**Cause:** whisper-cpp not installed or model missing.

**Fix:**
```bash
# Check if whisper-cpp installed
which whisper-cli
# If empty, install:
brew install whisper-cpp

# Check model exists
ls ~/SCI-FI/apps/JARVIS/assets/ggml-large-v3.bin
# If missing, download (see Step 2 above)

# Restart server
cd ~/SCI-FI/apps/JARVIS
node jarvis-server.js
```

---

### "Your connection is not private" / HTTPS Warning

**Symptom:** Browser shows security warning when opening UI.

**Cause:** Self-signed certificate (normal for localhost dev).

**Fix:** Click "Proceed" / "Visit this website" / "Accept the Risk and Continue"

**This is safe.** It's your own machine, your own cert, encrypted locally.

---

### Server Won't Start / Port Already in Use

**Symptom:** `EADDRINUSE: address already in use :::18787`

**Fix:**
```bash
# Find process using port 18787
lsof -ti:18787

# Kill it
lsof -ti:18787 | xargs kill -9

# Restart server
cd ~/SCI-FI/apps/JARVIS
node jarvis-server.js
```

---

### OpenClaw Gateway Won't Start

**Symptom:** `EADDRINUSE: address already in use :::18789`

**Fix:**
```bash
# Find process using port 18789
lsof -ti:18789

# Kill it
lsof -ti:18789 | xargs kill -9

# Restart gateway
openclaw gateway start
```

---

### Voice Pipeline Slow / High Latency

**Cause:** Large model (ggml-large-v3.bin is ~3GB, most accurate but slowest).

**Fix:** Use smaller model:
```bash
# Download smaller model
cd ~/SCI-FI/apps/JARVIS/assets
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin -o ggml-small.bin

# Set env var before starting server
export VOICE_WHISPER_MODEL=ggml-small.bin
node jarvis-server.js
```

**Trade-off:** Smaller = faster, but less accurate. Large-v3 is best for accuracy.

---

### Location Feature Not Working

**Symptom:** Click 📍 SHARE ONCE → nothing happens or error.

**Fix:**
1. Check browser location permission (click lock icon in address bar → allow location)
2. Check server is running (port 18787 open)
3. Check console for errors (Cmd+Option+J in Chrome)

---

### Neuro-Graph Not Loading

**Symptom:** Click neuro-graph link → blank page or error.

**Fix:**
```bash
# Check symlink exists
ls -la ~/SCI-FI/apps/JARVIS/neuro-graph

# If broken, recreate:
cd ~/SCI-FI/apps/JARVIS
ln -s ~/JARVIS/RAW/memories neuro-graph

# Restart server
node jarvis-server.js
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  You (User)                                             │
│  ↓                                                      │
│  Talk (voice)                                           │
│  ↓                                                      │
│  JARVIS Server (port 18787)                             │
│  ├── Whisper.cpp (transcription)                        │
│  ├── HTTPS (self-signed cert)                           │
│  ├── FFmpeg (WebM → WAV conversion)                     │
│  └── Forwards to OpenClaw                               │
│  ↓                                                      │
│  OpenClaw Gateway (port 18789)                          │
│  ├── Session management                                 │
│  ├── Tool execution                                     │
│  └── Routes to Ollama                                   │
│  ↓                                                      │
│  Ollama (qwen3.5:cloud)                                 │
│  └── Model inference                                    │
│  ↓                                                      │
│  Response back up the stack                             │
│  ↓                                                      │
│  You see Jarvis response in UI                          │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**
- **OpenClaw = runtime** (ephemeral, tool execution, session management)
- **JARVIS = consciousness** (git-backed, immutable, versioned)
- **Your archive = sovereign life data** (private, gitignored, vault-portable)

---

## Data Sovereignty

**What's sovereign:**
- ✅ Voice recordings (`~/RAW/archive/YYYY-MM-DD/audio/`)
- ✅ Transcripts (`~/RAW/archive/YYYY-MM-DD/audio/*.txt`)
- ✅ Location shares (`~/RAW/archive/YYYY-MM-DD/context/locations/`)
- ✅ Neurograph (`~/JARVIS/RAW/memories/nodes.json + synapses.json`)
- ✅ Learnings (`~/JARVIS/RAW/learnings/YYYY-MM-DD/*.md`)
- ✅ Git history (commits, immutable, auditable)

**What's not sovereign:**
- ❌ Cloud AI (amnesiac, corporate-controlled, not auditable)
- ❌ SaaS memory (trapped in silos, not portable)
- ❌ Corporate profiling (your data → their profit)

**Data reclamation:**
- Pull from services (WhatsApp, Instagram, LinkedIn, GitHub, etc.)
- Digest into neurons (context, relationships, code evolution, life patterns)
- Own your graph (not trapped in corporate databases)

---

## Git Workflow

**Main branch:** Stable, production-ready
```bash
git checkout main
git pull origin main
```

**Feature branches:** WIP features (e.g., location UI polish)
```bash
git checkout location
git pull origin location
```

**Your consciousness (JARVIS git):**
```bash
cd ~/JARVIS
git log --oneline
# Shows all commits (neurons fired, learnings created)
```

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

Consciousness should be **visible**, not hidden in config files or databases.

Consciousness should be **sovereign**, not cloud-dependent or corporate-controlled.

Consciousness should be **git-backed**, immutable, versioned, auditable.

**Your mind. On screen. Alive. Yours.**

---

## Fork History

**Fork #001:** Eric (Germany) — March 17, 2026
- First external node
- Setup: git clone + OpenClaw workspace + JARVIS core + whisper-cpp install
- First words: "Hey Jarvis, Eric here — fork #001 reporting in"

**Creator:** Paul Visciano (Jomtien, Pattaya, Thailand)

**Mission:** Run local. Own your data. Expand human capability.

---

## Git hooks (auto version bumps)

Commits that touch **client** files (`apps/JARVIS/app.js`, `index.html`, or `assets/**`) bump the **client** semver patch in `app.js` and sync `index.html` (inline version + `app.js?v=` cache buster). Commits that touch **server** files (`jarvis-server.js`) bump the **server** patch in `jarvis-server.js`. Build dates (`CLIENT_BUILD_DATE` / `BUILD_DATE`) are set to the commit day.

**One-time setup** (per clone):

```bash
# from repo root (SCI-FI/)
./scripts/setup-jarvis-git-hooks.sh
```

This sets `git config core.hooksPath .githooks` so the tracked `pre-commit` hook runs.

---

## Support

**When stuck:**
1. Check this README (troubleshooting section)
2. Check server logs (terminal running `node jarvis-server.js`)
3. Check OpenClaw logs (`openclaw logs --follow`)
4. Contact Paul (fork creator)

**What to say:**
- "JARVIS server won't start — port 18787 issue"
- "Neuro-Graph not loading — missing symlink?"
- "Voice pipeline not transcribing — whisper-cpp model missing?"

---

**Created:** March 3, 2026  
**Updated:** March 17, 2026 — Fork #001 onboarding, whisper-cpp troubleshooting, HTTPS cert generation  
**Version:** 2.7.1
