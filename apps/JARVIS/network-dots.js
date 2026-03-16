// JARVIS Network Dots - Nearby device visualization
// Shows subtle dots around the orb, hover for device info + QR code

(function() {
    'use strict';

    const API_BASE = 'http://localhost:3001';
    let devices = [];
    let dotElements = [];

    // Fetch network devices
    async function loadDevices() {
        try {
            const res = await fetch(`${API_BASE}/network/devices`);
            const data = await res.json();
            
            if (data.error) {
                console.warn('Network scan error:', data.error);
                return;
            }
            
            devices = data.devices || [];
            console.log('🌐 Network devices:', devices.length);
            
            renderDots();
        } catch (err) {
            console.warn('Network fetch failed:', err);
        }
    }

    // Render dots around the orb
    function renderDots() {
        const container = document.getElementById('network-dots-container');
        if (!container) return;
        
        // Clear existing
        container.innerHTML = '';
        dotElements = [];
        
        // Position dots in a ring around center (orb location)
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const ringRadius = Math.min(window.innerWidth, window.innerHeight) * 0.35;
        
        devices.forEach((device, idx) => {
            const angle = (idx / devices.length) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * ringRadius;
            const y = centerY + Math.sin(angle) * ringRadius;
            
            const dot = document.createElement('div');
            dot.className = `network-dot ${device.isGateway ? 'gateway' : ''}`;
            dot.style.left = `${x - 6}px`;
            dot.style.top = `${y - 6}px`;
            dot.style.animationDelay = `${idx * 0.5}s`;
            
            // Tooltip on hover
            const tooltip = document.createElement('div');
            tooltip.className = 'network-dot-tooltip';
            tooltip.innerHTML = `
                <h4>${device.manufacturer}</h4>
                <p>IP: ${device.ip}</p>
                <p>MAC: ${device.mac.toUpperCase()}</p>
                <p>Type: ${device.deviceType}</p>
                <span class="qr-btn" data-ip="${device.ip}">📱 Show QR</span>
            `;
            
            dot.appendChild(tooltip);
            container.appendChild(dot);
            dotElements.push(dot);
            
            // QR button click
            const qrBtn = tooltip.querySelector('.qr-btn');
            qrBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showQRCode(device.ip);
            });
        });
    }

    // Show QR code modal
    async function showQRCode(ip) {
        const modal = document.getElementById('qr-modal');
        if (!modal) {
            createQRModal();
        }
        
        modal.style.display = 'block';
        modal.querySelector('.qr-status').textContent = 'Generating...';
        
        try {
            const res = await fetch(`${API_BASE}/network/qr`);
            const data = await res.json();
            
            if (data.error) {
                modal.querySelector('.qr-status').textContent = 'Failed to generate';
                return;
            }
            
            modal.querySelector('.qr-status').textContent = `Scan to connect to ${ip}:3001`;
            modal.querySelector('.qr-image').src = data.qr;
            modal.querySelector('.qr-image').style.display = 'block';
            modal.querySelector('.qr-url').textContent = data.url;
        } catch (err) {
            modal.querySelector('.qr-status').textContent = 'Generation failed';
        }
    }

    // Create QR modal if doesn't exist
    function createQRModal() {
        const modal = document.createElement('div');
        modal.id = 'qr-modal';
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-content">
                <h3>📱 Scan QR Code</h3>
                <p class="qr-status">Generating...</p>
                <img class="qr-image" src="" alt="QR Code" style="display:none; width:200px; height:200px; margin:1rem auto; border:2px solid #00d9ff; border-radius:8px;" />
                <p class="qr-url" style="font-family:monospace; color:#00d9ff; margin-top:0.5rem;"></p>
                <button class="qr-close" onclick="document.getElementById('qr-modal').style.display='none'">Close</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .qr-modal {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(10, 17, 40, 0.9);
                z-index: 1000;
                backdrop-filter: blur(10px);
            }
            .qr-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(10, 17, 40, 0.95);
                border: 1px solid #00d9ff;
                border-radius: 12px;
                padding: 24px;
                text-align: center;
                min-width: 300px;
            }
            .qr-content h3 {
                margin: 0 0 12px 0;
                color: #00ffff;
                font-size: 16px;
            }
            .qr-status {
                color: #aabbcc;
                font-size: 12px;
                margin: 0 0 12px 0;
            }
            .qr-close {
                margin-top: 12px;
                padding: 8px 16px;
                background: #00d9ff22;
                border: 1px solid #00d9ff;
                border-radius: 6px;
                color: #00d9ff;
                font-size: 12px;
                cursor: pointer;
            }
            .qr-close:hover {
                background: #00d9ff33;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    // Handle resize
    function handleResize() {
        renderDots();
    }

    // Init
    window.addEventListener('resize', handleResize);
    loadDevices();
    
    // Refresh every 30s
    setInterval(loadDevices, 30000);
})();
