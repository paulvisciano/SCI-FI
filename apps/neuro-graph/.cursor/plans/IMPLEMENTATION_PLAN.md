# Neurograph File Viewer - Cursor Implementation Plan

**Created:** March 12, 2026, 17:00 GMT+7  
**Author:** Jarvis (via Paul Visciano)  
**Status:** Ready for Cursor implementation  
**Location:** `/Users/paulvisciano/SCI-FI/apps/neuro-graph/.cursor/plans/`

---

## Vision

**Inline file preview within Neurograph UI** - Click any file node → preview plays inline (audio/photo/video) without external apps or context switching.

**Goal:** Recollect moments by experiencing content directly. Graph shows structure, viewer shows substance.

---

## Technical Requirements

### 1. File Type Detection
- **Audio:** `.webm`, `.wav`, `.mp3`, `.ogg`
- **Image:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`
- **Video:** `.mp4`, `.webm`, `.mov`

### 2. Inline Preview Components
Each file type gets its own viewer component, all render inline next to the neuron:

#### Audio Viewer
- Play/pause controls
- Waveform visualization (optional)
- Duration display
- Transcript toggle (if .txt exists alongside audio)

#### Image Viewer
- Full-size preview on click
- Zoom/pan controls
- OCR text overlay toggle (if .txt exists)
- Caption display

#### Video Viewer
- Play/pause controls
- Timeline scrubber
- Fullscreen toggle
- Transcript sync (if available)

### 3. Integration Points
- **Neuron click:** File node → opens preview panel
- **Preview panel:** Docked next to graph (right sidebar or modal)
- **Multiple files:** Queue/playlist for sequential viewing
- **Keyboard shortcuts:** Space (play/pause), Esc (close), Arrow keys (navigate)

### 4. Architecture
```
neuro-graph/
├── .cursor/
│   └── plans/
│       └── file-viewer/
│           └── IMPLEMENTATION_PLAN.md (this file)
├── components/
│   ├── FileViewer/
│   │   ├── AudioPlayer.jsx
│   │   ├── ImageViewer.jsx
│   │   └── VideoPlayer.jsx
│   └── PreviewPanel.jsx
├── hooks/
│   └── useFilePreview.js
└── utils/
    └── fileTypeDetector.js
```

---

## Test Files Available

### Audio (March 12, 2026)
- `~/RAW/archive/2026-03-12/audio/2026-03-12-154930-recording-1773305247279.webm` (Tim Demo Intro, 414 KB)
- `~/RAW/archive/2026-03-12/audio/2026-03-12-161649-recording-1773306875063.webm` (Tim Reaction, 1,042 KB)

### Images (March 12, 2026)
- `~/RAW/archive/2026-03-12/images/2026-03-12-162954-Photo on 3-12-26 at 4.26 PM.jpg` (Tim Demo Photo, 171 KB)
- Multiple screenshots from Neurograph UI (4.25-4.58 PM)

### Video
- Paul's video from previous day (check `~/RAW/archive/2026-03-11/`)

---

## Reference Screenshots

Just archived (March 12, 4.50-4.58 PM):
- `~/RAW/archive/2026-03-12/images/` - 5 screenshots of current Neurograph UI
- Use these as reference for integration points

---

## Implementation Phases

### Phase 1: Foundation (Day 1)
- Create `FileViewer` component with type detection
- Implement `AudioPlayer` component
- Basic preview panel (docked right sidebar)

### Phase 2: Image Support (Day 2)
- Implement `ImageViewer` component
- Zoom/pan functionality
- OCR text overlay toggle

### Phase 3: Video Support (Day 3)
- Implement `VideoPlayer` component
- Timeline scrubber
- Fullscreen mode

### Phase 4: Polish (Day 4)
- Keyboard shortcuts
- Multiple file queue
- Transcript sync
- Performance optimization

---

## Success Criteria

✅ Click file node → preview opens inline  
✅ No external apps launched  
✅ All three types work (audio/image/video)  
✅ Smooth UX (no lag, clean transitions)  
✅ Works with existing Neurograph graph  

---

## Next Steps

1. **Run this plan through Cursor** (Paul to trigger)
2. **Implement Phase 1** (Audio player + foundation)
3. **Test with Tim demo audio files**
4. **Iterate through Phases 2-4**
5. **Deploy to production Neurograph**

---

**Learning Node Reference:** `neurograph-file-viewer-vision` (created March 12, 2026)  
**Transcript Source:** `~/RAW/archive/2026-03-12/transcript.md` (16:51 GMT+7 entry)  
**Neurograph State:** 1,262 nodes, 2,187 synapses (March 12, 2026)
