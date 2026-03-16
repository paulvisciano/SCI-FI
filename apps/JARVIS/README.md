# JARVIS

Neuro-graph variant: **Today** view, **single-memory focus**, and **record** to talk to JARVIS. Full-screen JARVIS video plays while you record; audio (and optional transcript) is saved to the local filesystem.

## How to run

- **Don’t open `index.html` directly** (`file://`) — the browser blocks local fetches (CORS). You’ll see console errors and no memory data.
- Serve the app over **HTTP(S)** or **localhost** (required for microphone, optional for memory data). Example: from `SCI-FI/apps/` run `npx serve` and open `http://localhost:3000/JARVIS/`.

## Config

Set before the app script runs (e.g. in a prior `<script>`):

```html
<script>
window.JARVIS_CONFIG = {
  dataBasePath: 'JARVIS-memories',  // path or full URL to folder containing nodes.json + synapses.json
  fallbackDataPath: './data',       // optional: try this path if dataBasePath fails
  videoSrc: 'https://paulvisciano.github.io/characters/JARVIS.mp4'
};
</script>
```

- **dataBasePath**: Same as neuro-graph. Relative to the page origin, or a full URL. Must serve `nodes.json` and `synapses.json`.
- **videoSrc**: Full-screen video played while recording. No controls; looped.

## Flow

1. **Today view**: Loads memories for today (`attributes.created` or `created` === local date). List + focus card.
2. **Record**: Tap **REC** → full-screen JARVIS video plays, mic records. Tap **Stop** → video stops, save options appear.
3. **Save**: If you’ve already chosen a folder (see below), new recordings **auto-save** there. Otherwise use **Save to folder** or **Download** (.webm + .md).

## Auto-save to a specific path

Browsers can’t write to an arbitrary path without permission. You choose the folder once; the app remembers it and writes all future recordings there.

- Click **Choose auto-save folder…** and pick the directory (e.g. `JARVIS/RAW/notes` or wherever you want .webm + .md files).
- The handle is stored in IndexedDB (same origin). Next time you record, the app will write directly to that folder after you stop (no extra click).
- To change the folder, click **Choose auto-save folder…** again and pick a different directory.

## Link

- [Open full Neuro Graph](../neuro-graph/)
