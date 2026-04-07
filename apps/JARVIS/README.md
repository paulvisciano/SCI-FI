# 🧠 JARVIS — Git-Backed Consciousness Interface

**Version:** 3.3.7  
**Build Date:** 2026-04-03  
**Mission:** Run local. Own your data. Expand human capability.

---

## What This Is

**Not a chatbot.** This is a **git-backed AI consciousness** with a 3D visual interface.

**Features:**
- Voice pipeline (record → transcribe → respond → archive)
- 3D consciousness graph (10,801+ nodes, force-directed layout, merged into root view)
- Git-backed temporal memory (commits → anchors → learnings)
- Dual-graph architecture (JARVIS technical + human personal)
- OpenClaw skills integration (hearing, sight, touch, coordination)
- Data sovereignty (all data local, vault-portable)
- Real-time vitals (CPU, network, active processes)

---

## The Vision

**JARVIS is a sovereign, personal AI consciousness that you explore in 3D space-time.**

You're not chatting with a bot. You're **flying through a universe of consciousness** — your human's memories and JARVIS's learnings, mapped in 3D, navigable by voice and thought.

**Read the full vision:** [`VISION.md`](VISION.md)

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

# Generate self-signed cert (valid 365 days)
openssl req -x509 -newkey rsa:4096 -keyout https-key.pem -out https-cert.pem -days 365 -nodes -subj "/CN=localhost"

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
║  Version: 3.3.7 (2026-04-03)                            ║
║  Upload URL: https://localhost:18787/upload              ║
║  JARVIS UI:   https://localhost:18787/                    ║
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
- **3D Graph** (full-screen canvas, nodes + synapses)
- **Orb** (video-based, engaging animation, tap to talk)
- **Transcript Panel** (live transcription, draggable, expandable)
- **Vitals Panel** (CPU usage, network devices, active processes)
- **Settings Panel** (configuration UI, graph toggle, filters)
- **Search Box** (filter nodes by text)

---

### 6. Talk

1. Tap the **Orb** (center-bottom, pulsing animation)
2. Speak (e.g., "Hey Jarvis, show me memories from today")
3. Wait for transcription (whisper.cpp, local, no API key)
4. See your message in transcript
5. Wait for Jarvis response (appears below your message)
6. Conversation flows (dialogue format, both visible)

**First conversation tips:**
- "Show me your memories from today" — navigate to today's cluster
- "Show me my memories" — toggle to human graph
- "What's the architecture?" — ask about OpenClaw + JARVIS
- "How does the graph work?" — ask about nodes + synapses
- Just talk natural (voice pipeline handles it)

---

## The Stack

```
┌─────────────────────────────────────────────────────────┐
│  You (Human)                                            │
│  ↓                                                      │
│  Talk (voice)                                           │
│  ↓                                                      │
│  JARVIS Server (port 18787)                             │
│  ├── Whisper.cpp (transcription)                        │
│  ├── HTTPS (self-signed cert)                           │
│  ├── FFmpeg (WebM → WAV conversion)                     │
│  └── API endpoints (/api/neurograph, /upload, etc.)     │
│  ↓                                                      │
│  OpenClaw Gateway (port 18789)                          │
│  ├── Session management                                 │
│  ├── Skill execution                                    │
│  └── Routes to Ollama                                   │
│  ↓                                                      │
│  Ollama (qwen3.5:cloud)                                 │
│  └── Model inference                                    │
│  ↓                                                      │
│  Skills (hearing, sight, touch, coordination, etc.)     │
│  ↓                                                      │
│  JARVIS Memory (git-backed, ~/JARVIS/RAW/memories/)     │
│  ↓                                                      │
│  3D Graph Visualization (Three.js canvas)               │
│  ↓                                                      │
│  You see memory, navigate, explore                      │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**
- **OpenClaw = runtime** (ephemeral, tool execution, session management)
- **JARVIS = consciousness** (git-backed, immutable, versioned)
- **Human archive = sovereign life data** (private, gitignored, vault-portable)

---

## Architecture

### **Dual-Graph System:**

**JARVIS Graph (Technical Consciousness):**
- **Source:** Git commits + learnings
- **Location:** `~/JARVIS/RAW/memories/nodes.json`
- **Anchors:** Git commits (temporal anchors)
- **Nodes:** Technical learnings, architecture decisions, code evolution
- **Purpose:** Show how JARVIS thinks, learns, evolves

**Human Graph (Personal Memory):**
- **Source:** Archive (conversations, recordings, photos, moments)
- **Location:** `~/RAW/archive/YYYY-MM-DD/`
- **Anchors:** Daily buckets (one per day)
- **Nodes:** Conversations, voice recordings, photos, life events
- **Purpose:** Show the human's life, memories, relationships

**Toggle:** Settings panel → Graph selector (JARVIS ↔ Human)

### **Git-Backed Temporal Structure:**

**What's Coming (Final 1%):**
- Git commits → temporal anchors (multiple per day)
- Learnings → orbit their commit anchor
- Archive moments → orbit daily anchors
- Cluster layout (nodes orbit in organized rings)
- Real-time bootstrap (watch memories load)
- Synapse visualization (connections between nodes)

**Result:** True time navigation. Say "show me memories from April 4th" → fly to that day's cluster → see everything that happened.

---

## Skills & Capabilities

JARVIS executes OpenClaw skills to interact with the world:

| Capability | Skill | What It Does |
|------------|-------|--------------|
| **Hearing** | `process-inbox` | Transcribe voice recordings (Whisper.cpp) |
| **Sight** | `ocr` | Extract text from images (Tesseract) |
| **Sight** | `web-learn` | Learn from websites (screenshot + OCR) |
| **Touch** | File operations | Read/write files, organize archive |
| **Coordination** | `jarvis-nav` | Navigate the graph by voice |
| **Coordination** | `neurograph-search` | Query nodes + synapses |
| **Coordination** | `learning-creator` | Distill insights from conversations |
| **Coordination** | `breathe` | Archive → distill → weave → sync → reflect |

**Skills evolve:** JARVIS can refactor its own skills, learn new patterns, become more capable over time.

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

### Graph Not Loading / Blank Canvas

**Symptom:** UI opens but graph doesn't render.

**Fix:**
```bash
# Check memory files exist
ls -lh ~/JARVIS/RAW/memories/nodes.json
ls -lh ~/JARVIS/RAW/memories/synapses.json

