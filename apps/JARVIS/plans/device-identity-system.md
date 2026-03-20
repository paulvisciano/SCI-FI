# Plan: Device Identity System — MAC + User Agent Association

**Created:** March 19, 2026 — 4:29 PM GMT+7  
**Priority:** High (makes network personal, identifies known devices)  
**Estimate:** 2-4 hours

---

## Goal

When a user scans the QR code and connects to J.A.R.V.I.S, **fingerprint their device** (MAC address + User Agent), then **recognize that device forever** on the network.

**Current state:**
- ✅ Network dots show MAC addresses
- ✅ QR code generates WhatsApp login link
- ❌ MAC + User Agent not associated
- ❌ Devices show as "Unknown" every time

**Desired state:**
- ✅ First connection: MAC + UA → Identity stored
- ✅ Next connection: Recognized as "Paul's iPhone"
- ✅ Tooltip shows: Name, last seen, connection status
- ✅ Network feels personal (you see *who*, not just *what*)

---

## Data Model

### Device Registry

```json
{
  "devices": [
    {
      "id": "paul-iphone-15-pro",
      "mac": "AA:BB:CC:DD:EE:FF",
      "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...",
      "name": "Paul's iPhone",
      "owner": "paul",
      "first_seen": "2026-03-19T16:29:00Z",
      "last_seen": "2026-03-19T16:29:00Z",
      "connection_count": 42,
      "ip_addresses": ["192.168.1.105", "192.168.1.106"],
      "notes": "Scanned QR code on first visit"
    },
    {
      "id": "eric-macbook-pro",
      "mac": "11:22:33:44:55:66",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "name": "Eric's MacBook",
      "owner": "eric",
      "first_seen": "2026-03-18T10:15:00Z",
      "last_seen": "2026-03-19T14:20:00Z",
      "connection_count": 15,
      "ip_addresses": ["192.168.1.110"],
      "notes": "Fork #001 creator"
    }
  ]
}
```

### Storage Location

```
~/JARVIS/registry/devices.json
```

**Why:** Separate from neurograph, archive, sessions — this is device identity registry.

---

## Flow: First Connection (QR Code Scan)

### 1. User Scans QR Code

```
WhatsApp QR code scanned
  ↓
Opens: https://localhost:18787/
  ↓
Browser sends: User-Agent header
  ↓
Server logs: UA + IP + timestamp
```

### 2. Server Captures Fingerprint

```javascript
// In jarvis-server.js, on / GET request
const userAgent = req.headers['user-agent'];
const ip = req.connection.remoteAddress;
const timestamp = new Date().toISOString();

console.log(`[Device Fingerprint] UA: ${userAgent}, IP: ${ip}`);
```

### 3. Network Scan Discovers MAC

```bash
# Arp-scan or similar discovers MAC
arp -a | grep <ip>
# Output: ? (192.168.1.105) at AA:BB:CC:DD:EE:FF on en0

MAC: AA:BB:CC:DD:EE:FF
```

### 4. Associate MAC + UA

```javascript
// Create device record
const device = {
    id: generateDeviceId(userAgent), // e.g., "paul-iphone-15-pro"
    mac: "AA:BB:CC:DD:EE:FF",
    user_agent: userAgent,
    name: extractDeviceName(userAgent), // "Paul's iPhone"
    owner: "paul", // From WhatsApp self-chat or manual entry
    first_seen: timestamp,
    last_seen: timestamp,
    connection_count: 1,
    ip_addresses: [ip]
};

// Save to registry
fs.writeFileSync(
    path.join(__dirname, '../registry/devices.json'),
    JSON.stringify({ devices: [device] }, null, 2)
);
```

### 5. Next Time Device Connects

```
Network scan finds MAC: AA:BB:CC:DD:EE:FF
  ↓
Lookup in devices.json
  ↓
Found: "Paul's iPhone"
  ↓
Update: last_seen, connection_count++, ip_addresses
  ↓
Show in tooltip: "Paul's iPhone • Connected • 2h ago"
```

---

## Implementation Steps

### Step 1: Create Device Registry Module

**File:** `~/SCI-FI/apps/JARVIS/device-registry.js`

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REGISTRY_PATH = path.join(__dirname, '../registry/devices.json');

