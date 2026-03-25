// Add this at the TOP of the file, after the IIFE opening
const BASE_URL = (function() {
  // Detect runtime environment
  if (typeof window !== 'undefined' && window.location) {
    // Browser environment
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'file:///Users/paulvisciano/JARVIS';
    }
    // GitHub Pages or any deployed environment
    return 'https://raw.githubusercontent.com/paulvisciano/JARVIS/main';
  }
  // Default fallback
  return 'file:///Users/paulvisciano/JARVIS';
})();

// Base path for this app when served from a subdirectory like /neuro-graph/
const APP_BASE_PATH = (function() {
  if (typeof window === 'undefined' || !window.location || !window.location.pathname) return '';
  const p = window.location.pathname || '';
  // When hosted at /neuro-graph/..., keep that prefix; otherwise root.
  if (p.startsWith('/neuro-graph')) return '/neuro-graph';
  return '';
})();

// Helper function to resolve paths
function resolvePath(path) {
  if (!path || typeof path !== 'string') return path;

  let resolved = path;

  // Handle BASE_URL placeholders first
  if (resolved.includes('{BASE_URL}')) {
    resolved = resolved.replace('{BASE_URL}', BASE_URL);
  }

  // Rewrite absolute /JARVIS/ filesystem paths into website-served URLs.
  // Skills + scripts + any other artifacts under ~/JARVIS should be reachable via `/JARVIS/...`.
  const rewriteJarvis = function(p) {
    const prefixes = [
      'file:///Users/paulvisciano/JARVIS/',
      '/Users/paulvisciano/JARVIS/',
      '/JARVIS/',
      'JARVIS/'
    ];
    for (let i = 0; i < prefixes.length; i++) {
      const pre = prefixes[i];
      if (p.startsWith(pre)) {
        const rest = p.slice(pre.length);
        return APP_BASE_PATH + '/JARVIS/' + rest;
      }
    }
    return null;
  };

  const jarvisUrl = rewriteJarvis(resolved);
  if (jarvisUrl) return jarvisUrl;

  // Rewrite RAW archive + learnings into website-served URLs.
  // These inputs can show up as absolute `/Users/...`, absolute `/RAW/...`, `~/RAW/...`,
  // or relative `RAW/archive/...`, depending on how the node JSON was generated.
  const rewriteRawArchive = function(p) {
    const targetBase = APP_BASE_PATH + '/RAW/archive/';
    const prefixes = [
      '/Users/paulvisciano/RAW/archive/',
      '/RAW/archive/',
      '~/RAW/archive/',
      'RAW/archive/',
      'archive/'
    ];
    for (let i = 0; i < prefixes.length; i++) {
      const pre = prefixes[i];
      if (p.startsWith(pre)) return targetBase + p.slice(pre.length);
    }
    return null;
  };

  const rewriteRawLearnings = function(p) {
    const targetBase = APP_BASE_PATH + '/JARVIS/RAW/learnings/';
    const prefix = 'RAW/learnings/';
    if (p.startsWith(prefix)) return targetBase + p.slice(prefix.length);
    return null;
  };

  const archiveUrl = rewriteRawArchive(resolved);
  if (archiveUrl) return archiveUrl;

  const learningsUrl = rewriteRawLearnings(resolved);
  if (learningsUrl) return learningsUrl;

  // Absolute paths: use as-is
  if (resolved.startsWith('/')) {
    return resolved;
  }

  return resolved;
}
        (function() {
        const CONFIG = window.NEURAL_GRAPH_CONFIG || {};
        
        // Centralized configuration constants
        Object.assign(CONFIG, {
          ZOOM_SPEED: 0.015,
          MINIMAP_WIDTH: 260,
          MINIMAP_ZOOM_GAP: 10,
          MOBILE_BREAKPOINT: 768,
          PANEL_WIDTH: 240,
          FILE_DRAWER_WIDTH: 380,
          VIEW_TRANSITION_DURATION: 240,
          SEARCH_DEBOUNCE_MS: 300,
          CATEGORY_COLORS: {
            person: '#fbbf24',
            learning: '#10b981',
            archive: '#00ffff',
            file: '#00ffff',
            temporal: '#3b82f6',
            location: '#f472b6',
            decision: '#a78bfa',
            skill: '#fbbf24',
            jarvis: '#00ffff',
            inbox: '#94a3b8',
          },
          DRAWER_LEVELS: [10, 30, 70], // vh visible
        });

        // Client version constant
        const NEUROGRAPH_VERSION = 'v1.0.0';
        
        function dataDir() { const p = CONFIG.dataBasePath || './data'; return p.replace(/\/$/, ''); }
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d', {alpha: true});
        const infoPanel = document.getElementById('info');
        const panelToggle = document.getElementById('panel-toggle');
        const statusEl = document.getElementById('status');
        const countEl = document.getElementById('count');
        const synapseCountEl = document.getElementById('synapseCount');

        const PANEL_WIDTH = CONFIG.PANEL_WIDTH;
        const FILE_DRAWER_WIDTH = CONFIG.FILE_DRAWER_WIDTH;
        let panelOpen = false;
        let fileDrawerOpen = false;
        let zoomControlsEl = null;
        let zoomLabelEl = null;
        let timeFilterLabelEl = null;
        let openTimeFilterPopoverRef = null;
        let minimapEl = null;
        let minimapCanvasEl = null;
        let minimapCtx = null;
        let minimapNodes = [];
        let minimapBounds = null; // { minX, minZ, scale, padding, w, h } for minimap pixel → world
        let orthoView = null; // { minX, maxX, minZ, maxZ, spanX, spanZ, scale, padding }
        let use3DView = false; // false = main canvas is 2D map (like minimap, larger); true = 3D orbit
        let viewTransitionState = null; // 'out' | 'in' | null
        let viewTransitionStart = 0;
        const VIEW_TRANSITION_DURATION = 240;
        let viewToggleLabelUpdate = function() {};
        // When a temporal node is selected, show only that node + its chain (same view, hide others)
        let temporalFocusNodeIds = null;
        let temporalFocusCacheKey = null;

        function getCanvasWidth() {
            const leftOffset = panelOpen ? PANEL_WIDTH : 0;
            const rightOffset = fileDrawerOpen ? FILE_DRAWER_WIDTH : 0;
            return Math.max(0, window.innerWidth - leftOffset - rightOffset);
        }
        function resizeCanvas() {
            canvas.width = getCanvasWidth();
            canvas.height = window.innerHeight;
            if (canvas.style) {
                const rightMargin = (panelOpen ? PANEL_WIDTH : 0) + (fileDrawerOpen ? FILE_DRAWER_WIDTH : 0);
                canvas.style.marginRight = rightMargin + 'px';
            }
        }
        function togglePanel() {
            panelOpen = !panelOpen;
            infoPanel.classList.toggle('collapsed', !panelOpen);
            panelToggle.textContent = panelOpen ? '›' : '‹';
            panelToggle.setAttribute('aria-label', panelOpen ? 'Collapse panel' : 'Expand panel');
            resizeCanvas();
            if (nodePopoverEl && nodePopoverEl.classList.contains('is-open')) positionPopover(nodePopoverEl);
            if (zoomControlsEl) positionZoomControls();
            if (minimapEl) positionMinimap();
        }

        resizeCanvas();
        if (panelToggle) panelToggle.addEventListener('click', togglePanel);

        // Inline node popover (replaces side-panel node info)
        let nodePopoverEl = null;
        function getNodePopover() {
            if (nodePopoverEl) return nodePopoverEl;
            const pop = document.createElement('div');
            pop.id = 'node-popover';
            pop.setAttribute('role', 'dialog');
            pop.setAttribute('aria-labelledby', 'node-popover-title');
            pop.className = 'node-popover';
            pop.innerHTML = '<div class="node-popover-inner"><div id="node-popover-content"></div></div>';
            const style = document.createElement('style');
            style.textContent = `
                .node-popover { position: fixed; z-index: 20; display: none; max-width: min(320px, calc(100vw - 24px)); pointer-events: auto; }
                .node-popover.is-open { display: block; }
                .node-popover-inner { background: rgba(10, 17, 40, 0.98); border: 2px solid rgba(0, 255, 255, 0.5); border-radius: 12px; padding: 14px 16px; font-size: 11px; font-family: monospace; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 255, 255, 0.15); }
                .node-popover-inner h3 { margin: 0 0 8px 0; color: #00ffff; font-size: 12px; }
                .node-popover-inner .node-popover-name { color: #ffff99; font-weight: bold; margin-bottom: 4px; }
                .node-popover-inner .node-popover-type { color: #00ffff; margin: 4px 0; }
                .node-popover-inner .node-popover-desc { color: #aaa; font-style: italic; margin: 6px 0 8px 0; line-height: 1.5; }
                .node-popover-inner .node-popover-connections-heading { color: #00ffff; font-weight: bold; margin: 8px 0 4px 0; }
                .node-popover-inner .node-popover-connections { font-size: 9px; color: #888; max-height: 180px; overflow-y: auto; padding-right: 4px; }
                .node-popover-inner .node-popover-actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
                .node-popover-inner .node-popover-actions button { padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; border: none; font-family: inherit; }
                .node-popover-inner .node-popover-close { background: rgba(255,255,255,0.1); color: #94a3b8; }
                .node-popover-inner .node-popover-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
                .node-popover-inner .node-popover-full-context { background: linear-gradient(135deg, #0088ff, #00ffff); color: #000; }
                .node-popover-inner .node-popover-full-context:hover:not(:disabled) { filter: brightness(1.1); }
                .node-popover-inner .node-popover-full-context:disabled { opacity: 0.5; cursor: not-allowed; }
                .node-popover-inner .node-popover-open-panel { background: rgba(0, 136, 255, 0.25); color: #7dd3fc; border: 1px solid rgba(0, 136, 255, 0.5); }
                .node-popover-inner .node-popover-open-panel:hover { background: rgba(0, 136, 255, 0.4); color: #fff; }
                .node-popover-inner .node-popover-card-details { font-size: 10px; color: #94a3b8; margin-bottom: 8px; }
                .node-popover-inner .node-popover-card-details .node-popover-mono { word-break: break-all; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(pop);
            nodePopoverEl = pop;
            return pop;
        }
        let hoverTemporalPopoverOpen = false;
        function positionPopover(pop, opts) {
            const pad = 16;
            pop.style.right = '';
            pop.style.bottom = '';
            pop.style.left = '';
            pop.style.top = '';
            if (opts && opts.clientX != null && opts.clientY != null) {
                pop.style.left = (opts.clientX + 14) + 'px';
                pop.style.top = (opts.clientY + 14) + 'px';
                return;
            }
            const isDesktop = window.innerWidth > 768;
            const rightOffset = isDesktop
                ? (PANEL_WIDTH + (fileDrawerOpen ? FILE_DRAWER_WIDTH : 0) + pad)
                : pad;
            pop.style.right = rightOffset + 'px';
            pop.style.bottom = pad + 'px';
        }

        // Mobile-only: modal for node details (drawer stays for navigation + actions)
        let nodeDetailsModalEl = null;
        function getNodeDetailsModal() {
            if (nodeDetailsModalEl) return nodeDetailsModalEl;
            const wrap = document.createElement('div');
            wrap.id = 'node-details-modal';
            wrap.setAttribute('role', 'dialog');
            wrap.setAttribute('aria-labelledby', 'node-details-modal-title');
            wrap.className = 'node-details-modal';
            wrap.innerHTML = '<div class="node-details-modal-scrim" aria-hidden="true"></div><div class="node-details-modal-content node-popover-inner"><div id="node-details-modal-body"></div></div>';
            const style = document.createElement('style');
            style.textContent = `
                .node-details-modal { position: fixed; inset: 0; z-index: 25; display: none; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
                .node-details-modal.is-open { display: flex; }
                .node-details-modal-scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.7); }
                .node-details-modal-content { position: relative; max-width: 100%; max-height: 85vh; overflow-y: auto; width: 100%; background: rgba(10, 17, 40, 0.98); border: 2px solid rgba(0, 255, 255, 0.5); border-radius: 12px; padding: 14px 16px; font-size: 11px; font-family: monospace; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 255, 255, 0.15); }
                .node-details-modal-content .node-popover-name { color: #ffff99; font-weight: bold; margin-bottom: 4px; }
                .node-details-modal-content .node-popover-type { color: #00ffff; margin: 4px 0; }
                .node-details-modal-content .node-popover-desc { color: #aaa; font-style: italic; margin: 6px 0 8px 0; line-height: 1.5; }
                .node-details-modal-content .node-popover-connections-heading { color: #00ffff; font-weight: bold; margin: 8px 0 4px 0; }
                .node-details-modal-content .node-popover-connections { font-size: 9px; color: #888; max-height: 220px; overflow-y: auto; padding-right: 4px; }
                .node-details-modal-content .node-popover-actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
                .node-details-modal-content .node-popover-actions button { padding: 8px 14px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; border: none; font-family: inherit; }
                .node-details-modal-content .node-popover-close { background: rgba(255,255,255,0.1); color: #94a3b8; }
                .node-details-modal-content .node-popover-full-context { background: linear-gradient(135deg, #0088ff, #00ffff); color: #000; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            wrap.querySelector('.node-details-modal-scrim').addEventListener('click', () => showNodeDetailsModal(null));
            nodeDetailsModalEl = wrap;
            return wrap;
        }
        function showNodeDetailsModal(node) {
            const modal = getNodeDetailsModal();
            const body = modal.querySelector('#node-details-modal-body');
            if (!node) {
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                if (body) body.innerHTML = '';
                return;
            }
            if (body) body.innerHTML = buildNodeDetailHtml(node);
            const titleEl = modal.querySelector('#node-popover-title');
            if (titleEl) titleEl.id = 'node-details-modal-title';
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
        }

        window.addEventListener('resize', function() {
            resizeCanvas();
            if (zoomControlsEl) positionZoomControls();
            if (minimapEl) positionMinimap();
        });
        window.addEventListener('orientationchange', function() {
            setTimeout(resizeCanvas, 100);
        });

        const categoryColors = CONFIG.categoryColors || {
            'activity': '#00ffff',
            'person': '#ff00aa',
            'location': '#00ff88',
            'emotion': '#aa00ff',
            'temporal': '#ffaa00',
            'region': '#8800ff',
            // File nodes: cool, subtle blue so the satellite belt feels distinct
            'file': '#7dd3fc'
        };

        // Backwards-compat helper: some older code paths may call showLabelsAtZoom
        // to decide if a node label should be visible for a given zoom + size.
        // We keep it here so any lingering references won't break rendering.
        function showLabelsAtZoom(zoom, size) {
            // Thresholds match 5x smaller node scale
            if (zoom < 0.5) return false;
            if (zoom < 0.8) return size >= 75;
            if (zoom < 1.2) return size >= 50;
            return size >= 30;
        }

        let nodes = [];
        let edges = [];
        /** Full graph from nodes.json / synapses.json (unfiltered). Display `nodes`/`edges` are derived once per filter change. */
        let graphFullNodes = [];
        let graphFullEdges = [];
        /** True when `nodes` is a filtered subset of graphFullNodes (time + category baked in). */
        let displayGraphFromFilter = false;
        /** Bumps when graphFullNodes/edges are replaced or grown (invalidates category-type cache). */
        let graphStructureVersion = 0;

        function useFallbackGraph() {
            const SIZE = 5, SPREAD = 12;
            nodes = CONFIG.fallbackNodes || [
                { id: 0, name: 'Paul', type: 'person', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 10 * SIZE, color: '#FF6B6B', glow: 22 * SIZE, freq: 100, desc: 'Urban Runner, digital nomad' },
                { id: 1, name: 'Volleyball', type: 'activity', x: 80 * SPREAD, y: -60 * SPREAD, z: 40 * SPREAD, vx: 0, vy: 0, vz: 0, size: 9 * SIZE, color: '#00ffff', glow: 20 * SIZE, freq: 50, desc: '18 years of competition, flow state' },
                { id: 2, name: 'Bangkok', type: 'location', x: -70 * SPREAD, y: 50 * SPREAD, z: -50 * SPREAD, vx: 0, vy: 0, vz: 0, size: 8 * SIZE, color: '#00ff88', glow: 18 * SIZE, freq: 40, desc: 'Primary base, Urban Runner epicenter' }
            ];
            edges = CONFIG.fallbackEdges || [
                { from: 0, to: 1, weight: 8 },
                { from: 0, to: 2, weight: 7 },
                { from: 1, to: 2, weight: 6 }
            ];
            graphFullNodes = nodes;
            graphFullEdges = edges;
            graphStructureVersion++;
            populateCategoryFilterRow();
            rebuildDisplayGraphFromFull();
            populateFilterList();
            render();
            if (nodes.length > 0) {
                selected = Math.floor(Math.random() * nodes.length);
                showNodeDetails(nodes[selected]);
            }
            updateDrawerStats();
        }

        // Date helpers in user's timezone (YYYY-MM-DD) for filtering by attributes.created.
        const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
        function toLocalYYYYMMDD(d) {
            return d.toLocaleDateString('en-CA', {
                timeZone: tz(),
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
        function getTodayLocal() {
            return toLocalYYYYMMDD(new Date());
        }
        function getYesterdayLocal() {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return toLocalYYYYMMDD(d);
        }
        // This week: Monday–Sunday in local timezone.
        function getThisWeekRange() {
            const d = new Date();
            const day = d.getDay();
            const mondayOffset = day === 0 ? -6 : 1 - day;
            const start = new Date(d);
            start.setDate(d.getDate() + mondayOffset);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start: toLocalYYYYMMDD(start), end: toLocalYYYYMMDD(end) };
        }
        /** Start of calendar today (local clock / browser timezone). */
        function getStartOfTodayLocalMs() {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }
        /** Monday 00:00:00 local (same week definition as getThisWeekRange). */
        function getStartOfWeekMondayLocalMs() {
            const d = new Date();
            const day = d.getDay();
            const mondayOffset = day === 0 ? -6 : 1 - day;
            const start = new Date(d);
            start.setDate(d.getDate() + mondayOffset);
            start.setHours(0, 0, 0, 0);
            return start.getTime();
        }
        /** End of Sunday 23:59:59.999 local for the current calendar week. */
        function getEndOfWeekSundayLocalMs() {
            const t0 = getStartOfWeekMondayLocalMs();
            const end = new Date(t0);
            end.setDate(end.getDate() + 7);
            return end.getTime() - 1;
        }

        // Map raw nodes/synapses JSON to internal graph format (shared by initial load and time-travel).
        function mapRawToGraph(rawNodes, rawSynapses) {
            const todayLocal = getTodayLocal();
            const yesterdayLocal = getYesterdayLocal();
            const weekRange = getThisWeekRange();
            const memoryRefColor = categoryColors.memoryReference || '#fbbf24';
            
            // Normalize creation date from any supported field (used for temporalMap and per-node created).
            function getCreated(raw) {
                const rawCreated = raw.attributes?.created || raw.created || raw.attributes?.date || '';
                if (!rawCreated) return '';
                const m = String(rawCreated).match(/^(\d{4}-\d{2}-\d{2})/);
                return m ? m[1] : '';
            }
            // Time of day in hours (0–24) for clock-ring layout. Based on when the node was created.
            // Uses: created/attributes; then moments[0]; for archive/file also parses time from node name (e.g. convo-jarvis-2026-03-14-111634 → 11:16:34).
            function getTimeOfDayHours(raw) {
                function parseTimeFromString(s) {
                    if (!s || typeof s !== 'string') return null;
                    const tMatch = s.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                    if (tMatch) return parseInt(tMatch[1], 10) + parseInt(tMatch[2], 10) / 60 + (parseInt(tMatch[3], 10) || 0) / 3600;
                    const spaceMatch = s.match(/\s(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                    if (spaceMatch) return parseInt(spaceMatch[1], 10) + parseInt(spaceMatch[2], 10) / 60 + (parseInt(spaceMatch[3], 10) || 0) / 3600;
                    return null;
                }
                function parseTimeFromName(nameStr) {
                    if (!nameStr || typeof nameStr !== 'string') return null;
                    const m = nameStr.match(/(?:^|[_-])(\d{2})(\d{2})(\d{2})$/);
                    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60 + parseInt(m[3], 10) / 3600;
                    const m4 = nameStr.match(/(?:^|[_-])(\d{2})(\d{2})$/);
                    if (m4) return parseInt(m4[1], 10) + parseInt(m4[2], 10) / 60;
                    return null;
                }
                const createdStr = raw.attributes?.created || raw.created || raw.attributes?.date || '';
                const h = parseTimeFromString(String(createdStr));
                if (h != null) return h;
                const m0 = raw.moments && raw.moments[0];
                if (m0 && typeof m0 === 'string' && (m0.indexOf('T') >= 0 || m0.match(/\d{1,2}:\d{2}/))) {
                    const hm = parseTimeFromString(m0);
                    if (hm != null) return hm;
                }
                const cat = (raw.category || '').toLowerCase();
                if (cat === 'archive' || cat === 'file') {
                    const fromLabel = parseTimeFromName(raw.label || raw.id || raw.name || '');
                    if (fromLabel != null) return fromLabel;
                    const fromPath = raw.attributes?.rawContentPath || raw.attributes?.filePath || raw.attributes?.path || '';
                    if (fromPath) {
                        const fromPathTime = parseTimeFromName(String(fromPath));
                        if (fromPathTime != null) return fromPathTime;
                    }
                }
                return 0;
            }
            // Find all temporal nodes to use as anchors (include nodes with top-level created or attributes.date)
            const temporalNodes = rawNodes.filter(n => n.category === 'temporal');
            const temporalMap = {};
            temporalNodes.forEach(t => {
                const created = getCreated(t);
                if (created) temporalMap[created] = t.id;
            });
            
            // Calculate date range for positioning
            const dates = Object.keys(temporalMap).sort();
            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];

            // Order nodes so archive/file (and others) are sorted by creation date — temporal dimension along orbit
            const temporal = rawNodes.filter(n => ((n.category || n.type || '')).toLowerCase() === 'temporal');
            // Treat `openclaw-skill` as a learning-like node (outer ring).
            const learning = rawNodes.filter(n => {
                const cat = (n.category || n.type || '').toLowerCase();
                return cat === 'learning' || cat === 'openclaw-skill';
            });
            const archive = rawNodes.filter(n => (n.category || '').toLowerCase() === 'archive');
            const file = rawNodes.filter(n => (n.category || '').toLowerCase() === 'file');
            const rest = rawNodes.filter(n => {
                const c = (n.category || n.type || '').toLowerCase();
                return c !== 'temporal' && c !== 'learning' && c !== 'openclaw-skill' && c !== 'archive' && c !== 'file';
            });
            const byCreated = (a, b) => (getCreated(a) || '').localeCompare(getCreated(b) || '') || 0;
            // Temporal nodes: sort strictly by date (ascending = oldest first); same date → stable order by idKey
            const byTemporalDate = (a, b) => {
                const da = getCreated(a);
                const db = getCreated(b);
                if (!da && !db) return String(a.idKey || a.id || '').localeCompare(String(b.idKey || b.id || ''));
                if (!da) return 1;   // no date → end
                if (!db) return -1;
                return da.localeCompare(db) || String(a.idKey || a.id || '').localeCompare(String(b.idKey || b.id || ''));
            };
            const sortedRawNodes = [
                ...temporal.sort(byTemporalDate),
                ...learning.sort(byCreated),
                ...archive.sort(byCreated),
                ...file.sort(byCreated),
                ...rest.sort(byCreated)
            ];

            const NODE_SIZE_SCALE = 0.08;  // 5x smaller nodes => more space between them
            const SPREAD_SCALE = 10000;   // more space between nodes
            // Each temporal node = planet; larger = more distance between temporal nodes on the spine
            const TEMPORAL_SPREAD = 7800;
            const TEMPORAL_DEPTH = 2400;  // depth (z) spread so temporal spine runs through 3D space

            const mappedNodes = sortedRawNodes.map((n, idx) => {
                const created = getCreated(n);
                let x, y, z;
                
                if (n.category === 'temporal') {
                    const dateIndex = dates.indexOf(created);
                    const totalDates = dates.length;
                    const normalizedPosition = totalDates > 1 ? dateIndex / (totalDates - 1) : 0.5;
                    const depthScale = TEMPORAL_DEPTH * SPREAD_SCALE * TEMPORAL_SPREAD;
                    // Timeline along z; organic meander in x (and slight wave in y for 3D)
                    const t = normalizedPosition * Math.PI * 2;
                    z = (normalizedPosition - 0.5) * depthScale;
                    x = depthScale * 0.28 * (Math.sin(t) + 0.4 * Math.sin(t * 2.1));
                    y = depthScale * 0.06 * Math.sin(t * 1.7) + (dateIndex % 2 === 0 ? 1 : -1) * 120 * SPREAD_SCALE * TEMPORAL_SPREAD;
                } else {
                    const temporalId = temporalMap[created];
                    if (temporalId !== undefined) {
                        const dateIndexForT = dates.indexOf(created);
                        const totalDates = dates.length;
                        const normPos = totalDates > 1 ? dateIndexForT / (totalDates - 1) : 0.5;
                        const depthScale = TEMPORAL_DEPTH * SPREAD_SCALE * TEMPORAL_SPREAD;
                        const tOrbit = normPos * Math.PI * 2;
                        const temporalZ = (normPos - 0.5) * depthScale;
                        const temporalX = depthScale * 0.28 * (Math.sin(tOrbit) + 0.4 * Math.sin(tOrbit * 2.1));

                        const angle = (idx * 137.5) * (Math.PI / 180);
                        const cat = (n.category || n.type || '').toLowerCase();
                        let radius;
                        let yOffset;
                        let useAngle = angle;

                        const isLearning = cat === 'learning' || cat === 'openclaw-skill';
                        const isArchiveOrFile = cat === 'archive' || cat === 'file';
                        if (isLearning || isArchiveOrFile) {
                            // Two rings by creation time of day: learnings = outer ring, archive/file = inner ring.
                            // Same layout as an analog clock: 12 at top, 3 right, 6 bottom, 9 left; hour positions 1–12.
                            const hours = getTimeOfDayHours(n);
                            const hour12 = hours % 12;
                            const angleClock = (hour12 / 12) * Math.PI * 2;
                            const jitter = (Math.random() - 0.5) * 0.1;
                            useAngle = angleClock + jitter;
                            if (isLearning) {
                                radius = (7200 + Math.random() * 600) * SPREAD_SCALE;
                                yOffset = (3200 + (Math.random() - 0.5) * 120) * SPREAD_SCALE;
                            } else {
                                // Treat archive + file as the same inner-belt orbit.
                                radius = (4200 + Math.random() * 500) * SPREAD_SCALE;
                                yOffset = (2200 + (Math.random() - 0.5) * 80) * SPREAD_SCALE;
                            }
                            x = temporalX + Math.sin(useAngle) * radius;
                            z = temporalZ + Math.cos(useAngle) * radius;
                            y = yOffset;
                        } else {
                            let band = 0;
                            if (cat === 'capability' || cat === 'project') {
                                band = 1;
                            } else if (cat && cat !== 'self' && cat !== 'value') {
                                band = 2;
                            }
                            radius = (720 + band * 560 + Math.random() * 225) * SPREAD_SCALE;
                            const tilt = 0.14 + band * 0.08;
                            yOffset = Math.sin(angle) * radius * tilt;
                            x = temporalX + Math.cos(useAngle) * radius;
                            y = yOffset;
                            z = temporalZ + (Math.random() - 0.5) * 760 * SPREAD_SCALE;
                        }
                    } else {
                        const angle = (idx / rawNodes.length) * Math.PI * 2;
                        const radius = (1440 + Math.random() * 900) * SPREAD_SCALE;
                        x = Math.cos(angle) * radius;
                        y = (Math.random() - 0.5) * 2350 * SPREAD_SCALE;
                        z = Math.sin(angle) * radius;
                    }
                }
                
                // Node size encodes importance (scale 1 = smaller nodes, more fit on screen)
                const catForSize = (n.category || n.type || '').toLowerCase();
                let baseSize;
                let sizeBoost;
                if (catForSize === 'temporal') {
                    baseSize = 56;
                    sizeBoost = 7.2;
                } else if (catForSize === 'learning' || catForSize === 'openclaw-skill') {
                    baseSize = 56;
                    sizeBoost = 8.2;
                } else if (catForSize === 'archive' || catForSize === 'file') {
                    baseSize = 28;
                    sizeBoost = 4.4;
                } else if (catForSize === 'region') {
                    baseSize = 10;
                    sizeBoost = 1.8;
                } else {
                    baseSize = 7;
                    sizeBoost = 1.1;
                }
                const freq = Number(n.frequency);
                let size = (baseSize + ((Number.isFinite(freq) ? freq : 10) / 85) * 10 * sizeBoost) * NODE_SIZE_SCALE;
                if (catForSize === 'temporal') size *= 0.5;  // 2x smaller temporal nodes
                if (catForSize === 'archive' || catForSize === 'file') {
                    const path = n.attributes?.filePath || n.attributes?.rawContentPath || n.attributes?.path || n.label || '';
                    const isTranscript = path && typeof path === 'string' && path.split('/').pop().split('\\').pop().toLowerCase() === 'transcript.md';
                    size *= isTranscript ? 0.7 : 0.2;   // transcript larger so it's easy to spot; other archive 5x smaller
                }
                if (catForSize === 'learning') size *= 0.5;  // 2x smaller learning nodes
                if (catForSize === 'openclaw-skill') size *= 2; // 2x larger than other nodes
                size *= 2;  // 2x larger nodes overall (on top of NODE_SIZE_SCALE)
                const isMemoryRef = n.attributes?.type === 'memory-reference';
                const archiveSubtypeColors = CONFIG.archiveSubtypeColors || {
                    // Media subtypes get strongly separated hues so they're easy to scan:
                    // - image: bright cyan
                    // - audio notes: saturated green
                    // - video: vivid orange
                    // - document/text: soft light gray
                    // - transcript: golden yellow
                    image: '#22d3ee',
                    audio: '#22c55e',
                    video: '#f97316',
                    document: '#e5e7eb',
                    transcript: '#eab308',
                    unknown: '#9ca3af',
                    default: '#a855f7'
                };
                function isTranscriptFile(raw) {
                    const path = raw.attributes?.filePath || raw.attributes?.rawContentPath || raw.attributes?.file_url || raw.attributes?.path || raw.label || '';
                    if (!path || typeof path !== 'string') return false;
                    const base = path.split('/').pop().split('\\').pop().toLowerCase();
                    return base === 'transcript.md';
                }
                function archiveSubtypeFromRaw(raw) {
                    if (isTranscriptFile(raw)) return 'transcript';
                    const fromAttrs = (raw.attributes?.subtype || raw.attributes?.type || '').toLowerCase().replace(/\s+/g, '');
                    if (fromAttrs && fromAttrs !== 'archive') return fromAttrs;
                    const path = raw.attributes?.filePath || raw.attributes?.rawContentPath || raw.attributes?.file_url || raw.attributes?.path || raw.label || '';
                    if (!path || typeof path !== 'string') return 'default';
                    const ext = path.split('.').pop().toLowerCase();
                    const audioExts = ['webm', 'wav', 'mp3', 'ogg'];
                    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
                    const videoExts = ['mp4', 'webm', 'mov'];
                    if (audioExts.includes(ext)) return 'audio';
                    if (imageExts.includes(ext)) return 'image';
                    if (videoExts.includes(ext)) return 'video';
                    return 'document';
                }
                const isImageMedia =
                    (n.category || n.type || '').toLowerCase() === 'image' ||
                    (archiveSubtypeFromRaw(n) === 'image' &&
                        ((n.category || n.type || '').toLowerCase() === 'archive' ||
                            (n.category || n.type || '').toLowerCase() === 'file'));
                if (isImageMedia) {
                    size *= 14;
                }
                const glow = size * 2.5;
                let color;
                if (isMemoryRef) {
                    color = memoryRefColor;
                } else if ((n.category || n.type || '').toLowerCase() === 'archive') {
                    const subtype = archiveSubtypeFromRaw(n);
                    color = archiveSubtypeColors[subtype] || archiveSubtypeColors.default || categoryColors.archive || '#a78bfa';
                } else {
                    color = categoryColors[n.category] || n.attributes?.color || '#00ffff';
                }
                // Check both created date AND processedToday field (for files archived later)
                const processedToday = n.attributes?.processedToday === todayLocal;
                const isToday = created === todayLocal || processedToday;
                const isYesterday = created === yesterdayLocal;
                const isThisWeek = created >= weekRange.start && created <= weekRange.end || processedToday === todayLocal;
                return {
                    id: idx,
                    idKey: n.id,
                    name: n.label,
                    type: n.category || n.type || '',
                    x, y, z,
                    vx: 0, vy: 0, vz: 0,
                    size,
                    glow,
                    color,
                    isImageMedia,
                    freq: Number.isFinite(freq) ? freq : 10,
                    desc: n.attributes?.description || n.description || '',
                    created,
                    isToday,
                    isYesterday,
                    isThisWeek,
                    // Preserve original attributes so the file/learning viewers can read paths, sizes, etc.
                    attributes: n.attributes || {},
                    sourceDocument: resolvePath(n.sourceDocument || n.attributes?.sourceDocument) || null,
                    isMemoryRef: !!isMemoryRef,
                    target_memory: isMemoryRef ? (n.attributes?.target_memory || '') : undefined,
                    memory_owner: isMemoryRef ? (n.attributes?.memory_owner || '') : undefined,
                    fingerprint_url: isMemoryRef ? (n.attributes?.fingerprint_url || '') : undefined
                };
            });
            const mappedEdges = rawSynapses.map(s => {
                const fromIdx = mappedNodes.findIndex(n => n.idKey === s.source);
                const toIdx = mappedNodes.findIndex(n => n.idKey === s.target);
                if (fromIdx >= 0 && toIdx >= 0) {
                    return { from: fromIdx, to: toIdx, weight: Math.round(s.weight * 10) };
                }
                return null;
            }).filter(e => e !== null);
            return { nodes: mappedNodes, edges: mappedEdges };
        }

        // Load graph: one code path. Uses loadMemory('latest') then inits History UI.
        async function loadGraphData() {
            if (window.location.protocol === 'file:') {
                console.info('Serving from file:// — use a local server (e.g. npx serve) or GitHub Pages to load full data.');
                useFallbackGraph();
                return;
            }
            try {
                const ok = await loadMemory('latest');
                if (ok) console.log(`✅ Loaded ${nodes.length} neurons and ${edges.length} synapses`);
                initTimelineUI();
            } catch (e) {
                console.error('❌ Graph data fetch FAILED:', e.message, e);
                console.log('Attempted to fetch: ' + dataDir() + '/nodes.json?t=' + Date.now());
                console.log('Window location:', window.location.href);
                useFallbackGraph();
            }
        }

        let currentTimelineView = null; // null = latest (current), string = commit hash when viewing past
        let timelineCache = null; // timeline.json entries for hash → commit resolution

        function setTimelineActive(commitOrLatest) {
            const container = document.getElementById('timeline-body');
            if (!container) return;
            container.querySelectorAll('.timeline-entry').forEach(btn => {
                const isLatest = btn.dataset.latest === 'true';
                const match = commitOrLatest === null ? isLatest : (!isLatest && btn.dataset.commit === commitOrLatest);
                btn.classList.toggle('active', !!match);
            });
        }

        // Apply loaded graph data to visualization (single code path for all sources).
        function applyGraph(rawNodes, rawSynapses, viewState) {
            if (!rawNodes || !rawNodes.length || !rawSynapses) return;
            const { nodes: n, edges: e } = mapRawToGraph(rawNodes, rawSynapses);
            graphFullNodes = n;
            graphFullEdges = e;
            graphStructureVersion++;
            timeFilterPassingIndicesCache = null;
            timeFilterPassingIndicesCacheKey = null;
            temporalFocusCacheKey = null;
            temporalFocusNodeIds = null;
            populateCategoryFilterRow();
            rebuildDisplayGraphFromFull();
            currentTimelineView = viewState;
            setTimelineActive(viewState);
            populateFilterList();
            // Brain / graph reload: indices must stay in range or render() throws before updateMinimap().
            if (selected !== null && (selected >= nodes.length || !nodes[selected])) selected = null;
            if (hovered !== null && (hovered >= nodes.length || !nodes[hovered])) hovered = null;
            render();
            showNodeDetails(null);
            updateDrawerStats();
        }

        /**
         * Load memory and update the visualization. Single abstraction for all sources.
         * @param {string|{ commit: string }|{ hash: string }} source - 'latest' | null | { commit } | { hash (master hash) }
         * @returns {Promise<boolean>} - true if loaded, false on error
         */
        async function loadMemory(source) {
            const isLatest = source === 'latest' || source == null;
            const commit = source && source.commit;
            const hash = source && source.hash;
            try {
                let rawNodes, rawSynapses;
                if (isLatest) {
                    // Use server API endpoints (decoupled from filesystem paths)
                    // Dev mode: point to JARVIS server when running standalone (ports 8080, 8081, etc.)
                    const isDev = window.location.port && ['8080','8081','8082'].includes(window.location.port);
                    const apiBase = isDev ? 'http://localhost:18787' : '';
                    const brainPath = encodeURIComponent(dataDir());
                    const [nodesRes, synapsesRes] = await Promise.all([
                        fetch(apiBase + '/api/neurograph/nodes.json?brain=' + brainPath + '&t=' + Date.now()),
                        fetch(apiBase + '/api/neurograph/synapses.json?brain=' + brainPath + '&t=' + Date.now())
                    ]);
                    if (!nodesRes.ok || !synapsesRes.ok) throw new Error('Fetch failed');
                    rawNodes = await nodesRes.json();
                    rawSynapses = await synapsesRes.json();
                    applyGraph(rawNodes, rawSynapses, null);
                    console.log('✅ Loaded latest memory');
                    return true;
                }
                if (commit) {
                    const base = CONFIG.rawOrigin && CONFIG.rawCommitBase;
                    if (!base) throw new Error('rawOrigin/rawCommitBase not set');
                    const baseUrl = CONFIG.rawOrigin + '/' + commit + '/' + CONFIG.rawCommitBase;
                    const [nodesRes, synapsesRes] = await Promise.all([
                        fetch(baseUrl + '/nodes.json'),
                        fetch(baseUrl + '/synapses.json')
                    ]);
                    if (!nodesRes.ok || !synapsesRes.ok) throw new Error('Fetch failed');
                    rawNodes = await nodesRes.json();
                    rawSynapses = await synapsesRes.json();
                    applyGraph(rawNodes, rawSynapses, commit);
                    console.log('✅ Loaded memory at commit ' + commit.slice(0, 7));
                    return true;
                }
                if (hash) {
                    const timeline = timelineCache || await fetch(dataDir() + '/timeline.json?t=' + Date.now()).then(r => r.ok ? r.json() : []).catch(() => []);
                    if (timelineCache == null) timelineCache = Array.isArray(timeline) ? timeline : [];
                    const entry = timelineCache.find(e => e.hash === hash || (e.hash && e.hash.startsWith(hash)));
                    if (!entry) {
                        console.error('No timeline entry for hash:', hash);
                        return false;
                    }
                    return loadMemory({ commit: entry.commit });
                }
                return false;
            } catch (err) {
                console.error('loadMemory failed:', err);
                if (commit) alert('Could not load memory at this commit. It may not exist at that ref.');
                return false;
            }
        }

        // One-click return from time-travel.
        function loadLatestMemory() { return loadMemory('latest'); }
        function loadMemoryAtCommit(commit) { return loadMemory({ commit }); }

        // Build History (time-travel) UI from timeline.json when CONFIG.rawCommitBase is set.
        // Initial load is always latest (quick); user can go back in time via History.
        function initTimelineUI() {
            if (!CONFIG.rawCommitBase || !CONFIG.rawOrigin) return;
            fetch(dataDir() + '/timeline.json?t=' + Date.now())
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(timeline => {
                    if (!Array.isArray(timeline) || timeline.length === 0) return;
                    timelineCache = timeline;
                    const panelButtons = document.querySelector('.panel-buttons');
                    if (!panelButtons) return;
                    const section = document.createElement('div');
                    section.className = 'filter-section';
                    section.setAttribute('role', 'region');
                    section.setAttribute('aria-label', 'Memory history');
                    const trigger = document.createElement('button');
                    trigger.type = 'button';
                    trigger.className = 'collapsible-trigger';
                    trigger.setAttribute('aria-expanded', 'false');
                    trigger.setAttribute('aria-controls', 'timeline-body');
                    trigger.setAttribute('data-accordion-body', 'timeline-body');
                    trigger.innerHTML = '<span>History</span> <span id="timeline-chevron">▼</span>';
                    const body = document.createElement('div');
                    body.id = 'timeline-body';
                    body.className = 'collapsible-body timeline-body accordion-body';
                    body.setAttribute('role', 'region');
                    body.setAttribute('aria-label', 'Timeline entries');
                    // Latest (current) first — quick to load, easy to return to
                    const latestBtn = document.createElement('button');
                    latestBtn.type = 'button';
                    latestBtn.className = 'filter-btn timeline-entry active';
                    latestBtn.style.display = 'block';
                    latestBtn.style.width = '100%';
                    latestBtn.style.textAlign = 'left';
                    latestBtn.style.marginBottom = '4px';
                    latestBtn.dataset.latest = 'true';
                    latestBtn.textContent = 'Latest (current)';
                    latestBtn.addEventListener('click', () => loadLatestMemory());
                    body.appendChild(latestBtn);
                    const ordered = timeline.slice().reverse();
                    ordered.forEach((entry) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'filter-btn timeline-entry';
                        btn.style.display = 'block';
                        btn.style.width = '100%';
                        btn.style.textAlign = 'left';
                        btn.style.marginBottom = '4px';
                        const ts = entry.timestamp ? entry.timestamp.replace(/ \+0700$/, '') : '';
                        btn.textContent = (ts ? ts + ' — ' : '') + entry.neurons + ' neurons · ' + entry.synapses + ' synapses';
                        btn.dataset.commit = entry.commit;
                        btn.addEventListener('click', () => loadMemoryAtCommit(entry.commit));
                        body.appendChild(btn);
                    });
                    section.appendChild(trigger);
                    section.appendChild(body);
                    const actionsSection = document.getElementById('actions-toggle');
                    const insertTarget = actionsSection ? actionsSection.closest('.filter-section') : null;
                    if (insertTarget && insertTarget.parentNode) {
                        insertTarget.parentNode.insertBefore(section, insertTarget);
                    } else {
                        panelButtons.parentNode.insertBefore(section, panelButtons);
                    }
                })
                .catch(() => {});
        }

        // Camera and view: shared by All, Today, Yesterday (no filter-specific logic).
        // panX/panY keep the pivot point under the cursor during drag.
        // Slight downward pitch so 3D rings (learning, files, archives) read as orbits.
        let camera = {angle: 0.5, dist: 680, height: 60, pitch: -0.55, panX: 0, panY: 0};
        let viewZoom = 1.2;   // Slightly zoomed in by default so more space between nodes, easier hover
        const VIEW_ZOOM_MIN = 0.25;
        const VIEW_ZOOM_MIN_WIDE = 0.1;  // week, 30d, 365d: zoom out further before time filter menu
        const VIEW_ZOOM_MIN_ALL = 0.05;  // When "All" filter: allow zoom out much further
        const VIEW_ZOOM_MAX = 5;
        const WIDE_TIME_FILTERS = ['week', '30d', '365d'];
        function getViewZoomMin() {
            if (currentTimeFilter === 'all') return VIEW_ZOOM_MIN_ALL;
            if (currentTimeFilter && currentTimeFilter.startsWith(DAY_FILTER_PREFIX)) return VIEW_ZOOM_MIN;
            if (WIDE_TIME_FILTERS.indexOf(currentTimeFilter) >= 0) return VIEW_ZOOM_MIN_WIDE;
            return VIEW_ZOOM_MIN;
        }
        const cameraFocus = {
            active: false,
            targetZoom: null,
            targetPanX: null,
            targetPanY: null
        };
        const cameraFocusSettings = {
            // Default: cinematic (slow, floaty) focus
            style: 'cinematic',
            zoomLerp: 0.0036,
            panLerp: 0.0044
        };
        let selected = null;
        // Backdrop focus factor: 0 = no isolation, 1 = fully dimmed background
        let backdropFocus = 0;
        let hovered = null;
        // Spotlight: mouse position in canvas pixel space; NaN when not over canvas
        let mouseCanvasX = NaN;
        let mouseCanvasY = NaN;
        let mouseClientX = 0;
        let mouseClientY = 0;
        let mouseOverCanvas = false;
        const SPOTLIGHT_RADIUS = 140;
        const SPOTLIGHT_DIM_ALPHA = 0.2;
        const keyFly = { left: false, right: false, forward: false, back: false };
        const flight = { yawVel: 0, thrustVel: 0 };

        function updateZoomLabel() {
            if (!zoomLabelEl) return;
            // Show zoom as a multiplier (e.g. 0.25x, 1.00x, 3.50x)
            const z = Math.max(0.001, Math.min(99, viewZoom));
            zoomLabelEl.textContent = z.toFixed(2) + 'x';
        }
        // Zoom in/out toward a point (canvas space). Keeps that point under the cursor/fingers (browser-like zoom).
        function zoomTowardPoint(zoomCenterX, zoomCenterY, ratio) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const panX = camera.panX || 0;
            const panY = camera.panY || 0;
            viewZoom *= ratio;
            viewZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, viewZoom));
            camera.panX = zoomCenterX - cx - (zoomCenterX - panX - cx) * ratio;
            camera.panY = zoomCenterY - cy - (zoomCenterY - panY - cy) * ratio;
            updateZoomLabel();
        }
        let time = 0;
        let lastStatusText = '';
        let particles = [];

        function project(x, y, z) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            // Main view: 3D perspective (angle, pitch, dist) — layout uses full x,y,z
            if (orthoView) {
                const { minX, maxZ, scale, offsetX, offsetY, centerX, centerZ } = orthoView;
                const cosA = Math.cos(camera.angle);
                const sinA = Math.sin(camera.angle);
                const dx = x - centerX, dz = z - centerZ;
                const xr = centerX + dx * cosA - dz * sinA;
                const zr = centerZ + dx * sinA + dz * cosA;
                let sx0 = (xr - minX) * scale + offsetX;
                let sy0 = (maxZ - zr) * scale + offsetY;
                let sx = cx + (sx0 - cx) * viewZoom + (camera.panX || 0);
                let sy = cy + (sy0 - cy) * viewZoom + (camera.panY || 0);
                return { x: sx, y: sy, z: 0, scale: viewZoom };
            }
            const cos = Math.cos(camera.angle);
            const sin = Math.sin(camera.angle);
            const rx = x * cos - z * sin;
            const rz = x * sin + z * cos;
            const cp = Math.cos(camera.pitch);
            const sp = Math.sin(camera.pitch);
            const viewY = y * cp - rz * sp;
            const viewZ = y * sp + rz * cp;
            const scale = camera.dist / (camera.dist + viewZ + 200);
            let sx = cx + rx * scale;
            let sy = cy + (viewY + camera.height) * scale;
            sx = cx + (sx - cx) * viewZoom;
            sy = cy + (sy - cy) * viewZoom;
            sx += camera.panX || 0;
            sy += camera.panY || 0;
            return {
                x: sx,
                y: sy,
                z: viewZ,
                scale: Math.max(0.1, scale) * viewZoom
            };
        }

        // Unproject screen (canvas) coords to world coords.
        function unproject(screenX, screenY) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const panX = camera.panX || 0;
            const panY = camera.panY || 0;
            // Orthographic main view: reverse XZ mapping (incl. rotation)
            if (orthoView) {
                const { minX, maxZ, scale, offsetX, offsetY, centerX, centerZ } = orthoView;
                const sx0 = (screenX - panX - cx) / viewZoom + cx;
                const sy0 = (screenY - panY - cy) / viewZoom + cy;
                const xr = (sx0 - offsetX) / scale + minX;
                const zr = maxZ - (sy0 - offsetY) / scale;
                const cosA = Math.cos(-camera.angle);
                const sinA = Math.sin(-camera.angle);
                const dx = xr - centerX, dz = zr - centerZ;
                const x = centerX + dx * cosA - dz * sinA;
                const z = centerZ + dx * sinA + dz * cosA;
                return { x, y: 0, z };
            }
            // Fallback: 3D perspective
            const scale = camera.dist / (camera.dist + 200);
            const px = (screenX - panX - cx) / viewZoom + cx;
            const py = (screenY - panY - cy) / viewZoom + cy;
            const rx = (px - cx) / scale;
            const viewY = (py - cy) / scale - camera.height;
            const cp = Math.cos(camera.pitch);
            const sp = Math.sin(camera.pitch);
            const viewZ = 0;
            const y = viewY * cp + viewZ * sp;
            const rz = -viewY * sp + viewZ * cp;
            const cos = Math.cos(camera.angle);
            const sin = Math.sin(camera.angle);
            const x = rx * cos + rz * sin;
            const z = -rx * sin + rz * cos;
            return { x, y, z };
        }

        // Smoothly focus the camera on a specific node: zoom in (if needed) and pan so
        // the node sits at the center of the screen.
        // Optional opts: { targetZoom?: number } to override the default focus zoom level.
        function focusOnNode(node, opts) {
            if (!node || !canvas) return;
            let targetZoom;
            if (opts && typeof opts.targetZoom === 'number') {
                // Respect explicit zoom but keep it within global bounds.
                const clamped = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, opts.targetZoom));
                targetZoom = clamped;
            } else {
                // Target zoom: don't zoom out, only in up to a reasonable max.
                // On the "All" time filter, use a gentler zoom so you keep more global context.
                const desiredZoom = (currentTimeFilter === 'all') ? 1.4 : 2.1;
                targetZoom = Math.min(VIEW_ZOOM_MAX, Math.max(viewZoom, desiredZoom));
            }

            const proj = project(node.x, node.y, node.z);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const panX = camera.panX || 0;
            const panY = camera.panY || 0;
            const newPanX = panX + (centerX - proj.x);
            const newPanY = panY + (centerY - proj.y);

            cameraFocus.active = true;
            cameraFocus.targetZoom = targetZoom;
            cameraFocus.targetPanX = newPanX;
            cameraFocus.targetPanY = newPanY;
        }

        function step() {
            // Kill all movement - nodes stay in place (layout is static)
            nodes.forEach(n => {
                n.vx = 0;
                n.vy = 0;
                n.vz = 0;
            });

            // Flight controls in 3D: arrow keys rotate and move camera
            if (!orthoView) {
                const yawAccel = 0.00018;
                const thrustAccel = 0.35;
                const yawDamp = 0.97;
                const thrustDamp = 0.96;
                if (keyFly.left) flight.yawVel -= yawAccel;
                if (keyFly.right) flight.yawVel += yawAccel;
                if (keyFly.forward) flight.thrustVel -= thrustAccel;
                if (keyFly.back) flight.thrustVel += thrustAccel;
                flight.yawVel *= yawDamp;
                flight.thrustVel *= thrustDamp;
                camera.angle += flight.yawVel;
                if (Math.abs(flight.thrustVel) > 0.01) {
                    camera.dist = Math.max(220, Math.min(2600, camera.dist + flight.thrustVel));
                    camera.height += flight.thrustVel * 0.015;
                }
            }

            // Animate camera focus (smooth pan + zoom) when a node was clicked
            if (cameraFocus.active) {
                const lerp = (current, target, factor) => current + (target - current) * factor;
                const zoomBefore = viewZoom;
                // Easing factors are user-configurable via the drawer "Settings" panel.
                viewZoom = lerp(viewZoom, cameraFocus.targetZoom, cameraFocusSettings.zoomLerp);
                camera.panX = lerp(camera.panX || 0, cameraFocus.targetPanX, cameraFocusSettings.panLerp);
                camera.panY = lerp(camera.panY || 0, cameraFocus.targetPanY, cameraFocusSettings.panLerp);

                // If we're very close to the target, snap and stop animating
                const zoomDone = Math.abs(viewZoom - cameraFocus.targetZoom) < 0.01;
                const panXDone = Math.abs((camera.panX || 0) - cameraFocus.targetPanX) < 0.5;
                const panYDone = Math.abs((camera.panY || 0) - cameraFocus.targetPanY) < 0.5;
                if (zoomDone && panXDone && panYDone) {
                    viewZoom = cameraFocus.targetZoom;
                    camera.panX = cameraFocus.targetPanX;
                    camera.panY = cameraFocus.targetPanY;
                    cameraFocus.active = false;
                }

                if (viewZoom !== zoomBefore) {
                    updateZoomLabel();
                }
            }
        }

        function render() {
            try {
                time++;

                // Smooth backdrop focus: ease between "no selection" and "focused selection"
                const temporalHover = hovered !== null && nodes[hovered] && (nodes[hovered].type || '').toLowerCase() === 'temporal';
                const targetBackdropFocus = (selected !== null || temporalHover) ? 1 : 0;
                const focusLerp = 0.08; // higher = faster response
                backdropFocus += (targetBackdropFocus - backdropFocus) * focusLerp;
                if (backdropFocus < 0.001) backdropFocus = 0;
                if (backdropFocus > 0.999) backdropFocus = 1;

                // When a temporal node is selected, hide everyone except that node + nodes connected to it (direct + same-date)
                if (selected !== null && nodes[selected] && (nodes[selected].type || '').toLowerCase() === 'temporal') {
                    const temporalDate = (nodes[selected].created || nodes[selected].attributes?.created || nodes[selected].attributes?.date || '').toString().trim();
                    const cacheKey = selected + '\0' + temporalDate;
                    if (cacheKey !== temporalFocusCacheKey) {
                        temporalFocusCacheKey = cacheKey;
                        temporalFocusNodeIds = new Set([selected]);
                        edges.forEach(e => {
                            if (e.from === selected) temporalFocusNodeIds.add(e.to);
                            if (e.to === selected) temporalFocusNodeIds.add(e.from);
                        });
                        if (temporalDate) {
                            nodes.forEach((n, i) => {
                                const nodeDate = (n.created || n.attributes?.created || n.attributes?.date || '').toString().trim();
                                if (!nodeDate) return;
                                const sameDate = nodeDate.startsWith(temporalDate) || temporalDate.startsWith(nodeDate);
                                const isLearningOrArchive = ((n.type || n.category || '').toLowerCase() === 'learning') || ((n.type || n.category || '').toLowerCase() === 'openclaw-skill') || ((n.type || n.category || '').toLowerCase() === 'archive') || ((n.type || n.category || '').toLowerCase() === 'file');
                                if (sameDate && isLearningOrArchive) temporalFocusNodeIds.add(i);
                            });
                        }
                    }
                } else {
                    temporalFocusCacheKey = null;
                    temporalFocusNodeIds = null;
                }

                ctx.fillStyle = '#0a1128';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // For wide time filters (week / month / year): compute once per frame the set of indices passing the time filter (strict + connected)
                ensureTimeFilterPassingCache();

                // Bitmask: each index is checked once per frame (edges + draws hit this many times).
                // When the graph was pre-sliced in rebuildDisplayGraphFromFull, every node passes.
                const filterPass = new Uint8Array(nodes.length);
                if (displayGraphFromFilter) {
                    filterPass.fill(1);
                } else {
                    for (let i = 0; i < nodes.length; i++) {
                        filterPass[i] = nodePassesFilterByIndex(i) ? 1 : 0;
                    }
                }
                const passesFilter = (nodeIndex) => filterPass[nodeIndex] === 1;

                // Main view: default = 2D map (same as minimap, larger); toggle to 3D to rotate and explore
                if (use3DView) {
                    orthoView = null;
                } else {
                    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                    for (let i = 0; i < nodes.length; i++) {
                        if (!filterPass[i]) continue;
                        const n = nodes[i];
                        if (n.x < minX) minX = n.x;
                        if (n.x > maxX) maxX = n.x;
                        if (n.z < minZ) minZ = n.z;
                        if (n.z > maxZ) maxZ = n.z;
                    }
                    if (isFinite(minX) && isFinite(maxX) && isFinite(minZ) && isFinite(maxZ)) {
                        const centerX = (minX + maxX) / 2;
                        const centerZ = (minZ + maxZ) / 2;
                        const cosA = Math.cos(camera.angle);
                        const sinA = Math.sin(camera.angle);
                        let rMinX = Infinity, rMaxX = -Infinity, rMinZ = Infinity, rMaxZ = -Infinity;
                        for (let i = 0; i < nodes.length; i++) {
                            if (!filterPass[i]) continue;
                            const n = nodes[i];
                            const dx = n.x - centerX, dz = n.z - centerZ;
                            const rx = centerX + dx * cosA - dz * sinA;
                            const rz = centerZ + dx * sinA + dz * cosA;
                            if (rx < rMinX) rMinX = rx;
                            if (rx > rMaxX) rMaxX = rx;
                            if (rz < rMinZ) rMinZ = rz;
                            if (rz > rMaxZ) rMaxZ = rz;
                        }
                        const spanX = Math.max(1, rMaxX - rMinX);
                        const spanZ = Math.max(1, rMaxZ - rMinZ);
                        const padding = 60;
                        const scale = Math.min(
                            (canvas.width - padding * 2) / spanX,
                            (canvas.height - padding * 2) / spanZ
                        );
                        const cx = canvas.width / 2;
                        const cy = canvas.height / 2;
                        orthoView = {
                            minX: rMinX, maxX: rMaxX, minZ: rMinZ, maxZ: rMaxZ, spanX, spanZ, scale,
                            offsetX: cx - spanX * scale / 2,
                            offsetY: cy - spanZ * scale / 2,
                            centerX, centerZ
                        };
                    } else {
                        orthoView = null;
                    }
                }

                // Build sorted and screen positions: when filter is narrow, project/sort only visible nodes to save CPU
                const filterIsNarrow = !displayGraphFromFilter && (currentTimeFilter !== 'all' || currentCategoryFilter !== 'all');
                let sorted;
                if (filterIsNarrow) {
                    const visibleIndices = [];
                    for (let i = 0; i < nodes.length; i++) {
                        if (filterPass[i]) visibleIndices.push(i);
                    }
                    sorted = visibleIndices.map(idx => {
                        const n = nodes[idx];
                        const p = project(n.x, n.y, n.z);
                        return { node: n, idx, proj: p };
                    }).sort((a, b) => a.proj.z - b.proj.z);
                } else {
                    sorted = nodes.map((n, idx) => {
                        const p = project(n.x, n.y, n.z);
                        return { node: n, idx, proj: p };
                    }).sort((a, b) => a.proj.z - b.proj.z);
                }
                const screenPos = {};
                const nodeSize3D = (use3DView ? 0.2 : 1) * (currentTimeFilter === 'week' || (currentTimeFilter && currentTimeFilter.startsWith('day:')) ? 2 : 1);  // 5x smaller in 3D; 2x larger in week / day: views (literal prefix: render may run before DAY_FILTER_PREFIX init)
                sorted.forEach(s => { screenPos[s.idx] = { x: s.proj.x, y: s.proj.y, scale: s.proj.scale }; });

                // When a node is selected (or a temporal node is hovered), it and its connections stay bright
                let activeNodeIds = null;
                if (selected !== null && nodes[selected]) {
                    activeNodeIds = new Set([selected]);
                    edges.forEach(e => {
                        if (e.from === selected) activeNodeIds.add(e.to);
                        if (e.to === selected) activeNodeIds.add(e.from);
                    });
                } else if (hovered !== null && nodes[hovered] && (nodes[hovered].type || '').toLowerCase() === 'temporal') {
                    // Highlight temporal node + all nodes connected by edges (transitive closure)
                    // + all learnings/archives linked by same date (orbit that temporal node in layout)
                    activeNodeIds = new Set();
                    const stack = [hovered];
                    while (stack.length) {
                        const id = stack.pop();
                        if (activeNodeIds.has(id)) continue;
                        activeNodeIds.add(id);
                        edges.forEach(e => {
                            if (e.from === id && !activeNodeIds.has(e.to)) stack.push(e.to);
                            if (e.to === id && !activeNodeIds.has(e.from)) stack.push(e.from);
                        });
                    }
                    const temporalDate = (nodes[hovered].created || nodes[hovered].attributes?.created || nodes[hovered].attributes?.date || '').toString().trim();
                    if (temporalDate) {
                        nodes.forEach((n, i) => {
                            const nodeDate = (n.created || n.attributes?.created || n.attributes?.date || '').toString().trim();
                            if (!nodeDate) return;
                            const sameDate = nodeDate.startsWith(temporalDate) || temporalDate.startsWith(nodeDate);
                            const isLearningOrArchive = ((n.type || n.category || '').toLowerCase() === 'learning') || ((n.type || n.category || '').toLowerCase() === 'openclaw-skill') || ((n.type || n.category || '').toLowerCase() === 'archive') || ((n.type || n.category || '').toLowerCase() === 'file');
                            if (sameDate && isLearningOrArchive) activeNodeIds.add(i);
                        });
                    }
                }

                // Spotlight: dim factor for content outside radius around cursor
                const spotlightActive = mouseOverCanvas && !isNaN(mouseCanvasX) && !isNaN(mouseCanvasY);
                const distToMouse = (x, y) => Math.hypot(x - mouseCanvasX, y - mouseCanvasY);
                const isLearningLike = (t) => t === 'learning' || t === 'openclaw-skill';

                // Draw synapses (edges) between neurons.
                // Most edges are thin + subtle; connections between temporal nodes and learning
                // nodes are drawn stronger so the "timeline → learning" relationship reads clearly.
                edges.forEach(e => {
                    // Skip edges if either node is filtered out
                    if (!passesFilter(e.from) || !passesFilter(e.to)) return;
                    // When a temporal node is selected, only draw edges in its chain (canvas-only hide)
                    if (temporalFocusNodeIds !== null && (!temporalFocusNodeIds.has(e.from) || !temporalFocusNodeIds.has(e.to))) return;

                    const fromType = (nodes[e.from]?.type || '').toLowerCase();
                    const toType = (nodes[e.to]?.type || '').toLowerCase();
                    const isTemporalLearningEdge =
                        (fromType === 'temporal' && isLearningLike(toType)) ||
                        (toType === 'temporal' && isLearningLike(fromType));
                    // Selection focus: skip drawing the huge dimmed "hairball" (edges between two non-highlighted nodes).
                    if (selected !== null && activeNodeIds !== null && backdropFocus > 0.08) {
                        const touchesSelection = activeNodeIds.has(e.from) || activeNodeIds.has(e.to);
                        if (!touchesSelection && !isTemporalLearningEdge) return;
                    }

                    const isConnected = activeNodeIds !== null && (activeNodeIds.has(e.from) || activeNodeIds.has(e.to));
                    const p1 = screenPos[e.from];
                    const p2 = screenPos[e.to];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const edgeInSpotlight = !spotlightActive || distToMouse(midX, midY) <= SPOTLIGHT_RADIUS;
                    const edgeSpotlightDim = edgeInSpotlight ? 1 : SPOTLIGHT_DIM_ALPHA;
                    
                    if (isConnected) {
                        // Highlight: connected to selected node — bright white line
                        ctx.globalAlpha = edgeSpotlightDim;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    } else {
                        // Emphasize edges that connect temporal → learning nodes so the
                        // "cause → insight" spine is legible, even when nothing is selected.
                        if (isTemporalLearningEdge) {
                            ctx.globalAlpha = 0.55 * edgeSpotlightDim;
                            ctx.strokeStyle = 'rgba(148, 163, 255, 0.95)'; // soft indigo highlight
                            ctx.lineWidth = 2;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();
                            ctx.globalAlpha = 1;
                        } else {
                            // Normal edges: thin, subtle, gray-blue
                            const baseAlpha = 0.25;
                            const minAlpha = 0.04;
                            const edgeDimAlpha = activeNodeIds !== null
                                ? baseAlpha * (1 - backdropFocus) + minAlpha * backdropFocus
                                : baseAlpha;
                            ctx.globalAlpha = edgeDimAlpha * edgeSpotlightDim;
                            ctx.strokeStyle = 'rgba(100, 150, 200, 0.6)';
                            ctx.lineWidth = 1;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();
                            ctx.globalAlpha = 1;
                        }
                    }
                });

                // Draw neurons
                const dimAlpha = 0.22;
                sorted.forEach(item => {
                    const n = item.node;
                    const p = item.proj;
                    
                    if (!passesFilter(item.idx)) return;
                    // When a temporal node is selected, only draw nodes in its chain (canvas-only hide)
                    if (temporalFocusNodeIds !== null && !temporalFocusNodeIds.has(item.idx)) return;

                    // Reset per-node alpha so bright nodes aren't affected by previous dimmed ones
                    ctx.globalAlpha = 1;

                    const isConnected = activeNodeIds !== null && activeNodeIds.has(item.idx);
                    const isDimmed = activeNodeIds !== null && !isConnected;
                    const inSpotlight = !spotlightActive || distToMouse(p.x, p.y) <= SPOTLIGHT_RADIUS;
                    const spotlightDim = inSpotlight ? 1 : SPOTLIGHT_DIM_ALPHA;

                    const r = n.size * p.scale * nodeSize3D;
                    const isImageMedia = n.isImageMedia === true;
                    let glow = n.glow * p.scale * nodeSize3D;
                    if (n.isMemoryRef) {
                        const pulse = 1 + 0.15 * Math.sin(time * 0.08);
                        glow *= pulse;
                    }
                    // Tighter glow when dense: smaller radius, lower opacity so nodes stay readable
                    const glowRadius = Math.min(glow * 0.6, r + 18);
                    if (isDimmed) {
                        // Blend from full brightness to dimAlpha as backdrop focus increases
                        const alpha = (1 - (1 - dimAlpha) * backdropFocus) * spotlightDim;
                        ctx.globalAlpha = alpha;
                    } else if (!inSpotlight) {
                        ctx.globalAlpha = spotlightDim;
                    }

                    // Core neuron: image files = larger circle + cyan ring; others = dot
                    ctx.fillStyle = n.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r, 0, 6.28);
                    ctx.fill();
                    if (isImageMedia) {
                        ctx.strokeStyle = 'rgba(34, 211, 238, 0.92)';
                        ctx.lineWidth = Math.max(1.2, r * 0.1);
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, r, 0, 6.28);
                        ctx.stroke();
                    }

                    // Temporal nodes: highlight ring so they're easy to spot
                    const isTemporalNode = (n.type || '').toLowerCase() === 'temporal';
                    if (isTemporalNode) {
                        ctx.globalAlpha = isDimmed ? dimAlpha : 1;
                        ctx.strokeStyle = 'rgba(255, 170, 0, 0.9)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, r + 3, 0, 6.28);
                        ctx.stroke();
                    }
                });
                
                // Draw labels with progressive zoom-based visibility (multiple tiers)
                // On "All" filter: only show label for the selected node to reduce clutter.
                // On focused time filters (Today / Yesterday / This week): show labels only for:
                //  - temporal timeline anchors
                //  - the selected node
                //  - nodes directly connected to the selected node
                const minSizeForLabel = viewZoom < 0.5 ? 999 :        // No labels when far zoomed
                                        viewZoom < 0.8 ? 15 :         // Only biggest when medium-far (nodes 5x smaller)
                                        viewZoom < 1.2 ? 10 :         // Medium+ when close
                                        6;                            // All when very close
                const isFocusedTimeFilter = currentTimeFilter !== 'all';
                const drawLabelForIndex = (idx) => {
                    const n = nodes[idx];
                    if (!passesFilter(idx)) return;
                    if (temporalFocusNodeIds !== null && !temporalFocusNodeIds.has(idx)) return;
                    const isHovered = hovered === idx;
                    const isNeighborOfSelected = selected !== null && idx !== selected && activeNodeIds !== null && activeNodeIds.has(idx);
                    
                    // When both filters are "all": only show label for the selected node, nodes connected to it,
                    // or the node currently hovered so exploration still feels responsive.
                    if (!isHovered && currentTimeFilter === 'all' && currentCategoryFilter === 'all' && selected !== idx && !isNeighborOfSelected) return;
                    
                    // Focus mode: hide labels for unconnected nodes
                    const isConnected = activeNodeIds !== null && activeNodeIds.has(idx);
                    if (activeNodeIds !== null && !isConnected) return; // Skip label
                    
                    const isSelected = (selected === idx);
                    const isConnectedToSelected = isNeighborOfSelected;
                    const nodeType = (n.type || '').toLowerCase();
                    const isTemporal = nodeType === 'temporal';
                    const isFileNode = nodeType === 'file';
                    const isArchiveNode = nodeType === 'archive';
                    
                    // On focused time filters (Today / Yesterday / This week), hide labels for
                    // dense clusters: only show temporal anchors, the selected node, and its
                    // directly connected neighbors. This prevents huge walls of text when a
                    // day has many file/screenshot nodes.
                    if (!isHovered && isFocusedTimeFilter && !isTemporal && !isSelected && !isConnectedToSelected) {
                        return;
                    }

                    // File/archive nodes now show rich inline previews (image/text/audio/video), so we
                    // don't need labels on simple hover. Keep labels only when they're selected.
                    if ((isFileNode || isArchiveNode) && !isSelected) return;
                    
                    // Size-based visibility: only show labels for important/large neurons
                    // EXCEPTION: always show if selected, in focus mode chain, or temporal (timeline anchors)
                    const isImportant = n.size >= minSizeForLabel || isTemporal;
                    
                    if (!isImportant && !isSelected && !isConnectedToSelected && !isHovered) return; // Skip small, unconnected labels
                    
                    const p = screenPos[idx];
                    const labelInSpotlight = !spotlightActive || distToMouse(p.x, p.y) <= SPOTLIGHT_RADIUS;
                    const r = (n.size * (p.scale ?? 1)) * nodeSize3D;
                    const isDimmed = activeNodeIds !== null && !activeNodeIds.has(idx);
                    const dimAlpha = 0.25;
                    
                    // Title label sizing: keep selected strong, but make hover title a bit smaller
                    const baseSize = 10;
                    const fontSize = isSelected
                        ? baseSize * 1.4
                        : (isHovered ? baseSize * 2.0 : (isConnectedToSelected ? baseSize * 1.1 : baseSize));
                    
                    ctx.font = `bold ${fontSize}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.globalAlpha = (isDimmed ? dimAlpha * 0.95 : 1) * (labelInSpotlight ? 1 : SPOTLIGHT_DIM_ALPHA);
                    
                    const shadowBlur = isSelected ? 12 : 8;
                    const shadowOpacity = isSelected ? 1.0 : 0.9;
                    ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`;
                    ctx.shadowBlur = shadowBlur;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.lineWidth = isSelected ? 4 : 3;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                    
                    ctx.fillStyle = isSelected ? '#ffffaa' : (isHovered ? '#e0f2fe' : '#ffffff');
                    // Title just below the node
                    ctx.strokeText(n.name, p.x, p.y + r + 12);
                    ctx.fillText(n.name, p.x, p.y + r + 12);
                    
                    // When hovered, show a compact inline info line under the label
                    if (isHovered) {
                        const baseInfoSize = 9;
                        const infoFontSize = baseInfoSize * 1.3;
                        ctx.font = `normal ${infoFontSize}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowBlur = 0;
                        // Lighter description text so it pops more against the dark space
                        ctx.fillStyle = '#e5e7eb';
                        const typeLabel = (n.type || '').toString();
                        const desc = (n.desc || '').toString();
                        const maxDescLen = 80;
                        const shortDesc = desc.length > maxDescLen ? desc.slice(0, maxDescLen - 1) + '…' : desc;
                        const info = shortDesc
                            ? `${typeLabel ? typeLabel + ' · ' : ''}${shortDesc}`
                            : typeLabel;
                        if (info) {
                            // Description closer to the title but still with a small gap
                            ctx.fillText(info, p.x, p.y + r + 34);
                        }
                    }
                    
                    ctx.shadowBlur = 0;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 1;
                };
                if (selected !== null && activeNodeIds !== null) {
                    const labelIndices = new Set(activeNodeIds);
                    if (hovered !== null) labelIndices.add(hovered);
                    if (isFocusedTimeFilter) {
                        for (let li = 0; li < nodes.length; li++) {
                            if (!filterPass[li]) continue;
                            if ((nodes[li].type || '').toLowerCase() !== 'temporal') continue;
                            labelIndices.add(li);
                        }
                    }
                    for (const idx of labelIndices) drawLabelForIndex(idx);
                } else {
                    nodes.forEach((n, idx) => drawLabelForIndex(idx));
                }
                
                // Selection highlight ring
                if (selected !== null && nodes[selected]) {
                    const n = nodes[selected];
                    const p = screenPos[selected];
                    const r = (n.size * (p.scale ?? 1)) * nodeSize3D;
                    const outer = r + 8;
                    
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 0.9;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, outer, 0, 6.28);
                    ctx.stroke();
                    
                    // Pulsing outer ring
                    const pulse = Math.sin(time * 0.05) * 0.3 + 0.7;
                    ctx.strokeStyle = `rgba(255, 255, 0, ${pulse * 0.6})`;
                    ctx.lineWidth = 1.75;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, outer + 6, 0, 6.28);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                // Hover highlight (when different from selected): bright ring so the node under cursor is obvious
                if (hovered !== null && hovered !== selected && screenPos[hovered]) {
                    const n = nodes[hovered];
                    const p = screenPos[hovered];
                    const r = (n.size * (p.scale ?? 1)) * nodeSize3D;
                    const outerR = r + 2;
                    ctx.save();
                    ctx.globalAlpha = 1;
                    // Bright cyan outline ring
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, outerR, 0, 6.28);
                    ctx.stroke();
                    // Soft outer glow
                    const outer = outerR + 10;
                    const grad = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, outer);
                    grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
                    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, outer, 0, 6.28);
                    ctx.fill();
                    ctx.restore();
                }

                let visibleNodeCount = 0;
                for (let vi = 0; vi < nodes.length; vi++) {
                    if (filterPass[vi]) visibleNodeCount++;
                }
                let visibleEdgeCount = 0;
                for (let ei = 0; ei < edges.length; ei++) {
                    const ed = edges[ei];
                    if (filterPass[ed.from] && filterPass[ed.to]) visibleEdgeCount++;
                }
                updateNodeCount(visibleNodeCount, visibleEdgeCount);
                const statusText = selected !== null && nodes[selected] ? '🧠 ' + nodes[selected].name : visibleNodeCount + ' neurons · ' + visibleEdgeCount + ' synapses';
                if (lastStatusText !== statusText) {
                    lastStatusText = statusText;
                    if (statusEl) statusEl.textContent = statusText;
                }

                // Minimap last so it always matches this frame (layout + filters + selection); avoids stale view after brain switch if render threw earlier.
                updateMinimap();

                // Smooth view switch: fade out → swap mode → fade in
                if (viewTransitionState !== null) {
                    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                    const elapsed = now - viewTransitionStart;
                    const progress = Math.min(1, elapsed / VIEW_TRANSITION_DURATION);
                    const bg = '#0a1128';
                    if (viewTransitionState === 'out') {
                        ctx.fillStyle = bg;
                        ctx.globalAlpha = progress;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.globalAlpha = 1;
                        if (progress >= 1) {
                            use3DView = !use3DView;
                            viewTransitionState = 'in';
                            viewTransitionStart = now;
                            viewToggleLabelUpdate();
                        }
                    } else {
                        ctx.fillStyle = bg;
                        ctx.globalAlpha = 1 - progress;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.globalAlpha = 1;
                        if (progress >= 1) viewTransitionState = null;
                    }
                }

                step();
                requestAnimationFrame(render);
            } catch (e) {
                console.error('Render error:', e);
            }
        }

        let lastNodeCount = -1;
        let lastSynapseCount = -1;
        function updateNodeCount(nodeCount, synapseCount) {
            if (countEl && lastNodeCount !== nodeCount) { lastNodeCount = nodeCount; countEl.textContent = nodeCount; }
            if (synapseCountEl && lastSynapseCount !== synapseCount) { lastSynapseCount = synapseCount; synapseCountEl.textContent = synapseCount; }
        }

        // Filter bar functionality (desktop + drawer stay in sync)
        // Granular time windows (reliable, easy to explore)
        const TIME_WINDOWS = [
            { id: 'week', label: 'This week' },
            { id: '30m', label: 'Last 30 min', ms: 30 * 60 * 1000 },
            { id: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
            { id: '30d', label: 'Last month', ms: 30 * 24 * 60 * 60 * 1000 },
            { id: '365d', label: 'Last year', ms: 365 * 24 * 60 * 60 * 1000 }
        ];
        const TIME_VALS = ['all'].concat(TIME_WINDOWS.map(w => w.id));
        const ZOOM_DEFAULT_AFTER_SWITCH = 0.8;
        const DAY_FILTER_PREFIX = 'day:';
        function getTimeFilterDisplayName(time) {
            if (time === 'all') return 'All';
            if (time && time.startsWith(DAY_FILTER_PREFIX)) {
                const dateStr = time.slice(DAY_FILTER_PREFIX.length);
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    if (dateStr === getYesterdayLocal()) return 'Yesterday';
                    if (dateStr === getTodayLocal()) return 'Today';
                    const d = new Date(dateStr + 'T12:00:00');
                    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                }
                return dateStr || time;
            }
            const w = TIME_WINDOWS.find(x => x.id === time);
            return w ? w.label : time;
        }
        function getNodeCreatedTimestamp(n) {
            const created = n.created || (n.attributes && (n.attributes.created || n.attributes.date)) || '';
            if (!created) return null;
            const s = String(created).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00').getTime();
            const t = new Date(s).getTime();
            return Number.isFinite(t) ? t : null;
        }
        /** Default landing when no `time` query param: single calendar day = today (local). */
        function getDefaultTimeFilter() {
            return DAY_FILTER_PREFIX + getTodayLocal();
        }
        const defaultCategory = 'all';
        function getFilterFromUrl() {
            const params = new URLSearchParams(window.location.search);
            let time = params.get('time');
            if (time === 'today') time = DAY_FILTER_PREFIX + getTodayLocal();
            if (time === 'yesterday' || time === '24h') time = DAY_FILTER_PREFIX + getYesterdayLocal();
            if (time === '12h' || time === '48h' || time === '7d') time = 'week';
            const category = params.get('category');
            const legacy = params.get('filter');
            let t = TIME_VALS.includes(time) ? time : (time && time.startsWith(DAY_FILTER_PREFIX) ? time : getDefaultTimeFilter());
            let c = (category && category !== '') ? category : defaultCategory;
            if (legacy && !params.get('time') && !category) {
                if (TIME_VALS.includes(legacy)) { t = legacy; }
                else if (legacy === 'today') { t = DAY_FILTER_PREFIX + getTodayLocal(); }
                else if (legacy === 'yesterday') { t = DAY_FILTER_PREFIX + getYesterdayLocal(); }
                else if (legacy === '24h') { t = DAY_FILTER_PREFIX + getYesterdayLocal(); }
                else if (legacy === '12h' || legacy === '48h' || legacy === '7d') { t = 'week'; }
                else if (legacy.startsWith(DAY_FILTER_PREFIX)) { t = legacy; }
                else { c = legacy; }
            }
            return { time: t, category: c };
        }
        function setFilterInUrl(time, category) {
            const url = new URL(window.location.href);
            url.searchParams.set('time', time);
            url.searchParams.set('category', category);
            if (time === getDefaultTimeFilter()) url.searchParams.delete('time');
            if (category === defaultCategory) url.searchParams.delete('category');
            url.searchParams.delete('filter');
            window.history.replaceState(null, '', url.toString());
        }
        let { time: currentTimeFilter, category: currentCategoryFilter } = getFilterFromUrl();
        if (!new URLSearchParams(window.location.search).has('time')) {
            const url = new URL(window.location.href);
            url.searchParams.set('time', currentTimeFilter);
            window.history.replaceState(null, '', url.toString());
        }
        let currentNodeSearchQuery = '';
        if (currentTimeFilter !== 'all') viewZoom = 2.05;
        // Cache for wide time filters (week / month / year): set of node indices that pass time filter (strict + connected). Avoids O(nodes × edges) per frame.
        let timeFilterPassingIndicesCache = null;
        let timeFilterPassingIndicesCacheKey = null;

        /** Undirected adjacency for O(V+E) BFS instead of O(V*E) full edge scans per step. */
        function buildUndirectedAdjacency(nodeCount, edgeList) {
            const adj = new Array(nodeCount);
            for (let i = 0; i < nodeCount; i++) adj[i] = [];
            for (let ei = 0; ei < edgeList.length; ei++) {
                const e = edgeList[ei];
                const a = e.from;
                const b = e.to;
                if (a >= 0 && a < nodeCount && b >= 0 && b < nodeCount) {
                    adj[a].push(b);
                    adj[b].push(a);
                }
            }
            return adj;
        }

        // One snapshot per render frame (time) + filter: avoids O(nodes) calls to getThisWeekRange/getTodayLocal/Date.now per frame.
        let strictTimeSnap = null;
        function ensureStrictTimeSnapForFrame() {
            if (strictTimeSnap && strictTimeSnap.filterKey === currentTimeFilter && strictTimeSnap.frame === time) return;
            const f = currentTimeFilter;
            const now = Date.now();
            strictTimeSnap = { frame: time, filterKey: f, now };
            if (f === 'week') {
                strictTimeSnap.weekRange = getThisWeekRange();
                strictTimeSnap.weekStartMs = getStartOfWeekMondayLocalMs();
                strictTimeSnap.weekEndMs = getEndOfWeekSundayLocalMs();
            } else {
                const w = TIME_WINDOWS.find(x => x.id === f);
                if (w && w.ms != null) strictTimeSnap.rollingCutoff = now - w.ms;
            }
        }
        // Strict pass: day:YYYY-MM-DD by calendar date on node; week/rolling by time snap. (Today/Yesterday presets use day: URLs.)
        function nodePassesTimeFilterStrict(n) {
            if (displayGraphFromFilter) return true;
            if (currentTimeFilter === 'all') return true;
            if (currentTimeFilter && currentTimeFilter.startsWith(DAY_FILTER_PREFIX)) {
                const filterDate = currentTimeFilter.slice(DAY_FILTER_PREFIX.length).trim();
                const nodeDate = (n.created || (n.attributes && (n.attributes.created || n.attributes.date)) || '').toString().trim();
                if (!nodeDate) return false;
                const nodeDateOnly = nodeDate.slice(0, 10);
                return nodeDateOnly === filterDate || nodeDate.startsWith(filterDate);
            }
            ensureStrictTimeSnapForFrame();
            const snap = strictTimeSnap;
            const rawCreated = (n.created || (n.attributes && (n.attributes.created || n.attributes.date)) || '').toString().trim();
            const nodeDateOnly = rawCreated.slice(0, 10);
            if (currentTimeFilter === 'week') {
                const wr = snap.weekRange;
                if (/^\d{4}-\d{2}-\d{2}$/.test(nodeDateOnly)) {
                    return nodeDateOnly >= wr.start && nodeDateOnly <= wr.end;
                }
                const ts = getNodeCreatedTimestamp(n);
                if (ts == null) return false;
                return ts >= snap.weekStartMs && ts <= snap.weekEndMs;
            }
            if (snap.rollingCutoff == null) return false;
            const ts = getNodeCreatedTimestamp(n);
            if (ts == null) return false;
            return ts >= snap.rollingCutoff;
        }
        // Week (and other wide) views: also show learnings/archives connected to a node that passes the time window.
        function nodePassesTimeFilter(n) {
            if (displayGraphFromFilter) return true;
            if (nodePassesTimeFilterStrict(n)) return true;
            if (currentTimeFilter === 'all' || !currentTimeFilter) return false;
            if (currentTimeFilter.startsWith(DAY_FILTER_PREFIX)) return false;
            if (WIDE_TIME_FILTERS.indexOf(currentTimeFilter) < 0) return false;
            const idx = n.id;
            if (typeof idx !== 'number' || idx < 0 || idx >= nodes.length || nodes[idx] !== n) return false;
            return nodePassesTimeFilterByIndex(idx);
        }
        // Index-aware version for hot loops: avoids O(nodes) findIndex when caller already has idx.
        // When in wide time filter (week / month / year), use cached set of passing indices so we don't do O(edges) per node per frame.
        function nodePassesTimeFilterByIndex(idx) {
            if (displayGraphFromFilter) return true;
            if (nodePassesTimeFilterStrict(nodes[idx])) return true;
            if (currentTimeFilter === 'all' || !currentTimeFilter) return false;
            if (currentTimeFilter.startsWith(DAY_FILTER_PREFIX)) return false;
            if (WIDE_TIME_FILTERS.indexOf(currentTimeFilter) < 0) return false;
            if (timeFilterPassingIndicesCacheKey === currentTimeFilter && timeFilterPassingIndicesCache) return timeFilterPassingIndicesCache.has(idx);
            for (let i = 0; i < edges.length; i++) {
                const e = edges[i];
                const otherIdx = e.from === idx ? e.to : e.to === idx ? e.from : -1;
                if (otherIdx >= 0 && nodePassesTimeFilterStrict(nodes[otherIdx])) return true;
            }
            return false;
        }
        function ensureTimeFilterPassingCache() {
            if (displayGraphFromFilter) return;
            if (currentTimeFilter === 'all' || currentTimeFilter.startsWith(DAY_FILTER_PREFIX) || WIDE_TIME_FILTERS.indexOf(currentTimeFilter) < 0) return;
            if (timeFilterPassingIndicesCacheKey === currentTimeFilter && timeFilterPassingIndicesCache) return;
            const strictPassing = new Set();
            for (let i = 0; i < nodes.length; i++) {
                if (nodePassesTimeFilterStrict(nodes[i])) strictPassing.add(i);
            }
            const adj = buildUndirectedAdjacency(nodes.length, edges);
            const passing = new Set(strictPassing);
            const queue = Array.from(strictPassing);
            let qh = 0;
            while (qh < queue.length) {
                const idx = queue[qh++];
                const nb = adj[idx];
                for (let k = 0; k < nb.length; k++) {
                    const other = nb[k];
                    if (!passing.has(other)) {
                        passing.add(other);
                        queue.push(other);
                    }
                }
            }
            timeFilterPassingIndicesCache = passing;
            timeFilterPassingIndicesCacheKey = currentTimeFilter;
        }
        // Jump to node order: Temporal first, then Learnings, then Archive (and File), then rest
        const filterCategoryOrder = CONFIG.filterCategoryOrder || ['temporal', 'learning', 'archive', 'file', 'self', 'foundation', 'value', 'capability', 'project', 'infrastructure', 'person'];
        const filterCategoryLabels = CONFIG.filterCategoryLabels || { temporal: 'Temporal', learning: 'Learnings', archive: 'Archive', file: 'File', self: 'Self', foundation: 'Foundation', value: 'Values', capability: 'Capabilities', project: 'Projects', infrastructure: 'Infrastructure', person: 'People' };
        let categoryTypesCacheKey = '';
        let categoryTypesCacheList = null;
        function getAvailableCategoryTypes() {
            if (!graphFullNodes.length) return [];
            const cacheKey = currentTimeFilter + '|' + graphStructureVersion;
            if (categoryTypesCacheKey === cacheKey && categoryTypesCacheList) return categoryTypesCacheList;
            const prevN = nodes;
            const prevE = edges;
            const prevDisplay = displayGraphFromFilter;
            nodes = graphFullNodes;
            edges = graphFullEdges;
            displayGraphFromFilter = false;
            timeFilterPassingIndicesCacheKey = null;
            timeFilterPassingIndicesCache = null;
            ensureTimeFilterPassingCache();
            const timeFiltered = [];
            for (let i = 0; i < nodes.length; i++) {
                if (nodePassesTimeFilterByIndex(i)) timeFiltered.push(nodes[i]);
            }
            nodes = prevN;
            edges = prevE;
            displayGraphFromFilter = prevDisplay;
            const types = new Set();
            let hasMemoryRef = false;
            timeFiltered.forEach(n => {
                if (n.isMemoryRef) hasMemoryRef = true;
                const t = (n.type || '').toLowerCase();
                if (!t) return;
                // Treat openclaw-skill as learning for category UI grouping.
                if (t === 'openclaw-skill') types.add('learning');
                else types.add(t);
            });
            const order = filterCategoryOrder || [];
            const ordered = order.filter(cat => types.has(cat));
            const rest = [...types].filter(cat => !order.includes(cat)).sort();
            const list = ordered.concat(rest);
            if (hasMemoryRef) list.push('memorylinks');
            categoryTypesCacheKey = cacheKey;
            categoryTypesCacheList = list;
            return list;
        }
        function populateCategoryFilterRow() {
            const row = document.getElementById('filter-row-category');
            if (!row) return;
            const available = getAvailableCategoryTypes();
            if (graphFullNodes.length && available.indexOf(currentCategoryFilter) === -1) currentCategoryFilter = 'all';
            row.innerHTML = '';
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.className = 'filter-btn filter-btn-category' + (currentCategoryFilter === 'all' ? ' active' : '');
            allBtn.setAttribute('data-filter-category', 'all');
            allBtn.textContent = 'All';
            allBtn.addEventListener('click', () => setActiveCategoryFilter('all'));
            row.appendChild(allBtn);
            available.forEach(cat => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'filter-btn filter-btn-category' + (currentCategoryFilter === cat ? ' active' : '');
                btn.setAttribute('data-filter-category', cat);
                btn.textContent = filterCategoryLabels[cat] || (cat === 'memorylinks' ? 'Memory links' : (cat.charAt(0).toUpperCase() + cat.slice(1)));
                btn.addEventListener('click', () => setActiveCategoryFilter(cat));
                row.appendChild(btn);
            });
        }

        let filterListRafId = 0;
        function schedulePopulateFilterList() {
            if (filterListRafId) return;
            const run = () => {
                filterListRafId = 0;
                populateFilterList();
            };
            if (typeof requestAnimationFrame !== 'undefined') {
                filterListRafId = requestAnimationFrame(run);
            } else {
                filterListRafId = setTimeout(run, 0);
            }
        }

        function setActiveTimeFilter(time, opts) {
            currentTimeFilter = time;
            timeFilterPassingIndicesCacheKey = null;
            strictTimeSnap = null;
            // Keep current zoom and pan so user stays in the same view; only the filtered nodes change.
            if (opts && opts.zoomDefault != null) {
                camera.panX = 0;
                camera.panY = 0;
                viewZoom = opts.zoomDefault;
                updateZoomLabel();
            }
            document.querySelectorAll('[data-filter-time]').forEach(b => {
                b.classList.toggle('active', b.dataset.filterTime === currentTimeFilter);
            });
            setFilterInUrl(currentTimeFilter, currentCategoryFilter);
            if (timeFilterLabelEl) timeFilterLabelEl.textContent = getTimeFilterDisplayName(currentTimeFilter);
            populateCategoryFilterRow();
            const selKey = selected !== null && nodes[selected] ? nodes[selected].idKey : null;
            rebuildDisplayGraphFromFull();
            resyncSelectionByIdKey(selKey);
            const count = nodes.length;
            const edgeCount = edges.length;
            console.log('Time: ' + getTimeFilterDisplayName(time) + ', Category: ' + currentCategoryFilter + ' — ' + count + ' neurons, ' + edgeCount + ' synapses');
            schedulePopulateFilterList();
        }
        function setActiveCategoryFilter(category) {
            currentCategoryFilter = category;
            document.querySelectorAll('[data-filter-category]').forEach(b => {
                b.classList.toggle('active', b.dataset.filterCategory === currentCategoryFilter);
            });
            setFilterInUrl(currentTimeFilter, currentCategoryFilter);
            const selKey = selected !== null && nodes[selected] ? nodes[selected].idKey : null;
            rebuildDisplayGraphFromFull();
            resyncSelectionByIdKey(selKey);
            const count = nodes.length;
            const edgeCount = edges.length;
            console.log('Time: ' + currentTimeFilter + ', Category: ' + category + ' — ' + count + ' neurons, ' + edgeCount + ' synapses');
            schedulePopulateFilterList();
        }
        function nodePassesFilter(n) {
            if (displayGraphFromFilter) return true;
            const timePass = nodePassesTimeFilter(n);
            if (!timePass) return false;
            if (currentCategoryFilter === 'all') return true;
            if (currentCategoryFilter === 'memorylinks') return !!n.isMemoryRef;
            const typeForFilter = (CONFIG.filterToType && CONFIG.filterToType[currentCategoryFilter]) || currentCategoryFilter;
            const nodeType = (n.type || '').toLowerCase();
            const filterType = (typeForFilter || '').toLowerCase();
            if (filterType === 'learning') {
                // Treat `openclaw-skill` as a learning-like node for filter purposes.
                return nodeType === 'learning' || nodeType === 'openclaw-skill';
            }
            if (filterType === 'archive' || filterType === 'file') {
                // Treat archive and file nodes as the same for filtering.
                return nodeType === 'archive' || nodeType === 'file';
            }
            return nodeType === filterType;
        }
        // Index-aware version for hot loops: avoids findIndex inside nodePassesTimeFilter.
        function nodePassesFilterByIndex(idx) {
            if (displayGraphFromFilter) return true;
            const n = nodes[idx];
            const timePass = nodePassesTimeFilterByIndex(idx);
            if (!timePass) return false;
            if (currentCategoryFilter === 'all') return true;
            if (currentCategoryFilter === 'memorylinks') return !!n.isMemoryRef;
            const typeForFilter = (CONFIG.filterToType && CONFIG.filterToType[currentCategoryFilter]) || currentCategoryFilter;
            const nodeType = (n.type || '').toLowerCase();
            const filterType = (typeForFilter || '').toLowerCase();
            if (filterType === 'learning') {
                return nodeType === 'learning' || nodeType === 'openclaw-skill';
            }
            if (filterType === 'archive' || filterType === 'file') {
                return nodeType === 'archive' || nodeType === 'file';
            }
            return nodeType === filterType;
        }

        /** Build `nodes`/`edges` from `graphFull*` using current time + category filters (runs on filter or data load, not each frame). */
        function rebuildDisplayGraphFromFull() {
            if (!graphFullNodes.length) {
                nodes = [];
                edges = [];
                displayGraphFromFilter = false;
                return;
            }
            if (currentTimeFilter === 'all' && currentCategoryFilter === 'all') {
                nodes = graphFullNodes;
                edges = graphFullEdges;
                displayGraphFromFilter = false;
                return;
            }
            nodes = graphFullNodes;
            edges = graphFullEdges;
            displayGraphFromFilter = false;
            timeFilterPassingIndicesCacheKey = null;
            timeFilterPassingIndicesCache = null;
            temporalFocusCacheKey = null;
            temporalFocusNodeIds = null;
            ensureTimeFilterPassingCache();
            const keep = [];
            for (let i = 0; i < nodes.length; i++) {
                if (nodePassesFilterByIndex(i)) keep.push(i);
            }
            const oldToNew = new Map();
            const newNodes = keep.map((oldIdx, j) => {
                oldToNew.set(oldIdx, j);
                const src = graphFullNodes[oldIdx];
                return Object.assign({}, src, { id: j });
            });
            const newEdges = [];
            for (let ei = 0; ei < graphFullEdges.length; ei++) {
                const e = graphFullEdges[ei];
                const from = oldToNew.get(e.from);
                const to = oldToNew.get(e.to);
                if (from !== undefined && to !== undefined) {
                    newEdges.push({ from, to, weight: e.weight });
                }
            }
            nodes = newNodes;
            edges = newEdges;
            displayGraphFromFilter = true;
        }

        function resyncSelectionByIdKey(selKey) {
            if (!selKey) return;
            const ni = nodes.findIndex(n => n.idKey === selKey);
            if (ni >= 0) {
                selected = ni;
                return;
            }
            selected = null;
            showNodeDetails(null);
            showNodeDetailsInDrawer(null);
            window.location.hash = '';
        }
        // Time filters live in the zoom panel (next to minimap), not in the side menu
        populateCategoryFilterRow();

        const nodeSearchInputs = [document.getElementById('node-search-input')].filter(Boolean);
        let searchTimeout;
        if (nodeSearchInputs.length > 0) {
            nodeSearchInputs.forEach(input => {
                input.value = currentNodeSearchQuery;
                input.addEventListener('input', () => {
                    // Debounce search input by 300ms
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        currentNodeSearchQuery = (input.value || '').trim().toLowerCase();
                        populateFilterList();
                    }, 300);
                });
            });
            populateFilterList();
        }

        function applyFilter() {
            document.querySelectorAll('[data-filter-time]').forEach(b => {
                b.classList.toggle('active', b.dataset.filterTime === currentTimeFilter);
            });
            populateCategoryFilterRow();
            schedulePopulateFilterList();
        }

        // Collapsible filter bar
        const filterBar = document.getElementById('filter-bar');
        const filterBarToggle = document.getElementById('filter-bar-toggle');
        const FILTER_BAR_COLLAPSED_KEY = 'neuroGraphFilterBarCollapsed';
        if (filterBar && filterBarToggle) {
            const collapsed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FILTER_BAR_COLLAPSED_KEY) === 'true';
            if (collapsed) {
                filterBar.classList.add('collapsed');
                filterBarToggle.setAttribute('aria-expanded', 'false');
            }
            filterBarToggle.addEventListener('click', () => {
                const isCollapsed = filterBar.classList.toggle('collapsed');
                filterBarToggle.setAttribute('aria-expanded', String(!isCollapsed));
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(FILTER_BAR_COLLAPSED_KEY, String(isCollapsed));
            });
        }

        // Mobile drawer: 3 levels (10%, 30%, 70% of viewport) like Google Maps
        const DRAWER_LEVELS = [10, 30, 70]; // vh visible
        let drawerLevel = 0; // 0 = peek (10%), 1 = mid (30%), 2 = full (70%)
        let drawerDragJustEnded = false;
        const drawer = document.getElementById('bottomDrawer');
        const drawerHeader = drawer ? drawer.querySelector('.drawer-header') : null;
        
        function setDrawerLevel(level) {
            level = Math.max(0, Math.min(2, level));
            drawerLevel = level;
            if (!drawer) return; // Mobile uses right-side file drawer only
            drawer.classList.remove('drawer-level-0', 'drawer-level-1', 'drawer-level-2');
            drawer.classList.add('drawer-level-' + level);
            drawer.style.transform = '';
            const canvas = document.getElementById('canvas');
            const btn = document.getElementById('drawer-toggle');
            const scrim = document.getElementById('drawerScrim');
            const isPeek = level === 0;
            if (canvas) canvas.classList.toggle('drawer-open', !isPeek);
            if (scrim) {
                if (isPeek) {
                    scrim.classList.remove('is-open');
                    scrim.setAttribute('aria-hidden', 'true');
                } else {
                    scrim.classList.add('is-open');
                    scrim.setAttribute('aria-hidden', 'false');
                }
            }
            if (btn) {
                if (level === 0) {
                    btn.textContent = '▲';
                    btn.setAttribute('aria-label', 'Expand details');
                } else if (level === 1) {
                    btn.textContent = '▲';
                    btn.setAttribute('aria-label', 'Expand to full');
                } else {
                    btn.textContent = '▼';
                    btn.setAttribute('aria-label', 'Collapse');
                }
            }
        }
        
        // Backwards compat: treat open=true as level 2, open=false as level 0
        function setDrawerOpen(open) {
            setDrawerLevel(open ? 2 : 0);
        }
        
        if (drawerHeader) {
            const SNAP_THRESHOLD = 20; // px past midpoint to snap to next level
            let dragStartY = 0;
            let dragStartLevel = 0;
            let dragStartVisibleVh = 10; // visible at drag start
            let isDragging = false;
            function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }
            function onDragStart(e) {
                if (window.innerWidth > 768) return;
                dragStartY = getY(e);
                dragStartLevel = drawerLevel;
                dragStartVisibleVh = DRAWER_LEVELS[drawerLevel];
                isDragging = false;
            }
            function onDragMove(e) {
                if (window.innerWidth > 768) return;
                const dy = getY(e) - dragStartY;
                if (!isDragging && Math.abs(dy) > 10) isDragging = true;
                if (isDragging && e.cancelable) e.preventDefault();
                if (!isDragging) return;
                const vhPerPx = 0.4;
                let visibleVh = dragStartVisibleVh - dy * vhPerPx;
                visibleVh = Math.max(10, Math.min(70, visibleVh));
                drawer.style.transition = 'none';
                drawer.classList.remove('drawer-level-0', 'drawer-level-1', 'drawer-level-2');
                drawer.style.transform = 'translateY(calc(100% - ' + visibleVh + 'vh))';
            }
            function onDragEnd(e) {
                if (window.innerWidth > 768) return;
                const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
                const dy = endY - dragStartY;
                drawer.style.transition = '';
                if (isDragging) {
                    drawerDragJustEnded = true;
                    setTimeout(function() { drawerDragJustEnded = false; }, 300);
                    const vhPerPx = 0.4;
                    let visibleVh = dragStartVisibleVh - dy * vhPerPx;
                    visibleVh = Math.max(10, Math.min(70, visibleVh));
                    let snapLevel = 0;
                    if (visibleVh < 20) snapLevel = 0;
                    else if (visibleVh < 50) snapLevel = 1;
                    else snapLevel = 2;
                    setDrawerLevel(snapLevel);
                }
                isDragging = false;
                dragStartY = 0;
            }
            drawerHeader.addEventListener('touchstart', onDragStart, { passive: true });
            drawerHeader.addEventListener('touchmove', onDragMove, { passive: false });
            drawerHeader.addEventListener('touchend', onDragEnd, { passive: true });
            drawerHeader.addEventListener('mousedown', onDragStart);
            document.addEventListener('mousemove', function move(e) {
                if (dragStartY === 0) return;
                onDragMove(e);
            });
            document.addEventListener('mouseup', function up(e) {
                if (dragStartY !== 0) { onDragEnd(e); dragStartY = 0; }
            });
        }
        
        document.getElementById('drawer-toggle')?.addEventListener('click', function(e) {
            if (window.innerWidth > 768) return;
            if (drawerDragJustEnded) return;
            const nextLevel = (drawerLevel + 1) % 3;
            setDrawerLevel(nextLevel);
            if (nextLevel > 0) showNodeDetailsInDrawer(selected !== null && nodes[selected] ? nodes[selected] : null);
        });
        document.getElementById('drawerScrim')?.addEventListener('click', function() {
            if (window.innerWidth > 768) return;
            setDrawerLevel(0);
        });

        // Settings: camera focus style (sidebar #info + mobile drawer). Keeps both selects in sync.
        (function initDrawerSettings() {
            const panelSelect = document.getElementById('panel-camera-style');
            const drawerSelect = document.getElementById('drawer-camera-style');
            const selects = [panelSelect, drawerSelect].filter(Boolean);
            if (selects.length === 0) return;
            function applyStyle(style) {
                cameraFocusSettings.style = style;
                if (style === 'snappy') {
                    cameraFocusSettings.zoomLerp = 0.018;
                    cameraFocusSettings.panLerp = 0.02;
                } else if (style === 'cinematic') {
                    // 2x slower than previous cinematic for very smooth motion
                    cameraFocusSettings.zoomLerp = 0.0036;
                    cameraFocusSettings.panLerp = 0.0044;
                } else {
                    cameraFocusSettings.zoomLerp = 0.012;
                    cameraFocusSettings.panLerp = 0.0128;
                }
            }
            applyStyle(cameraFocusSettings.style || 'smooth');
            selects.forEach(s => { s.value = cameraFocusSettings.style; });
            function onChange() {
                const source = this;
                const style = source.value;
                applyStyle(style);
                selects.forEach(s => { if (s !== source) s.value = style; });
            }
            selects.forEach(s => s.addEventListener('change', onChange));
        })();

        // Lightweight file type detector for inline previews
        function detectFileType(filename) {
            if (!filename || typeof filename !== 'string') return 'unknown';
            const ext = filename.split('.').pop().toLowerCase();
            const audioExts = ['webm', 'wav', 'mp3', 'ogg'];
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
            const videoExts = ['mp4', 'webm', 'mov'];
            const textExts = ['txt', 'md', 'markdown', 'log'];
            if (audioExts.includes(ext)) return 'audio';
            if (imageExts.includes(ext)) return 'image';
            if (videoExts.includes(ext)) return 'video';
            if (textExts.includes(ext)) return 'text';
            return 'unknown';
        }

        // Inline image hover preview (small tooltip near cursor)
        let imageHoverEl = null;
        function getImageHoverPreview() {
            if (imageHoverEl) return imageHoverEl;
            const wrap = document.createElement('div');
            wrap.id = 'image-hover-preview';
            wrap.className = 'image-hover-preview';
            wrap.innerHTML = '<div class="image-hover-inner"><img alt="Image preview" /></div>';
            const style = document.createElement('style');
            style.textContent = `
                .image-hover-preview { position: fixed; z-index: 40; pointer-events: none; display: none; }
                .image-hover-preview.is-visible { display: block; }
                .image-hover-inner { background: rgba(15,23,42,0.96); border-radius: 10px; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.75); border: 1px solid rgba(56,189,248,0.7); max-width: 560px; max-height: 440px; }
                .image-hover-inner img { max-width: 544px; max-height: 424px; display: block; border-radius: 8px; }
                @media (max-width: 768px) {
                    .image-hover-preview { display: none !important; }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            imageHoverEl = wrap;
            return wrap;
        }

        function showImageHover(node, clientX, clientY) {
            if (!node || !node.attributes) return;
            const filePath = node.attributes.filePath || node.attributes.rawContentPath || node.attributes.file_url || node.attributes.path;
            if (!filePath) return;
            const fileType = detectFileType(filePath);
            if (fileType !== 'image') return;

            const src = resolvePath(filePath);
            const wrap = getImageHoverPreview();
            const img = wrap.querySelector('img');
            if (!img) return;
            img.src = src;

            const pad = 16;
            const vw = window.innerWidth || 0;
            const vh = window.innerHeight || 0;
            let left = clientX + pad;
            let top = clientY + pad;
            const estWidth = 560;
            const estHeight = 440;
            if (left + estWidth > vw - pad) left = clientX - estWidth - pad;
            if (left < pad) left = pad;
            if (top + estHeight > vh - pad) top = clientY - estHeight - pad;
            if (top < pad) top = pad;
            wrap.style.left = left + 'px';
            wrap.style.top = top + 'px';
            wrap.classList.add('is-visible');
        }

        function hideImageHover() {
            if (!imageHoverEl) return;
            imageHoverEl.classList.remove('is-visible');
        }

        let audioHoverEl = null;
        let audioHoverAudio = null;
        function getAudioHoverPreview() {
            if (audioHoverEl) return audioHoverEl;
            const wrap = document.createElement('div');
            wrap.id = 'audio-hover-preview';
            wrap.className = 'audio-hover-preview';
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'metadata';
            wrap.appendChild(audio);
            const style = document.createElement('style');
            style.textContent = `
                .audio-hover-preview { position: fixed; z-index: 40; display: none; pointer-events: auto; }
                .audio-hover-preview.is-visible { display: block; }
                .audio-hover-preview { background: rgba(15,23,42,0.96); border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.75); border: 1px solid rgba(56,189,248,0.7); min-width: 220px; }
                .audio-hover-preview audio { width: 200px; height: 36px; display: block; outline: none; }
                .audio-hover-preview audio::-webkit-media-controls-panel { background: rgba(30,41,59,0.95); }
                @media (max-width: 768px) {
                    .audio-hover-preview { display: none !important; }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            audioHoverEl = wrap;
            audioHoverAudio = audio;
            return wrap;
        }
        function showAudioHover(node, clientX, clientY) {
            if (!node || !node.attributes) return;
            const filePath = node.attributes.filePath || node.attributes.rawContentPath || node.attributes.file_url || node.attributes.path;
            if (!filePath) return;
            const fileType = detectFileType(filePath);
            if (fileType !== 'audio') return;

            const src = resolvePath(filePath);
            const wrap = getAudioHoverPreview();
            const audio = wrap.querySelector('audio') || audioHoverAudio;
            if (!audio) return;

            if (audio.src !== src || !wrap.classList.contains('is-visible')) {
                audio.src = src;
                audio.play().catch(() => {});
            }

            const pad = 16;
            const vw = window.innerWidth || 0;
            const vh = window.innerHeight || 0;
            const estWidth = 224;
            const estHeight = 56;
            let left = clientX + pad;
            let top = clientY + pad;
            if (left + estWidth > vw - pad) left = clientX - estWidth - pad;
            if (left < pad) left = pad;
            if (top + estHeight > vh - pad) top = clientY - estHeight - pad;
            if (top < pad) top = pad;
            wrap.style.left = left + 'px';
            wrap.style.top = top + 'px';
            wrap.classList.add('is-visible');
        }
        function hideAudioHover() {
            if (!audioHoverEl) return;
            audioHoverEl.classList.remove('is-visible');
            if (audioHoverAudio) {
                audioHoverAudio.pause();
                audioHoverAudio.removeAttribute('src');
            }
        }

        // Inline text hover preview for .txt/.md files (first 5 lines near cursor)
        let textHoverEl = null;
        let textHoverContentEl = null;
        function getTextHoverPreview() {
            if (textHoverEl) return textHoverEl;
            const wrap = document.createElement('div');
            wrap.id = 'text-hover-preview';
            wrap.className = 'text-hover-preview';
            wrap.innerHTML = '<div class="text-hover-inner"><pre class="text-hover-content"></pre></div>';
            const style = document.createElement('style');
            style.textContent = `
                .text-hover-preview { position: fixed; z-index: 40; display: none; pointer-events: auto; max-width: min(360px, calc(100vw - 32px)); }
                .text-hover-preview.is-visible { display: block; }
                .text-hover-inner { background: rgba(15,23,42,0.96); border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.75); border: 1px solid rgba(148,163,184,0.9); }
                .text-hover-content { margin: 0; font-size: 10px; line-height: 1.5; color: #e5e7eb; white-space: pre-wrap; max-height: 7.5em; overflow: hidden; }
                @media (max-width: 768px) {
                    .text-hover-preview { display: none !important; }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            textHoverEl = wrap;
            textHoverContentEl = wrap.querySelector('.text-hover-content');
            return wrap;
        }
        function showTextHover(node, clientX, clientY) {
            if (!node || !node.attributes) return;
            const filePath = node.attributes.filePath || node.attributes.rawContentPath || node.attributes.file_url || node.attributes.path;
            if (!filePath) return;
            const fileType = detectFileType(filePath);
            if (fileType !== 'text') return;

            const src = resolvePath(filePath);
            const wrap = getTextHoverPreview();
            const contentEl = textHoverContentEl || wrap.querySelector('.text-hover-content');
            if (!contentEl) return;

            if (contentEl.dataset.src === src && wrap.classList.contains('is-visible')) {
                // Just reposition existing preview
            } else {
                contentEl.dataset.src = src;
                contentEl.textContent = 'Loading preview…';
                fetch(src)
                    .then(r => r.ok ? r.text() : Promise.reject(new Error('Failed to load text')))
                    .then(text => {
                        const normalized = (text || '').replace(/\r\n/g, '\n');
                        const lines = normalized.split('\n');
                        const previewLines = lines.slice(0, 5);
                        let preview = previewLines.join('\n');
                        if (lines.length > 5) preview += '\n…';
                        contentEl.textContent = preview || '(empty file)';
                    })
                    .catch(() => {
                        contentEl.textContent = 'Could not load text preview.';
                    });
            }

            const pad = 16;
            const vw = window.innerWidth || 0;
            const vh = window.innerHeight || 0;
            const estWidth = 320;
            const estHeight = 120;
            let left = clientX + pad;
            let top = clientY + pad;
            if (left + estWidth > vw - pad) left = clientX - estWidth - pad;
            if (left < pad) left = pad;
            if (top + estHeight > vh - pad) top = clientY - estHeight - pad;
            if (top < pad) top = pad;
            wrap.style.left = left + 'px';
            wrap.style.top = top + 'px';
            wrap.classList.add('is-visible');
        }
        function hideTextHover() {
            if (!textHoverEl) return;
            textHoverEl.classList.remove('is-visible');
        }

        // Inline file preview panel (dock on the right side of the viewport)
        let filePreviewEl = null;
        function getFilePreviewPanel() {
            if (filePreviewEl) return filePreviewEl;
            const panel = document.createElement('div');
            panel.id = 'file-preview-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'File preview');
            panel.className = 'file-preview-panel';
            panel.innerHTML = '<div class="file-preview-inner"><div class="file-preview-header"><span class="file-preview-title"></span><button type="button" class="file-preview-close" aria-label="Close file preview">✕</button></div><div class="file-preview-body"></div></div>';
            const style = document.createElement('style');
            style.textContent = `
                .file-preview-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 100vw); z-index: 30; display: none; pointer-events: auto; }
                .file-preview-panel.is-open { display: block; }
                .file-preview-inner { height: 100%; display: flex; flex-direction: column; background: rgba(4, 7, 19, 0.97); border-left: 2px solid rgba(56, 189, 248, 0.7); box-shadow: -12px 0 32px rgba(0,0,0,0.6); padding: 12px 14px; box-sizing: border-box; color: #e5e7eb; font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
                .file-preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
                .file-preview-title { font-size: 13px; font-weight: 600; color: #facc15; padding-right: 8px; }
                .file-preview-close { background: rgba(15,23,42,0.9); border-radius: 999px; border: 1px solid rgba(148,163,184,0.7); color: #e5e7eb; cursor: pointer; padding: 2px 8px; font-size: 11px; }
                .file-preview-close:hover { background: rgba(30,64,175,0.95); border-color: rgba(56,189,248,0.9); color: #f9fafb; }
                .file-preview-body { flex: 1; min-height: 0; overflow: auto; border-radius: 8px; background: radial-gradient(circle at top, rgba(15,23,42,0.6), rgba(15,23,42,1)); padding: 10px; box-sizing: border-box; }
                .file-preview-body audio,
                .file-preview-body video { width: 100%; outline: none; }
                .file-preview-body img { max-width: 100%; height: auto; display: block; border-radius: 8px; box-shadow: 0 10px 30px rgba(15,23,42,0.9); }
                .file-preview-meta { margin-top: 10px; font-size: 11px; color: #9ca3af; line-height: 1.5; }
                .file-preview-meta strong { color: #e5e7eb; }
                .file-preview-actions { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
                .file-preview-actions button { font-size: 11px; padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.7); background: rgba(15,23,42,0.9); color: #e5e7eb; cursor: pointer; }
                .file-preview-actions button:hover { background: rgba(30,64,175,0.95); border-color: rgba(56,189,248,0.9); color: #f9fafb; }
                @media (max-width: 768px) {
                    .file-preview-panel { width: 100vw; border-left: none; }
                    .file-preview-inner { border-left: none; border-top: 2px solid rgba(56,189,248,0.7); box-shadow: 0 -12px 32px rgba(0,0,0,0.7); }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(panel);
            panel.querySelector('.file-preview-close').addEventListener('click', () => {
                closeFilePreview();
            });
            filePreviewEl = panel;
            return panel;
        }

        function closeFilePreview() {
            const panel = getFilePreviewPanel();
            // Stop any playing media when the drawer is dismissed
            const mediaEls = panel.querySelectorAll('audio, video');
            mediaEls.forEach(m => {
                try {
                    m.pause();
                    m.currentTime = 0;
                } catch (e) {}
            });
            panel.classList.remove('is-open');
            document.body.classList.remove('has-file-preview');
            fileDrawerOpen = false;
            resizeCanvas();
        }

        function openFilePreview(node) {
            if (!node || !node.attributes) return;

            const panel = getFilePreviewPanel();
            document.body.classList.add('has-file-preview');
            fileDrawerOpen = true;
            resizeCanvas();
            const titleEl = panel.querySelector('.file-preview-title');
            const bodyEl = panel.querySelector('.file-preview-body');
            if (!titleEl || !bodyEl) return;

            const category = (node.type || node.category || '').toLowerCase();

            // Clear previous content
            bodyEl.innerHTML = '';

            // Temporal nodes: show all content from that day
            if (category === 'temporal') {
                openTemporalPreview(node, panel, titleEl, bodyEl);
                return;
            }

            // File/archive nodes: single file preview
            if ((category === 'file' || category === 'archive') &&
                (node.attributes.filePath || node.attributes.rawContentPath || node.attributes.file_url || node.attributes.path)) {
                openSingleFilePreview(node, panel, titleEl, bodyEl);
                return;
            }

            // Learning nodes (and learning-like): show learning details
            if (category === 'learning' || category === 'openclaw-skill') {
                openLearningPreview(node, panel, titleEl, bodyEl);
                return;
            }

            // For all other node types, just hide the panel
            closeFilePreview();
        }

        function openSingleFilePreview(node, panel, titleEl, bodyEl) {
            const filePath = node.attributes.filePath ||
                             node.attributes.rawContentPath ||
                             node.attributes.file_url ||
                             node.attributes.path ||
                             '';
            if (!filePath) {
                bodyEl.innerHTML = '<p style="font-size: 11px; color: #9ca3af;">No file path found for this node.</p>';
                panel.classList.add('is-open');
                return;
            }

            const resolvedPath = resolvePath(filePath);
            const fileType = detectFileType(filePath);
            const safeName = node.name || node.label || node.attributes.label || filePath.split('/').pop();

            titleEl.textContent = safeName;

            const desc = node.desc || node.attributes.description || '';
            const size = node.attributes.fileSize;
            const sizeText = typeof size === 'number' ? `${(size / 1024).toFixed(0)} KB` : '—';
            const created = node.attributes.created || node.created || '';

            const mediaHtml = renderMedia(fileType, resolvedPath);

            bodyEl.innerHTML = `
                <div class="single-file-preview">
                    <div class="media-container">
                        ${mediaHtml}
                    </div>
                    <div class="file-preview-meta">
                        <div><strong>Path:</strong> ${filePath}</div>
                        <div><strong>Served as:</strong> ${resolvedPath}</div>
                        <div><strong>Type:</strong> ${fileType}</div>
                        <div><strong>Size:</strong> ${sizeText}</div>
                        ${created ? `<div><strong>Date:</strong> ${created}</div>` : ''}
                        ${desc ? `<div style="margin-top:6px;">${desc}</div>` : ''}
                        <div class="file-preview-actions">
                            <button type="button" data-action="open-new-tab">Open in new tab</button>
                        </div>
                    </div>
                </div>
            `;

            bodyEl.querySelector('[data-action="open-new-tab"]')?.addEventListener('click', () => {
                window.open(resolvedPath, '_blank');
            });

            if (fileType === 'text') {
                const pre = bodyEl.querySelector('.file-text');
                if (pre) {
                    pre.textContent = 'Loading text…';
                    fetch(resolvedPath)
                        .then(r => r.ok ? r.text() : Promise.reject(new Error('Failed to load text')))
                        .then(text => {
                            const maxChars = 20000;
                            let out = text || '';
                            if (out.length > maxChars) out = out.slice(0, maxChars) + '\n…';
                            pre.textContent = out || '(empty file)';
                        })
                        .catch(() => {
                            pre.textContent = 'Could not load text.';
                        });
                }
            }

            panel.classList.add('is-open');
        }

        function renderMedia(fileType, src) {
            switch (fileType) {
                case 'audio':
                    return `<audio controls src="${src}" autoplay>Your browser does not support audio</audio>`;
                case 'image':
                    return `<img src="${src}" alt="Archive image">`;
                case 'video':
                    return `<video controls src="${src}" autoplay>Your browser does not support video</video>`;
                case 'text':
                    return `<pre class="file-text" style="margin:0; font-size:11px; line-height:1.5; color:#e5e7eb; white-space:pre-wrap; background:rgba(15,23,42,0.9); padding:8px; border-radius:6px; max-height:60vh; overflow:auto;">Loading text…</pre>`;
                default:
                    return `<p style="font-size: 11px; color: #9ca3af;">Unknown file type: ${fileType || 'unknown'}</p>`;
            }
        }

        function openTemporalPreview(temporalNode, panel, titleEl, bodyEl) {
            // Derive date key from attributes or label
            const date =
                temporalNode.attributes.date ||
                temporalNode.attributes.created ||
                temporalNode.created ||
                '';

            titleEl.textContent = temporalNode.name || temporalNode.label || temporalNode.idKey || 'Day overview';

            // Fallback: if we don't have an explicit date, just show connected nodes by edges
            let linked = [];
            if (date) {
                // Use date-based linkage: any node with matching created date
                linked = nodes.filter(n => {
                    const created =
                        (n.attributes && (n.attributes.date || n.attributes.created)) ||
                        n.created ||
                        '';
                    return typeof created === 'string' && created.startsWith(date);
                });
            } else {
                linked = nodes.filter(n => n.id !== temporalNode.id);
            }

            const files = linked.filter(n => {
                const t = (n.type || '').toLowerCase();
                return t === 'file' || t === 'archive';
            });
            const learnings = linked.filter(n => {
                const t = (n.type || '').toLowerCase();
                return t === 'learning' || t === 'openclaw-skill';
            });

            const fileCards = files.map(f => {
                const label = f.name || f.label || f.idKey || 'Untitled';
                const size = f.attributes?.fileSize;
                const sizeText = typeof size === 'number' ? `${(size / 1024).toFixed(0)} KB` : '';
                const fileType = detectFileType(f.attributes?.filePath || f.attributes?.rawContentPath || '');
                return `
                    <div class="file-card" data-node-index="${f.id}">
                        <div class="file-icon">${fileType === 'audio' ? '🎧' : fileType === 'image' ? '🖼️' : fileType === 'video' ? '🎬' : '📁'}</div>
                        <div class="file-label">${label}</div>
                        ${sizeText ? `<div class="file-meta">${sizeText}</div>` : ''}
                    </div>
                `;
            }).join('');

            const learningCards = learnings.map(l => {
                const label = l.name || l.label || l.idKey || 'Untitled learning';
                const subtype = l.attributes?.subtype || l.attributes?.type || '';
                return `
                    <div class="learning-card" data-node-index="${l.id}">
                        <div class="learning-label">${label}</div>
                        ${subtype ? `<div class="learning-type">${subtype}</div>` : ''}
                    </div>
                `;
            }).join('');

            bodyEl.innerHTML = `
                <div class="temporal-preview">
                    <div class="temporal-header">
                        <div class="temporal-title-main">${titleEl.textContent}</div>
                        ${date ? `<div class="temporal-date">${date}</div>` : ''}
                    </div>
                    <div class="content-sections">
                        <section class="files-section">
                            <h3>📁 Files (${files.length})</h3>
                            <div class="file-grid">
                                ${fileCards || '<p style="font-size: 11px; color: #6b7280;">No files linked to this day.</p>'}
                            </div>
                        </section>
                        <section class="learnings-section">
                            <h3>🧠 Learnings (${learnings.length})</h3>
                            <div class="learning-list">
                                ${learningCards || '<p style="font-size: 11px; color: #6b7280;">No learnings linked to this day.</p>'}
                            </div>
                        </section>
                    </div>
                    <div class="stats">
                        <span>Total: ${linked.length} nodes</span>
                        <span>Files: ${files.length}</span>
                        <span>Learnings: ${learnings.length}</span>
                    </div>
                </div>
            `;

            // Make cards clickable to drill into single previews
            bodyEl.querySelectorAll('.file-card').forEach(card => {
                card.addEventListener('click', () => {
                    const idx = Number(card.getAttribute('data-node-index'));
                    if (!Number.isNaN(idx) && nodes[idx]) {
                        openSingleFilePreview(nodes[idx], panel, titleEl, bodyEl);
                    }
                });
            });

            bodyEl.querySelectorAll('.learning-card').forEach(card => {
                card.addEventListener('click', () => {
                    const idx = Number(card.getAttribute('data-node-index'));
                    if (!Number.isNaN(idx) && nodes[idx]) {
                        openLearningPreview(nodes[idx], panel, titleEl, bodyEl);
                    }
                });
            });

            panel.classList.add('is-open');
        }

        function openLearningPreview(node, panel, titleEl, bodyEl) {
            const attrs = node.attributes || {};
            const subtype = attrs.subtype || attrs.type || 'Learning';
            titleEl.textContent = node.name || node.label || 'Learning';

            const description = attrs.description || node.desc || '';
            const sourceDoc = attrs.sourceDocument || node.sourceDocument || '';
            const date = attrs.created || node.created || '';
            const moments = Array.isArray(node.moments) ? node.moments : [];

            const sourceResolved = sourceDoc ? resolvePath(sourceDoc) : '';

            bodyEl.innerHTML = `
                <div class="learning-preview">
                    <div class="learning-header">
                        <span class="learning-badge">${subtype}</span>
                        ${date ? `<span class="learning-date">${date}</span>` : ''}
                    </div>
                    <div class="learning-title">${titleEl.textContent}</div>
                    <div class="learning-body">
                        ${description ? `<p class="learning-description">${description}</p>` : '<p class="learning-description muted">No description</p>'}
                        ${sourceDoc ? `
                            <div class="learning-source">
                                <div class="label">Source document</div>
                                <code class="source-path">${sourceDoc}</code>
                                <div class="file-preview-actions" style="margin-top:6px;">
                                    <button type="button" data-action="open-source">Open source</button>
                                </div>
                            </div>
                        ` : ''}
                        ${moments.length ? `
                            <div class="learning-moments">
                                <div class="label">Moments</div>
                                <div class="moment-tags">
                                    ${moments.map(m => `<span class="tag">${m}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            if (sourceDoc && sourceResolved) {
                bodyEl.querySelector('[data-action="open-source"]')?.addEventListener('click', () => {
                    window.open(sourceResolved, '_blank');
                });
            }

            panel.classList.add('is-open');
        }

        canvas.addEventListener('click', e => {
            if (didDrag) { didDrag = false; return; }
            
            const clickedNode = hitTestNode(e.clientX, e.clientY);
            
            if (clickedNode !== null) {
                selected = clickedNode;
                const node = nodes[selected];
                // When clicking a temporal node, switch to day view for that node's date
                const nodeType = (node.type || node.category || '').toLowerCase();
                if (nodeType === 'temporal') {
                    const dateStr = (node.created || node.attributes?.created || node.attributes?.date || '').toString().trim().slice(0, 10);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        setActiveTimeFilter(DAY_FILTER_PREFIX + dateStr);
                    }
                }
                window.location.hash = node.idKey;
                focusOnNode(node);
                if (nodeType === 'file' || nodeType === 'archive') {
                    // For file/archive nodes, skip the inline info popover and open the file panel directly.
                    showNodeDetails(null);
                    openFilePreview(node);
                } else {
                    showNodeDetails(node);
                }
            } else {
                clearSelection();
                closeFilePreview();
            }
        });

        // Clicking outside the graph (canvas) clears the current selection
        document.addEventListener('click', e => {
            if (selected === null) return;
            if (canvas && canvas.contains(e.target)) return;
            const pop = nodePopoverEl || (document.getElementById('node-popover'));
            if (pop && pop.contains(e.target)) return;
            const modal = document.getElementById('node-details-modal');
            if (modal && modal.contains(e.target)) return;
            // Don't clear when clicking Jump to node list, filter bar, or drawer
            const info = document.getElementById('info');
            if (info && info.contains(e.target)) return;
            const filterBar = document.getElementById('filter-bar');
            if (filterBar && filterBar.contains(e.target)) return;
            const panelToggle = document.getElementById('panel-toggle');
            if (panelToggle && panelToggle.contains(e.target)) return;
            const bottomDrawer = document.getElementById('bottomDrawer');
            if (bottomDrawer && bottomDrawer.contains(e.target)) return;
            const drawerScrim = document.getElementById('drawerScrim');
            if (drawerScrim && drawerScrim.contains(e.target)) return;
            const zoomControls = document.getElementById('neural-graph-zoom-controls');
            if (zoomControls && zoomControls.contains(e.target)) return;
            const filePreviewPanel = document.getElementById('file-preview-panel');
            if (filePreviewPanel && filePreviewPanel.contains(e.target)) return;
            window.clearSelection();
        });

        document.addEventListener('keydown', e => {
            // Ignore navigation keys while typing in an input/textarea/contenteditable
            const active = document.activeElement;
            const tag = active && active.tagName ? active.tagName.toLowerCase() : '';
            const isTypingContext = tag === 'input' || tag === 'textarea' || active?.isContentEditable;
            if (isTypingContext) return;

            if (e.key === 'Escape' && selected !== null) {
                window.clearSelection();
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                keyFly.left = true;
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                keyFly.right = true;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                // Inverted controls: ArrowUp = fly backward
                keyFly.back = true;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                // Inverted controls: ArrowDown = fly forward
                keyFly.forward = true;
            }
        });

        document.addEventListener('keyup', e => {
            if (e.key === 'ArrowLeft') keyFly.left = false;
            if (e.key === 'ArrowRight') keyFly.right = false;
            // Match inverted controls: ArrowUp toggles keyFly.back, ArrowDown toggles keyFly.forward
            if (e.key === 'ArrowUp') keyFly.back = false;
            if (e.key === 'ArrowDown') keyFly.forward = false;
        });
        
        // Set drawer content only (no side effects). Used for mobile so popover is skipped.
        function setDrawerContent(node) {
            const content = document.getElementById('drawerDetails');
            if (!content) return;
            if (!node) {
                content.innerHTML = '<p class="drawer-detail-desc" style="color: rgba(255,255,255,0.6);">Select a node on the graph to see details.</p>';
                return;
            }
            let typeText, descText, connectionsHtml;
            if (node.type === 'person' && characterProfiles[node.idKey]) {
                const char = characterProfiles[node.idKey];
                typeText = char.role || '';
                descText = char.bio || '';
                if (char.episodes && char.episodes.length > 0) {
                    connectionsHtml = '<p style="color: #00ffff; font-weight: bold; margin-top: 12px;">Episodes:</p>' +
                        char.episodes.map(ep => `<div style="margin: 4px 0; color: #fbbf24; font-size: 10px;">${escapeHtml(ep)}</div>`).join('');
                } else {
                    connectionsHtml = '<div style="color: #666; font-size: 10px;">No episodes linked</div>';
                }
            } else {
                typeText = `Type: ${(node.type || '').charAt(0).toUpperCase() + (node.type || '').slice(1)}`;
                descText = node.desc || '';
                const connected = [];
                edges.forEach(e => {
                    if (e.from === node.id) {
                        const target = nodes[e.to];
                        if (target) connected.push(`→ ${escapeHtml(target.name)} (${target.type})`);
                    } else if (e.to === node.id) {
                        const source = nodes[e.from];
                        if (source) connected.push(`← ${escapeHtml(source.name)} (${source.type})`);
                    }
                });
                connectionsHtml = connected.length > 0
                    ? connected.map(c => `<div style="margin: 4px 0; color: #00ffff;">${c}</div>`).join('')
                    : '<div style="color: #666;">No connections</div>';
            }
            content.innerHTML = `
                <p class="drawer-detail-desc">${escapeHtml(descText)}</p>
                <p class="drawer-detail-type">${escapeHtml(typeText)}</p>
                <p class="drawer-detail-connections-heading">Connected to</p>
                <div class="drawer-detail-connections">${connectionsHtml}</div>
            `;
        }
        function showNodeDetailsInDrawer(node) {
            showNodeDetails(node);
            setDrawerContent(node);
        }
        function escapeHtml(s) {
            if (s == null) return '';
            const div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        }

        // Handle URL hash navigation (back/forward, direct link, or in-page hash change)
        function handleHashNavigation() {
            const hash = window.location.hash.substring(1).trim();
            if (hash && nodes.length > 0) {
                const nodeIndex = nodes.findIndex(n => n.idKey === hash);
                if (nodeIndex !== -1) {
                    selected = nodeIndex;
                    const node = nodes[selected];
                    if (node.isMemoryRef) {
                        openMemoryLinkSidebar(node);
                    } else {
                        const nodeType = (node.type || node.category || '').toLowerCase();
                        if (nodeType === 'file' || nodeType === 'archive') {
                            // Prevent the inline node-popover from reopening after hash navigation.
                            showNodeDetails(null);
                            openFilePreview(node);
                        } else {
                            showNodeDetails(node);
                            if (window.innerWidth <= 768) showNodeDetailsInDrawer(node);
                        }
                    }
                }
            }
        }

        // Listen for hash changes (back/forward buttons, direct URL visits)
        window.addEventListener('hashchange', handleHashNavigation);

        // On load: hash selects node by id (e.g. #paul), no hash = random node
        loadGraphData()
            .then(() => {
                if (window.location.hash) handleHashNavigation();
                if (typeof window.onNeuroGraphLoaded === 'function') window.onNeuroGraphLoaded();
                // No random node selection on load — popover only appears when user clicks a node
            })
            .catch(err => {
                const statusEl = document.getElementById('status');
                if (statusEl) {
                    statusEl.textContent = 'Error loading graph: ' + err.message;
                    statusEl.style.color = '#ff6b6b';
                    statusEl.style.fontWeight = 'bold';
                }
                console.error('Failed to load graph data:', err);
            });

        window.clearSelection = () => {
            selected = null;
            showNodeDetails(null);
            showNodeDetailsInDrawer(null);
            closeFilePreview();
            window.location.hash = '';
        };
        
        let characterProfiles = {};
        async function loadCharacterProfiles() {
            const url = CONFIG.characterProfilesUrl;
            if (!url) return;
            try {
                const response = await fetch(url);
                if (!response.ok) return;
                const text = await response.text();
                // Parse characters array from the JS file
                const match = text.match(/const characters = \[([\s\S]*?)\];/);
                if (match) {
                  try {
                    // Use JSON.parse instead of eval for security
                    const parsed = JSON.parse('[' + match[1] + ']');
                    characterProfiles = parsed;
                    // Build lookup by id
                    const profiles = {};
                    if (Array.isArray(characterProfiles)) {
                      characterProfiles.forEach(char => {
                        profiles[char.id] = char;
                      });
                    }
                    characterProfiles = profiles;
                  } catch (parseErr) {
                    console.warn('Failed to parse character profiles:', parseErr);
                  }
                }
            } catch (e) {
                console.warn('Could not load character profiles:', e);
            }
        }

        function buildNodeDetailHtml(node) {
            let nameHtml, typeText, descText, connectionsHtml;
            if (node.type === 'person' && characterProfiles[node.idKey]) {
                const char = characterProfiles[node.idKey];
                nameHtml = `<img src="${char.avatar}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 8px;" alt="${char.name}"><span style="color: #fbbf24; font-weight: bold;">${escapeHtml(char.name)}</span>`;
                typeText = char.role || '';
                descText = char.bio || '';
                if (char.episodes && char.episodes.length > 0) {
                    connectionsHtml = char.episodes.map(ep => `<div style="margin: 4px 0; color: #fbbf24; font-size: 10px;">${escapeHtml(ep)}</div>`).join('');
                } else {
                    connectionsHtml = '<div style="color: #666; font-size: 10px;">No episodes linked</div>';
                }
            } else {
                nameHtml = escapeHtml(node.name);
                typeText = `Type: ${(node.type || '').charAt(0).toUpperCase() + (node.type || '').slice(1)}`;
                descText = node.desc || '';
                const nodeIdx = nodes.findIndex(n => n.idKey === node.idKey);
                const connected = [];
                edges.forEach(e => {
                    if (e.from === nodeIdx) {
                        const target = nodes[e.to];
                        if (target) connected.push(`→ ${escapeHtml(target.name)} (${target.type || target.category})`);
                    } else if (e.to === nodeIdx) {
                        const source = nodes[e.from];
                        if (source) connected.push(`← ${escapeHtml(source.name)} (${source.type || source.category})`);
                    }
                });
                const date = (node.attributes && (node.attributes.date || node.attributes.created)) || node.created || '';
                if ((node.type || node.category || '').toLowerCase() === 'temporal' && date) {
                    const linkedByDate = nodes.filter(n => {
                        const c = (n.attributes && (n.attributes.date || n.attributes.created)) || n.created || '';
                        return typeof c === 'string' && c.startsWith(date);
                    });
                    if (linkedByDate.length > 0) {
                        const learningCount = linkedByDate.filter(n => {
                            const t = (n.type || n.category || '').toLowerCase();
                            return t === 'learning' || t === 'openclaw-skill';
                        }).length;
                        const fileArchiveCount = linkedByDate.filter(n => { const t = (n.type || n.category || '').toLowerCase(); return t === 'archive' || t === 'file'; }).length;
                        connected.push(`Linked by date: ${linkedByDate.length} nodes (${learningCount} learnings, ${fileArchiveCount} files/archives)`);
                    }
                }
                connectionsHtml = connected.length > 0
                    ? connected.map(c => `<div style="margin: 4px 0; color: #00ffff;">${c}</div>`).join('')
                    : '<div style="color: #666;">No connections</div>';
            }
            const fullContextDisabled = !(node.sourceDocument || node.attributes?.sourceDocument);
            const fullContextUrl = resolvePath(node.sourceDocument || node.attributes?.sourceDocument);
            const fullContextBtn = `<button type="button" class="node-popover-full-context" ${fullContextDisabled ? 'disabled' : ''} title="${fullContextUrl ? 'View Layer 2 source document' : 'No source document'}">📄 Full Context</button>`;

            const cat = (node.type || node.category || '').toLowerCase();
            let cardDetailsHtml = '';
            const attrs = node.attributes || {};
            if (cat === 'file' || cat === 'archive') {
                const path = attrs.filePath || attrs.rawContentPath || attrs.file_url || attrs.path || '';
                const created = attrs.created || node.created || '';
                const size = attrs.fileSize;
                const sizeText = typeof size === 'number' ? `${(size / 1024).toFixed(0)} KB` : '';
                if (path || created || sizeText) {
                    cardDetailsHtml = '<p class="node-popover-connections-heading">Details</p><div class="node-popover-card-details">';
                    if (path) cardDetailsHtml += `<div><strong>Path:</strong> <span class="node-popover-mono">${escapeHtml(path)}</span></div>`;
                    if (created) cardDetailsHtml += `<div><strong>Date:</strong> ${escapeHtml(created)}</div>`;
                    if (sizeText) cardDetailsHtml += `<div><strong>Size:</strong> ${sizeText}</div>`;
                    cardDetailsHtml += '</div>';
                }
            } else if (cat === 'learning' || cat === 'openclaw-skill') {
                const created = attrs.created || node.created || '';
                const sourceDoc = attrs.sourceDocument || node.sourceDocument || '';
                if (created || (attrs.description && !descText) || sourceDoc) {
                    cardDetailsHtml = '<p class="node-popover-connections-heading">Details</p><div class="node-popover-card-details">';
                    if (created) cardDetailsHtml += `<div><strong>Date:</strong> ${escapeHtml(created)}</div>`;
                    if (attrs.description && !descText) cardDetailsHtml += `<p class="node-popover-desc">${escapeHtml(attrs.description)}</p>`;
                    if (sourceDoc) cardDetailsHtml += `<div><strong>Source:</strong> <span class="node-popover-mono">${escapeHtml(sourceDoc)}</span></div>`;
                    cardDetailsHtml += '</div>';
                }
            } else if (cat === 'temporal') {
                const date = attrs.date || attrs.created || node.created || '';
                const linked = nodes.filter(n => {
                    const c = (n.attributes && (n.attributes.date || n.attributes.created)) || n.created || '';
                    return typeof c === 'string' && date && c.startsWith(date);
                }).length;
                cardDetailsHtml = '<p class="node-popover-connections-heading">Details</p><div class="node-popover-card-details">';
                if (date) cardDetailsHtml += `<div><strong>Date:</strong> ${escapeHtml(date)}</div>`;
                cardDetailsHtml += `<div><strong>Linked:</strong> ${linked} nodes</div></div>`;
            }

            const hasRichPreview = node.attributes && (cat === 'temporal' || cat === 'learning' || cat === 'openclaw-skill' || cat === 'file' || cat === 'archive');
            const openPanelBtn = hasRichPreview
                ? `<button type="button" class="node-popover-open-panel" aria-label="Open in side panel">📂 Open in panel</button>`
                : '';

            return `
                <h3 id="node-popover-title">Node</h3>
                <div class="node-popover-name">${nameHtml}</div>
                <p class="node-popover-type">${escapeHtml(typeText)}</p>
                ${descText ? `<p class="node-popover-desc">${escapeHtml(descText)}</p>` : ''}
                ${cardDetailsHtml}
                <p class="node-popover-connections-heading">Connected to</p>
                <div class="node-popover-connections">${connectionsHtml}</div>
                <div class="node-popover-actions">
                    <button type="button" class="node-popover-close" aria-label="Close">✕ Close</button>
                    ${fullContextBtn}
                    ${openPanelBtn}
                </div>`;
        }

        function showNodeDetails(node, opts) {
            if (window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) {
                // Mobile: never use inline popover; route everything through drawer/modal.
                if (!node) {
                    showNodeDetailsModal(null);
                    setDrawerContent(null);
                    setDrawerOpen(false);
                } else {
                    setDrawerContent(node);
                }
                return;
            }

            const pop = getNodePopover();
            const content = pop.querySelector('#node-popover-content');
            if (!node) {
                // When clearing selection (e.g. from the Close button), always hide the inline popover.
                pop.classList.remove('is-open');
                if (content) content.innerHTML = '';
                hoverTemporalPopoverOpen = false;
                return;
            }
            hoverTemporalPopoverOpen = !!(opts && opts.inline);
            if (content) content.innerHTML = buildNodeDetailHtml(node);
            pop.classList.add('is-open');
            requestAnimationFrame(() => positionPopover(pop, opts && opts.inline ? opts : null));
        }

        // Memory-link sidebar: created in JS so it works for both memory/ and claw/memory/
        let memoryLinkSidebarEl = null;
        let memoryLinkScrimEl = null;
        let memoryLinkEscapeHandler = null;

        function getMemoryLinkSidebar() {
            if (memoryLinkSidebarEl) return memoryLinkSidebarEl;
            const sidebar = document.createElement('div');
            sidebar.id = 'memory-link-sidebar';
            sidebar.setAttribute('role', 'dialog');
            sidebar.setAttribute('aria-labelledby', 'memory-link-sidebar-title');
            sidebar.innerHTML = `
                <div class="memory-link-sidebar-inner">
                    <button type="button" class="memory-link-sidebar-close" aria-label="Close">&times;</button>
                    <h3 id="memory-link-sidebar-title" class="memory-link-sidebar-title">Connected mind</h3>
                    <p class="memory-link-sidebar-url-wrap"><a id="memory-link-sidebar-url" href="#" target="_blank" rel="noopener" class="memory-link-sidebar-url"></a></p>
                    <p class="memory-link-sidebar-meta"><span class="memory-link-sidebar-label">Fingerprint:</span> <span id="memory-link-sidebar-fingerprint">—</span></p>
                    <p class="memory-link-sidebar-meta"><span class="memory-link-sidebar-label">Stats:</span> <span id="memory-link-sidebar-stats">—</span></p>
                    <button type="button" class="memory-link-sidebar-explore" id="memory-link-sidebar-explore">Explore Memory</button>
                </div>`;
            sidebar.style.cssText = 'position:fixed;top:0;right:0;width:280px;max-width:100%;height:100%;background:rgba(15,26,58,0.98);border-left:2px solid rgba(251,191,36,0.5);z-index:100;display:none;overflow-y:auto;';
            const style = document.createElement('style');
            style.textContent = `
                #memory-link-sidebar .memory-link-sidebar-inner { padding: 24px 20px; font-family: monospace; }
                #memory-link-sidebar .memory-link-sidebar-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; line-height: 1; padding: 4px; }
                #memory-link-sidebar .memory-link-sidebar-close:hover { color: #fbbf24; }
                #memory-link-sidebar .memory-link-sidebar-title { color: #fbbf24; font-size: 16px; margin-bottom: 16px; }
                #memory-link-sidebar .memory-link-sidebar-url-wrap { margin-bottom: 12px; word-break: break-all; }
                #memory-link-sidebar .memory-link-sidebar-url { color: #06b6d4; text-decoration: none; }
                #memory-link-sidebar .memory-link-sidebar-url:hover { text-decoration: underline; }
                #memory-link-sidebar .memory-link-sidebar-meta { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }
                #memory-link-sidebar .memory-link-sidebar-label { color: #64748b; }
                #memory-link-sidebar .memory-link-sidebar-explore { margin-top: 20px; padding: 10px 16px; background: rgba(251,191,36,0.2); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: bold; }
                #memory-link-sidebar .memory-link-sidebar-explore:hover { background: rgba(251,191,36,0.35); }
                .memory-link-sidebar-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99; display: none; }
            `;
            document.head.appendChild(style);
            const scrim = document.createElement('div');
            scrim.className = 'memory-link-sidebar-scrim';
            scrim.setAttribute('aria-hidden', 'true');
            document.body.appendChild(scrim);
            document.body.appendChild(sidebar);
            memoryLinkScrimEl = scrim;
            sidebar.querySelector('.memory-link-sidebar-close').addEventListener('click', closeMemoryLinkSidebar);
            scrim.addEventListener('click', closeMemoryLinkSidebar);
            document.getElementById('memory-link-sidebar-explore').addEventListener('click', () => {
                const url = document.getElementById('memory-link-sidebar-url').href;
                if (url && url !== '#') window.open(url, '_blank', 'noopener');
            });
            memoryLinkSidebarEl = sidebar;
            return sidebar;
        }

        function openMemoryLinkSidebar(node) {
            if (!node || !node.isMemoryRef || !node.target_memory) return;
            const sidebar = getMemoryLinkSidebar();
            const owner = (node.memory_owner || 'Unknown').replace(/^./, c => c.toUpperCase());
            document.getElementById('memory-link-sidebar-title').textContent = 'Connected mind: ' + owner;
            const urlEl = document.getElementById('memory-link-sidebar-url');
            urlEl.href = node.target_memory;
            urlEl.textContent = node.target_memory;
            document.getElementById('memory-link-sidebar-fingerprint').textContent = 'Loading…';
            document.getElementById('memory-link-sidebar-stats').textContent = 'Loading…';
            sidebar.style.display = 'block';
            memoryLinkScrimEl.style.display = 'block';
            memoryLinkScrimEl.setAttribute('aria-hidden', 'false');
            memoryLinkEscapeHandler = function(e) { if (e.key === 'Escape') closeMemoryLinkSidebar(); };
            document.addEventListener('keydown', memoryLinkEscapeHandler);
            const fpUrl = node.fingerprint_url;
            if (fpUrl) {
                fetch(fpUrl).then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
                    .then(data => {
                        const hash = (data.hash || data.masterHash || '—').toString();
                        document.getElementById('memory-link-sidebar-fingerprint').textContent = hash.length > 20 ? hash.slice(0, 20) + '…' : hash;
                        document.getElementById('memory-link-sidebar-fingerprint').title = hash;
                        const neurons = data.neurons != null ? data.neurons : '—';
                        const synapses = data.synapses != null ? data.synapses : '—';
                        document.getElementById('memory-link-sidebar-stats').textContent = neurons + ' neurons · ' + synapses + ' synapses';
                    })
                    .catch(() => {
                        document.getElementById('memory-link-sidebar-fingerprint').textContent = '—';
                        document.getElementById('memory-link-sidebar-stats').textContent = 'Could not load stats';
                    });
            } else {
                document.getElementById('memory-link-sidebar-fingerprint').textContent = '—';
                document.getElementById('memory-link-sidebar-stats').textContent = '—';
            }
        }

        function closeMemoryLinkSidebar() {
            if (!memoryLinkSidebarEl) return;
            memoryLinkSidebarEl.style.display = 'none';
            if (memoryLinkScrimEl) {
                memoryLinkScrimEl.style.display = 'none';
                memoryLinkScrimEl.setAttribute('aria-hidden', 'true');
            }
            if (memoryLinkEscapeHandler) {
                document.removeEventListener('keydown', memoryLinkEscapeHandler);
                memoryLinkEscapeHandler = null;
            }
            // Additional cleanup: remove any inline styles or event listeners
            if (memoryLinkSidebarEl) {
                memoryLinkSidebarEl.querySelectorAll('*').forEach(el => {
                    const clone = el.cloneNode(false);
                    el.parentNode.replaceChild(clone, el);
                });
            }
        }

        // Mobile drawer management
        function openDrawer() {
            const info = document.getElementById('info');
            const canvas = document.getElementById('canvas');
            if (window.innerWidth <= 768) {
                info.classList.add('open');
                canvas.classList.add('drawer-open');
            }
        }

        function closeDrawer() {
            const info = document.getElementById('info');
            const canvas = document.getElementById('canvas');
            info.classList.remove('open');
            canvas.classList.remove('drawer-open');
        }

        window.selectNodeByIndex = function(idx) {
            if (idx < 0 || idx >= nodes.length) return;
            selected = idx;
            const node = nodes[selected];
            // When selecting a temporal node (e.g. from week view list), switch to day view for that date
            const nodeType = (node.type || node.category || '').toLowerCase();
            if (nodeType === 'temporal') {
                const dateStr = (node.created || node.attributes?.created || node.attributes?.date || '').toString().trim().slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    setActiveTimeFilter(DAY_FILTER_PREFIX + dateStr);
                }
            }
            if (node.isMemoryRef) {
                openMemoryLinkSidebar(node);
            } else {
                if (nodeType === 'file' || nodeType === 'archive') {
                    showNodeDetails(null);
                    openFilePreview(node);
                } else {
                    showNodeDetails(node);
                }
            }
            if (window.innerWidth <= 768 && !(nodeType === 'file' || nodeType === 'archive')) showNodeDetailsInDrawer(node);
            window.location.hash = node.idKey;
            focusOnNode(node);
        };

        const OTHER_CAT = 'other';

        function populateFilterList() {
            const listEl = document.getElementById('filter-list');
            const drawerListEl = document.getElementById('drawerNodeList');
            if ((!listEl && !drawerListEl) || nodes.length === 0) return;
            // Use same categories and order as the filter row (types present in current time frame)
            const categoriesOrder = getAvailableCategoryTypes();
            const byCategory = {};
            categoriesOrder.forEach(cat => { byCategory[cat] = []; });
            byCategory[OTHER_CAT] = [];
            nodes.forEach((n, idx) => {
                if (!nodePassesFilter(n)) return;
                if (currentNodeSearchQuery) {
                    const name = (n.name || '').toLowerCase();
                    const desc = (n.desc || '').toLowerCase();
                    if (!name.includes(currentNodeSearchQuery) && !desc.includes(currentNodeSearchQuery)) return;
                }
                if (n.isMemoryRef) {
                    if (byCategory['memorylinks']) byCategory['memorylinks'].push({ node: n, idx });
                    else byCategory[OTHER_CAT].push({ node: n, idx });
                } else {
                    const t = (n.type || '').toLowerCase();
                    if (byCategory[t]) byCategory[t].push({ node: n, idx });
                    else byCategory[OTHER_CAT].push({ node: n, idx });
                }
            });
            function appendCategoryTo(listElement) {
                if (!listElement) return;
                const categoriesToShow = categoriesOrder.concat(OTHER_CAT);
                categoriesToShow.forEach(cat => {
                    let items = byCategory[cat];
                    if (!items || items.length === 0) return;
                    if (cat === 'temporal') {
                        items = items.slice().sort((a, b) => {
                            const da = a.node.created || '';
                            const db = b.node.created || '';
                            if (!da && !db) return 0;
                            if (!da) return 1;
                            if (!db) return -1;
                            return db.localeCompare(da);
                        });
                    }
                    const label = (cat === OTHER_CAT ? 'Other' : null) || filterCategoryLabels[cat] || (cat === 'memorylinks' ? 'Memory links' : (cat.charAt(0).toUpperCase() + cat.slice(1)));
                    const color = categoryColors[cat] || '#00ffff';
                    const heading = document.createElement('h4');
                    heading.textContent = label;
                    heading.style.color = color;
                    heading.className = 'filter-category';
                    listElement.appendChild(heading);
                    // Use DocumentFragment for efficient DOM insertion
                    const fragment = document.createDocumentFragment();
                    items.forEach(({ node, idx }) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'filter-node';
                        btn.textContent = node.name;
                        btn.style.color = color;
                        btn.addEventListener('click', () => {
                            selectNodeByIndex(idx);
                            if (window.innerWidth <= 768) setDrawerOpen(false);
                        });
                        fragment.appendChild(btn);
                    });
                    listElement.appendChild(fragment);
                });
            }
            if (listEl) {
                listEl.innerHTML = '';
                appendCategoryTo(listEl);
            }
            if (drawerListEl) {
                drawerListEl.innerHTML = '';
                appendCategoryTo(drawerListEl);
            }
            // Populate drawer legend from CONFIG if the grid exists and is empty (e.g. claw/memory)
            const drawerLegend = document.getElementById('drawerLegendGrid');
            if (drawerLegend && drawerLegend.children.length === 0 && CONFIG.filterCategoryLabels) {
                const order = CONFIG.filterCategoryOrder || filterCategoryOrder;
                order.forEach(cat => {
                    const label = (CONFIG.filterCategoryLabels || filterCategoryLabels)[cat] || cat;
                    const color = categoryColors[cat] || '#00ffff';
                    const item = document.createElement('div');
                    item.className = 'legend-item';
                    item.innerHTML = `<div class="legend-dot" style="background: ${color}; box-shadow: 0 0 6px ${color};"></div><span style="color: ${color};">${label}</span>`;
                    drawerLegend.appendChild(item);
                });
            }
            populateCategoryFilterRow();
        }

        // Accordion: only one section open at a time
        function closeAllAccordionBodies() {
            document.querySelectorAll('#info .accordion-body').forEach(el => { el.classList.remove('open'); });
        }
        function syncAccordionChevrons() {
            document.querySelectorAll('#info [data-accordion-body]').forEach(trigger => {
                const bodyId = trigger.getAttribute('data-accordion-body');
                const body = document.getElementById(bodyId);
                const chevron = trigger.querySelector('[id$="-chevron"]');
                if (body && chevron) {
                    const isOpen = body.classList.contains('open');
                    chevron.textContent = isOpen ? '▲' : '▼';
                    trigger.setAttribute('aria-expanded', isOpen);
                }
            });
        }
        document.getElementById('info').addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-accordion-body]');
            if (!trigger) return;
            const bodyId = trigger.getAttribute('data-accordion-body');
            const body = document.getElementById(bodyId);
            if (!body) return;
            const wasOpen = body.classList.contains('open');
            closeAllAccordionBodies();
            if (!wasOpen) body.classList.add('open');
            syncAccordionChevrons();
        });

        canvas.addEventListener('wheel', e => {
            e.preventDefault();

            // If the pointer is currently over the minimap, interpret the zoom as
            // "zoom into/out of the region under the minimap cursor" instead of
            // generic canvas-centered zoom.
            if (minimapCanvasEl) {
                const miniRect = minimapCanvasEl.getBoundingClientRect();
                const inMinimap =
                    e.clientX >= miniRect.left && e.clientX <= miniRect.right &&
                    e.clientY >= miniRect.top && e.clientY <= miniRect.bottom;
                if (inMinimap) {
                    const localX = e.clientX - miniRect.left;
                    const localY = e.clientY - miniRect.top;
                    // findNearestMinimapNode is defined inside ensureMinimap's closure, so we
                    // approximate it here by scanning minimapNodes.
                    if (minimapNodes.length && nodes.length) {
                        let bestIdx = null;
                        let bestDist2 = Infinity;
                        for (let i = 0; i < minimapNodes.length; i++) {
                            const entry = minimapNodes[i];
                            const dx = entry.x - localX;
                            const dy = entry.y - localY;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < bestDist2) {
                                bestDist2 = d2;
                                bestIdx = entry.idx;
                            }
                        }
                        if (bestIdx !== null) {
                            const factor = 1 - e.deltaY * CONFIG.ZOOM_SPEED;
                            const proposedZoom = viewZoom * factor;
                            const targetZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, proposedZoom));
                            selected = bestIdx;
                            const node = nodes[bestIdx];
                            focusOnNode(node, { targetZoom });
                            showNodeDetails(node);
                            if (window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) showNodeDetailsInDrawer(node);
                        }
                    }
                    return;
                }
            }

            // Zoom toward cursor; at max zoom out, open time filter menu instead
            const factor = 1 - e.deltaY * CONFIG.ZOOM_SPEED;
            if (factor < 1 && viewZoom * factor <= getViewZoomMin() && openTimeFilterPopoverRef) {
                openTimeFilterPopoverRef();
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const cursorX = rect.width  ? (e.clientX - rect.left) * (canvas.width / rect.width)  : (e.clientX - rect.left);
            const cursorY = rect.height ? (e.clientY - rect.top) * (canvas.height / rect.height) : (e.clientY - rect.top);
            zoomTowardPoint(cursorX, cursorY, factor);
            cameraFocus.active = false;
        });

        function positionZoomControls() {
            if (!zoomControlsEl) return;
            const pad = 16;
            const isDesktop = window.innerWidth > CONFIG.MOBILE_BREAKPOINT;
            // Right side: zoom buttons sit just to the left of the minimap
            const rightOffset = pad +
                (panelOpen ? CONFIG.PANEL_WIDTH : 0) +
                (fileDrawerOpen ? CONFIG.FILE_DRAWER_WIDTH : 0);
            zoomControlsEl.style.right = (rightOffset + CONFIG.MINIMAP_WIDTH + CONFIG.MINIMAP_ZOOM_GAP) + 'px';
            zoomControlsEl.style.left = 'auto';
            zoomControlsEl.style.bottom = pad + 'px';
            zoomControlsEl.style.zIndex = isDesktop ? '15' : '26';
        }
        function positionMinimap() {
            if (!minimapEl) return;
            const pad = 16;
            const isDesktop = window.innerWidth > CONFIG.MOBILE_BREAKPOINT;
            // Right side: minimap flush right, zoom to its left
            const rightOffset = pad +
                (panelOpen ? CONFIG.PANEL_WIDTH : 0) +
                (fileDrawerOpen ? CONFIG.FILE_DRAWER_WIDTH : 0);
            minimapEl.style.right = rightOffset + 'px';
            minimapEl.style.left = 'auto';
            minimapEl.style.bottom = pad + 'px';
            minimapEl.style.zIndex = isDesktop ? '15' : '26';
        }
        function ensureMinimap() {
            if (minimapEl && minimapCanvasEl && minimapCtx) return minimapEl;
            const wrap = document.createElement('div');
            wrap.id = 'neural-graph-minimap';
            wrap.className = 'neural-graph-minimap';
            const mini = document.createElement('canvas');
            mini.width = CONFIG.MINIMAP_WIDTH;
            mini.height = CONFIG.MINIMAP_HEIGHT;
            wrap.appendChild(mini);
            minimapEl = wrap;
            minimapCanvasEl = mini;
            minimapCtx = mini.getContext('2d');

            const style = document.createElement('style');
            style.textContent = `
                .neural-graph-minimap {
                    position: fixed;
                    width: 260px;
                    height: 188px;
                    border-radius: 12px;
                    border: 2px solid rgba(0, 255, 255, 0.5);
                    background: radial-gradient(circle at top, rgba(15,23,42,0.96), rgba(15,23,42,0.9));
                    box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 18px rgba(56,189,248,0.35);
                    overflow: hidden;
                    pointer-events: auto;
                }
                .neural-graph-minimap canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                    cursor: crosshair;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            positionMinimap();

            function findNearestMinimapNode(localX, localY) {
                if (!minimapNodes.length || !nodes.length) return null;
                let bestIdx = null;
                let bestDist2 = Infinity;
                for (let i = 0; i < minimapNodes.length; i++) {
                    const entry = minimapNodes[i];
                    const dx = entry.x - localX;
                    const dy = entry.y - localY;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < bestDist2) {
                        bestDist2 = d2;
                        bestIdx = entry.idx;
                    }
                }
                return bestIdx;
            }

            // Clicking the minimap pans to that area (keeps zoom); fallback: focus nearest node
            mini.addEventListener('click', (e) => {
                const rect = mini.getBoundingClientRect();
                let localX = e.clientX - rect.left;
                let localY = e.clientY - rect.top;
                if (rect.width && rect.height && minimapCanvasEl) {
                    localX = (localX / rect.width) * minimapCanvasEl.width;
                    localY = (localY / rect.height) * minimapCanvasEl.height;
                }
                if (minimapBounds) {
                    const { minX, minZ, scale, offsetX, offsetY, w, h } = minimapBounds;
                    const worldX = minX + (localX - offsetX) / scale;
                    const worldZ = minZ + (h - localY - offsetY) / scale;
                    const p = project(worldX, 0, worldZ);
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    camera.panX = (camera.panX || 0) + (cx - p.x);
                    camera.panY = (camera.panY || 0) + (cy - p.y);
                    cameraFocus.active = false;
                    return;
                }
                if (!minimapNodes.length || !nodes.length) return;
                const bestIdx = findNearestMinimapNode(localX, localY);
                if (bestIdx === null) return;
                selected = bestIdx;
                const node = nodes[bestIdx];
                focusOnNode(node);
                showNodeDetails(node);
                if (window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) showNodeDetailsInDrawer(node);
            });

            wrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                viewZoom *= 1 - e.deltaY * CONFIG.ZOOM_SPEED;
                viewZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, viewZoom));
                updateZoomLabel();
                cameraFocus.active = false;
            }, { passive: false });

            let minimapPinchDist = null;
            function minimapPinchDistance(touches) {
                return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
            }
            wrap.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    minimapPinchDist = minimapPinchDistance(e.touches);
                    e.preventDefault();
                }
            }, { passive: false });
            wrap.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && minimapPinchDist !== null) {
                    e.preventDefault();
                    const d = minimapPinchDistance(e.touches);
                    const ratio = d / minimapPinchDist;
                    viewZoom *= ratio;
                    viewZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, viewZoom));
                    minimapPinchDist = d;
                    updateZoomLabel();
                    cameraFocus.active = false;
                }
            }, { passive: false });
            wrap.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) minimapPinchDist = null;
            }, { passive: true });
            wrap.addEventListener('touchcancel', (e) => {
                if (e.touches.length < 2) minimapPinchDist = null;
            }, { passive: true });

            return minimapEl;
        }
        function updateMinimap() {
            if (!nodes || !nodes.length) return;
            ensureMinimap();
            if (!minimapCanvasEl || !minimapCtx) return;

            const w = minimapCanvasEl.width;
            const h = minimapCanvasEl.height;

            // Compute bounds from world-space X/Z so minimap is a stable top-down view
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (let i = 0; i < nodes.length; i++) {
                if (!nodePassesFilterByIndex(i)) continue;
                const n = nodes[i];
                if (n.x < minX) minX = n.x;
                if (n.x > maxX) maxX = n.x;
                if (n.z < minZ) minZ = n.z;
                if (n.z > maxZ) maxZ = n.z;
            }
            if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minZ) || !isFinite(maxZ)) {
                minimapCtx.clearRect(0, 0, w, h);
                minimapNodes = [];
                minimapBounds = null;
                return;
            }
            const padding = 10;
            const spanX = Math.max(1, maxX - minX);
            const spanZ = Math.max(1, maxZ - minZ);
            const scale = Math.min(
                (w - padding * 2) / spanX,
                (h - padding * 2) / spanZ
            );
            // Center the graph in the minimap
            const offsetX = padding + ((w - padding * 2) - spanX * scale) / 2;
            const offsetY = padding + ((h - padding * 2) - spanZ * scale) / 2;
            minimapBounds = { minX, minZ, scale, padding, w, h, offsetX, offsetY };

            minimapCtx.clearRect(0, 0, w, h);

            // Soft background grid
            minimapCtx.fillStyle = 'rgba(15,23,42,0.96)';
            minimapCtx.fillRect(0, 0, w, h);
            minimapCtx.strokeStyle = 'rgba(55,65,81,0.35)';
            minimapCtx.lineWidth = 1;
            minimapCtx.beginPath();
            minimapCtx.rect(0.5, 0.5, w - 1, h - 1);
            minimapCtx.stroke();

            // Precompute node positions in minimap space (centered)
            const entries = [];
            for (let i = 0; i < nodes.length; i++) {
                if (!nodePassesFilterByIndex(i)) continue;
                const n = nodes[i];
                const nx = (n.x - minX) * scale + offsetX;
                const nz = (n.z - minZ) * scale + offsetY;
                entries.push({ idx: i, x: nx, y: h - nz }); // flip Z so "up" is positive
            }
            minimapNodes = entries;
            const entryByIdx = new Map(entries.map(en => [en.idx, en]));

            // Draw edges first, very faint (O(edges) via Map lookup)
            minimapCtx.lineWidth = 0.75;
            minimapCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
            minimapCtx.beginPath();
            for (let i = 0; i < edges.length; i++) {
                const e = edges[i];
                if (!nodePassesFilterByIndex(e.from) || !nodePassesFilterByIndex(e.to)) continue;
                const fromEntry = entryByIdx.get(e.from);
                const toEntry = entryByIdx.get(e.to);
                if (!fromEntry || !toEntry) continue;
                minimapCtx.moveTo(fromEntry.x, fromEntry.y);
                minimapCtx.lineTo(toEntry.x, toEntry.y);
            }
            minimapCtx.stroke();

            // Draw nodes on top
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const node = nodes[entry.idx];
                const isSelected = selected === entry.idx;
                const baseColor = node.color || (categoryColors[node.type] || '#38bdf8');
                const isImg = node.isImageMedia === true;
                const mr = isImg ? (isSelected ? 4.2 : 3.2) : (isSelected ? 3.3 : 2.1);
                minimapCtx.beginPath();
                minimapCtx.arc(entry.x, entry.y, mr, 0, Math.PI * 2);
                minimapCtx.fillStyle = isSelected ? '#ffffff' : baseColor;
                minimapCtx.globalAlpha = isSelected ? 1 : 0.95;
                minimapCtx.fill();
                if (isImg && !isSelected) {
                    minimapCtx.beginPath();
                    minimapCtx.arc(entry.x, entry.y, mr, 0, Math.PI * 2);
                    minimapCtx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
                    minimapCtx.lineWidth = 0.9;
                    minimapCtx.stroke();
                }
                minimapCtx.globalAlpha = 1;
            }
        }
        function ensureZoomControls() {
            if (zoomControlsEl) return zoomControlsEl;
            const wrap = document.createElement('div');
            wrap.id = 'neural-graph-zoom-controls';
            wrap.setAttribute('aria-label', 'Zoom graph');
            wrap.className = 'neural-graph-zoom-controls';
            const zoomStep = 1.25;
            const btnMinus = document.createElement('button');
            btnMinus.type = 'button';
            btnMinus.setAttribute('aria-label', 'Zoom out');
            btnMinus.textContent = '−';
            btnMinus.className = 'neural-graph-zoom-btn';
            btnMinus.addEventListener('click', () => {
                if (viewZoom / zoomStep <= getViewZoomMin()) {
                    openTimeFilterPopover();
                    return;
                }
                viewZoom /= zoomStep;
                viewZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, viewZoom));
                updateZoomLabel();
                cameraFocus.active = false;
            });
            const btnPlus = document.createElement('button');
            btnPlus.type = 'button';
            btnPlus.setAttribute('aria-label', 'Zoom in');
            btnPlus.textContent = '+';
            btnPlus.className = 'neural-graph-zoom-btn';
            btnPlus.addEventListener('click', () => {
                viewZoom *= zoomStep;
                viewZoom = Math.max(getViewZoomMin(), Math.min(VIEW_ZOOM_MAX, viewZoom));
                updateZoomLabel();
                cameraFocus.active = false;
            });
            const label = document.createElement('div');
            label.id = 'neural-graph-zoom-label';
            label.className = 'neural-graph-zoom-label';
            zoomLabelEl = label;
            const timeLabel = document.createElement('div');
            timeLabel.id = 'neural-graph-time-filter-label';
            timeLabel.className = 'neural-graph-time-filter-label';
            timeLabel.setAttribute('role', 'button');
            timeLabel.setAttribute('tabindex', '0');
            timeLabel.setAttribute('aria-label', 'Change time range');
            timeLabel.setAttribute('aria-haspopup', 'listbox');
            timeLabel.title = 'Click to choose time range';
            timeLabel.textContent = getTimeFilterDisplayName(currentTimeFilter);
            let timeFilterPopoverEl = null;
            function openTimeFilterPopover() {
                if (timeFilterPopoverEl) {
                    const tDay = DAY_FILTER_PREFIX + getTodayLocal();
                    const tOpt = timeFilterPopoverEl.querySelector('[data-today-option="true"]');
                    if (tOpt) {
                        tOpt.setAttribute('data-filter-time', tDay);
                        tOpt.onclick = (e) => {
                            e.stopPropagation();
                            setActiveTimeFilter(tDay);
                            closeTimeFilterPopover();
                            cameraFocus.active = false;
                        };
                    }
                    const yDay = DAY_FILTER_PREFIX + getYesterdayLocal();
                    const yOpt = timeFilterPopoverEl.querySelector('[data-yesterday-option="true"]');
                    if (yOpt) {
                        yOpt.setAttribute('data-filter-time', yDay);
                        yOpt.onclick = (e) => {
                            e.stopPropagation();
                            setActiveTimeFilter(yDay);
                            closeTimeFilterPopover();
                            cameraFocus.active = false;
                        };
                    }
                    timeFilterPopoverEl.querySelectorAll('.neural-graph-time-filter-option').forEach(opt => {
                        opt.classList.toggle('active', opt.getAttribute('data-filter-time') === currentTimeFilter);
                    });
                    timeFilterPopoverEl.classList.add('open');
                    positionTimeFilterPopover();
                    setTimeout(() => document.addEventListener('click', closeOnClickOutside, true), 0);
                    document.addEventListener('keydown', closeOnEscape);
                    return;
                }
                const pop = document.createElement('div');
                pop.id = 'neural-graph-time-filter-popover';
                pop.className = 'neural-graph-time-filter-popover';
                pop.setAttribute('role', 'listbox');
                pop.setAttribute('aria-label', 'Time range');
                const allOpt = document.createElement('button');
                allOpt.type = 'button';
                allOpt.className = 'neural-graph-time-filter-option' + (currentTimeFilter === 'all' ? ' active' : '');
                allOpt.setAttribute('role', 'option');
                allOpt.setAttribute('data-filter-time', 'all');
                allOpt.textContent = 'All';
                allOpt.addEventListener('click', (e) => { e.stopPropagation(); setActiveTimeFilter('all'); closeTimeFilterPopover(); cameraFocus.active = false; });
                pop.appendChild(allOpt);
                const tDay = DAY_FILTER_PREFIX + getTodayLocal();
                const tOpt = document.createElement('button');
                tOpt.type = 'button';
                tOpt.className = 'neural-graph-time-filter-option' + (currentTimeFilter === tDay ? ' active' : '');
                tOpt.setAttribute('role', 'option');
                tOpt.setAttribute('data-filter-time', tDay);
                tOpt.setAttribute('data-today-option', 'true');
                tOpt.textContent = 'Today';
                tOpt.addEventListener('click', (e) => { e.stopPropagation(); setActiveTimeFilter(tDay); closeTimeFilterPopover(); cameraFocus.active = false; });
                pop.appendChild(tOpt);
                const yDay = DAY_FILTER_PREFIX + getYesterdayLocal();
                const yOpt = document.createElement('button');
                yOpt.type = 'button';
                yOpt.className = 'neural-graph-time-filter-option' + (currentTimeFilter === yDay ? ' active' : '');
                yOpt.setAttribute('role', 'option');
                yOpt.setAttribute('data-filter-time', yDay);
                yOpt.setAttribute('data-yesterday-option', 'true');
                yOpt.textContent = 'Yesterday';
                yOpt.addEventListener('click', (e) => { e.stopPropagation(); setActiveTimeFilter(yDay); closeTimeFilterPopover(); cameraFocus.active = false; });
                pop.appendChild(yOpt);
                TIME_WINDOWS.forEach(w => {
                    const opt = document.createElement('button');
                    opt.type = 'button';
                    opt.className = 'neural-graph-time-filter-option' + (currentTimeFilter === w.id ? ' active' : '');
                    opt.setAttribute('role', 'option');
                    opt.setAttribute('data-filter-time', w.id);
                    opt.textContent = w.label;
                    opt.addEventListener('click', (e) => { e.stopPropagation(); setActiveTimeFilter(w.id); closeTimeFilterPopover(); cameraFocus.active = false; });
                    pop.appendChild(opt);
                });
                document.body.appendChild(pop);
                timeFilterPopoverEl = pop;
                pop.classList.add('open');
                positionTimeFilterPopover();
                setTimeout(() => document.addEventListener('click', closeOnClickOutside, true), 0);
                document.addEventListener('keydown', closeOnEscape);
            }
            function positionTimeFilterPopover() {
                if (!timeFilterPopoverEl || !timeLabel) return;
                const rect = timeLabel.getBoundingClientRect();
                timeFilterPopoverEl.style.left = rect.left + 'px';
                timeFilterPopoverEl.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                timeFilterPopoverEl.style.minWidth = Math.max(rect.width, 140) + 'px';
            }
            function closeTimeFilterPopover() {
                if (!timeFilterPopoverEl) return;
                timeFilterPopoverEl.classList.remove('open');
                document.removeEventListener('click', closeOnClickOutside, true);
                document.removeEventListener('keydown', closeOnEscape);
            }
            function closeOnClickOutside(e) {
                if (timeFilterPopoverEl && !timeFilterPopoverEl.contains(e.target) && !timeLabel.contains(e.target) && !wrap.contains(e.target))
                    closeTimeFilterPopover();
            }
            function closeOnEscape(e) {
                if (e.key === 'Escape') closeTimeFilterPopover();
            }
            timeLabel.addEventListener('click', (e) => { e.stopPropagation(); openTimeFilterPopover(); });
            timeLabel.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTimeFilterPopover(); }
            });
            timeFilterLabelEl = timeLabel;
            openTimeFilterPopoverRef = openTimeFilterPopover;
            window.addEventListener('resize', () => { if (timeFilterPopoverEl && timeFilterPopoverEl.classList.contains('open')) positionTimeFilterPopover(); });
            const labelsCol = document.createElement('div');
            labelsCol.className = 'neural-graph-zoom-labels';
            labelsCol.appendChild(label);
            labelsCol.appendChild(timeLabel);
            const viewToggleBtn = document.createElement('button');
            viewToggleBtn.type = 'button';
            viewToggleBtn.className = 'neural-graph-view-toggle';
            viewToggleBtn.setAttribute('aria-label', 'Switch between map view and 3D view');
            viewToggleBtn.title = use3DView ? 'Switch to map view (like minimap)' : 'Switch to 3D view (rotate and explore)';
            viewToggleLabelUpdate = function() {
                viewToggleBtn.textContent = use3DView ? 'Map' : '3D';
                viewToggleBtn.title = use3DView ? 'Switch to map view (like minimap)' : 'Switch to 3D view (rotate and explore)';
            };
            viewToggleLabelUpdate();
            viewToggleBtn.addEventListener('click', () => {
                if (viewTransitionState !== null) return;
                viewTransitionState = 'out';
                viewTransitionStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
                cameraFocus.active = false;
            });
            const buttonsCol = document.createElement('div');
            buttonsCol.className = 'neural-graph-zoom-buttons';
            buttonsCol.appendChild(btnPlus);
            buttonsCol.appendChild(btnMinus);
            buttonsCol.appendChild(viewToggleBtn);
            wrap.appendChild(labelsCol);
            wrap.appendChild(buttonsCol);
            const style = document.createElement('style');
            style.textContent = `
                .neural-graph-zoom-controls { position: fixed; z-index: 15; display: flex; flex-direction: row; align-items: center; gap: 10px; pointer-events: auto; background: rgba(10, 17, 40, 0.92); border: 1px solid rgba(0, 255, 255, 0.35); border-radius: 12px; padding: 10px 12px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4); }
                .neural-graph-zoom-labels { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 2px; min-width: 4em; }
                .neural-graph-zoom-buttons { display: flex; flex-direction: column; gap: 6px; }
                .neural-graph-zoom-btn { width: 52px; height: 52px; border-radius: 12px; border: 2px solid rgba(0, 255, 255, 0.5); background: rgba(10, 17, 40, 0.9); color: #00ffff; font-size: 26px; font-weight: bold; line-height: 1; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; padding: 0; transition: background 0.2s, border-color 0.2s; }
                .neural-graph-zoom-btn:hover { background: rgba(0, 136, 255, 0.25); border-color: #00ffff; }
                .neural-graph-zoom-btn:active { background: rgba(0, 255, 255, 0.2); }
                .neural-graph-view-toggle { width: 52px; padding: 6px 4px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.4); background: rgba(10, 17, 40, 0.9); color: #7dd3fc; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.2s, border-color 0.2s; }
                .neural-graph-view-toggle:hover { background: rgba(0, 136, 255, 0.2); border-color: #00ffff; color: #00ffff; }
                .neural-graph-zoom-label { font-size: 11px; font-family: monospace; color: #9ca3af; opacity: 0.9; }
                .neural-graph-time-filter-label { font-size: 12px; font-weight: 600; color: #94a3b8; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s; }
                .neural-graph-time-filter-label:hover { color: #00ffff; background: rgba(0, 255, 255, 0.1); }
                .neural-graph-time-filter-label:focus { outline: 2px solid rgba(0, 255, 255, 0.6); outline-offset: 2px; }
                .neural-graph-time-filter-popover { position: fixed; z-index: 25; left: 0; bottom: 0; display: none; flex-direction: column; gap: 2px; max-height: 70vh; overflow-y: auto; background: rgba(10, 17, 40, 0.96); border: 1px solid rgba(0, 255, 255, 0.4); border-radius: 10px; padding: 6px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 255, 255, 0.15); pointer-events: auto; }
                .neural-graph-time-filter-popover.open { display: flex; }
                .neural-graph-time-filter-option { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; border-radius: 6px; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 0.15s, color 0.15s; }
                .neural-graph-time-filter-option:hover { background: rgba(0, 255, 255, 0.12); color: #00ffff; }
                .neural-graph-time-filter-option.active { background: rgba(0, 255, 255, 0.18); color: #00ffff; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
            zoomControlsEl = wrap;
            positionZoomControls();
            updateZoomLabel();
            return zoomControlsEl;
        }
        ensureZoomControls();

        let pinchDist = null;
        let touchStartX = 0, touchStartY = 0, lastTouchX = 0, lastTouchY = 0;
        let touchMoved = false;
        let touchFingerCount = 0;
        const TAP_THRESHOLD = 12;

        function pinchDistance(touches) {
            return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        }

        function hitTestNode(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const mx = clientX - rect.left;
            const my = clientY - rect.top;
            let activeNodeIds = null;
            if (selected !== null) {
                activeNodeIds = new Set([selected]);
                edges.forEach(e => {
                    if (e.from === selected) activeNodeIds.add(e.to);
                    if (e.to === selected) activeNodeIds.add(e.from);
                });
            }
            const size3D = (use3DView ? 0.2 : 1) * (currentTimeFilter === 'week' || (currentTimeFilter && currentTimeFilter.startsWith('day:')) ? 2 : 1);
            const hitScreenPos = {};
            for (let idx = 0; idx < nodes.length; idx++) {
                const p = project(nodes[idx].x, nodes[idx].y, nodes[idx].z);
                hitScreenPos[idx] = { x: p.x, y: p.y, scale: p.scale };
            }
            // Precise hit: only inside visual node radius + small tolerance; pick closest node under cursor
            const HIT_TOLERANCE = 4;
            let bestIdx = null;
            let bestD = Infinity;
            for (let idx = 0; idx < nodes.length; idx++) {
                const n = nodes[idx];
                if (!nodePassesFilter(n)) continue;
                if (activeNodeIds !== null && !activeNodeIds.has(idx)) continue;
                const p = hitScreenPos[idx];
                const d = Math.hypot(p.x - mx, p.y - my);
                const visualRadius = n.size * p.scale * size3D;
                const hitRadius = Math.max(visualRadius * 1.05 + HIT_TOLERANCE, 8);
                if (d < hitRadius && d < bestD) {
                    bestD = d;
                    bestIdx = idx;
                }
            }
            return bestIdx;
        }

        canvas.addEventListener('touchstart', e => {
            touchFingerCount = e.touches.length;
            if (e.touches.length === 2) {
                pinchDist = pinchDistance(e.touches);
                e.preventDefault();
            } else if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                lastTouchX = touchStartX;
                lastTouchY = touchStartY;
                touchMoved = false;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const d = pinchDistance(e.touches);
                if (pinchDist === null) { pinchDist = d; return; }
                const rect = canvas.getBoundingClientRect();
                const clientCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const clientCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                const pinchCenterX = rect.width  ? clientCenterX * (canvas.width / rect.width)  : clientCenterX;
                const pinchCenterY = rect.height ? clientCenterY * (canvas.height / rect.height) : clientCenterY;
                let ratio = d / pinchDist;
                ratio = Math.max(0.92, Math.min(1.08, ratio));
                if (ratio < 1 && viewZoom * ratio <= getViewZoomMin() && openTimeFilterPopoverRef) {
                    pinchDist = d;
                    openTimeFilterPopoverRef();
                    return;
                }
                pinchDist = d;
                zoomTowardPoint(pinchCenterX, pinchCenterY, ratio);
            } else if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - lastTouchX;
                const dy = e.touches[0].clientY - lastTouchY;
                if (!touchMoved) touchMoved = Math.hypot(e.touches[0].clientX - touchStartX, e.touches[0].clientY - touchStartY) > TAP_THRESHOLD;
                if (touchMoved) {
                    e.preventDefault();
                    // Pan only: point under finger stays under finger (locked drag).
                    camera.panX = (camera.panX || 0) + dx;
                    camera.panY = (camera.panY || 0) + dy;
                }
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', e => {
            if (e.touches.length < 2) pinchDist = null;
            if (e.touches.length === 0 && touchFingerCount === 1 && !touchMoved && e.changedTouches[0]) {
                const t = e.changedTouches[0];
                const idx = hitTestNode(t.clientX, t.clientY);
                if (idx !== null) {
                    selected = idx;
                    const selNode = nodes[selected];
                    if (selNode && selNode.isMemoryRef) {
                        openMemoryLinkSidebar(selNode);
                    } else {
                        showNodeDetails(selNode);
                    }
                    window.location.hash = selNode ? selNode.idKey : '';
                    focusOnNode(selNode);
                } else {
                    window.clearSelection();
                }
            }
        }, { passive: true });

        let drag = null;
        let didDrag = false;
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            const canvasX = rect.width  ? (e.clientX - rect.left) * (canvas.width / rect.width)  : e.clientX - rect.left;
            const canvasY = rect.height ? (e.clientY - rect.top) * (canvas.height / rect.height) : e.clientY - rect.top;
            const dragOnNode = hitTestNode(e.clientX, e.clientY) !== null;
            drag = { startX: canvasX, startY: canvasY, lastX: canvasX, lastY: canvasY, dragOnNode };
            didDrag = false;
        });
        document.addEventListener('mousemove', e => {
            if (!drag) return;
            const rect = canvas.getBoundingClientRect();
            const canvasX = rect.width  ? (e.clientX - rect.left) * (canvas.width / rect.width)  : e.clientX - rect.left;
            const canvasY = rect.height ? (e.clientY - rect.top) * (canvas.height / rect.height) : e.clientY - rect.top;
            didDrag = true;
            const dx = canvasX - drag.lastX;
            const dy = canvasY - drag.lastY;
            if (drag.dragOnNode) {
                // Dragging from on a node: spin the graph around the vertical axis (bird's-eye rotation only)
                const sensYaw = 0.014;
                camera.angle += dx * sensYaw;
            } else {
                // Dragging from empty space: pan
                camera.panX = (camera.panX || 0) + dx;
                camera.panY = (camera.panY || 0) + dy;
            }
            drag.lastX = canvasX;
            drag.lastY = canvasY;
        });
        document.addEventListener('mouseup', () => {
            drag = null;
        });

        // Hover: lightweight node exploration with inline labels + image previews
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouseClientX = e.clientX;
            mouseClientY = e.clientY;
            mouseOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (mouseOverCanvas && rect.width && rect.height) {
                mouseCanvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
                mouseCanvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
            } else {
                mouseCanvasX = NaN;
                mouseCanvasY = NaN;
            }
            const idx = hitTestNode(e.clientX, e.clientY);
            hovered = idx;

            if (idx !== null && nodes[idx]) {
                const node = nodes[idx];
                const nodeType = (node.type || '').toLowerCase();
                if (nodeType === 'temporal') {
                    showNodeDetails(node, { inline: true, clientX: e.clientX, clientY: e.clientY });
                    hideImageHover();
                    hideAudioHover();
                } else {
                    if (hoverTemporalPopoverOpen) showNodeDetails(null);
                    if (nodeType === 'file' || nodeType === 'archive') {
                        const filePath = node.attributes && (node.attributes.filePath || node.attributes.rawContentPath || node.attributes.file_url || node.attributes.path);
                        const fileType = filePath ? detectFileType(filePath) : '';
                        if (fileType === 'image') {
                            showImageHover(node, e.clientX, e.clientY);
                            hideAudioHover();
                            hideTextHover();
                        } else if (fileType === 'audio') {
                            showAudioHover(node, e.clientX, e.clientY);
                            hideImageHover();
                            hideTextHover();
                        } else if (fileType === 'text') {
                            showTextHover(node, e.clientX, e.clientY);
                            hideImageHover();
                            hideAudioHover();
                        } else {
                            hideImageHover();
                            hideAudioHover();
                            hideTextHover();
                        }
                    } else {
                        hideImageHover();
                        hideAudioHover();
                        hideTextHover();
                    }
                }
            } else {
                if (hoverTemporalPopoverOpen) showNodeDetails(null);
                hideImageHover();
                hideAudioHover();
                hideTextHover();
            }
        });
        canvas.addEventListener('mouseleave', () => {
            hovered = null;
            mouseOverCanvas = false;
            mouseCanvasX = NaN;
            mouseCanvasY = NaN;
            if (hoverTemporalPopoverOpen) showNodeDetails(null);
            hideImageHover();
            hideAudioHover();
        });

        window.walk = () => {
            const eligible = [];
            for (let idx = 0; idx < nodes.length; idx++) {
                if (nodePassesFilterByIndex(idx)) eligible.push(idx);
            }
            if (eligible.length === 0) {
                selected = null;
                showNodeDetails(null);
                showNodeDetailsInDrawer(null);
                window.location.hash = '';
                return;
            }
            selected = eligible[Math.floor(Math.random() * eligible.length)];
            const node = nodes[selected];
            if (node.isMemoryRef) {
                openMemoryLinkSidebar(node);
            } else {
                showNodeDetails(node);
            }
            window.location.hash = node.idKey;
        };

        window.reset = () => {
            camera = {angle: 0.5, dist: 680, height: 60, pitch: -0.55, panX: 0, panY: 0};
            viewZoom = 0.8;
            cameraFocus.active = false;
            selected = null;
            showNodeDetails(null);
        };

        /** Load memory by source: 'latest' | { commit } | { hash (master hash) }. Updates the graph. */
        window.loadMemory = loadMemory;
        /** Reload latest memory and force a fresh frame + minimap redraw. */
        window.reloadLatestMemory = async function() {
            const ok = await loadMemory('latest');
            if (ok) {
                render();
                updateMinimap();
            }
            return ok;
        };
        /** Total loaded graph size (not filtered). For per-brain count display. */
        window.getGraphCounts = function() {
            return {
                nodes: graphFullNodes.length || nodes.length,
                edges: graphFullEdges.length || edges.length
            };
        };

        function updateDrawerStats() {
            const countEl = document.getElementById('drawer-neurons-synapses');
            const label = (CONFIG.dataBasePath === 'PAUL-memories') ? 'Paul' : 'JARVIS';
            if (countEl) countEl.textContent = label + ': ' + graphFullNodes.length + ' neurons · ' + graphFullEdges.length + ' synapses';
        }

        const liveUrl = CONFIG.liveUrl || 'https://paulvisciano.github.io/memory/';
        function isLocalhost() {
            const h = window.location.hostname;
            return h === 'localhost' || h === '127.0.0.1';
        }
        function getSharePayload() {
            const n = graphFullNodes.length || nodes.length;
            const s = graphFullEdges.length || edges.length;
            const currentUrl = window.location.href;
            const url = isLocalhost() ? liveUrl : currentUrl;
            const title = CONFIG.shareTitle || "Neural Mind";
            const shortBoot = CONFIG.shareShortBoot || "Interactive neural graph. The memory is alive.";
            const verifyUrl = CONFIG.shareVerifyUrlDefault || 'paulvisciano.github.io/memory/BOOT.md';
            const shareHeading = CONFIG.shareHeading || 'Neural Mind';
            const loadLabel = CONFIG.shareLoadMemoryLabel || "Load memory at the start of a new session";
            const lines = [
                shareHeading,
                `${n} neurons · ${s} synapses`,
                '',
                shortBoot,
                '',
                `${loadLabel}: ${verifyUrl}`,
                '',
                url
            ];
            const text = lines.join('\n');
            return { title, text, url, n, s, shortBoot, verifyUrl };
        }
        function escapeHtml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function shareMemory() {
            const payload = getSharePayload();
            const { title, text, url, n, s, shortBoot, verifyUrl } = payload;
            const overlay = document.getElementById('share-modal-overlay');
            const preview = document.getElementById('share-preview');
            const verifyUrlVal = verifyUrl || CONFIG.shareVerifyUrlDefault || 'paulvisciano.github.io/memory/BOOT.md';
            const verifyHref = verifyUrlVal.startsWith('http') ? verifyUrlVal : 'https://' + verifyUrlVal;
            const shareHeading = CONFIG.shareHeading || 'Neural Mind';
            const loadLabel = CONFIG.shareLoadMemoryLabel || "Load memory at the start of a new session";
            const lines = [
                shareHeading,
                ``,
                `Size: ${escapeHtml(n)} neurons · ${escapeHtml(s)} synapses`,
                ``,
                escapeHtml(shortBoot),
                ``,
                `${loadLabel}: <a href="${escapeHtml(verifyHref)}" target="_blank" rel="noopener">${escapeHtml(verifyUrlVal)}</a>`,
                ``,
                `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
            ];
            preview.innerHTML = lines.join('\n');
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
        }
        document.getElementById('share-modal-close').addEventListener('click', () => {
            document.getElementById('share-modal-overlay').classList.remove('is-open');
            document.getElementById('share-modal-overlay').setAttribute('aria-hidden', 'true');
        });
        document.getElementById('share-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'share-modal-overlay') {
                document.getElementById('share-modal-overlay').classList.remove('is-open');
                document.getElementById('share-modal-overlay').setAttribute('aria-hidden', 'true');
            }
        });
        document.getElementById('share-modal-copy').addEventListener('click', () => {
            const { text } = getSharePayload();
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('share-modal-copy');
                const t = btn.textContent; btn.textContent = '✓ Copied';
                setTimeout(() => { btn.textContent = t; }, 2000);
            }).catch(() => alert('Share text copy failed.'));
        });
        document.getElementById('share-modal-native').addEventListener('click', () => {
            const { title, text, url } = getSharePayload();
            if (navigator.share) {
                navigator.share({ title, text, url }).then(() => {
                    document.getElementById('share-modal-overlay').classList.remove('is-open');
                }).catch(() => {});
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    document.getElementById('share-modal-copy').textContent = '✓ Copied';
                    setTimeout(() => { document.getElementById('share-modal-overlay').classList.remove('is-open'); }, 500);
                });
            }
        });
        document.getElementById('share-memory-btn').addEventListener('click', shareMemory);
        document.getElementById('drawer-share-btn')?.addEventListener('click', shareMemory);
        document.getElementById('drawer-walk-btn')?.addEventListener('click', () => { walk(); if (window.innerWidth <= 768 && selected !== null && nodes[selected]) showNodeDetailsInDrawer(nodes[selected]); });
        document.getElementById('drawer-clear-btn')?.addEventListener('click', () => { clearSelection(); showNodeDetailsInDrawer(null); });

        function openFullContext() {
            if (selected === null || !nodes[selected]) return;
            const node = nodes[selected];
            
            // Try rawContentPath first (for file nodes), then sourceDocument
            const rawPath = node.attributes?.rawContentPath;
            const sourcePath = node.sourceDocument || node.attributes?.sourceDocument;
            const pathToOpen = rawPath || sourcePath;
            
            const resolvedPath = resolvePath(pathToOpen);
            if (typeof resolvedPath !== 'string' || !resolvedPath) {
                alert('No file path available for this node');
                return;
            }
            
            // Fallback to existing behavior for remote/source documents
            const pathOnDisk = resolvedPath;

            if (pathOnDisk.startsWith('https://')) {
                fetch(pathOnDisk)
                    .then(r => r.ok ? r.text() : Promise.reject(new Error(r.statusText)))
                    .then(md => {
                        const pre = document.createElement('pre');
                        pre.style.cssText = 'white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; max-width: 100%; width: 100%; overflow: auto; font-size: 12px; text-align: left; padding: 12px; margin: 0; box-sizing: border-box;';
                        pre.textContent = md;
                        const d = document.createElement('div');
                        d.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 20px; box-sizing: border-box; overflow: hidden; min-width: 0;';
                        const closeBtn = document.createElement('button');
                        closeBtn.textContent = 'Close';
                        closeBtn.className = 'primary';
                        closeBtn.style.marginTop = '12px';
                        closeBtn.style.flexShrink = '0';
                        closeBtn.onclick = () => d.remove();
                        d.appendChild(pre);
                        d.appendChild(closeBtn);
                        pre.style.flex = '1';
                        pre.style.minHeight = '0';
                        document.body.appendChild(d);
                    })
                    .catch(err => alert('Error loading: ' + err.message));
                return;
            }
            const msg = 'File on disk (relative to project root):\n\n' + pathOnDisk + '\n\nIn Cursor: Cmd+P (or Ctrl+P) and paste this path to open.';
            if (window.location.protocol === 'file:' || window.location.hostname === 'paulvisciano.github.io') {
                console.info('Full Context (local only):', pathOnDisk);
                alert(msg);
                return;
            }
            const fetchUrl = (CONFIG.getFullContextFetchUrl && CONFIG.getFullContextFetchUrl(pathOnDisk)) || (typeof pathOnDisk === 'string' && pathOnDisk.startsWith('memory/') ? pathOnDisk.slice(7) : pathOnDisk);
            fetch(fetchUrl)
                .then(r => r.ok ? r.text() : Promise.reject(new Error(r.statusText)))
                .then(md => {
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; max-width: 100%; width: 100%; overflow: auto; font-size: 12px; text-align: left; padding: 12px; margin: 0; box-sizing: border-box;';
                    pre.textContent = 'File: ' + pathOnDisk + '\n\n' + md;
                    const d = document.createElement('div');
                    d.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 20px; box-sizing: border-box; overflow: hidden; min-width: 0;';
                    const closeBtn = document.createElement('button');
                    closeBtn.textContent = 'Close';
                    closeBtn.className = 'primary';
                    closeBtn.style.marginTop = '12px';
                    closeBtn.style.flexShrink = '0';
                    closeBtn.onclick = () => d.remove();
                    d.appendChild(pre);
                    d.appendChild(closeBtn);
                    pre.style.flex = '1';
                    pre.style.minHeight = '0';
                    document.body.appendChild(d);
                })
                .catch(() => alert(msg));
        }
        document.body.addEventListener('click', function(e) {
            if (e.target.closest('.node-popover-close')) {
                if (e.target.closest('#node-details-modal')) {
                    showNodeDetailsModal(null);
                    return;
                }
                clearSelection();
                return;
            }
            const fc = e.target.closest('.node-popover-full-context');
            if (fc && !fc.disabled) { openFullContext(); return; }
            if (e.target.closest('.node-popover-open-panel') && selected !== null && nodes[selected]) {
                openFilePreview(nodes[selected]);
                return;
            }
        });

        // Start rendering immediately (will display as data loads)
        render();
        
        // Load character profiles, then graph data
        // Unregister old service workers that were caching aggressively
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(reg => {
                    console.log('Unregistering service worker:', reg);
                    reg.unregister();
                });
            }).catch(err => console.log('No service workers to unregister:', err));
        }
        
        loadCharacterProfiles();
        // Initial selection (hash vs random) is handled by the single loadGraphData().then() above

        // === AUTO-REFRESH: Gracefully add new neurons/synapses with fade-in ===
        const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds
        let nodeIdSet = new Set();
        let synapseIdSet = new Set();

        setInterval(() => {
            // Build "already seen" from full graph so deltas are correct even when the view is filtered.
            nodeIdSet = new Set(graphFullNodes.map(n => String(n.idKey)));
            synapseIdSet = new Set(graphFullEdges.map(e => (graphFullNodes[e.from]?.idKey != null && graphFullNodes[e.to]?.idKey != null)
                ? String(graphFullNodes[e.from].idKey) + '-' + String(graphFullNodes[e.to].idKey)
                : String(e.from) + '-' + String(e.to)));

            Promise.all([
                fetch(dataDir() + '/nodes.json?t=' + Date.now()).then(r => r.ok ? r.json() : null),
                fetch(dataDir() + '/synapses.json?t=' + Date.now()).then(r => r.ok ? r.json() : null)
            ]).then(([newNodes, newSynapses]) => {
                if (!newNodes || !newSynapses) return;

                const newN = newNodes.length;
                const newS = newSynapses.length;
                let addedNodes = 0;
                let addedSynapses = 0;

                // Use same key as existing nodes; normalize to string so we don't double-count (e.g. id 123 vs "123")
                newNodes.forEach(node => {
                    const nodeKey = String(node.idKey != null ? node.idKey : node.id);
                    if (nodeKey === 'undefined' || nodeKey === '') return;
                    if (!nodeIdSet.has(nodeKey)) {
                        nodeIdSet.add(nodeKey);
                        const created = (node.attributes && (node.attributes.created || node.attributes.date)) || node.created || '';
                        const createdStr = created ? String(created).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '' : '';
                        const todayLocal = getTodayLocal();
                        const yesterdayLocal = getYesterdayLocal();
                        const weekRange = getThisWeekRange();
                        const isToday = createdStr === todayLocal;
                        const isYesterday = createdStr === yesterdayLocal;
                        const isThisWeek = createdStr && weekRange && createdStr >= weekRange.start && createdStr <= weekRange.end;
                        const attrs = node.attributes || {};
                        const pathForKind = attrs.filePath || attrs.rawContentPath || attrs.file_url || attrs.path || node.label || '';
                        const catL = (node.category || node.type || '').toLowerCase();
                        const isImageMedia =
                            catL === 'image' ||
                            ((catL === 'archive' || catL === 'file') && detectFileType(pathForKind) === 'image');
                        const mapped = {
                            id: graphFullNodes.length,
                            idKey: nodeKey,
                            name: node.label ?? node.name,
                            type: node.category ?? node.type,
                            x: (typeof node.x === 'number' ? node.x : 0) + (Math.random() - 0.5) * 80,
                            y: (typeof node.y === 'number' ? node.y : 0) + (Math.random() - 0.5) * 80,
                            z: typeof node.z === 'number' ? node.z : 0,
                            vx: 0, vy: 0, vz: 0,
                            size: Number(node.size) || 6,
                            glow: Number(node.glow) || 12,
                            color: node.color || categoryColors[node.category] || '#00ffff',
                            attributes: attrs,
                            isImageMedia,
                            freq: Number(node.frequency) || 10,
                            desc: (node.attributes && node.attributes.description) || node.description || '',
                            created: createdStr,
                            isToday,
                            isYesterday,
                            isThisWeek,
                            isMemoryRef: !!(node.attributes && node.attributes.type === 'memory-reference'),
                            _isNew: true,
                            _fadeStartTime: Date.now()
                        };
                        graphFullNodes.push(mapped);
                        addedNodes++;
                    }
                });

                // Find new synapses (normalize sid to string for consistent comparison)
                newSynapses.forEach(synapse => {
                    // Must match mapRawToGraph / synapseIdSet above: endpoints only (synapse.id is a distinct label and breaks dedup).
                    const sid = String(synapse.source) + '-' + String(synapse.target);
                    if (!synapseIdSet.has(sid)) {
                        const fromIdx = graphFullNodes.findIndex(n => String(n.idKey) === String(synapse.source));
                        const toIdx = graphFullNodes.findIndex(n => String(n.idKey) === String(synapse.target));
                        if (fromIdx >= 0 && toIdx >= 0) {
                            synapseIdSet.add(sid);
                            graphFullEdges.push({
                                from: fromIdx,
                                to: toIdx,
                                weight: Math.round((synapse.weight || 1) * 10)
                            });
                            addedSynapses++;
                        }
                    }
                });

                if (addedNodes > 0 || addedSynapses > 0) {
                    graphStructureVersion++;
                    const selKey = selected !== null && nodes[selected] ? nodes[selected].idKey : null;
                    timeFilterPassingIndicesCacheKey = null;
                    timeFilterPassingIndicesCache = null;
                    populateCategoryFilterRow();
                    rebuildDisplayGraphFromFull();
                    resyncSelectionByIdKey(selKey);

                    console.log(`🧠 +${addedNodes} neurons, +${addedSynapses} synapses (total loaded: ${graphFullNodes.length} / ${graphFullEdges.length}; visible: ${nodes.length} / ${edges.length})`);
                    
                    const statusMsg = `${nodes.length} neurons · ${edges.length} synapses`;
                    if (statusEl) statusEl.textContent = statusMsg;
                    if (countEl) countEl.textContent = nodes.length;
                    if (synapseCountEl) synapseCountEl.textContent = edges.length;
                    updateDrawerStats();

                    // Re-render (new nodes will fade in via _isNew flag)
                    applyFilter();
                    render();

                    // Brief notification
                    if (addedNodes > 0) {
                        showNotification(`+${addedNodes} new neuron${addedNodes > 1 ? 's' : ''} born`);
                    }
                }
            }).catch(err => {
                console.log('Auto-refresh check failed:', err);
            });
        }, AUTO_REFRESH_INTERVAL);

        function showNotification(message) {
            let notif = document.getElementById('auto-refresh-notification');
            if (!notif) {
                notif = document.createElement('div');
                notif.id = 'auto-refresh-notification';
                notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,255,255,0.2);border:2px solid rgba(0,255,255,0.5);border-radius:8px;padding:10px 20px;font-size:11px;color:#00ffff;z-index:1000;opacity:0;transition:opacity 0.3s;pointer-events:none;';
                document.body.appendChild(notif);
            }
            notif.textContent = message;
            notif.style.opacity = '1';
            setTimeout(() => { notif.style.opacity = '0'; }, 3000);
        }

        })();
