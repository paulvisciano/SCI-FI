/**
 * Dual Neuro Graph Viewer v2
 * Uses GraphViewer component to render both graphs
 */

(function() {
    'use strict';
    
    // Graph instances
    window.jarvisGraph = null;
    window.userGraph = null;
    
    // Shared state
    let currentRange = 'all';
    
    /**
     * Initialize both graphs
     */
    async function initDualGraphs() {
        console.log('Initializing dual neuro graphs v2...');
        
        // Create JARVIS graph (left panel)
        window.jarvisGraph = new GraphViewer({
            canvasId: 'jarvis-canvas',
            dataPath: 'JARVIS/RAW/memories',
            label: 'JARVIS',
            categoryColors: {
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
                region: '#8800ff'
            }
        });
        
        // Create User graph (right panel)
        window.userGraph = new GraphViewer({
            canvasId: 'user-canvas',
            dataPath: 'RAW/memories',
            label: 'User',
            categoryColors: {
                person: '#f87171',
                activity: '#f472b6',
                location: '#fbbf24',
                project: '#10b981',
                decision: '#a78bfa',
                emotion: '#3b82f6',
                memory: '#00ffff'
            }
        });
        
        // Initialize canvases
        if (!jarvisGraph.init()) {
            console.error('Failed to initialize JARVIS graph');
            return;
        }
        if (!userGraph.init()) {
            console.error('Failed to initialize User graph');
            return;
        }
        
        // Setup interactions
        jarvisGraph.setupInteractions();
        userGraph.setupInteractions();
        
        // Load data
        await jarvisGraph.load();
        await userGraph.load();
        
        // Update stats
        updateStats();
        
        // Setup filter buttons
        setupFilterButtons();
        setupSearchInputs();
        setupSyncButtons();
        setupPanelToggles();
        
        console.log('Dual neuro graphs v2 initialized.');
    }
    
    /**
     * Update stats display
     */
    function updateStats() {
        const jarvisStats = jarvisGraph.getStats();
        const userStats = userGraph.getStats();
        
        document.getElementById('jarvis-node-count').textContent = jarvisStats.nodes;
        document.getElementById('jarvis-synapse-count').textContent = jarvisStats.edges;
        document.getElementById('user-node-count').textContent = userStats.nodes;
        document.getElementById('user-synapse-count').textContent = userStats.edges;
    }
    
    /**
     * Setup filter buttons (date range)
     */
    function setupFilterButtons() {
        // JARVIS filters
        const jarvisButtons = document.querySelectorAll('#jarvis-panel [data-range]');
        jarvisButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                jarvisButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const range = btn.getAttribute('data-range');
                jarvisGraph.setDateRange(range);
                currentRange = range;
                
                // Sync with user graph
                userGraph.setDateRange(range);
                syncFilterButtons('user', range);
                updateStats();
            });
        });
        
        // User filters
        const userButtons = document.querySelectorAll('#user-panel [data-range]');
        userButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                userButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const range = btn.getAttribute('data-range');
                userGraph.setDateRange(range);
                currentRange = range;
                
                // Sync with jarvis graph
                jarvisGraph.setDateRange(range);
                syncFilterButtons('jarvis', range);
                updateStats();
            });
        });
    }
    
    /**
     * Sync filter button states
     */
    function syncFilterButtons(panel, range) {
        const buttons = document.querySelectorAll(`#${panel}-panel [data-range]`);
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-range') === range);
        });
    }
    
    /**
     * Setup search inputs
     */
    function setupSearchInputs() {
        const jarvisSearch = document.getElementById('jarvis-search');
        if (jarvisSearch) {
            jarvisSearch.addEventListener('input', (e) => {
                jarvisGraph.setSearchTerm(e.target.value);
                updateStats();
            });
        }
        
        const userSearch = document.getElementById('user-search');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                userGraph.setSearchTerm(e.target.value);
                updateStats();
            });
        }
    }
    
    /**
     * Setup sync buttons
     */
    function setupSyncButtons() {
        const syncBtn = document.getElementById('sync-breathe-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                syncBtn.textContent = '🫁 Syncing...';
                await jarvisGraph.load();
                await userGraph.load();
                updateStats();
                syncBtn.textContent = '🫁 Breathe Now';
            });
        }
        
        const zoomInBtn = document.getElementById('sync-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                const newZoom = Math.min(5, jarvisGraph.zoom * 1.2);
                jarvisGraph.syncZoom(newZoom);
                userGraph.syncZoom(newZoom);
            });
        }
        
        const zoomOutBtn = document.getElementById('sync-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                const newZoom = Math.max(0.1, jarvisGraph.zoom * 0.8);
                jarvisGraph.syncZoom(newZoom);
                userGraph.syncZoom(newZoom);
            });
        }
    }
    
    /**
     * Setup panel toggles
     */
    function setupPanelToggles() {
        const jarvisToggle = document.getElementById('jarvis-toggle');
        const jarvisInfo = document.getElementById('jarvis-info');
        if (jarvisToggle && jarvisInfo) {
            jarvisToggle.addEventListener('click', () => {
                jarvisInfo.classList.toggle('collapsed');
                jarvisToggle.textContent = jarvisInfo.classList.contains('collapsed') ? '›' : '‹';
            });
        }
        
        const userToggle = document.getElementById('user-toggle');
        const userInfo = document.getElementById('user-info');
        if (userToggle && userInfo) {
            userToggle.addEventListener('click', () => {
                userInfo.classList.toggle('collapsed');
                userToggle.textContent = userInfo.classList.contains('collapsed') ? '›' : '‹';
            });
        }
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDualGraphs);
    } else {
        initDualGraphs();
    }
    
})();
