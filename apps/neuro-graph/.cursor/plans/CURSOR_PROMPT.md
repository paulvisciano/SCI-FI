# Cursor Prompt: Fix File Viewer + Add Temporal/Learning Preview

**Date:** March 12, 2026  
**Priority:** High - unblocks file viewer testing  

---

## Context

We built an inline file viewer for Neurograph but it's not working because:
1. File nodes have `category: "archive"` but code checks for `category: "file"`
2. Temporal nodes should show ALL content from that day (files + learnings)
3. Learning nodes should show details when clicked

**Architecture:** Symlinked `~/RAW/archive` → `/Users/paulvisciano/SCI-FI/apps/neuro-graph/archive` so files serve over HTTP (`http://127.0.0.1:8081/archive/...`)

---

## What to Fix

### 1. Fix Archive Category Check (5 min)

**File:** `neural-graph.js` (canvas click handler)

**Current:**
```javascript
if (d.category === 'file' && d.attributes.filePath) {
  openFilePreview(d);
}
```

**Change to:**
```javascript
if ((d.category === 'file' || d.category === 'archive') && 
    d.attributes && 
    (d.attributes.filePath || d.attributes.rawContentPath)) {
  openFilePreview(d);
}
```

**Why:** Today's 49 audio nodes have `category: "archive"` with `attributes.filePath`. This unblocks testing immediately.

---

### 2. Add Temporal Preview (30 min)

**File:** `neural-graph.js` (add new function)

**Behavior:** Click temporal node ("March 12, 2026") → shows ALL content from that day

**Implementation:**
```javascript
function openTemporalPreview(temporalNode, panel) {
  // Find date from node label or attributes
  const date = temporalNode.attributes.date || extractDateFromLabel(temporalNode.label);
  
  // Query all nodes linked to this temporal node
  const linkedNodes = nodes.filter(n => {
    const synapse = synapses.find(s => 
      (s.source === n.id && s.target === temporalNode.id) ||
      (s.target === n.id && s.source === temporalNode.id)
    );
    return synapse && ['learned-today', 'recorded-today', 'archived-in'].includes(synapse.type);
  });
  
  // Group by category
  const files = linkedNodes.filter(n => n.category === 'file' || n.category === 'archive');
  const learnings = linkedNodes.filter(n => n.category === 'learning');
  
  // Render grid view
  panel.innerHTML = `
    <div class="temporal-preview">
      <button class="close-btn" onclick="closePreview()">✕</button>
      <h2>${temporalNode.label}</h2>
      
      <div class="content-sections">
        <section class="files-section">
          <h3>📁 Files (${files.length})</h3>
          <div class="file-grid">
            ${files.map(f => `
              <div class="file-card" data-node-id="${f.id}">
                <div class="file-icon">${getIconForType(f.attributes.fileType)}</div>
                <div class="file-label">${f.label}</div>
                <div class="file-meta">${(f.attributes.fileSize / 1024).toFixed(0)} KB</div>
              </div>
            `).join('')}
          </div>
        </section>
        
        <section class="learnings-section">
          <h3>🧠 Learnings (${learnings.length})</h3>
          <div class="learning-list">
            ${learnings.map(l => `
              <div class="learning-card" data-node-id="${l.id}">
                <div class="learning-label">${l.label}</div>
                <div class="learning-type">${l.attributes.subtype}</div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
      
      <div class="stats">
        Total: ${linkedNodes.length} nodes | 
        Files: ${files.length} | 
        Learnings: ${learnings.length}
      </div>
    </div>
  `;
  
  // Make file cards clickable → opens single file preview
  panel.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('click', () => {
      const nodeId = card.dataset.nodeId;
      const node = nodes.find(n => n.id === nodeId);
      openSingleFilePreview(node, panel);
    });
  });
}
```

---

### 3. Add Learning Preview (15 min)

**File:** `neural-graph.js` (add new function)

**Behavior:** Click learning node → shows learning details

**Implementation:**
```javascript
function openLearningPreview(node, panel) {
  panel.innerHTML = `
    <div class="learning-preview">
      <button class="close-btn" onclick="closePreview()">✕</button>
      
      <div class="learning-header">
        <span class="learning-badge">${node.attributes.subtype || node.attributes.type}</span>
        <h2>${node.label}</h2>
      </div>
      
      <div class="learning-content">
        <p class="description">${node.attributes.description}</p>
        
        ${node.attributes.sourceDocument ? `
          <div class="source">
            <h4>Source Document</h4>
            <code>${node.attributes.sourceDocument}</code>
          </div>
        ` : ''}
        
        ${node.moments ? `
          <div class="moments">
            <h4>Moments</h4>
            <div class="moment-tags">
              ${node.moments.map(m => `<span class="tag">${m}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
```

---

### 4. Update Main Preview Router

**File:** `neural-graph.js` (update `openFilePreview` or equivalent)

```javascript
function openFilePreview(node, panel) {
  // Route based on category
  if (node.category === 'temporal') {
    openTemporalPreview(node, panel);
    return;
  }
  
  if (node.category === 'learning') {
    openLearningPreview(node, panel);
    return;
  }
  
  if ((node.category === 'file' || node.category === 'archive') && 
      node.attributes && 
      (node.attributes.filePath || node.attributes.rawContentPath)) {
    openSingleFilePreview(node, panel);
    return;
  }
  
  // Fallback
  panel.innerHTML = '<p>Preview not available for this node type</p>';
}
```

---

### 5. Fix Path Resolution

**File:** `shared/neural-graph.js` (resolvePath function)

**Add:**
```javascript
function resolvePath(path) {
  if (!path || typeof path !== 'string') return path;
  
  // Handle archive paths (symlinked folder)
  if (path.startsWith('RAW/archive/')) {
    return `/archive/${path.replace('RAW/archive/', '')}`;
  }
  
  // Handle learnings paths
  if (path.startsWith('RAW/learnings/')) {
    return `/learnings/${path.replace('RAW/learnings/', '')}`;
  }
  
  // ... existing BASE_URL logic
}
```

---

## Test Plan

**After implementation, test:**

1. **File node:** Click "Tim Demo Intro (15:49)" → audio player loads inline ✅
2. **Temporal node:** Click "March 12, 2026" → shows 49 files + 6 learnings grid ✅
3. **Learning node:** Click "Inbox Processing Bug Fixed" → shows details ✅
4. **Path resolution:** Verify audio plays (no 404 errors) ✅

---

## Files to Modify

- `neural-graph.js` (main graph logic, click handlers, preview functions)
- `shared/neural-graph.js` (path resolution)
- Optional: `index.html` (CSS styles for new preview panels)

---

## Start Now

**Begin with:** Fix #1 (archive category check) - unblocks testing in 5 minutes.

**Then:** Implement temporal preview (most valuable feature).

**Finally:** Add learning preview + path resolution polish.

---

**Reference:**
- Full spec: `/Users/paulvisciano/SCI-FI/apps/neuro-graph/.cursor/plans/FILE_VIEWER_UPDATES.md`
- Symlink: `/Users/paulvisciano/SCI-FI/apps/neuro-graph/archive` → `~/RAW/archive`
- Test files: Tim Demo Intro audio, Tim Reaction audio, March 12 temporal node
