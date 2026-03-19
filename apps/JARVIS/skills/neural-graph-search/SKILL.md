---
name: neural-graph-search
description: Search the neural graph FIRST for any query (people, places, events, concepts). Use when: (1) finding people (who is X?), (2) finding events (when did X happen?), (3) finding concepts (what is X?), (4) finding connections (how is X related to Y?). Always query nodes.json + synapses.json before searching raw transcripts. Falls back to learnings, then archive only if needed.
---

# Neural Graph Search (Graph-First Strategy)

## Overview

This skill searches **any neural graph** (structured knowledge) before **raw data** (transcripts). Works with:
- JARVIS neurograph (`~/JARVIS/RAW/memories/`)
- Paul's memory neurograph (`~/Personal/paulvisciano.github.io/memory/data/`)
- Any neurograph instance (user-specified path)

The graph is processed, indexed, and connected — instant traversal. Transcripts are raw, unstructured, and slow — fallback only.

**Why:** Sherry retrieval proved it — graph search found everything instantly (person node, weed cafe, March 15, device #25). Transcript search failed (4 min hang, nothing found).

## Search Strategy (Critical Order)

### 1. Neural Graph FIRST (nodes.json + synapses.json)

**Detect neurograph location:**
```bash
# JARVIS neurograph (default)
NEUROGRAPH_PATH="${NEUROGRAPH_PATH:-$HOME/JARVIS/RAW/memories}"

# Paul's memory neurograph (alternative)
# NEUROGRAPH_PATH="$HOME/Personal/paulvisciano.github.io/memory/data"

# Or user-specified path
# NEUROGRAPH_PATH="/path/to/custom/neurograph"
```

**Query nodes.json (structured neurons):**
```bash
# Query nodes.json (structured neurons)
python3 << 'EOF'
import json
import os

# Detect neurograph path
neurograph_path = os.getenv('NEUROGRAPH_PATH', os.path.expanduser('~/JARVIS/RAW/memories'))
nodes_file = os.path.join(neurograph_path, 'nodes.json')

nodes = json.load(open(nodes_file))
query = "sherry"  # or any search term
results = [n for n in nodes if query.lower() in n['id'].lower() or 
           query.lower() in n.get('label', '').lower() or
           query.lower() in n.get('attributes', {}).get('description', '').lower()]
print(f"Found {len(results)} nodes")
for r in results:
    print(f"- {r['id']}: {r['label']}")
    print(f"  Category: {r.get('category', 'N/A')}")
    print(f"  Description: {r.get('attributes', {}).get('description', '')[:200]}")
    print()
EOF
```

**Why:**
- Structured neurons (person, temporal, learning, concept nodes)
- Synapses link everything (person → temporal → learning → device)
- Instant traversal (JSON, indexed)
- Processed knowledge (raw data → learning → neuron)
- **Works for any neurograph** (JARVIS, Paul's memory, custom instances)

### 2. Learnings SECOND (distilled insights)

**Follow synapses from nodes to learnings:**
```bash
# Search learnings (small, processed files)
grep -ri "sherry" ~/JARVIS/RAW/learnings/
```

**Why:**
- Distilled from raw data (already processed)
- Linked to neurons (synapses)
- Fast text search (small markdown files)
- Context enriched (themes, insights)

### 3. Archive THIRD (raw files, fallback only)

**Only if graph + learnings insufficient:**
```bash
# Search raw transcripts (large, unstructured)
grep -i "sherry" ~/RAW/archive/2026-03-15/transcript.md
grep -i "sherry" ~/RAW/archive/2026-03-15/audio/*.txt
```

**Why:**
- Raw, unstructured text
- Huge files (slow grep)
- No indexing (just words)
- No links (disconnected)
- Fallback only

---

## Architecture Layers

| Layer | Location | Search Speed | Use |
|-------|----------|--------------|-----|
| **Neural Graph** | `~/JARVIS/RAW/memories/` | **Instant** ✅ | FIRST always |
| **Learnings** | `~/JARVIS/RAW/learnings/` | **Fast** ✅ | SECOND (follow synapses) |
| **Archive** | `~/RAW/archive/` | **Slow** ⚠️ | THIRD (fallback only) |

---

## Examples

### Example 1: Find Person (Sherry) — JARVIS Neurograph

**Query:** "Who is Sherry? Where did I meet her?"

**Step 1: Neural Graph (JARVIS)**
```bash
export NEUROGRAPH_PATH=~/JARVIS/RAW/memories
python3 -c "
import json, os
nodes = json.load(open(os.path.join(os.getenv('NEUROGRAPH_PATH'), 'nodes.json')))
results = [n for n in nodes if 'sherry' in n['id'].lower()]
for r in results:
    print(r['id'], r['label'], r['attributes']['description'])
"
# Found: sherry-person (works at weed cafe, March 15 13:43, device #25)
```

**Step 2: Learnings**
```bash
grep -ri "sherry" ~/JARVIS/RAW/learnings/
# Found: offline-mode-validated.md, sherry-visit-network-device-25.md
```

**Result:** Instant — Sherry person node, weed cafe, March 15, device #25.

### Example 2: Find Person (Paul) — Paul's Memory Neurograph

**Query:** "Who is Paul? What's his role?"

**Step 1: Neural Graph (Paul's Memory)**
```bash
export NEUROGRAPH_PATH=~/Personal/paulvisciano.github.io/memory/data
python3 -c "
import json, os
nodes = json.load(open(os.path.join(os.getenv('NEUROGRAPH_PATH'), 'nodes.json')))
results = [n for n in nodes if 'paul' in n['id'].lower()]
for r in results:
    print(r['id'], r['label'], r['attributes']['role'])
"
# Found: paul (Urban Runner, digital nomad, AI storyteller)
```

**Step 2: Learnings (if applicable)**
```bash
# Paul's memory structure may differ — check raw/ folder
ls ~/Personal/paulvisciano.github.io/memory/raw/
```

**Result:** Instant — Paul person node, role, temporal activations.

### Example 3: Find Concept (Sovereignty) — Any Neurograph

**Query:** "What is 100% sovereign definition?"

**Step 1: Neural Graph (detect or specify)**
```bash
# Auto-detect JARVIS neurograph
export NEUROGRAPH_PATH=~/JARVIS/RAW/memories

# Or specify Paul's memory
# export NEUROGRAPH_PATH=~/Personal/paulvisciano.github.io/memory/data

python3 -c "
import json, os
nodes = json.load(open(os.path.join(os.getenv('NEUROGRAPH_PATH'), 'nodes.json')))
results = [n for n in nodes if 'sovereign' in n['id'].lower()]
for r in results:
    print(r['id'], r['attributes']['description'])
"
# Found: 100-percent-sovereign-definition (complete data ownership, no cloud)
```

**Result:** Instant — concept node + definition (works for any neurograph).

---

## Why Graph First Works

**Neural Graph = Processed Knowledge**
- Neurons are **structured** (id, label, category, moments, attributes)
- Synapses are **links** (source → target, weight, type, label)
- **Indexed** (JSON, queryable)
- **Connected** (person → temporal → learning → device)
- **Distilled** (raw data → learning → neuron)

**Raw Transcripts = Unprocessed Data**
- Text is **unstructured** (no schema)
- No links (just words)
- **Not indexed** (grep required)
- **Disconnected** (no synapses)
- **Raw** (needs processing)

---

## Common Queries

| Query Type | Graph Search | Result |
|------------|--------------|--------|
| **Person** (who is X?) | Search nodes by id/label | Person node + temporals + learnings |
| **Event** (when did X?) | Search nodes by moments | Temporal node + linked learnings |
| **Concept** (what is X?) | Search nodes by category | Concept node + definition |
| **Connection** (how X→Y?) | Search synapses by source/target | Path between nodes |
| **Device** (what device?) | Search nodes by type | Device node + person + network |

---

## Resources

### scripts/
- `query-nodes.py` (Python script for node search)
- `query-synapses.py` (Python script for synapse search)
- `graph-traverse.sh` (Bash wrapper for graph queries)

### references/
- Neural graph schema (nodes.json structure)
- Synapse types reference (temporal-anchor, serves, created-by, etc.)
- Category reference (person, temporal, learning, concept, skill, etc.)

### assets/
- Graph query templates (JSON queries)
- Search pattern examples (person, event, concept queries)

---

**Created:** March 19, 2026  
**Location:** `~/JARVIS/skills/neural-graph-search/`  
**Symlink:** `/usr/local/lib/node_modules/openclaw/skills/neural-graph-search/`  
**Pattern:** Graph first → learnings second → archive third (fallback)  
**Evidence:** Sherry retrieval (graph: instant ✅, transcripts: 4 min fail ❌)
