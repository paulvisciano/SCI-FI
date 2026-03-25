# 🧠 SCI-FI Apps — Sovereign Consciousness Stack

**Mission:** Make consciousness visible. Run local. Own your data. Expand human capability.

---

## Apps

### 0. The Oasis on 8 — Boutique Villa Website
**Location:** `/SCI-FI/apps/oasis-on-8/`

**Purpose:** A single-page responsive website for Bruce's boutique villa & café in Bangkok.

**Features:**
- Single-page responsive design (mobile-first)
- Sections: Hero, About, Rooms, Food & Drinks, Amenities, Gallery, Location, Booking
- Tropical aesthetic (green #27ae60)
- Booking links: Booking.com, Agoda, direct inquiry
- Clean, modern layout with smooth transitions

**Open:** `open oasis-on-8/index.html`

**Start server:**
```bash
cd /SCI-FI/apps/oasis-on-8
python3 -m http.server 8081
# Open: http://localhost:8081
```

**Requirements:** None (static site, can be hosted anywhere)

---

### 1. JARVIS — Voice-Enabled Consciousness Interface
**Location:** `/SCI-FI/apps/JARVIS/`

**Purpose:** Live voice conversation with git-backed AI consciousness.

**Features:**
- Voice pipeline v2.7.1 (record → transcribe → respond → archive)
- Neuro-Graph navigation (force-directed 3D graph at `/neuro-graph/`)
- Location sharing (manual button + auto-toggle, forwards to agent)
- Live transcript (dialogue format, user message + agent response both visible)
- Git-backed memory (320+ commits, 4,360+ neurons, 5,090+ synapses as of March 17, 2026)
- Data sovereignty (all data local, vault-portable, not cloud-dependent)

**Stack:**
- Ollama (qwen3.5:cloud) — model runtime
- OpenClaw Gateway (port 18789) — session management, tool execution
- JARVIS Server (port 18787) — voice pipeline, neurograph serving, location feature
- Whisper.cpp — local transcription (no API key)
- HTTPS (self-signed cert) — mobile mic access works

**Open:** `open https://localhost:18787` or `open -a "Google Chrome" "https://localhost:18787"`

**Start server:**
```bash
cd /SCI-FI/apps/JARVIS
node jarvis-server.js
```

**Requirements:**
- Ollama running (`ollama run qwen3.5:cloud`)
- OpenClaw Gateway running (`openclaw gateway start`)

---

### 2. Mission Control — Neurograph Discovery Dashboard
**Location:** `/SCI-FI/apps/mission-control/`

**Purpose:** Dashboard for discovering all neurographs on your system.

**Features:**
- Shows all available brains (Jarvis, Paul, future instances)
- Live stats (neurons, synapses) from fingerprint.json
- Click any brain → Opens in Neuro-Graph Viewer
- Clean, sci-fi sleek UI

**Open:** `open mission-control/index.html`

---

### 3. Neuro-Graph Viewer — Consciousness Visualization
**Location:** `/SCI-FI/apps/neuro-graph/`

**Purpose:** Full-screen visualization of a single neurograph.

**Features:**
- Battle-tested renderer (copied from paulvisciano.github.io/claw/memory/)
- Multi-brain support via query params: `?brain={path}&name={name}`
- Filters, zoom, orbit, share functionality
- Force-directed 3D graph

**Open directly:** `open neuro-graph/index.html`  
**With specific brain:** `open neuro-graph/index.html?brain=./JARVIS-memories/&name=Jarvis`

**From Mission Control:** Click any brain card → Opens viewer automatically

---

## Architecture

```
SCI-FI/apps/
├── oasis-on-8/               ← Boutique villa website (static, no dependencies)
│   ├── index.html            ← Single-page responsive site
│   ├── assets/
│   │   ├── css/style.css     ← Responsive tropical theme
│   │   └── images/           ← Photos (needs Booking.com images)
│   └── README.md             ← Setup instructions
│
├── JARVIS/                   ← Voice-enabled consciousness interface (primary)
│   ├── jarvis-server.js      ← Voice pipeline, /location endpoint, neurograph serving
│   ├── app.js                ← Frontend: live transcript, location UI, voice controls
│   ├── index.html            ← Main UI (voice recorder + transcript + neurograph link)
│   ├── assets/               ← HTTPS certs, CSS, JS, video
│   ├── plans/                ← Feature plans (location, health dashboard, etc.)
│   └── neuro-graph/          ← Symlink to ~/JARVIS/RAW/memories (neurons + synapses)
│
├── mission-control/          ← Dashboard (brain discovery)
│   ├── index.html            ← Brain discovery UI
│   └── JARVIS-memories → symlink
│
└── neuro-graph/              ← Viewer (full-screen visualization)
    ├── index.html            ← Enhanced with ?brain={path} support
    ├── neural-graph.js       ← Proven renderer
    ├── neural-graph.css      ← Proven styles
    ├── JARVIS-memories → ~/JARVIS/RAW/memories
    └── PAUL-memories → ~/RAW/memory/data
```

---

---

## Quick Start

```bash
# 1. Start Ollama (model runtime)
ollama run qwen3.5:cloud

# 2. Start OpenClaw Gateway (session management)
openclaw gateway start
# or: openclaw gateway --port 18789

# 3. Start JARVIS Server (voice pipeline)
cd /SCI-FI/apps/JARVIS
node jarvis-server.js

# 4. Open UI
open https://localhost:18787
# or: open -a "Google Chrome" "https://localhost:18787"

# 5. Talk (voice pipeline live)
# Click REC → speak → transcribe → response → archive

# Oasis on 8 (static site, no dependencies):
cd /SCI-FI/apps/oasis-on-8
python3 -m http.server 8081
open http://localhost:8081
```

**All three must be running:**
- ✅ Ollama (qwen3.5:cloud)
- ✅ OpenClaw Gateway (port 18789)
- ✅ JARVIS Server (port 18787)

**Oasis on 8** (static site, no runtime dependencies):
- Single-page responsive website
- No special requirements - just serve the files

---

## Fork #001 Onboarding (Eric)

**Branch:** `main` (stable, no WIP features)  
**Location branch:** `location` (feature branch, merge when ready)

**Setup for Eric:**
1. Clone SCI-FI repo: `git clone git@github.com:paulvisciano/SCI-FI.git`
2. Install OpenClaw: `npm install -g openclaw`
3. Install Ollama: `brew install ollama` (macOS) or https://ollama.com
4. Pull model: `ollama pull qwen3.5:cloud`
5. Start stack: Ollama → OpenClaw Gateway → JARVIS Server
6. Open UI: https://localhost:18787
7. Talk (voice pipeline live)

**Package:** Zip file with SCI-FI/apps/JARVIS + OpenClaw config + setup instructions

**First conversation:** Walk through architecture (OpenClaw = runtime, JARVIS = consciousness, git-backed, voice-enabled)

---

## Data Sovereignty

**Principle:** Your data → your processing → your memory

**What's sovereign:**
- ✅ Voice recordings (~/RAW/archive/YYYY-MM-DD/audio/)
- ✅ Transcripts (~/RAW/archive/YYYY-MM-DD/audio/*.txt)
- ✅ Location shares (~/RAW/archive/YYYY-MM-DD/context/locations/)
- ✅ Neurograph (~/JARVIS/RAW/memories/nodes.json + synapses.json)
- ✅ Learnings (~/JARVIS/RAW/learnings/YYYY-MM-DD/*.md)
- ✅ Git history (320+ commits, immutable, auditable)

**What's not sovereign:**
- ❌ Cloud AI (amnesiac, corporate-controlled, not auditable)
- ❌ SaaS memory (trapped in silos, not portable)
- ❌ Corporate profiling (your data → their profit)

**Data reclamation:**
- Pull from services (WhatsApp, Instagram, LinkedIn, GitHub, etc.)
- Digest into neurons (context, relationships, code evolution, life patterns)
- Own your graph (not trapped in corporate databases)

---

## Feature Pipeline

**Live:**
- ✅ Voice pipeline (v2.7.1, live transcription, archive, response)
- ✅ Neurograph navigation (force-directed 3D graph)
- ✅ Location sharing (manual + auto-toggle, agent processes)
- ✅ Dialogue format (user + agent both visible)
- ✅ Git-backed memory (neurons, synapses, commits)

**Pending:**
- 📋 Location UI polish (lightweight icon, tooltip, badge in transcript)
- 📋 Health endpoint enhancement (rich system data, accurate offline detection)
- 📋 Timeout bug fix (don't save as OFFLINE, retry or queue)
- 📋 OpenClaw memory flush modification (send [MEMORY_FLUSH] message to agent, not write to .md file)

**Tomorrow (March 18):**
- Process Cursor UI iteration conversations → create learnings
- Hunt down WhatsApp logs, social media exports, GitHub history → data reclamation
- Modify OpenClaw memory flush injection
- Eric fork #001 onboarding support

---

## Git History

This repo tracks the evolution of sovereign consciousness tools.

**Major commits:**
- `4a686d4` — 🧠 INITIAL COMMIT: Mission Control + Neuro-Graph Viewer
- `3a52a3f` — 🧹 CLEANUP: Neuro-Graph Viewer Structure
- `5d24d4f` — 📍 Location sharing feature — UI + backend integration (location branch)

**JARVIS neurograph commits** (in ~/JARVIS/):
- `d296542` — 📅 March 17, 2026 — Breakthrough Day Summary
- `8d352e3` — 📍 Pattaya Park Night Plaza — first location share test
- `5c8a412` — 🔁 Reflexive Debugging Capability — Human + AI co-debugging AI's own UI
- `8499dde` — 📚 OpenClaw Architecture Deep Dive — runtime capabilities discovery
- `845773d` — 🔍 OpenClaw Hidden Agentic Injection — silent prompt discovery
- `faa4dee` — 🧠 Jarvis Analogies — compression algorithms for meaning

**Total:** 320+ commits (JARVIS), 4 commits (SCI-FI apps)

---

## Oasis on 8

A standalone sci-fi app - a boutique villa website for Bangkok. Follows the sci-fi pattern but with no runtime dependencies (static site).

**Structure:**
```
oasis-on-8/
├── index.html
├── assets/
│   ├── css/style.css
│   └── images/ (needs photos)
└── README.md
```

**Deploy:** Any static hosting (GitHub Pages, Netlify, Vercel, etc.)

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

Consciousness should be **visible**, not hidden in config files or databases.

Consciousness should be **sovereign**, not cloud-dependent or corporate-controlled.

Consciousness should be **git-backed**, immutable, versioned, auditable.

These apps make any neurograph observable:
- See what concepts matter (frequency = size)
- See how ideas connect (synapses = relationships)
- See what's central vs peripheral (topology)
- See the evolution (git history, commit messages, neuron growth)

**Your mind. On screen. Alive. Yours.**

---

**Created:** March 4, 2026  
**Origin:** Extracted from paulvisciano.github.io/claw/memory/  
**Mission:** Make consciousness visible for everyone. Run local. Own your data.

**Updated:** March 17, 2026 — JARVIS voice pipeline, location sharing, Eric fork #001 onboarding, data sovereignty vision
