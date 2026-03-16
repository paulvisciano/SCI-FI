# Cursor Implementation Prompt - Neurograph File Viewer

**Date:** March 12, 2026  
**Feature:** Inline File Viewer for Neurograph  
**Status:** Ready to implement  

---

## Context

We're building an **inline file viewer** for the Neurograph UI. When you click a file node (audio/image/video), it should preview inline without opening external apps.

**Architecture decision:** Symlinked `~/RAW/archive` to `/Users/paulvisciano/SCI-FI/apps/neuro-graph/archive` so the dev server can serve files over HTTP (same origin, avoids browser `file://` blocking).

---

## What to Build

### 1. File Type Detector

```javascript
// utils/fileTypeDetector.js
export function detectFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const audioExts = ['webm', 'wav', 'mp3', 'ogg'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
  const videoExts = ['mp4', 'webm', 'mov'];
  
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'unknown';
}
```

### 2. Preview Panel Component

```jsx
// components/PreviewPanel.jsx
import { AudioPlayer } from './FileViewer/AudioPlayer';
import { ImageViewer } from './FileViewer/ImageViewer';
import { VideoPlayer } from './FileViewer/VideoPlayer';

export function PreviewPanel({ fileNode, onClose }) {
  const fileType = detectFileType(fileNode.attributes.filePath);
  
  return (
    <div className="preview-panel">
      <button onClick={onClose}>✕ Close</button>
      
      {fileType === 'audio' && <AudioPlayer src={fileNode.attributes.filePath} />}
      {fileType === 'image' && <ImageViewer src={fileNode.attributes.filePath} />}
      {fileType === 'video' && <VideoPlayer src={fileNode.attributes.filePath} />}
      
      <div className="file-info">
        <h3>{fileNode.label}</h3>
        <p>{fileNode.attributes.description}</p>
        <p>Size: {(fileNode.attributes.fileSize / 1024).toFixed(0)} KB</p>
      </div>
    </div>
  );
}
```

### 3. Audio Player Component

```jsx
// components/FileViewer/AudioPlayer.jsx
export function AudioPlayer({ src }) {
  return (
    <div className="audio-player">
      <audio controls src={src} />
      <p>Transcript: {src.replace('.webm', '.txt')}</p>
    </div>
  );
}
```

### 4. Image Viewer Component

```jsx
// components/FileViewer/ImageViewer.jsx
export function ImageViewer({ src }) {
  return (
    <div className="image-viewer">
      <img src={src} alt="Archive image" />
      <button onClick={() => window.open(src, '_blank')}>Open full size</button>
    </div>
  );
}
```

### 5. Video Player Component

```jsx
// components/FileViewer/VideoPlayer.jsx
export function VideoPlayer({ src }) {
  return (
    <div className="video-player">
      <video controls src={src} />
    </div>
  );
}
```

### 6. Integration with Neurograph

**Modify `neural-graph.js`:**
- Add click handler for file nodes
- Open PreviewPanel when file node clicked
- Pass file node data to PreviewPanel

```javascript
// In neural-graph.js, where nodes are rendered
node.on('click', (d) => {
  if (d.category === 'file' && d.attributes.filePath) {
    openPreviewPanel(d);
  }
});
```

---

## File Path Resolution

**Current setup:**
- Symlink: `/Users/paulvisciano/SCI-FI/apps/neuro-graph/archive` → `~/RAW/archive`
- Dev server runs on `http://127.0.0.1:8081`
- Files accessible at: `http://127.0.0.1:8081/archive/YYYY-MM-DD/filename.ext`

**Update `resolvePath()` in `shared/neural-graph.js`:**
```javascript
function resolvePath(path) {
  if (path.startsWith('archive/')) {
    // Serve from symlinked archive folder
    return `http://127.0.0.1:8081/${path}`;
  }
  // ... existing logic
}
```

---

## Test Files Available

**Audio:**
- `/archive/2026-03-12/audio/2026-03-12-154930-recording-1773305247279.webm` (Tim Demo Intro)
- `/archive/2026-03-12/audio/2026-03-12-161649-recording-1773306875063.webm` (Tim Reaction)

**Images:**
- `/archive/2026-03-12/images/2026-03-12-162954-Photo on 3-12-26 at 4.26 PM.jpg` (Tim Demo Photo)
- Multiple Neurograph screenshots (4.25-5.04 PM)

**Use these to test the viewer.**

---

## UI States

### Vault Connected (Normal)
```
[Graph visible] + [Preview Panel docked right]
Click file node → Preview opens inline
```

### Vault Disconnected (Graceful Degradation)
```
[Graph visible] + [Toast: "Archive not available - connect external drive"]
Click file node → Toast message, no preview
```

---

## Success Criteria

✅ Click file node → PreviewPanel opens  
✅ Correct viewer loads based on file type  
✅ Audio plays inline (no external app)  
✅ Image displays inline (zoom works)  
✅ Video plays inline (controls work)  
✅ Close button works  
✅ File info displays (size, description)  
✅ Graceful degradation when archive unavailable  

---

## Implementation Order

1. **Create component structure** (FileViewer folder, 3 player components)
2. **Build PreviewPanel** (type detection, routing to correct viewer)
3. **Integrate with graph** (click handler on file nodes)
4. **Test with Tim demo files** (audio + photo)
5. **Add polish** (keyboard shortcuts, multiple file queue)

---

## Start Now

**Begin with:** Create the component structure and build AudioPlayer first (simplest).

**Test:** Click Tim Demo Intro audio node → should play inline.

**Then:** Iterate through ImageViewer, VideoPlayer, polish.

---

**Reference:**
- Implementation Plan: `/Users/paulvisciano/SCI-FI/apps/neuro-graph/.cursor/plans/IMPLEMENTATION_PLAN.md`
- Symlink: `/Users/paulvisciano/SCI-FI/apps/neuro-graph/archive` → `~/RAW/archive`
- Learning Node: `neurograph-file-viewer-vision` (in neurograph)