// Initialize registry if doesn't exist
function initRegistry() {
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(REGISTRY_PATH)) {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify({ devices: [] }, null, 2));
    }
}

// Load registry
function loadRegistry() {
    initRegistry();
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

// Save registry
function saveRegistry(data) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
}

// Generate device ID from user agent
function generateDeviceId(userAgent) {
    const hash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `device-${hash}`;
}

// Extract friendly device name from UA
function extractDeviceName(userAgent) {
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Macintosh')) return 'MacBook';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Windows')) return 'Windows PC';
    return 'Unknown Device';
}

// Find or create device
function findOrCreateDevice(mac, userAgent, ip) {
    const registry = loadRegistry();
    let device = registry.devices.find(d => d.mac === mac);
    
    if (device) {
        // Update existing
        device.last_seen = new Date().toISOString();
        device.connection_count++;
        if (!device.ip_addresses.includes(ip)) {
            device.ip_addresses.push(ip);
        }
        saveRegistry(registry);
        return device;
    } else {
        // Create new
        const newDevice = {
            id: generateDeviceId(userAgent),
            mac: mac,
            user_agent: userAgent,
            name: extractDeviceName(userAgent),
            owner: 'unknown', // Could prompt user to name it
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            connection_count: 1,
            ip_addresses: [ip]
        };
        registry.devices.push(newDevice);
        saveRegistry(registry);
        return newDevice;
    }
}

module.exports = {
    initRegistry,
    loadRegistry,
    saveRegistry,
    generateDeviceId,
    extractDeviceName,
    findOrCreateDevice
};
```

### Step 2: Integrate with Server

**File:** `~/SCI-FI/apps/JARVIS/jarvis-server.js`

```javascript
const deviceRegistry = require('./device-registry');

// On root GET request (when user opens UI)
if (req.method === 'GET' && req.url === '/') {
    const userAgent = req.headers['user-agent'];
    const ip = req.connection.remoteAddress;
    
    console.log(`[Device Fingerprint] UA: ${userAgent}, IP: ${ip}`);
    
    // Try to get MAC from ARP table
    const mac = getMacFromArp(ip); // Implement this function
    
    if (mac) {
        const device = deviceRegistry.findOrCreateDevice(mac, userAgent, ip);
        console.log(`[Device] ${device.name} (${device.mac}) - Visit #${device.connection_count}`);
        
        // Pass device info to frontend (for tooltip display)
        res.setHeader('X-Device-Id', device.id);
        res.setHeader('X-Device-Name', device.name);
    }
    
    // Serve index.html as usual
    serveFile('index.html');
    return;
}

// Helper: Get MAC from ARP table
function getMacFromArp(ip) {
    try {
        const output = execSync(`arp -a | grep ${ip}`, { encoding: 'utf8' });
        const match = output.match(/([0-9a-f:]{17})/i);
        return match ? match[1].toUpperCase() : null;
    } catch (err) {
        console.warn('ARP lookup failed:', err.message);
        return null;
    }
}
```

### Step 3: Update Frontend Tooltip

**File:** `~/SCI-FI/apps/JARVIS/index.html`

```javascript
// In network dot click handler
dot.addEventListener('click', () => {
    const mac = dot.dataset.mac;
    const deviceName = dot.dataset.deviceName || 'Unknown Device';
    const lastSeen = dot.dataset.lastSeen || 'First seen now';
    
    tooltip.innerHTML = `
        <h4>${deviceName}</h4>
        <p>MAC: ${mac}</p>
        <p>${lastSeen}</p>
    `;
});
```

**Backend passes device info via headers:**
```javascript
// Server sets headers
res.setHeader('X-Device-Id', device.id);
res.setHeader('X-Device-Name', device.name);
res.setHeader('X-Device-Last-Seen', device.last_seen);

