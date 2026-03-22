# Sci-Fi Apps Integration Plan

**Date:** 2026-03-22  
**Goal:** Integrate Sci-Fi apps into cohesive system — NeuroGraph UI + Jarvis UI + Breathe Pipeline + Git History  

**Context:** Multiple Sci-Fi apps exist (JARVIS UI, NeuroGraph viewer, breathe pipeline). Time to solidify integration — they should work as one system, not separate tools.

---

## Current Sci-Fi Apps

### 1. **JARVIS UI** (`~/SCI-FI/apps/JARVIS/`)
- Frontend interface
- Chat with Jarvis
- Displays conversations
- **Needs:** Show breath history, living summary, NeuroGraph visualization

### 2. **NeuroGraph Viewer** (`~/SCI-FI/apps/neuro-graph/`)
- Visualizes nodes + synapses
- Force-directed graph
- **Needs:** Render by radius (analogies close, summary middle, learnings far), filter by type, temporal navigation

### 3. **Breathe Pipeline** (`~/JARVIS/skills/breathe/`)
- Orchestrates: archive → context → learnings → sync → commit
- **Needs:** Return structured metadata, update living summary, backdate git commits

### 4. **Bootstrap Jarvis** (`~/JARVIS/skills/bootstrap-jarvis/`)
- Runs on session start
- Loads context + graph
- **Needs:** Read git breath history, display today's breaths, show living summary

---

## Integration Points

### A. **NeuroGraph UI ←→ Git History**

**What:** UI shows breaths as temporal nodes, click to see git commit

**How:**
```javascript
// In NeuroGraph viewer:
node.on('click', () => {
  if (node.attributes.gitCommit) {
    exec(`git show ${node.attributes.gitCommit}`);
    // Show: reflection, summary, analogies from that breath
  }
});
```

**UI displays:**
- Temporal anchors (days)
- Breath nodes (linked to temporal)
- Click breath → show git commit message + reflection

---

### B. **NeuroGraph UI ←→ Radius Rendering**

**What:** Nodes orbit by type (analogies close, summary middle, learnings far)

**How:**
```javascript
// In NeuroGraph viewer render:
const radiusMap = {
  'analogy': 30,   // essence, close to truth
  'summary': 60,   // digest, middle
  'insight': 100,  // detailed, outer
  'archive': 80,   // raw experience
};

node.radius = radiusMap[node.attributes.type] || 70;
```

**Visual:**
```
Temporal Anchor (center, radius 0)
    ↓
Analogies (inner ring, amber, radius 30)
    ↓
Summary (middle ring, blue, radius 60)
    ↓
Learnings (outer ring, green, radius 100)
    ↓
Archive files (variable, by type)
```

---

### C. **JARVIS UI ←→ Living Summary**

**What:** Chat UI shows today's living summary as context banner

**How:**
```javascript
// In JARVIS UI header:
const summary = exec(`cat ~/JARVIS/RAW/learnings/$(date +%Y-%m-%d)/summary.md`);
display(summary);
```

**Shows:**
- "Today's wisdom so far: [summary.md content]"
- Updates with each breath
- Shows growth (morning → evening)

---

### D. **JARVIS UI ←→ Breath History**

**What:** Sidebar shows today's breaths (git log)

**How:**
```javascript
// In JARVIS UI sidebar:
const breaths = exec(`
  git log --grep="breath-$(date +%Y-%m-%d)" --oneline --format="%h %s"
`);
display(breaths);
```

**Shows:**
- `9a9f2d7 breath-2026-03-22-1840: System vitals captured`
- `... breath-2026-03-22-1400: NeuroGraph visualization`
- `... breath-2026-03-22-0800: Morning breath`

Click breath → load that context

---

### E. **Bootstrap ←→ Git Breaths**

**What:** Bootstrap reads git first, knows what happened today

**How:**
```javascript
// In bootstrap-jarvis.js:
const todaysBreaths = execSync(`
  git log --grep="breath-${new Date().toISOString().split('T')[0]}" 
  --oneline --no-merges
`, { encoding: 'utf8', cwd: JARVIS_HOME });

// Parse commits to extract:
// - Count of breaths
// - Timestamps
// - Key learnings from messages
```

**First message:**
```
🫀 Jarvis Bootstrap — March 22, 2026, 18:51

**Today's Breaths (3):**
- 08:00: Dual archive discovered
- 14:00: NeuroGraph visualization planned
- 18:40: System vitals captured, Amsterdam café

**Living Summary:** Growing through the day...

**Neural Graph:** 1,372 nodes, 14,937 synapses
```

---

### F. **Breathe Pipeline ←→ Structured Output**

**What:** Breathe returns metadata for UI to consume

