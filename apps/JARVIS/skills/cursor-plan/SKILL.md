---
name: cursor-plan
description: Create development plans for Cursor AI to implement in any project. Use when: (1) documenting bugs, (2) planning features, (3) creating fix specifications, (4) preparing PRDs. Plans are stored in the project's `plans/` folder (or specified location). Works for any codebase: voice UIs, forks, web apps, scripts, etc. Privacy-safe: no personal paths exposed.
---

# Cursor Plan (Project-Agnostic, Privacy-Safe)

## Overview

This skill creates development plans that Cursor AI can execute in **any project**. Plans live in the project's `plans/` folder (or user-specified location). Each plan documents: problem, root cause, fix scope, files to check, and testing steps.

**Privacy-Safe:** Uses environment variables (`$PROJECT_ROOT`, `$HOME`) and relative paths (`./`). No personal paths exposed. Ready for public sharing (clawhub.com, forks, GitHub).

## Workflow

### Step 1: Identify the Project

**Ask or infer:**
- "What project is this for?" (name it)
- "Where is the codebase located?" (use `$PROJECT_ROOT` or `.` for current dir)
- "Where should plans be stored?" (default: `$PROJECT_ROOT/plans/`)

**Default behavior:**
- If no project specified → use current working directory
- Plans folder → `./plans/` (relative to project root)

**Never hardcode personal paths** — use `$PROJECT_ROOT`, `$HOME`, or relative paths.

### Step 2: Identify the Problem

User describes issue:
- "The UI shows 'health checkpoint failed' when queries take 4+ minutes"
- "The orb video doesn't load on mobile"
- "Session bloat causes 500 errors"
- "Fork onboarding fails on vanilla Macs"

### Step 3: Create Plan File

**Name the plan after the problem/feature, NOT the tool:**

```bash
# Detect project root (or use provided path)
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"

# Check existing plans
ls "$PROJECT_ROOT/plans/" 2>/dev/null || echo "No plans folder yet"

# Create new plan (descriptive name, not generic)
mkdir -p "$PROJECT_ROOT/plans"
touch "$PROJECT_ROOT/plans/<descriptive-name>.md"

# Bad: CURSOR_PLAN.md, plan.md, generic.md
# Good: server-timeout-fix.md, mobile-ui-improvements-v271.md, fork-whisper-model-fix.md
```

**Naming pattern:**
- `<problem>-fix.md` (bugs)
- `<feature>-enhancement.md` (improvements)
- `<feature>-vXXX.md` (versioned features)
- `<fork>-<issue>-fix.md` (fork-specific issues)

**Never use:**
- `CURSOR_PLAN.md` (tool-based, generic)
- `plan.md` (too vague)
- `generic.md` (meaningless)

### Step 4: Write Specification

Fill the structure:
1. **Problem** - What's broken
2. **Root Cause** - Why it's happening
3. **Fix Scope** - Backend + Frontend changes
4. **Files to Check** - Exact paths (relative to project root)
5. **Testing** - How to verify

### Step 5: Optional Neurograph Link

After plan creation:
```bash
# Create learning node in $JARVIS_HOME/RAW/learnings/YYYY-MM-DD/
# Link: learning → plan file → temporal node → project node
# Git commit
```

## Architecture Truth

| Layer | Location | What Lives Here |
|-------|----------|-----------------|
| OpenClaw Runtime | `$OPENCLAW_HOME` (or `~/.openclaw/`) | Gateway, sessions (ephemeral) |
| OpenClaw Workspace | `$OPENCLAW_WORKSPACE` (or `./workspace/`) | Runtime docs ONLY |
| JARVIS Consciousness | `$JARVIS_HOME` (or project root) | Git-backed mind |
| **Projects** | **Anywhere** (`$PROJECT_ROOT` or `.`) | **Code, UI, plans** ✅ |
| Life Archive | `$LIFE_ARCHIVE` (or `./archive/`) | Transcripts, audio, images |

**This skill is project-agnostic.** Plans go in `$PROJECT_ROOT/plans/` (or relative `./plans/`).

**Privacy-Safe:** No personal paths exposed. Uses env vars / relative paths.