// Frontend reads headers (via meta tags or JS fetch)
<meta name="device-id" content="${deviceId}">
<meta name="device-name" content="${deviceName}">
```

### Step 4: Network Dots Integration

**File:** `~/SCI-FI/apps/JARVIS/index.html` (network dots section)

```javascript
// When rendering network dots
function renderNetworkDot(device) {
    const dot = document.createElement('div');
    dot.className = 'network-dot';
    dot.dataset.mac = device.mac;
    dot.dataset.deviceName = device.name;
    dot.dataset.lastSeen = formatLastSeen(device.last_seen);
    
    // Color by owner
    if (device.owner === 'paul') {
        dot.style.borderColor = '#00ff88'; // Paul's devices: green
    } else if (device.owner === 'eric') {
        dot.style.borderColor = '#00d9ff'; // Eric's devices: cyan
    } else {
        dot.style.borderColor = '#00d9ff'; // Unknown: default cyan
    }
    
    dot.addEventListener('click', () => showTooltip(device));
    return dot;
}
```

### Step 5: Manual Device Registration

**Add UI to name unknown devices:**

```html
<!-- In tooltip -->
<div id="unknown-device-prompt" style="display: none;">
    <p>This device is unknown.</p>
    <input type="text" id="device-name-input" placeholder="Name this device..." />
    <input type="text" id="device-owner-input" placeholder="Owner (e.g., paul, eric)" />
    <button onclick="registerDevice()">Register</button>
</div>
```

```javascript
function registerDevice() {
    const name = document.getElementById('device-name-input').value;
    const owner = document.getElementById('device-owner-input').value;
    const mac = currentDot.dataset.mac;
    
    // Call API to update registry
    fetch('/api/register-device', {
        method: 'POST',
        body: JSON.stringify({ mac, name, owner })
    });
}
```

---

## Testing

### Test 1: First Connection

1. **Clear registry:** `rm ~/JARVIS/registry/devices.json`
2. **Open UI:** https://localhost:18787/
3. **Check logs:** `[Device Fingerprint] UA: ..., IP: ...`
4. **Check registry:** `cat ~/JARVIS/registry/devices.json`
5. **Expected:** New device created with MAC + UA

### Test 2: Second Connection

1. **Refresh UI:** Cmd+Shift+R
2. **Check logs:** `[Device] Paul's iPhone - Visit #2`
3. **Expected:** Device recognized, connection_count incremented

### Test 3: Tooltip Display

1. **Click network dot**
2. **Expected:** "Paul's iPhone" instead of "Unknown Device"
3. **Expected:** "Last seen: 2 minutes ago"

---

## Privacy Considerations

**Important:**
- ✅ MAC addresses are local network only (not sent over internet)
- ✅ User-Agent is standard HTTP header (already sent)
- ✅ Registry stored locally (`~/JARVIS/registry/`)
- ✅ No cloud sync, no external sharing
- ✅ User can delete registry anytime (`rm ~/JARVIS/registry/devices.json`)

**Optional:**
- Add "Forget this device" button in tooltip
- Auto-expire devices not seen in 30 days
- Anonymize after X days (keep MAC, clear name)

---

## Future Enhancements

| Feature | Description |
|---------|-------------|
| **Device avatars** | Upload photo for each device |
| **Connection history** | Graph of when device connects |
| **Geofencing** | Alert when device leaves/enters network |
| **Multi-network** | Same device on different networks (home/work) |
| **Device groups** | "Family devices", "Guest devices" |
| **Auto-naming** | "Paul's iPhone 15 Pro" from UA parsing |

---

## Acceptance Criteria

- [ ] Device registry created on first run
- [ ] MAC + UA captured on first connection
- [ ] Device recognized on subsequent connections
- [ ] Tooltip shows friendly name (not just MAC)
- [ ] Connection count increments
- [ ] Last seen timestamp updates
- [ ] Manual registration UI for unknown devices
- [ ] Works with QR code flow (WhatsApp scan)
- [ ] Privacy-safe (local storage only)
- [ ] Network dots colored by owner

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `device-registry.js` | Create | Device registry module |
| `jarvis-server.js` | Modify | Integrate device fingerprinting |
| `index.html` | Modify | Update tooltips, add registration UI |
| `registry/devices.json` | Created | Device storage (auto-created) |

---

**Ready for implementation.** This makes the network personal — you see *who* is connected, not just *what*.

**Assigned to:** Cursor  
**Estimate:** 2-4 hours  
**Priority:** High (makes network meaningful)
