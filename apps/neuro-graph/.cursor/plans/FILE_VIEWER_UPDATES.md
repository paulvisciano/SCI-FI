# Neurograph File Viewer - Code Updates

**Date:** March 12, 2026  
**Issue:** File viewer not triggering on archive nodes + temporal nodes should show all content  

---

## Problem 1: Archive Nodes Not Triggering Viewer

**Current code checks:**
```javascript
if (d.category === 'file' && d.attributes.filePath) {
  openFilePreview(d);
}
```

**Reality:** Today's audio nodes have:
- `category: "archive"` (not "file")
- `attributes.filePath: "RAW/archive/2026-03-12/audio/..."`
- `attributes.fileType: "audio"`

**Fix:** Update click handler to check for both categories:

```javascript
// In neural-graph.js, canvas click handler
node.on('click', (d) => {
  // File preview: check for file OR archive category with file attributes
  if ((d.category === 'file' || d.category === 'archive') && 
      d.attributes && 
      (d.attributes.filePath || d.attributes.rawContentPath)) {
    openFilePreview(d);
    return;
  }
  
  // ... existing temporal/learning logic
});
```

---

## Problem 2: Temporal Nodes Should Show All Content

**Current behavior:** Temporal node click → zooms graph to that day

**Enhanced behavior:** Temporal node click → shows **all content from that day** (files + learnings)

**Data structure:**
```javascript
// Temporal node example
{
  id: "march-12-2026",
  label: "March 12, 2026",
  category: "temporal",
  attributes: {
    role: "temporal",
    date: "2026-03-12"
  }
}
```

**Need:** Query all nodes linked to this temporal node, group by type, display in preview panel.

---

## Solution: Enhanced Preview System

### 1. Update `openFilePreview()` to Handle Multiple Types

```javascript
// components/PreviewPanel.jsx (or inline in neural-graph.js)
function openFilePreview(node) {
  const panel = document.getElementById('file-preview-panel');
  
  // Clear previous content
  panel.innerHTML = '';
  
  // Handle temporal nodes (show all content from that day)
  if (node.category === 'temporal') {
    openTemporalPreview(node, panel);
    return;
  }
  
  // Handle file/archive nodes (single file preview)
  if ((node.category === 'file' || node.category === 'archive') && 
      node.attributes && 
      (node.attributes.filePath || node.attributes.rawContentPath)) {
    openSingleFilePreview(node, panel);
    return;
  }
  
  // Handle learning nodes (show learning details)
  if (node.category === 'learning') {
    openLearningPreview(node, panel);
    return;
  }
}
```

### 2. Temporal Preview (All Content from Day)

```javascript
function openTemporalPreview(temporalNode, panel) {
  const date = temporalNode.attributes.date || temporalNode.label.toLowerCase().replace('march ', '2026-03-');
  
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
  
  panel.innerHTML = `
    <div class="temporal-preview">
      <button class="close-btn" onclick="closePreview()">✕</button>
      <h2>${temporalNode.label}</h2>
      <p class="date">${date}</p>
      
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
                <div class="learning-type">${l.attributes.subtype || l.attributes.type}</div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
      
      <div class="stats">
        <span>Total: ${linkedNodes.length} nodes</span>
        <span>Files: ${files.length}</span>
        <span>Learnings: ${learnings.length}</span>
      </div>
    </div>
  `;
  
  // Make file cards clickable
  panel.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('click', () => {
      const nodeId = card.dataset.nodeId;
      const node = nodes.find(n => n.id === nodeId);
      openSingleFilePreview(node, panel);
    });
  });
}
```

### 3. Single File Preview (Updated Attribute Handling)

```javascript
function openSingleFilePreview(node, panel) {
  const filePath = node.attributes.filePath || 
                   node.attributes.rawContentPath || 
                   node.attributes.file_url || 
                   '';
  
  if (!filePath) {
    panel.innerHTML = '<p>No file path found</p>';
    return;
  }
  
  // Resolve path for HTTP serving
  const resolvedPath = resolvePath(filePath);
  const fileType = detectFileType(filePath);
  
  panel.innerHTML = `
    <div class="single-file-preview">
      <button class="close-btn" onclick="closePreview()">✕</button>
      
      <div class="media-container">
        ${renderMedia(fileType, resolvedPath)}
      </div>
      
      <div class="file-info">
        <h3>${node.label}</h3>
        <p class="description">${node.attributes.description || 'No description'}</p>
        <div class="metadata">
          <span class="type">📁 ${fileType}</span>
          <span class="size">💾 ${(node.attributes.fileSize / 1024).toFixed(0)} KB</span>
          <span class="date">📅 ${node.attributes.created || 'Unknown date'}</span>
        </div>
        <div class="path">
          <code>${filePath}</code>
          <button onclick="copyPath('${filePath}')">Copy</button>
        </div>
        <a href="${resolvedPath}" target="_blank" class="open-btn">Open in new tab</a>
      </div>
    </div>
  `;
}

function renderMedia(fileType, src) {
  switch(fileType) {
    case 'audio':
      return `<audio controls src="${src}" autoplay>Your browser does not support audio</audio>`;
    case 'image':
      return `<img src="${src}" alt="Archive image" style="max-width: 100%;" />`;
    case 'video':
      return `<video controls src="${src}" autoplay>Your browser does not support video</video>`;
    default:
      return `<p>Unknown file type: ${fileType}</p>`;
  }
}
```

### 4. Learning Preview

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
            <button onclick="openSource('${node.attributes.sourceDocument}')">Open</button>
          </div>
        ` : ''}
        
        ${node.moments && node.moments.length ? `
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

### 5. Path Resolution Update

```javascript
// In shared/neural-graph.js, resolvePath function
function resolvePath(path) {
  if (!path || typeof path !== 'string') return path;
  
  // Handle archive paths (symlinked folder)
  if (path.startsWith('RAW/archive/')) {
    return `/archive/${path.replace('RAW/archive/', '')}`;
  }
  
  // Handle learnings paths (public, in git)
  if (path.startsWith('RAW/learnings/')) {
    return `/learnings/${path.replace('RAW/learnings/', '')}`;
  }
  
  // Handle absolute paths
  if (path.startsWith('/')) {
    return path;
  }
  
  // Handle BASE_URL placeholders
  if (path.includes('{BASE_URL}')) {
    return path.replace('{BASE_URL}', BASE_URL);
  }
  
  return path;
}
```

---

## Implementation Order

1. **Fix archive category check** (5 min) - allows existing file nodes to work
2. **Add temporal preview** (30 min) - shows all content from a day
3. **Add learning preview** (15 min) - shows learning details
4. **Style polish** (15 min) - make it look good

---

## Test Plan

**Test 1:** Click "Tim Demo Intro (15:49)" file node → audio plays inline  
**Test 2:** Click "March 12, 2026" temporal node → shows all 49 audio files + 6 learnings  
**Test 3:** Click any learning node → shows learning details + source document  

---

## Paste This Into Cursor

"Update the file viewer implementation to:
1. Check for `category === 'archive'` in addition to `'file'` when opening file preview
2. Add `openTemporalPreview()` function that shows all content linked to a temporal node
3. Add `openLearningPreview()` function that shows learning node details
4. Update `resolvePath()` to handle `RAW/archive/` prefix correctly

See the attached spec for full implementation details."
