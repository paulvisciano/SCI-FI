---
name: neural-graph-search
description: Search the neural graph FIRST for any query (people, places, events, concepts). Use when: (1) finding people (who is X?), (2) finding events (when did X happen?), (3) finding concepts (what is X?), (4) finding connections (how is X related to Y?). Always query nodes.json + synapses.json before searching raw transcripts. Falls back to learnings, then archive only if needed.
---

# Neural Graph Search (Graph-First Strategy)

## Overview

This skill searches **structured knowledge** (neural graph) before **raw data** (transcripts). The graph is processed, indexed, and connected — instant traversal. Transcripts are raw, unstructured, and slow — fallback only.

**Why:** Sherry retrieval proved it — graph search found everything instantly (person node, weed cafe, March 15, device #25). Transcript search failed (4 min hang, nothing found).

## Search Strategy (Critical Order)

### 1. Neural Graph FIRST (nodes.json + synapses.json)

**Always start here:**
```bash
# Query nodes.json (structured neurons)
cd ~/JARVIS
python3 << 'EOF'
import json
nodes = json.load(open('RAW/memories/nodes.json'))
query = "sherry"  # or any search term
results = [n for n in nodes if query.lower() in n['id'].lower() or 
           query.lower() in n.get('label', '').lower() or
           query.lower() in n.get('attributes', {}).get('description', '').lower()]
print(f"Found {len(results)} nodes")
for r in results:
    print(f"- {r['id']}: {r['label']}")
    print(f"  Category: {r['category']}")
    print(f"  Description: {r['attributes']['description'][:200]}")
    print()
EOF
```

**Why:**
- Structured neurons (person, temporal, learning, concept nodes)
- Synapses link everything (person → temporal → learning → device)
- Instant traversal (JSON, indexed)
- Processed knowledge (raw data → learning → neuron)

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

### Example 1: Find Person (Sherry)

**Query:** "Who is Sherry? Where did I meet her?"

**Step 1: Neural Graph**
```bash
python3 -c "
import json
nodes = json.load(open('~/JARVIS/RAW/memories/nodes.json'))
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

**Step 3: Archive (not needed — graph had everything)**
```bash
# Skip — already found person node + learnings
```

**Result:** Instant — Sherry person node, weed cafe, March 15, device #25, learnings linked.

### Example 2: Find Event (Fork Onboarding)

**Query:** "When did Eric fork setup happen?"

**Step 1: Neural Graph**
```bash
python3 -c "
import json
nodes = json.load(open('~/JARVIS/RAW/memories/nodes.json'))
results = [n for n in nodes if 'fork' in n['id'].lower() or 'eric' in n['id'].lower()]
for r in results:
    print(r['id'], r['moments'])
"
# Found: fork-001-eric-live (March 17), fork-setup-troubleshooting (March 18)
```

**Step 2: Learnings**
```bash
grep -ri "fork.*eric" ~/JARVIS/RAW/learnings/
# Found: fork-setup-troubleshooting.md (March 18)
```

**Result:** Instant — March 17 (Eric live), March 18 (learning created).

### Example 3: Find Concept (Sovereignty)

**Query:** "What is 100% sovereign definition?"

**Step 1: Neural Graph**
```bash
python3 -c "
import json
nodes = json.load(open('~/JARVIS/RAW/memories/nodes.json'))
results = [n for n in nodes if 'sovereign' in n['id'].lower()]
for r in results:
    print(r['id'], r['attributes']['description'])
"
# Found: 100-percent-sovereign-definition (complete data ownership, no cloud)
```

**Step 2: Learnings**
```bash
grep -ri "100.*sovereign" ~/JARVIS/RAW/learnings/
# Found: 100-percent-sovereign-definition.md (March 7)
```

**Result:** Instant — concept node + learning file.

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
