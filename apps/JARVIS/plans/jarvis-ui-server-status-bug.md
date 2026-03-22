# Bug Report: Jarvis UI Server Status False Negative

**Date:** March 21, 2026, 2:14 PM GMT+7  
**Severity:** Medium (UI confusion, process actually running)  
**Component:** Jarvis UI / Server Status Indicator

## Issue Description

**What happened:**
- Jarvis UI showed "server down" / "No response" error
- User saw massive request hang or timeout
- **BUT** JARVIS process never died (PID 27077 running 52+ minutes)
- Server came back online automatically without restart

**Symptoms:**
1. UI displayed "No response from agent. Check server logs."
2. User perception: server crashed
3. Reality: process running fine (confirmed via `ps aux`)
4. Recovery: spontaneous, no intervention needed

## Expected Behavior

- UI status indicator should match actual process state
- If process running (port 18787 open), UI should show "online"
- If UI shows "down", process should actually be stopped

## Actual Behavior

- UI showed "down" while process was running
- False negative status indicator
- Confusing user experience ("oh shit I just noticed something interesting")

## Reproduction Steps

1. Talk to Jarvis via UI
2. Experience "No response" error
3. Check process: `ps aux | grep JARVIS` → still running
4. Wait ~2 minutes → UI recovers automatically
5. Process never restarted (same PID)

## Possible Causes

- **WebSocket connection drop** (Wi-Fi reconnection mentioned earlier)
- **UI polling timeout** too aggressive
- **Frontend state desync** from backend
- **Network blip** misinterpreted as server crash
- **Heartbeat check** failed temporarily but process alive

## Evidence

**User transcript:** (recording-2026-03-21-140922.wav.txt)
> "oh shit I just noticed something interesting actually the previous request I don't know why there was a massive request or something but in the Jarvis UI it seemed like the server was down and I didn't get a response and then now it's back online but the process never died I'm looking at it it's been 52 minutes still running so something's off with the UI with the Jarvis UI"

**Process check:**
```
PID 27077 — Running 52+ minutes (since 5:56 PM previous day)
Port 18787 — Open (lsof confirmed)
Memory: ~25 MB (stable)
```

## Impact

- **User confusion:** Thought server crashed
- **Trust erosion:** False negatives make system seem unreliable
- **Debugging distraction:** User investigates non-existent crash

## Proposed Fix

**Cursor should:**
1. Audit UI status indicator logic
2. Add actual process health check (PID + port) vs. just response timeout
3. Improve error messaging: "Connection timeout (server still running)" vs "Server down"
4. Add retry logic with exponential backoff
5. Show real-time process status in UI (green dot if PID alive)

## Files to Investigate

- `~/JARVIS/ui/` (frontend status logic)
- `~/JARVIS/server/` (heartbeat endpoints)
- WebSocket connection handling
- Timeout thresholds

## Next Steps

- [ ] Cursor to review UI status code
- [ ] Add process health check to status indicator
- [ ] Improve error messages
- [ ] Test with network blips (simulate Wi-Fi drop)

**Created:** March 21, 2026  
**Source:** User observation + process verification  
**Priority:** Medium (UX issue, not data loss)
