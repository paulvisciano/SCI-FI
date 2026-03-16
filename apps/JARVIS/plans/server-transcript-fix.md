# Server Code Fix Plan — Transcript Fetch 404s + Stability

**Created:** March 14, 2026, 14:19 GMT+7  
**Project:** ~/SCI-FI/apps/JARVIS  
**Priority:** High (blocking UI functionality)

---

## The Problem

**Symptom:** UI showing 404 errors when fetching latest transcript. Started when server code modifications were attempted.

**Cascade:**
1. Transcript fetch 404s
2. Spiraled into OpenClaw process errors
3. Session corruption
4. Amnesia state
5. Required hard reset (gateway + Jarvis process kill + bootstrap)

**Root cause hypothesis:** Server code edits broke the transcript endpoint or file serving logic.

---

## What Needs Fixing

### 1. Transcript Endpoint

**File:** `voice-pipeline-server.js`  
**Issue:** `/transcript` or `/latest-transcript` endpoint returning 404

**Expected behavior:**
- GET `/transcript` → Returns today's transcript.md content
- GET `/transcript/:date` → Returns specific date transcript
- Content-Type: `text/markdown` or `text/plain`
- Path: `~/RAW/archive/YYYY-MM-DD/transcript.md`

**Check:**
- Route registration (app.get('/transcript', ...))
- File path resolution (tilde expansion, date formatting)
- Error handling (file not found → 404 with message)
- CORS headers (if UI is on different origin)

### 2. Server Stability

**File:** `voice-pipeline-server.js`  
**Issue:** Server entering bad state after code changes

**Requirements:**
- Graceful error handling (don't crash on file not found)
- Request logging (see what's being hit)
- Health endpoint working (`/health`)
- Upload endpoint working (`/upload`)
- Transcription pipeline intact

### 3. UI Integration

**File:** `index.html` (or React component)  
**Issue:** UI expecting transcript endpoint, getting 404s

**Verify:**
- Frontend fetch URL matches backend route
- Error handling in UI (show meaningful message, not just 404)
- Polling logic (if any) not hammering dead endpoint

---

## Constraints

- **Do not break:** Upload pipeline, transcription, archive workflow
- **Keep working:** HTTPS (self-signed), localhost:3001, whisper-cpp integration
- **Preserve:** Offline mode functionality (proven March 14, 12:41-12:49)
- **Test:** Health endpoint, upload endpoint, transcript endpoint

---

## Implementation Steps

### Step 1: Audit Current Server Code

```bash
cd ~/SCI-FI/apps/JARVIS
cat voice-pipeline-server.js | grep -A 10 "transcript"
```

Find all transcript-related routes. Identify what broke.

### Step 2: Fix Transcript Endpoint

Ensure this route exists and works:
```javascript
app.get('/transcript', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const transcriptPath = path.join(os.homedir(), 'RAW/archive', today, 'transcript.md');
  
  try {
    const content = await fs.promises.readFile(transcriptPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Transcript not found', date: today });
    } else {
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  }
});
```

### Step 3: Add Defensive Logging

Add request logging to see what's being hit:
```javascript
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});
```

### Step 4: Test All Endpoints

```bash
# Health check
curl -sk https://localhost:3001/health

# Transcript fetch
curl -sk https://localhost:3001/transcript

# Upload test
curl -sk -F "file=@test.webm" https://localhost:3001/upload
```

### Step 5: Restart Server

```bash
# Kill old process
lsof -ti:3001 | xargs kill -9

# Start fresh
cd ~/SCI-FI/apps/JARVIS
node voice-pipeline-server.js &

# Verify
curl -sk https://localhost:3001/health
```

---

## Definition of Done

- ✅ `/health` returns 200 OK with status info
- ✅ `/transcript` returns today's transcript (or 404 with helpful message)
- ✅ `/upload` accepts webm/wav files, triggers transcription
- ✅ Server runs stable (no crashes, no 404 spirals)
- ✅ UI can fetch transcript without errors
- ✅ Offline mode still works (no cloud dependencies)

---

## Handoff Notes

**Jarvis role:**
- UI iteration (timestamps, styling, UX polish)
- Memory curation (neurograph, learnings, commits)
- Voice interaction (transcription, archive, response)
- Plan creation (this document)

**Cursor role:**
- Server code mutations (voice-pipeline-server.js)
- Backend logic (endpoints, routes, file handling)
- Process architecture (error handling, logging, stability)
- Implementation of this plan

**Review process:**
1. Cursor implements fixes
2. Jarvis tests endpoints
3. Jarvis verifies UI integration
4. Commit + deploy
5. Update neurograph if new learning emerges

---

**Linked to:** March 14 spiral recovery, UI vs server division of labor breakthrough