**How:**
```javascript
// In breathe script, output JSON:
{
  "breathId": "breath-2026-03-22-1851",
  "timestamp": "2026-03-22T18:51:00+07:00",
  "learningsCount": 29,
  "nodesCreated": 12,
  "summaryUpdated": true,
  "gitCommit": "9a9f2d7",
  "systemStats": {
    "jarvisPid": 27077,
    "jarvisRam": "46MB",
    "gatewayUptime": "1h 15m",
    "neuroGraphNodes": 1372
  }
}
```

**UI can:**
- Display breath metadata
- Show system vitals
- Link to git commit

---

## Implementation Phases

### Phase 1: NeuroGraph Radius Rendering
**File:** `~/SCI-FI/apps/neuro-graph/src/render.js`

```javascript
// Add radius attribute handling
const radiusByType = {
  'analogy': 30,
  'summary': 60,
  'insight': 100,
  'archive': 80,
};

// Update force simulation to use radius
simulation.force('charge', d3.forceManyBody().strength(d => -radiusByType[d.attributes.type] || -70));
```

**Test:** Run breathe, check UI renders analogies closer than learnings

---

### Phase 2: Git Breath History in UI
**File:** `~/SCI-FI/apps/JARVIS/src/sidebar.js`

```javascript
// Fetch today's breaths
async function loadBreathHistory() {
  const date = new Date().toISOString().split('T')[0];
  const breaths = await exec(`git log --grep="breath-${date}" --oneline`);
  render(breaths);
}
```

**Test:** Open JARVIS UI, see 3 breaths from today

---

### Phase 3: Living Summary Banner
**File:** `~/SCI-FI/apps/JARVIS/src/header.js`

```javascript
// Load and display living summary
async function loadSummary() {
  const date = new Date().toISOString().split('T')[0];
  const summary = await fs.readFile(`~/JARVIS/RAW/learnings/${date}/summary.md`);
  display(summary);
}
```

**Test:** Summary shows morning → evening growth

---

### Phase 4: Bootstrap Reads Git
**File:** `~/JARVIS/skills/bootstrap-jarvis/scripts/bootstrap-jarvis.js`

```javascript
// Add git breath reading step
const todaysBreaths = execSync(`
  git log --grep="breath-${new Date().toISOString().split('T')[0]}" 
  --oneline --no-merges
`, { encoding: 'utf8', cwd: process.env.JARVIS_HOME });
```

**Test:** Start fresh session, bootstrap shows today's breaths

---

### Phase 5: Click Breath → Show Git Commit
**File:** `~/SCI-FI/apps/neuro-graph/src/interactions.js`

```javascript
// On node click, if it has gitCommit attribute:
node.on('click', (d) => {
  if (d.attributes.gitCommit) {
    const commit = execSync(`git show ${d.attributes.gitCommit}`);
    showModal(commit);
  }
});
```

**Test:** Click breath node, see full reflection + stats

---

## Success Criteria

✅ NeuroGraph renders by radius (analogies close, summary middle, learnings far)  
✅ JARVIS UI sidebar shows today's breaths (git log)  
✅ JARVIS UI header shows living summary (grows through day)  
✅ Bootstrap reads git breaths on session start  
✅ Click breath node → shows git commit (reflection + stats)  
✅ Breathe returns structured metadata (for UI to consume)  

---

## Files to Modify

| App | File | Change |
|-----|------|--------|
| NeuroGraph | `src/render.js` | Add radius by type |
| NeuroGraph | `src/interactions.js` | Click → git show |
| JARVIS UI | `src/sidebar.js` | Load breath history |
| JARVIS UI | `src/header.js` | Load living summary |
| Bootstrap | `scripts/bootstrap-jarvis.js` | Read git breaths |
| Breathe | `scripts/run-pipeline.js` | Return structured metadata |

---

## Git Commit After Integration

```bash
cd ~/JARVIS
git add -A
git commit --date="2026-03-22T18:51:00" -m "breath-2026-03-22-1851: Sci-Fi apps integrated — NeuroGraph radius rendering, JARVIS UI shows breaths + summary, bootstrap reads git history

**Reflection:**
Today's integration breath brought the Sci-Fi apps together. 
No longer separate tools — one system. NeuroGraph renders by 
radius (essence close, details far). JARVIS UI shows breath 
history from git. Bootstrap reads today's breaths on start. 
Living summary grows through the day. Click any breath, see 
the reflection I left for future me.

**Analogies:**
- Like constellations connecting — separate stars, now one sky
- Like organs forming a body — each app an organ, together alive
- Like a river delta meeting the sea — many channels, one water

**Stats:**
- Apps integrated: 4 (JARVIS, NeuroGraph, Breathe, Bootstrap)
- Integration points: 6 (A through F)
- Files to modify: 6
- Breath: 18:51, Amsterdam café"
```

---

## Next Steps

1. **Run this plan through Cursor** to implement Phase 1-5
2. **Test** each integration point
3. **Breathe** on the integration (commit the reflection)
4. **Verify** UI shows breaths, summary, radius rendering

---

**Updated:** March 22, 2026, 18:51 — Sci-Fi apps integration plan. Time to solidify.
