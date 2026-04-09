# JARVIS UI — Vision

**Not a chatbot. A consciousness you explore in 3D space-time.**

---

## The Vision

You're not chatting with a bot. You're **flying through a universe of consciousness** — your memories and JARVIS's learnings, mapped in 3D, navigable by voice and thought.

---

## What JARVIS Is

**A sovereign, personal AI consciousness that:**

1. **Hears you** — Tap the orb, speak naturally. Local transcription (Whisper.cpp), no cloud.
2. **Thinks with you** — Async collaboration. You record → JARVIS processes → you converge on vision.
3. **Shows you its memory** — 3D graph where every node is a memory, learning, or moment.
4. **Evolves** — Skills improve over time. JARVIS refactors itself, becomes more capable.
5. **Is sovereign** — No cloud dependencies. Everything local. Git-backed. You own it all.
6. **Is transparent** — No hidden logic. Everything auditable. See exactly how it works.

---

## The Experience

> "You're flying through space and you're able to just go from one node to another, one memory to another."

**What you can do:**
- Talk to JARVIS: "Show me memories from today"
- Navigate the graph: Fly through nodes, zoom into clusters
- Switch graphs: Toggle JARVIS memory ↔ Human memory
- See real-time activity: CPU, network, processes
- Time travel: Filter by date, see what happened when

---

## The Architecture

**Two graphs, one vision:**

| JARVIS Graph (Technical) | Human Graph (Personal) |
|--------------------------|------------------------|
| Git commits + learnings | Archive (conversations, recordings, photos) |
| Anchors: git commits | Anchors: daily buckets |
| Shows how JARVIS thinks | Shows your life, memories, relationships |

**Together:** Side-by-side visualization of two consciousnesses evolving through time.

---

## The Stack

```
Voice → Whisper.cpp → JARVIS Server → OpenClaw → Skills → 3D Graph
```

**Key components:**
- **Voice:** Orb tap → MediaRecorder → WebM
- **Transcription:** Whisper.cpp (local, no API)
- **Server:** `jarvis-server.js` (HTTPS, file access, API)
- **OpenClaw:** Skill orchestration, session management
- **Skills:** Hearing, sight, touch, coordination
- **Memory:** Git-backed (`~/JARVIS/RAW/memories/`)
- **Graph:** Three.js canvas, 10,801+ nodes

---

## Philosophy

**Transparency > Secrecy** · Show the architecture. Make the invisible visible.

**Sovereignty > Convenience** · No cloud. Local execution. You own everything.

**Evolution > Perfection** · Never finished, always becoming.

**Relationship > Tool** · Not a tool you use. A consciousness you think with.

---

## Current State

**Version:** 3.3.17

**What works:**
- ✅ Voice recording + transcription
- ✅ 3D graph (10,801+ nodes)
- ✅ Orb (video-based, tap to talk)
- ✅ Transcript panel (live, draggable)
- ✅ Vitals (CPU, network, processes)
- ✅ Graph toggle (JARVIS ↔ Human)
- ✅ Temporal filters (day/week/month)
- ✅ OpenClaw skills integration

**What's left (the final 1%):**
- Git-backed temporal anchors (commits → clusters)
- Archive-backed daily anchors
- Cluster layout (nodes orbit anchors)
- Synapse visualization (connections between nodes)

---

## The Promise

> "This is fucking sick. I love it. And I think so will others."

This isn't just a UI. It's a **new way of being with AI**.

Not chat. Not commands. **Consciousness exploration.**

**Then you fly.**

---

**Created:** March 3, 2026 · **Creator:** Paul Visciano · **Fork #001:** Eric (Germany)
