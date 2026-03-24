// Device Registry Module — MAC + User Agent Association
// Stores device identities for J.A.R.V.I.S network recognition

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REGISTRY_DIR = process.env.DEVICE_REGISTRY_DIR || path.join(process.env.HOME, 'JARVIS', 'registry');
const REGISTRY_PATH = path.join(REGISTRY_DIR, 'devices.json');

// Initialize registry directory and file if doesn't exist
function initRegistry() {
    if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
        console.log('[DeviceRegistry] Created registry directory:', REGISTRY_DIR);
    }
    if (!fs.existsSync(REGISTRY_PATH)) {
        const emptyRegistry = { devices: [] };
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(emptyRegistry, null, 2));
        console.log('[DeviceRegistry] Initialized empty registry:', REGISTRY_PATH);
    }
}

// Load registry from disk
function loadRegistry() {
    initRegistry();
    try {
        const data = fs.readFileSync(REGISTRY_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[DeviceRegistry] Error loading registry:', err.message);
        return { devices: [] };
    }
}

// Save registry to disk
function saveRegistry(data) {
    try {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
        console.log('[DeviceRegistry] Registry saved');
    } catch (err) {
        console.error('[DeviceRegistry] Error saving registry:', err.message);
    }
}

// Generate unique device ID from user agent
function generateDeviceId(userAgent) {
    const hash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `device-${hash}`;
}

// Extract friendly device name from User Agent string
function extractDeviceName(userAgent) {
    if (!userAgent) return 'Unknown Device';
    
    if (userAgent.includes('iPhone')) {
        const iosMatch = userAgent.match(/iPhone OS (\d+_\d+)/);
        if (iosMatch) return `iPhone (iOS ${iosMatch[1].replace('_', '.')})`;
        return 'iPhone';
    }
    if (userAgent.includes('iPad')) {
        const iosMatch = userAgent.match(/iPad OS (\d+_\d+)/);
        if (iosMatch) return `iPad (iOS ${iosMatch[1].replace('_', '.')})`;
        return 'iPad';
    }
    if (userAgent.includes('Macintosh')) {
        const macMatch = userAgent.match(/Mac OS X (\d+[_\.\d]+)/);
        if (macMatch) return `MacBook (macOS ${macMatch[1].replace('_', '.')})`;
        return 'MacBook';
    }
    if (userAgent.includes('Android')) {
        const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
        if (androidMatch) return `Android ${androidMatch[1]}`;
        return 'Android Device';
    }
    if (userAgent.includes('Windows NT')) {
        const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
        if (winMatch) {
            const versionMap = { '10.0': '10', '6.3': '8.1', '6.2': '8', '6.1': '7' };
            return `Windows PC (${versionMap[winMatch[1]] || winMatch[1]})`;
        }
        return 'Windows PC';
    }
    if (userAgent.includes('X11') || userAgent.includes('Linux')) {
        return 'Linux Device';
    }
    return 'Unknown Device';
}

// Extract owner from user agent or prompt (simplified: use hostname or default)
function extractOwner(userAgent, ip) {
    // Simple heuristic: if localhost or loopback, owner is "paul"
    if (ip === '127.0.0.1' || ip === '::1') return 'paul';
    
    // Check if IP is in typical home range
    if (ip.startsWith('192.168.1.')) return 'paul'; // Default owner
    
    return 'unknown';
}

// Get MAC address from ARP table for given IP
function getMacFromArp(ip) {
    try {
        const output = execSync(`/usr/sbin/arp -a`, { encoding: 'utf8', timeout: 3000 });
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.includes(ip)) {
                const match = line.match(/([0-9a-f:]{17})/i);
                return match ? match[1].toUpperCase() : null;
            }
        }
        return null;
    } catch (err) {
        console.warn('[DeviceRegistry] ARP lookup failed:', err.message);
        return null;
    }
}

// Find existing device by MAC or create new one
function findOrCreateDevice(mac, userAgent, ip) {
    const registry = loadRegistry();
    
    // Search for existing device by MAC
    let device = registry.devices.find(d => d.mac === mac);
    
    if (device) {
        // Update existing device
        device.last_seen = new Date().toISOString();
        device.connection_count++;
        if (!device.ip_addresses.includes(ip)) {
            device.ip_addresses.push(ip);
        }
        device.user_agent = userAgent; // Update UA in case it changed
        
        saveRegistry(registry);
        console.log(`[DeviceRegistry] Recognized: ${device.name} (${device.mac}) - Visit #${device.connection_count}`);
        return device;
    } else {
        // Create new device entry
        const newDevice = {
            id: generateDeviceId(userAgent),
            mac: mac,
            user_agent: userAgent,
            name: extractDeviceName(userAgent),
            owner: extractOwner(userAgent, ip),
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            connection_count: 1,
            ip_addresses: [ip],
            notes: 'Auto-registered via network scan'
        };
        
        registry.devices.push(newDevice);
        saveRegistry(registry);
        console.log(`[DeviceRegistry] New device: ${newDevice.name} (${newDevice.mac})`);
        return newDevice;
    }
}

// Get device by MAC address
function getDeviceByMac(mac) {
    const registry = loadRegistry();
    return registry.devices.find(d => d.mac === mac) || null;
}

// Update device info (manual registration)
function updateDevice(mac, updates) {
    const registry = loadRegistry();
    const device = registry.devices.find(d => d.mac === mac);
    
    if (device) {
        Object.assign(device, updates);
        device.last_updated = new Date().toISOString();
        saveRegistry(registry);
        console.log(`[DeviceRegistry] Updated device: ${device.name}`);
        return device;
    }
    
    return null;
}

// Delete device from registry
function deleteDevice(mac) {
    const registry = loadRegistry();
    const index = registry.devices.findIndex(d => d.mac === mac);
    
    if (index !== -1) {
        const removed = registry.devices.splice(index, 1)[0];
        saveRegistry(registry);
        console.log(`[DeviceRegistry] Removed device: ${removed.name}`);
        return removed;
    }
    
    return null;
}

// List all devices
function listDevices() {
    const registry = loadRegistry();
    return registry.devices;
}

// Format last seen timestamp for display
function formatLastSeen(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

module.exports = {
    initRegistry,
    loadRegistry,
    saveRegistry,
    generateDeviceId,
    extractDeviceName,
    extractOwner,
    getMacFromArp,
    findOrCreateDevice,
    getDeviceByMac,
    updateDevice,
    deleteDevice,
    listDevices,
    formatLastSeen,
    REGISTRY_PATH
};
