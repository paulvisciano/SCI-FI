/**
 * Dual Neuro Graph Viewer
 * Side-by-side canvas: JARVIS graph (left) + User graph (right)
 * 
 * Features:
 * - Both graphs filterable by date (today, week, month, all)
 * - Both zoomable, rotatable, searchable
 * - Live sync (both update as conversations happen)
 * - "Breathe now" button syncs both graphs
 * - Same rendering engine, dual instances
 */

(function() {
    'use strict';
    
    // Path resolution functions (extracted from neural-graph.js)
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

        // Handle BASE_URL placeholders first
        if (resolved.includes('{BASE_URL}')) {
            resolved = resolved.replace('{BASE_URL}', BASE_URL);
        }

        // Rewrite absolute /JARVIS/ filesystem paths into website-served URLs
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

        // Rewrite RAW archive + learnings into website-served URLs
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
    
    // Configuration for both graphs
    const JARVIS_CONFIG = {
        dataBasePath: 'JARVIS/RAW/memories',
        canvasId: 'jarvis-canvas',
        searchId: 'jarvis-search',
        nodeCountId: 'jarvis-node-count',
        synapseCountId: 'jarvis-synapse-count',
        filterTypesId: 'jarvis-filter-types',
        loadingId: 'jarvis-loading',
        colorScheme: 'jarvis', // Uses categoryColors from main config
        label: 'JARVIS'
    };
    
    const USER_CONFIG = {
        dataBasePath: 'RAW/memories',
        canvasId: 'user-canvas',
        searchId: 'user-search',
        nodeCountId: 'user-node-count',
        synapseCountId: 'user-synapse-count',
        filterTypesId: 'user-filter-types',
        loadingId: 'user-loading',
        colorScheme: 'user', // Uses custom user colors
        label: 'User'
    };
    
    // Graph instances
    window.jarvisGraph = null;
    window.userGraph = null;
    
    // Shared state
    let syncEnabled = true;
    let currentRange = 'all'; // today, week, month, all
    
    /**
     * NeuroGraph Class - Manages a single graph instance
     */
    class NeuroGraph {
        constructor(config) {
            this.config = config;
            this.nodes = [];
            this.synapses = [];
            this.filteredNodes = [];
            this.filteredSynapses = [];
            this.selectedNode = null;
            this.zoom = 1;
            this.rotation = { x: 0, y: 0 };
            this.searchTerm = '';
            this.canvas = null;
            this.ctx = null;
            this.animationFrame = null;
            this.loaded = false;
            
            this.init();
        }
        
        async init() {
            this.canvas = document.getElementById(this.config.canvasId);
            if (!this.canvas) {
                console.error(`Canvas ${this.config.canvasId} not found`);
                return;
            }
            
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            
            // Setup event listeners
            this.setupInteractions();
            this.setupSearch();
            this.setupFilterButtons();
            
            // Load data
            await this.loadData();
        }
        
        resizeCanvas() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.render();
        }
        
        async loadData() {
            const loadingEl = document.getElementById(this.config.loadingId);
            if (loadingEl) loadingEl.classList.add('active');
            
            try {
                // Fetch nodes.json and synapses.json
                const nodesUrl = resolvePath(`${this.config.dataBasePath}/nodes.json`);
                const synapsesUrl = resolvePath(`${this.config.dataBasePath}/synapses.json`);
                
                console.log(`[${this.config.label}] Loading from: ${nodesUrl}, ${synapsesUrl}`);
                
                const [nodesRes, synapsesRes] = await Promise.all([
                    fetch(nodesUrl).then(r => r.json()),
                    fetch(synapsesUrl).then(r => r.json())
                ]);
                
                this.nodes = nodesRes || [];
                this.synapses = synapsesRes || [];
                
                this.applyFilters();
                this.updateStats();
                this.loaded = true;
                
                if (loadingEl) loadingEl.classList.remove('active');
                
                this.render();
                
            } catch (err) {
                console.error(`Failed to load ${this.config.label} graph:`, err);
                if (loadingEl) loadingEl.classList.remove('active');
                
                // Use fallback data
                this.nodes = window.NEURAL_GRAPH_CONFIG?.fallbackNodes || [];
                this.synapses = window.NEURAL_GRAPH_CONFIG?.fallbackEdges || [];
                this.applyFilters();
                this.updateStats();
                this.render();
            }
        }
        
        applyFilters() {
            // Filter by date range
            const now = Date.now();
            const rangeMs = {
                'today': 24 * 60 * 60 * 1000,
                'week': 7 * 24 * 60 * 60 * 1000,
                'month': 30 * 24 * 60 * 60 * 1000,
                'all': Infinity
            };
            
            const cutoff = now - rangeMs[currentRange];
            
            this.filteredNodes = this.nodes.filter(node => {
                const nodeTime = node.timestamp || node.created_at || 0;
                return nodeTime >= cutoff;
            });
            
            // Filter by search term
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                this.filteredNodes = this.filteredNodes.filter(node => 
                    node.name.toLowerCase().includes(term) ||
                    (node.desc && node.desc.toLowerCase().includes(term))
                );
            }
            
            // Filter synapses to match filtered nodes
            const filteredNodeIds = new Set(this.filteredNodes.map(n => n.id));
            this.filteredSynapses = this.synapses.filter(edge => 
                filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
            );
            
            this.updateStats();
            this.render();
        }
        
        updateStats() {
            const nodeCountEl = document.getElementById(this.config.nodeCountId);
            const synapseCountEl = document.getElementById(this.config.synapseCountId);
            
            if (nodeCountEl) nodeCountEl.textContent = this.filteredNodes.length;
            if (synapseCountEl) synapseCountEl.textContent = this.filteredSynapses.length;
        }
        
        setupSearch() {
            const searchInput = document.getElementById(this.config.searchId);
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchTerm = e.target.value.trim();
                    this.applyFilters();
                });
            }
        }
        
        setupFilterButtons() {
            const panel = this.canvas.parentElement;
            const rangeButtons = panel.querySelectorAll('[data-range]');
            
            rangeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active class from siblings
                    rangeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    currentRange = btn.getAttribute('data-range');
                    this.applyFilters();
                    
                    // Sync with other graph
                    if (syncEnabled) {
                        const otherGraph = (this === jarvisGraph) ? userGraph : jarvisGraph;
                        if (otherGraph) otherGraph.applyFilters();
                    }
                });
            });
            
            // Populate filter types (categories)
            this.populateFilterTypes();
        }
        
        populateFilterTypes() {
            const typesContainer = document.getElementById(this.config.filterTypesId);
            if (!typesContainer) return;
            
            // Extract unique types from nodes
            const types = new Set(this.nodes.map(n => n.type).filter(Boolean));
            const typeColors = window.NEURAL_GRAPH_CONFIG?.categoryColors || {};
            
            typesContainer.innerHTML = '';
            types.forEach(type => {
                const btn = document.createElement('button');
                btn.className = 'filter-btn';
                btn.textContent = type;
                btn.style.borderColor = typeColors[type] || 'rgba(0,255,255,0.3)';
                btn.addEventListener('click', () => {
                    btn.classList.toggle('active');
                    // Could implement type filtering here
                });
                typesContainer.appendChild(btn);
            });
        }
        
        setupInteractions() {
            // Mouse interactions for zoom, rotate, pan
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
            });
            
            // Click to select node
            this.canvas.addEventListener('click', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Simple hit detection (could be improved with spatial indexing)
                for (const node of this.filteredNodes) {
                    const screenX = this.projectX(node.x, node.y, node.z);
                    const screenY = this.projectY(node.x, node.y, node.z);
                    const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
                    
                    if (dist < (node.size || 10) * this.zoom) {
                        this.selectedNode = node;
                        this.render();
                        break;
                    }
                }
            });
            
            // Handle window resize
            window.addEventListener('resize', () => this.resizeCanvas());
        }
        
        projectX(x, y, z) {
            // Simple 3D projection with rotation
            const cosY = Math.cos(this.rotation.y);
            const sinY = Math.sin(this.rotation.y);
            const cosX = Math.cos(this.rotation.x);
            const sinX = Math.sin(this.rotation.x);
            
            const rotatedX = x * cosY - z * sinY;
            const rotatedZ = x * sinY + z * cosY;
            const rotatedY = y * cosX - rotatedZ * sinX;
            
            const canvasRect = this.canvas.getBoundingClientRect();
            const centerX = canvasRect.width / 2;
            const centerY = canvasRect.height / 2;
            
            return centerX + rotatedX * this.zoom;
        }
        
        projectY(x, y, z) {
            const cosY = Math.cos(this.rotation.y);
            const sinY = Math.sin(this.rotation.y);
            const cosX = Math.cos(this.rotation.x);
            const sinX = Math.sin(this.rotation.x);
            
            const rotatedZ = x * sinY + z * cosY;
            const rotatedY = y * cosX - rotatedZ * sinX;
            
            const canvasRect = this.canvas.getBoundingClientRect();
            const centerY = canvasRect.height / 2;
            
            return centerY + rotatedY * this.zoom;
        }
        
        render() {
            if (!this.ctx) return;
            
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Clear canvas
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);
            
            // Draw synapses (edges)
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            
            for (const edge of this.filteredSynapses) {
                const fromNode = this.filteredNodes.find(n => n.id === edge.from);
                const toNode = this.filteredNodes.find(n => n.id === edge.to);
                
                if (!fromNode || !toNode) continue;
                
                const x1 = this.projectX(fromNode.x, fromNode.y, fromNode.z);
                const y1 = this.projectY(fromNode.x, fromNode.y, fromNode.z);
                const x2 = this.projectX(toNode.x, toNode.y, toNode.z);
                const y2 = this.projectY(toNode.x, toNode.y, toNode.z);
                
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
                
                // Node color based on type
                const colors = window.NEURAL_GRAPH_CONFIG?.categoryColors || {};
                const color = colors[node.type] || (this.config.label === 'JARVIS' ? '#00ffff' : '#f87171');
                
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
                
                // Node label
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(node.name, x, y + size + 12);
                
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
        
        clearSelection() {
            this.selectedNode = null;
            this.render();
        }
        
        randomPulse() {
            // Animate a random node
            if (this.filteredNodes.length === 0) return;
            
            const randomNode = this.filteredNodes[Math.floor(Math.random() * this.filteredNodes.length)];
            this.selectedNode = randomNode;
            
            // Pulse animation
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
        
        syncZoom(zoom) {
            this.zoom = zoom;
            this.render();
        }
    }
    
    /**
     * Initialize both graphs
     */
    async function initDualGraphs() {
        console.log('Initializing dual neuro graphs...');
        console.log('JARVIS config path:', JARVIS_CONFIG.dataBasePath);
        console.log('User config path:', USER_CONFIG.dataBasePath);
        
        window.jarvisGraph = new NeuroGraph(JARVIS_CONFIG);
        window.userGraph = new NeuroGraph(USER_CONFIG);
        
        // Setup sync button
        const syncBtn = document.getElementById('sync-breathe-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                // Sync both graphs (reload data)
                jarvisGraph.loadData();
                userGraph.loadData();
                
                // Visual feedback
                syncBtn.textContent = '🫁 Syncing...';
                setTimeout(() => {
                    syncBtn.textContent = '🫁 Breathe Now';
                }, 1000);
            });
        }
        
        // Setup sync zoom buttons
        const zoomInBtn = document.getElementById('sync-zoom-in');
        const zoomOutBtn = document.getElementById('sync-zoom-out');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                const newZoom = Math.min(5, jarvisGraph.zoom * 1.2);
                jarvisGraph.syncZoom(newZoom);
                userGraph.syncZoom(newZoom);
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                const newZoom = Math.max(0.1, jarvisGraph.zoom * 0.8);
                jarvisGraph.syncZoom(newZoom);
                userGraph.syncZoom(newZoom);
            });
        }
        
        // Setup panel toggles
        setupPanelToggle('jarvis');
        setupPanelToggle('user');
        
        console.log('Dual neuro graphs initialized.');
    }
    
    /**
     * Setup panel collapse/expand
     */
    function setupPanelToggle(prefix) {
        const toggleBtn = document.getElementById(`${prefix}-toggle`);
        const infoPanel = document.getElementById(`${prefix}-info`);
        
        if (toggleBtn && infoPanel) {
            toggleBtn.addEventListener('click', () => {
                infoPanel.classList.toggle('collapsed');
                toggleBtn.textContent = infoPanel.classList.contains('collapsed') ? '›' : '‹';
            });
        }
    }
    
    // Start initialization on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDualGraphs);
    } else {
        initDualGraphs();
    }
    
})();
