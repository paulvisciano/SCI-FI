/**
 * GraphViewer Component
 * Reusable graph rendering component for dual-view neurograph
 * 
 * Usage:
 *   const viewer = new GraphViewer({
 *     canvasId: 'my-canvas',
 *     dataPath: 'JARVIS/RAW/memories',
 *     label: 'JARVIS'
 *   });
 *   await viewer.load();
 *   viewer.render();
 */

(function() {
    'use strict';
    
    // Path resolution (copied from neural-graph.js - handles filesystem → URL conversion)
    const BASE_URL = (function() {
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'file:///Users/paulvisciano/JARVIS';
            }
            return 'https://raw.githubusercontent.com/paulvisciano/JARVIS/main';
        }
        return 'file:///Users/paulvisciano/JARVIS';
    })();
    
    const APP_BASE_PATH = (function() {
        if (typeof window === 'undefined' || !window.location || !window.location.pathname) return '';
        const p = window.location.pathname || '';
        if (p.startsWith('/neuro-graph')) return '/neuro-graph';
        return '';
    })();
    
    function resolvePath(path) {
        if (!path || typeof path !== 'string') return path;
        let resolved = path;
        if (resolved.includes('{BASE_URL}')) {
            resolved = resolved.replace('{BASE_URL}', BASE_URL);
        }
        const rewriteJarvis = function(p) {
            const prefixes = ['file:///Users/paulvisciano/JARVIS/', '/Users/paulvisciano/JARVIS/', '/JARVIS/', 'JARVIS/'];
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
        const rewriteRawArchive = function(p) {
            const targetBase = APP_BASE_PATH + '/RAW/archive/';
            const prefixes = ['/Users/paulvisciano/RAW/archive/', '/RAW/archive/', '~/RAW/archive/', 'RAW/archive/', 'archive/'];
            for (let i = 0; i < prefixes.length; i++) {
                const pre = prefixes[i];
                if (p.startsWith(pre)) return targetBase + p.slice(pre.length);
            }
            return null;
        };
        const archiveUrl = rewriteRawArchive(resolved);
        if (archiveUrl) return archiveUrl;
        if (resolved.startsWith('/')) return resolved;
        return resolved;
    }
    
    /**
     * GraphViewer Class
     * Encapsulates graph loading, filtering, and rendering
     */
    window.GraphViewer = class GraphViewer {
        constructor(options) {
            this.canvasId = options.canvasId;
            this.dataPath = options.dataPath;
            this.label = options.label;
            this.nodes = [];
            this.edges = [];
            this.filteredNodes = [];
            this.filteredEdges = [];
            this.selectedNode = null;
            this.zoom = 1;
            this.rotation = { x: 0, y: 0 };
            this.searchTerm = '';
            this.dateRange = 'all'; // today, week, month, all
            this.canvas = null;
            this.ctx = null;
            this.animationFrame = null;
            this.loaded = false;
            this.categoryColors = options.categoryColors || {
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
                activity: '#00ffff',
                emotion: '#aa00ff',
                region: '#8800ff',
                project: '#10b981',
                memory: '#00ffff',
                concept: '#a78bfa',
                goal: '#10b981',
                target: '#10b981',
                definition: '#a78bfa'
            };
        }
        
        /**
         * Initialize canvas and context
         */
        init() {
            this.canvas = document.getElementById(this.canvasId);
            if (!this.canvas) {
                console.error(`Canvas ${this.canvasId} not found`);
                return false;
            }
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            return true;
        }
        
        /**
         * Resize canvas to fit parent container
         */
        resizeCanvas() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.render();
        }
        
        /**
         * Load graph data from JSON files
         */
        async load() {
            console.log(`[${this.label}] Loading graph from ${this.dataPath}...`);
            
            try {
                const nodesUrl = resolvePath(`${this.dataPath}/nodes.json`);
                const edgesUrl = resolvePath(`${this.dataPath}/synapses.json`);
                
                console.log(`[${this.label}] Fetching: ${nodesUrl}, ${edgesUrl}`);
                
                const [nodesRes, edgesRes] = await Promise.all([
                    fetch(nodesUrl).then(r => {
                        if (!r.ok) throw new Error(`Failed to load nodes: ${r.status}`);
                        return r.json();
                    }),
                    fetch(edgesUrl).then(r => {
                        if (!r.ok) throw new Error(`Failed to load edges: ${r.status}`);
                        return r.json();
                    })
                ]);
                
                this.nodes = nodesRes || [];
                this.edges = edgesRes || [];
                
                console.log(`[${this.label}] Loaded ${this.nodes.length} nodes, ${this.edges.length} edges`);
                
                // Layout the graph (assign x,y,z coordinates)
                this.layoutGraph();
                
                this.applyFilters();
                this.loaded = true;
                this.render();
                
                return true;
                
            } catch (err) {
                console.error(`[${this.label}] Load failed:`, err);
                this.useFallbackGraph();
                return false;
            }
        }
        
        /**
         * Layout graph - assign x,y,z coordinates based on node properties
         * Uses clock-ring layout similar to neural-graph.js
         */
        layoutGraph() {
            const NODE_SIZE_SCALE = 0.08;
            const SPREAD_SCALE = 10000;
            const TEMPORAL_SPREAD = 7800;
            const TEMPORAL_DEPTH = 2400;
            
            // Helper to get creation date
            const getCreated = (raw) => {
                const rawCreated = raw.attributes?.created || raw.created || raw.attributes?.date || '';
                if (!rawCreated) return '';
                const m = String(rawCreated).match(/^(\d{4}-\d{2}-\d{2})/);
                return m ? m[1] : '';
            };
            
            // Helper to get time of day in hours (0-24)
            const getTimeOfDayHours = (raw) => {
                const parseTimeFromString = (s) => {
                    if (!s || typeof s !== 'string') return null;
                    const tMatch = s.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                    if (tMatch) return parseInt(tMatch[1], 10) + parseInt(tMatch[2], 10) / 60 + (parseInt(tMatch[3], 10) || 0) / 3600;
                    const spaceMatch = s.match(/\s(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                    if (spaceMatch) return parseInt(spaceMatch[1], 10) + parseInt(spaceMatch[2], 10) / 60 + (parseInt(spaceMatch[3], 10) || 0) / 3600;
                    return null;
                };
                
                const parseTimeFromName = (nameStr) => {
                    if (!nameStr || typeof nameStr !== 'string') return null;
                    const m = nameStr.match(/(?:^|[_-])(\d{2})(\d{2})(\d{2})$/);
                    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60 + parseInt(m[3], 10) / 3600;
                    const m4 = nameStr.match(/(?:^|[_-])(\d{2})(\d{2})$/);
                    if (m4) return parseInt(m4[1], 10) + parseInt(m4[2], 10) / 60;
                    return null;
                };
                
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
                return 12; // Default to noon
            };
            
            // Find temporal nodes and build date range
            const temporalNodes = this.nodes.filter(n => n.category === 'temporal');
            const temporalMap = {};
            temporalNodes.forEach(t => {
                const created = getCreated(t);
                if (created) temporalMap[created] = t.id;
            });
            
            const dates = Object.keys(temporalMap).sort();
            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];
            
            // Categorize nodes
            const temporal = this.nodes.filter(n => ((n.category || n.type || '')).toLowerCase() === 'temporal');
            const learning = this.nodes.filter(n => {
                const cat = (n.category || n.type || '').toLowerCase();
                return cat === 'learning' || cat === 'openclaw-skill';
            });
            const archive = this.nodes.filter(n => (n.category || '').toLowerCase() === 'archive');
            const file = this.nodes.filter(n => (n.category || '').toLowerCase() === 'file');
            const rest = this.nodes.filter(n => {
                const c = (n.category || n.type || '').toLowerCase();
                return c !== 'temporal' && c !== 'learning' && c !== 'openclaw-skill' && c !== 'archive' && c !== 'file';
            });
            
            // Sort by creation date
            const byCreated = (a, b) => (getCreated(a) || '').localeCompare(getCreated(b) || '') || 0;
            const sortedNodes = [
                ...temporal.sort(byCreated),
                ...learning.sort(byCreated),
                ...archive.sort(byCreated),
                ...file.sort(byCreated),
                ...rest.sort(byCreated)
            ];
            
            // Assign coordinates
            const mappedNodes = sortedNodes.map((n, idx) => {
                const created = getCreated(n);
                let x, y, z;
                
                if (n.category === 'temporal') {
                    // Temporal nodes form the spine
                    const dateIndex = dates.indexOf(created);
                    const totalDates = Math.max(1, dates.length - 1);
                    const normalizedIndex = totalDates > 1 ? dateIndex / totalDates : 0.5;
                    
                    x = (normalizedIndex - 0.5) * TEMPORAL_SPREAD;
                    y = 0;
                    z = (Math.sin(normalizedIndex * Math.PI * 2) * TEMPORAL_DEPTH);
                    
                } else if (n.category === 'learning' || (n.type || '').toLowerCase() === 'openclaw-skill') {
                    // Outer ring (learnings)
                    const timeOfDay = getTimeOfDayHours(n);
                    const angle = ((timeOfDay / 24) * Math.PI * 2) - (Math.PI / 2);
                    const radius = 6000;
                    const dateIndex = created && minDate !== maxDate ? 
                        (new Date(created).getTime() - new Date(minDate).getTime()) / 
                        (new Date(maxDate).getTime() - new Date(minDate).getTime()) : 0.5;
                    
                    x = Math.cos(angle) * radius;
                    y = (dateIndex - 0.5) * TEMPORAL_SPREAD;
                    z = Math.sin(angle) * radius;
                    
                } else if (n.category === 'archive' || n.category === 'file') {
                    // Inner ring (archive/file)
                    const timeOfDay = getTimeOfDayHours(n);
                    const angle = ((timeOfDay / 24) * Math.PI * 2) - (Math.PI / 2);
                    const radius = 3000;
                    const dateIndex = created && minDate !== maxDate ? 
                        (new Date(created).getTime() - new Date(minDate).getTime()) / 
                        (new Date(maxDate).getTime() - new Date(minDate).getTime()) : 0.5;
                    
                    x = Math.cos(angle) * radius;
                    y = (dateIndex - 0.5) * TEMPORAL_SPREAD;
                    z = Math.sin(angle) * radius;
                    
                } else {
                    // Other nodes - spread around
                    const angle = (idx / Math.max(1, this.nodes.length)) * Math.PI * 2;
                    const radius = 4000 + Math.random() * 2000;
                    
                    x = Math.cos(angle) * radius;
                    y = (Math.random() - 0.5) * 4000;
                    z = Math.sin(angle) * radius;
                }
                
                // Calculate node size based on frequency
                const freq = n.frequency || 1;
                const size = Math.max(5, Math.log(freq + 1) * 30 * NODE_SIZE_SCALE);
                
                return {
                    id: n.id || n.idKey || idx,
                    name: n.label || n.name || n.id || 'Unknown',
                    type: n.type || n.category || 'unknown',
                    category: n.category || n.type || 'unknown',
                    x: x,
                    y: y,
                    z: z,
                    size: size,
                    desc: n.attributes?.description || n.attributes?.role || '',
                    frequency: freq,
                    color: n.attributes?.color || undefined,
                    created: created,
                    original: n
                };
            });
            
            this.nodes = mappedNodes;
            
            // Map edges to use new node IDs
            this.edges = (this.edges || []).map(edge => {
                // Try to match by various ID fields
                const fromNode = this.nodes.find(n => 
                    n.original.id === edge.source || 
                    n.original.id === edge.from ||
                    n.original.idKey === edge.source ||
                    n.original.idKey === edge.from ||
                    n.name === edge.source ||
                    n.name === edge.from
                );
                const toNode = this.nodes.find(n => 
                    n.original.id === edge.target || 
                    n.original.id === edge.to ||
                    n.original.idKey === edge.target ||
                    n.original.idKey === edge.to ||
                    n.name === edge.target ||
                    n.name === edge.to
                );
                
                return {
                    from: fromNode ? fromNode.id : null,
                    to: toNode ? toNode.id : null,
                    weight: edge.weight || 1,
                    type: edge.type || edge.label || 'connection',
                    label: edge.label || '',
                    original: edge
                };
            }).filter(e => e.from !== null && e.to !== null);
            
            console.log(`[${this.label}] Layout complete: ${this.nodes.length} nodes positioned, ${this.edges.length} edges mapped`);
        }
        
        /**
         * Use fallback graph if data load fails
         */
        useFallbackGraph() {
            const SIZE = 5, SPREAD = 12;
            this.nodes = [
                { id: 0, name: 'Paul', type: 'person', x: 0, y: 0, z: 0, size: 10 * SIZE, desc: 'Urban Runner' },
                { id: 1, name: 'Volleyball', type: 'activity', x: 80 * SPREAD, y: -60 * SPREAD, z: 40 * SPREAD, size: 9 * SIZE, desc: 'Flow state' },
                { id: 2, name: 'Bangkok', type: 'location', x: -70 * SPREAD, y: 50 * SPREAD, z: -50 * SPREAD, size: 8 * SIZE, desc: 'Home base' }
            ];
            this.edges = [
                { from: 0, to: 1, weight: 8 },
                { from: 0, to: 2, weight: 7 },
                { from: 1, to: 2, weight: 6 }
            ];
            this.applyFilters();
            this.render();
        }
        
        /**
         * Apply date range and search filters
         */
        applyFilters() {
            const now = Date.now();
            const rangeMs = {
                'today': 24 * 60 * 60 * 1000,
                'week': 7 * 24 * 60 * 60 * 1000,
                'month': 30 * 24 * 60 * 60 * 1000,
                'all': Infinity
            };
            
            const cutoff = now - rangeMs[this.dateRange];
            
            this.filteredNodes = this.nodes.filter(node => {
                if (this.dateRange === 'all') return true;
                const nodeTime = node.created ? new Date(node.created).getTime() : 0;
                return nodeTime >= cutoff;
            });
            
            // Apply search filter
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                this.filteredNodes = this.filteredNodes.filter(node => 
                    node.name.toLowerCase().includes(term) ||
                    (node.desc && node.desc.toLowerCase().includes(term)) ||
                    (node.type && node.type.toLowerCase().includes(term)) ||
                    (node.category && node.category.toLowerCase().includes(term))
                );
            }
            
            // Filter edges to match filtered nodes
            const filteredNodeIds = new Set(this.filteredNodes.map(n => n.id));
            this.filteredEdges = this.filteredEdges.filter(edge => 
                filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
            );
            
            this.render();
        }
        
        /**
         * Set date range filter
         */
        setDateRange(range) {
            this.dateRange = range;
            this.applyFilters();
        }
        
        /**
         * Set search term
         */
        setSearchTerm(term) {
            this.searchTerm = term;
            this.applyFilters();
        }
        
        /**
         * 3D projection with rotation
         */
        projectX(x, y, z) {
            const cosY = Math.cos(this.rotation.y);
            const sinY = Math.sin(this.rotation.y);
            const cosX = Math.cos(this.rotation.x);
            const sinX = Math.sin(this.rotation.x);
            
            const rotatedX = x * cosY - z * sinY;
            const rotatedZ = x * sinY + z * cosY;
            const rotatedY = y * cosX - rotatedZ * sinX;
            
            const centerX = this.canvas.width / 2;
            return centerX + rotatedX * this.zoom;
        }
        
        projectY(x, y, z) {
            const cosY = Math.cos(this.rotation.y);
            const sinY = Math.sin(this.rotation.y);
            const cosX = Math.cos(this.rotation.x);
            const sinX = Math.sin(this.rotation.x);
            
            const rotatedZ = x * sinY + z * cosY;
            const rotatedY = y * cosX - rotatedZ * sinX;
            
            const centerY = this.canvas.height / 2;
            return centerY + rotatedY * this.zoom;
        }
        
        /**
         * Render the graph
         */
        render() {
            if (!this.ctx) return;
            
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Clear canvas
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);
            
            // Draw edges (synapses) first (behind nodes)
            for (const edge of this.filteredEdges) {
                const fromNode = this.filteredNodes.find(n => n.id === edge.from);
                const toNode = this.filteredNodes.find(n => n.id === edge.to);
                
                if (!fromNode || !toNode) continue;
                
                const x1 = this.projectX(fromNode.x, fromNode.y, fromNode.z);
                const y1 = this.projectY(fromNode.x, fromNode.y, fromNode.z);
                const x2 = this.projectX(toNode.x, toNode.y, toNode.z);
                const y2 = this.projectY(toNode.x, toNode.y, toNode.z);
                
                // Color edge based on panel
                const edgeColor = this.label === 'JARVIS' ? 'rgba(0, 255, 255, 0.15)' : 'rgba(248, 113, 113, 0.15)';
                ctx.strokeStyle = edgeColor;
                ctx.lineWidth = Math.min(2, edge.weight * 0.5);
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            
            // Draw nodes
            for (const node of this.filteredNodes) {
                const x = this.projectX(node.x, node.y, node.z);
                const y = this.projectY(node.x, node.y, node.z);
                const size = (node.size || 10) * this.zoom;
                
                // Get color - use node's own color or category color
                let color = node.color || this.categoryColors[node.type] || this.categoryColors[node.category] || '#00ffff';
                
                // Override color based on panel for visual distinction
                if (this.label === 'JARVIS') {
                    // JARVIS nodes stay cyan/blue tones
                    if (!node.color) color = '#00ffff';
                } else {
                    // User nodes use warmer tones
                    if (!node.color) {
                        color = this.categoryColors[node.category] || this.categoryColors[node.type] || '#f87171';
                    }
                }
                
                // Glow effect
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
                gradient.addColorStop(0, color);
                gradient.addColorStop(0.5, color + '80');
                gradient.addColorStop(1, 'transparent');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Node circle
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                
                // Node label - only show if zoomed in enough
                if (this.zoom > 0.5) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.name, x, y + size + 12);
                }
                
                // Highlight selected node
                if (this.selectedNode && this.selectedNode.id === node.id) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
        
        /**
         * Setup mouse interactions
         */
        setupInteractions() {
            let isDragging = false;
            let lastX = 0, lastY = 0;
            
            this.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
            });
            
            this.canvas.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                
                this.rotation.y += dx * 0.01;
                this.rotation.x += dy * 0.01;
                
                lastX = e.clientX;
                lastY = e.clientY;
                
                this.render();
            });
            
            this.canvas.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom = Math.max(0.1, Math.min(5, this.zoom * delta));
                this.render();
            }, { passive: false });
            
            // Click to select node
            this.canvas.addEventListener('click', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Simple hit detection
                for (const node of this.filteredNodes) {
                    const screenX = this.projectX(node.x, node.y, node.z);
                    const screenY = this.projectY(node.x, node.y, node.z);
                    const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
                    
                    if (dist < (node.size || 10) * this.zoom) {
                        this.selectedNode = node;
                        this.render();
                        console.log(`[${this.label}] Selected: ${node.name} (${node.category})`);
                        break;
                    }
                }
            });
            
            // Handle resize
            window.addEventListener('resize', () => this.resizeCanvas());
        }
        
        /**
         * Clear selection
         */
        clearSelection() {
            this.selectedNode = null;
            this.render();
        }
        
        /**
         * Random pulse animation
         */
        randomPulse() {
            if (this.filteredNodes.length === 0) return;
            
            const randomNode = this.filteredNodes[Math.floor(Math.random() * this.filteredNodes.length)];
            this.selectedNode = randomNode;
            
            let scale = 1;
            const pulse = () => {
                scale = scale > 1 ? scale - 0.1 : scale + 0.1;
                this.render();
                if (scale > 1) requestAnimationFrame(pulse);
            };
            pulse();
            
            setTimeout(() => {
                this.selectedNode = null;
                this.render();
            }, 1000);
        }
        
        /**
         * Sync zoom with other viewer
         */
        syncZoom(zoom) {
            this.zoom = zoom;
            this.render();
        }
        
        /**
         * Get stats
         */
        getStats() {
            return {
                nodes: this.filteredNodes.length,
                edges: this.filteredEdges.length
            };
        }
    };
    
})();