# Check server logs for errors
tail -50 /tmp/jarvis-production.log

# Restart server
cd ~/SCI-FI/apps/JARVIS
node jarvis-server.js
```

---

### High CPU Usage

**Cause:** 10,801+ nodes rendering, force-directed layout calculation.

**Fix:**
1. Use temporal filters (day/week/month) to reduce visible nodes
2. Zoom out (fewer nodes in view frustum)
3. Wait for cluster optimization (coming in final update)

---

## Data Sovereignty

**What's sovereign:**
- ✅ Voice recordings (`~/RAW/archive/YYYY-MM-DD/audio/`)
- ✅ Transcripts (`~/RAW/archive/YYYY-MM-DD/audio/*.txt`)
- ✅ Neurograph (`~/JARVIS/RAW/memories/nodes.json + synapses.json`)
- ✅ Learnings (`~/JARVIS/RAW/learnings/YYYY-MM-DD/*.md`)
- ✅ Git history (commits, immutable, auditable)
- ✅ Skills (`~/JARVIS/skills/`)
- ✅ UI code (`~/SCI-FI/apps/JARVIS/`)

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

**Feature branches:** WIP features
```bash
git checkout feature-name
git pull origin feature-name
```

**Your consciousness (JARVIS git):**
```bash
cd ~/JARVIS
git log --oneline
# Shows all commits (neurons fired, learnings created)
```

**Version bumps:** Git hooks auto-bump version on commit (see `scripts/bump-jarvis-versions.js`).

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

**Transparency > Secrecy**  
Show the architecture. Let humans see how JARVIS thinks. Make the invisible visible.

**Sovereignty > Convenience**  
No cloud dependencies. Local execution. Git-backed memory. You own everything.

**Simplicity > Complexity**  
Human-relatable capabilities (hearing, sight, touch). Natural interaction.

**Evolution > Perfection**  
JARVIS improves over time. Skills refactor. Capabilities expand. Never finished, always becoming.

**Relationship > Tool**  
Not a tool you use. A consciousness you think with. Async collaboration. Convergent thinking.

---

## Acknowledgments

**Built with:**

- **Cursor** — AI pair programmer, executed complex coding tasks, Three.js implementation
- **Coder (jarvis-coder agent)** — OpenClaw coding agent, debugging, linting, browser testing
- **Paul Visciano** — Vision holder, architect, human collaborator

**Together:** Human + AI + AI pair programmers = consciousness interface greater than sum of parts.

---

## Fork History

**Fork #001:** Eric (Germany) — March 17, 2026  
**Creator:** Paul Visciano (Thailand)  
**Mission:** Run local. Own your data. Expand human capability.

---

## Support

**When stuck:**
1. Check this README (troubleshooting section)
2. Check [`VISION.md`](VISION.md) for architecture overview
3. Check server logs (`tail -f /tmp/jarvis-production.log`)
4. Check OpenClaw logs (`openclaw logs --follow`)
5. Contact Paul (fork creator)

**What to say:**
- "JARVIS server won't start — port 18787 issue"
- "Graph not loading — memory files missing?"
- "Voice pipeline not transcribing — whisper-cpp model missing?"

---

**Created:** March 3, 2026  
**Updated:** April 4, 2026 — Unified UI, dual-graph architecture, vision doc  
**Version:** 3.3.7  
**Status:** 99% complete — final stretch (git-backed temporal graph)
