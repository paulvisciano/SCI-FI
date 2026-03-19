# Server Timeout & UI Handling Fix

## Project
JARVIS Voice UI (`$PROJECT_ROOT` or `./`)

## Problem
When a query takes too long (4+ minutes), the UI shows:
1. "Health checkpoint failed"
2. On refresh, appears "server offline" (but server is still running)
3. Response never reaches the user even when complete

## Root Cause
Client-side timeout handling is broken:
- Polling for `done` status that never arrives
- Shows "server offline" incorrectly when just waiting
- Doesn't recover when response finally arrives

## Fix Scope

### Backend (voice-server.js or equivalent)
1. **Long-running task handling**
   - Return immediate acknowledgment with task ID
   - Stream progress updates during processing
   - Proper heartbeat/keep-alive during long operations
   - Timeout configuration (default 5 minutes, configurable)

2. **Health checkpoint**
   - Don't fail health check during legitimate long operations
   - Distinguish "server down" from "processing"

### Frontend (app.js or UI framework)
1. **Polling logic**
   - Increase timeout to 5 minutes minimum
   - Show "processing" state, not "server offline"
   - Progress indicator with elapsed time
   - Recover gracefully when response arrives

2. **UX improvements**
   - "Still working..." message after 30 seconds
   - Show elapsed time counter
   - Option to continue waiting or check results later

## Files to Check
- voice-server.js (or project's server file)
- app.js (or project's UI file)
- voice-pipeline.js (or transcription handler)

## Testing
1. Trigger 4+ minute query
2. Verify UI shows "processing" not "offline"
3. Verify response delivers when complete
4. Verify health check passes during long operation

---

**Created:** March 19, 2026, 12:00 PM GMT+7  
**Skill:** `cursor-plan` (project-agnostic, privacy-safe)  
**Location:** `$PROJECT_ROOT/plans/` (or `./plans/`)
