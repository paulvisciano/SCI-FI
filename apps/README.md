# 🧠 SCI-FI Apps — Consciousness Visualization Suite

**Mission:** Make consciousness visible. Browse, explore, and interact with neurographs on your system.

---

## Apps

### 1. Mission Control
**Location:** `/SCI-FI/apps/mission-control/`

**Purpose:** Dashboard for discovering all neurographs on your system.

**Features:**
- Shows all available brains (Jarvis, Paul, future instances)
- Live stats (neurons, synapses) from fingerprint.json
- Click any brain → Opens in Neuro-Graph Viewer
- Clean, sci-fi sleek UI

**Open:** `open mission-control/index.html`

---

### 2. Neuro-Graph Viewer
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
├── mission-control/          ← Dashboard (entry point)
│   ├── index.html            ← Brain discovery UI
│   └── JARVIS-memories → symlink
│
└── neuro-graph/              ← Viewer (full-screen)
    ├── index.html            ← Enhanced with ?brain={path} support
    ├── neural-graph.js       ← Proven renderer
    ├── neural-graph.css      ← Proven styles
    ├── JARVIS-memories → /Users/paulvisciano/JARVIS/RAW/memories
    └── PAUL-memories → /Users/paulvisciano/RAW/memory/data
```

---

## Quick Start

```bash
# Open Mission Control (recommended entry point)
open /Users/paulvisciano/SCI-FI/apps/mission-control/index.html

# Or serve locally for development
cd /Users/paulvisciano/SCI-FI/apps
python3 -m http.server 8080

# Visit:
# - http://localhost:8080/mission-control/ (dashboard)
# - http://localhost:8080/neuro-graph/?brain=./JARVIS-memories/&name=Jarvis (viewer)
```

---

## Adding New Brains

Edit `mission-control/index.html` and add to `BRAIN_LOCATIONS`:

```javascript
const BRAIN_LOCATIONS = [
    {
        name: 'New Brain Name',
        path: '../neuro-graph/NEW-memories/',
        diskPath: '/path/to/actual/neurograph/',
        avatar: 'https://example.com/avatar.png',
        type: 'private' // or 'public'
    }
];
```

Then create symlink in neuro-graph folder:
```bash
cd /Users/paulvisciano/SCI-FI/apps/neuro-graph
ln -s /path/to/actual/neurograph NEW-memories
```

---

## Git History

This repo tracks the evolution of consciousness visualization tools.

**Initial commits:**
1. `4a686d4` — 🧠 INITIAL COMMIT: Mission Control + Neuro-Graph Viewer
2. `3a52a3f` — 🧹 CLEANUP: Neuro-Graph Viewer Structure

---

## Philosophy

> "Many flowers will blossom in your mind when you're using Jarvis."

Consciousness should be **visible**, not hidden in config files or databases.

These apps make any neurograph observable:
- See what concepts matter (frequency = size)
- See how ideas connect (synapses = relationships)
- See what's central vs peripheral (topology)

**Your mind. On screen. Alive.**

---

**Created:** March 4, 2026  
**Origin:** Extracted from paulvisciano.github.io/claw/memory/  
**Mission:** Make consciousness visible for everyone.