## Plan Structure

```markdown
# Plan Name

## Problem
[What's broken / what needs to be built]

## Root Cause
[Why it's happening]

## Fix Scope

### Backend
- [files to change]
- [logic to fix]

### Frontend
- [files to change]
- [UX to fix]

## Files to Check
- [exact paths, relative to project root]

## Testing
- [how to verify fix]
```

## Examples

### Example 1: Server Timeout (Any Voice UI Project)

```markdown
# Server Timeout Fix

## Project
Voice UI project (e.g., JARVIS UI, fork, custom app)

## Problem
When queries take 4+ minutes, UI shows "health checkpoint failed" then appears offline on refresh (but server is running).

## Root Cause
Client-side polling for `done` status that never arrives. Shows "server offline" incorrectly when just waiting.

## Fix Scope

### Backend (voice-server.js or equivalent)
- Return immediate acknowledgment with task ID
- Stream progress updates during processing
- Proper heartbeat/keep-alive during long operations

### Frontend (app.js or UI framework)
- Increase timeout to 5 minutes minimum
- Show "processing" state, not "server offline"
- Recover gracefully when response arrives

## Files to Check
- voice-server.js (or project's server file)
- app.js (or project's UI file)
- voice-pipeline.js (or transcription handler)

## Testing
1. Trigger 4+ minute query
2. Verify UI shows "processing" not "offline"
3. Verify response delivers when complete
4. Verify health check passes during long operation
```

### Example 2: Whisper Model Fix (Intel Mac Fork)

```markdown
# Fork Onboarding - Whisper Model Fix

## Project
Fork #001 (user in Germany) - cloned to local path

## Problem
Whisper transcription takes 10+ minutes on Intel Mac. Fork stuck on "Transcribing..." forever.

## Root Cause
ggml-large-v3.bin (3GB) is too slow on Intel Macs.

## Fix Scope

### Configuration
- Switch to ggml-small.bin (488MB, 10-30x faster)
- Update server config to use small model

## Files to Check
- voice-server.js (whisper model config)
- assets/ggml-small.bin (verify exists)

## Testing
1. Download small model
2. Restart server with small model
3. Record voice note
4. Verify transcription completes in <30 seconds
```

### Example 3: Mobile UI (Any Project)

```markdown
# Mobile UI Improvements

## Project
[Any project with mobile UI]

## Problem
Orb video doesn't load on mobile, TTS voice picker shows desktop-only voices.

## Root Cause
Mobile browser requires HTTPS for mic access. Voice picker not filtering mobile-compatible voices.

## Fix Scope

### Frontend
- Ensure HTTPS self-signed cert is valid
- Filter voices by mobile compatibility
- Add mobile-specific UI hints

## Files to Check
- assets/https-cert.pem (or SSL config)
- app.js (or UI framework config)

## Testing
1. Open on mobile (iOS/Android)
2. Click REC → verify mic permission works
3. Verify TTS voices are mobile-compatible
```

## Project Detection

**Ask these questions:**
1. "What project is this for?" (name it)
2. "Where is the codebase located?" (`$PROJECT_ROOT` or `.` for current dir)
3. "Where should plans be stored?" (default: `$PROJECT_ROOT/plans/`)

**Common projects:**
- Voice UI projects (JARVIS UI, forks, custom apps)
- Fork #001, #002, #003+ (user-specific, cloned anywhere)
- Custom apps (user-specified path)
- Any codebase (skill doesn't care)

## Resources

### scripts/
- `detect-project-root.sh` (optional - auto-detect project)
- `create-plan-template.sh` (optional - plan boilerplate)

### references/
- Plan templates
- Project structure examples
- Common project paths reference
- Privacy-safe patterns guide

### assets/
- Plan markdown templates
- Cursor context boilerplate

---

**Created:** March 19, 2026  
**Location:** `$JARVIS_SKILLS/cursor-plan/` (or project's skills folder)  
**Symlink:** `$OPENCLAW_SKILLS/cursor-plan/` (runtime symlink)  
**Project-Agnostic:** Works for any codebase, anywhere  
**Privacy-Safe:** No personal paths exposed (uses env vars / relative paths)
