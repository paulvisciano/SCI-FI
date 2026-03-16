# Voice Pipeline Server - UI Polling 404 Bug Fix

## The Bug

**Symptom:** After recording completes, the UI starts getting 404 errors when polling `/transcript/latest`.

**When it happens:**
1. User records audio → uploads to `/upload`
2. Server transcribes (WebM → WAV → Whisper → .wav.txt)
3. Transcription completes → archive runs
4. UI polls `/transcript/latest` → **404** (file gone)

**Impact:** UI shows "No transcript found" even though transcription succeeded.

---

## Root Cause

**Race condition:** Archive runs **immediately after transcription completes**, but the UI is still polling that file.

**The UI polling logic** (`index.html`):
```javascript
// Poll every 2 seconds, up to 120 attempts (2 minutes)
let pollAttempts = 0;
const pollInterval = setInterval(async () => {
    pollAttempts++;
    const status = await fetch('/transcript/latest');
    // ... process response
    if (pollAttempts >= 120) clearInterval(pollInterval);
}, 2000);
```

**The archive logic** (in `handleTranscript`):
```javascript
// Currently runs immediately after transcription
archiveOldFilesFromLive();
```

**The problem:**
- Transcription completes at T+5s
- Archive runs at T+5s → moves file to `~/RAW/archive/`
- UI polls at T+6s, T+8s, T+10s... → **404** (file archived)

---

## Desired Behavior

**Keep the newest completed file in `live/`** so UI can poll it successfully.

**Archive only older completed files** (not the latest one).

**Logic:**
```
live/ folder contains:
  - recording-1773469900.wav.txt  ← NEWEST (keep for UI polling)
  - recording-1773469800.wav.txt  ← Older (archive)
  - recording-1773469700.wav.txt  ← Older (archive)
```

**When to archive:**
- After transcription completes
- Find all `.wav.txt` files in `live/`
- Sort by timestamp (newest first)
- Skip the first (newest)
- Archive the rest

---

## Current Code State

**File:** `/Users/paulvisciano/SCI-FI/apps/JARVIS/voice-pipeline-server.js`

**Current version:** Shows `1.1.6` but may have been reverted to `1.1.2`

**Current archive function** (incomplete/broken):
```javascript
function archiveOldFilesFromLive() {
    const liveFiles = fs.readdirSync(CONFIG.liveDir);
    const transcriptFiles = liveFiles.filter(f => f.endsWith('.wav.txt'));
    
    // BUG: Archives ALL completed files, including the newest
    for (const txtFile of transcriptFiles) {
        // Moves to archive...
    }
}
```

**Where it's called:**
```javascript
function handleTranscript(filepath, transcript, extension) {
    // ... saves transcript ...
    
    // BUG: Called immediately, archives the file UI is still polling
    archiveOldFilesFromLive();
    
    // ... send to main agent ...
}
```

---

## The Fix

**Modify `archiveOldFilesFromLive()`** to skip the newest completed file:

```javascript
function archiveOldFilesFromLive() {
    const today = new Date().toISOString().split('T')[0];
    const archiveAudioDir = path.join(CONFIG.archiveBase, today, 'audio');
    
    if (!fs.existsSync(archiveAudioDir)) {
        fs.mkdirSync(archiveAudioDir, { recursive: true });
    }
    
    const liveFiles = fs.readdirSync(CONFIG.liveDir);
    if (liveFiles.length === 0) return;
    
    // Only look at completed files (.wav.txt)
    const transcriptFiles = liveFiles.filter(f => f.endsWith('.wav.txt'));
    if (transcriptFiles.length === 0) return;
    
    // Sort by timestamp (newest first)
    const sortedFiles = transcriptFiles.map(f => {
        const match = f.match(/recording-(\d+)\.wav\.txt/);
        return { file: f, ts: match ? parseInt(match[1]) : 0 };
    }).sort((a, b) => b.ts - a.ts);
    
    // Skip the NEWEST (index 0) - UI is still polling it
    // Archive only older files (index 1+)
    const filesToArchive = sortedFiles.slice(1);
    
    if (filesToArchive.length === 0) {
        console.log('ℹ️ Only 1 completed file in live/ - keeping for UI polling');
        return;
    }
    
    console.log(`🧹 Archiving ${filesToArchive.length} older files (keeping newest)`);
    
    for (const item of filesToArchive) {
        const baseName = item.file.replace('.wav.txt', '');
        const filesToMove = [item.file, `${baseName}.wav`, `${baseName}.webm`];
        
        for (const file of filesToMove) {
            const srcPath = path.join(CONFIG.liveDir, file);
            const destPath = path.join(archiveAudioDir, file);
            if (fs.existsSync(srcPath)) {
                try {
                    fs.renameSync(srcPath, destPath);
                    console.log(`  ✓ Archived: ${file}`);
                } catch (err) {
                    console.error(`  ❌ Failed to archive ${file}:`, err.message);
                }
            }
        }
    }
}
```

**Keep the call in `handleTranscript()`** - it should run after transcription, just smarter about what it archives.

---

## Testing

**After applying fix:**
1. Restart server: `launchctl restart ai.jarvis.voice-server`
2. Hard refresh browser: Cmd+Shift+R
3. Record audio
4. Watch console logs:
   - `🎤 Transcribing: recording-17734xxxxxx.webm`
   - `📝 Transcript: <text>`
   - `🧹 Archiving 0 older files (keeping newest)` ← Should say 0 on first recording
5. Check UI: Should show transcript, no 404s
6. Record again:
   - `🧹 Archiving 1 older files (keeping newest)` ← Should archive previous
   - UI should still work (polling the new file)

**Verify:**
- `live/` folder: Always has 1 completed file (the latest)
- `~/RAW/archive/YYYY-MM-DD/audio/`: Accumulating older files
- UI console: No 404s on `/transcript/latest`

---

## Files to Modify

**Primary:** `/Users/paulvisciano/SCI-FI/apps/JARVIS/voice-pipeline-server.js`

**Function:** `archiveOldFilesFromLive()`

**Lines:** Around line 480-520 (check current file for exact location)

---

## Context

**Architecture:**
- `live/` = Staging folder (current recording being processed)
- `~/RAW/archive/YYYY-MM-DD/audio/` = Permanent storage
- UI polls `/transcript/latest` every 2s for up to 2 minutes
- Archive should run after transcription, but keep newest for UI

**Version history:**
- v1.1.2: No auto-archive (stable, but manual cleanup needed)
- v1.1.3-v1.1.5: Tried auto-archive, introduced race condition
- v1.1.6: Should fix race condition (keep newest, archive older)

---

## Apply This Fix

**Steps:**
1. Open `/Users/paulvisciano/SCI-FI/apps/JARVIS/voice-pipeline-server.js` in Cursor
2. Find `archiveOldFilesFromLive()` function
3. Replace with the fixed version above
4. Verify `const VERSION = '1.1.6'`
5. Restart: `launchctl restart ai.jarvis.voice-server`
6. Test recording → should work without 404s

---

**Created:** 2026-03-14 13:41 GMT+7
**Author:** Jarvis (via Paul's instruction)
