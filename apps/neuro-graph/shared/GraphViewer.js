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
                region: '#8800ff'
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
                const nodesUrl = `${this.dataPath}/nodes.json`;
                const edgesUrl = `${this.dataPath}/synapses.json`;
                
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
                
                this.applyFilters();
                this.loaded = true;
                this.render();
                
                return true;
                
            } catch (err) {
                console.error(`[${this.label}] Load failed:`, err);
                // Use fallback graph
                this.useFallbackGraph();
                return false;
            }
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
                const nodeTime = node.timestamp || node.created_at || node.attributes?.created || 0;
                const parsedTime = typeof nodeTime === 'string' ? new Date(nodeTime).getTime() : nodeTime;
                return parsedTime >= cutoff;
            });
            
            // Apply search filter
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                this.filteredNodes = this.filteredNodes.filter(node => 
                    node.name.toLowerCase().includes(term) ||
                    (node.desc && node.desc.toLowerCase().includes(term)) ||
                    (node.type && node.type.toLowerCase().includes(term))
                );
            }
            
            // Filter edges to match filtered nodes
            const filteredNodeIds = new Set(this.filteredNodes.map(n => n.id));
            this.filteredEdges = this.edges.filter(edge => 
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
            
            // Draw edges (synapses)
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            
            for (const edge of this.filteredEdges) {
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
                
                // Get color based on type
                const color = this.categoryColors[node.type] || this.categoryColors[node.category] || '#00ffff';
                
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
                
                // Only show label if zoomed in enough
                if (this.zoom > 0.5) {
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
            });
            
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
