# Health Endpoint Enhancement — Rich System Data + Accurate Offline Detection

**Created:** March 17, 2026, 15:35 GMT+7  
**Priority:** High  
**Type:** Bug fix + Feature enhancement  
**Status:** Ready for implementation

---

## The Bug: "SERVER OFFLINE" Incorrectly Shown

**Symptom:** UI shows "SERVER OFFLINE" even though Jarvis server process is running. The offline indicator triggers on any fetch failure, not just actual server down.

**When it happens:**
- Network blip (WiFi momentary dropout)
- Tab backgrounded (browser throttles fetches)
- Timeout (health check takes >1s)
- Transient DNS/cache issue

**Root cause:**
- `checkServerStatus()` does `fetch('/health')`
- Any fetch failure → UI shows "OFFLINE"
- No distinction between "server down" vs "network blip"
- No retry logic, no timeout handling

**Fix:**
1. Make `/health` endpoint authoritative — if it responds, server is online
2. Add retry logic: if health fails, retry 2-3 times before showing offline
3. Add timeout handling: don't fail on slow response, wait up to 5s
4. Show "Health check failed — retrying..." instead of "OFFLINE" on transient failures

---

## The Feature: Rich Health Endpoint + System Dashboard

**Enhancement:** `/health` endpoint returns rich system data, UI displays it in a health dashboard.

**What users see:**
- Server status (online/offline)
- Memory usage (RSS, heap)
- CPU usage (user, system)
- Uptime (formatted: Xh Ym Zs)
- OpenClaw Gateway status (running/stopped, PID, port)
- Jarvis port status (18787 open/closed)
- Session info (tokens, context %)
- Version + build info

---

## Technical Implementation

### Backend (`jarvis-server.js`)

**Enhanced `/health` endpoint:**

```javascript
const { exec } = require('child_process');
const net = require('net');

// Helper: check if port is open
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

// Helper: get OpenClaw Gateway status
async function getGatewayStatus() {
  return new Promise((resolve) => {
    exec('openclaw gateway status --json', (error, stdout, stderr) => {
      if (error) {
        resolve({ status: 'unknown', pid: null, port: 18789 });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({
          status: data.runtime || 'unknown',
          pid: data.pid || null,
          port: 18789
        });
      } catch {
        resolve({ status: 'unknown', pid: null, port: 18789 });
      }
    });
  });
}

// Helper: get session token count
async function getSessionTokenCount() {
  // Read from OpenClaw session file or return estimate
  return 82000; // Placeholder - implement actual read
}

// Enhanced health endpoint
app.get('/health', async (req, res) => {
  const pid = process.pid;
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  // OpenClaw Gateway status
  const gatewayStatus = await getGatewayStatus();
  
  // Jarvis port status
  const portOpen = await checkPort(18787);
  
  // Session info
  const sessionTokens = await getSessionTokenCount();
  
  res.json({
    status: 'healthy',
    version: '2.7.1',
    build: '2026-03-17',
    uptime: uptime,
    uptimeFormatted: formatUptime(uptime),
    pid: pid,
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    openclawGateway: {
      status: gatewayStatus.status,
      pid: gatewayStatus.pid,
      port: gatewayStatus.port
    },
    jarvisPort: {
      port: 18787,
      open: portOpen
    },
    session: {
      tokens: sessionTokens,
      contextPercent: (sessionTokens / 200000 * 100).toFixed(1) + '%'
    },
    timestamp: new Date().toISOString()
  });
});

// Helper: format uptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}
```

---

### Frontend (`app.js`)

**Enhanced health check with retry logic:**

```javascript
async function checkServerStatus() {
  const maxRetries = 3;
  const retryDelay = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Server is healthy - update UI
      document.getElementById('server-indicator').classList.remove('offline');
      document.getElementById('server-status-text').textContent = 'Server online';
      document.getElementById('server-version').textContent = `v${data.version} (${data.build})`;
      
      // Show rich health data
      updateHealthDisplay(data);
      
      return; // Success - exit retry loop
    } catch (err) {
      console.warn(`Health check attempt ${i + 1} failed:`, err.message);
      
      if (i === maxRetries - 1) {
        // All retries failed - show offline
        document.getElementById('server-indicator').classList.add('offline');
        document.getElementById('server-status-text').textContent = 'Server offline';
        document.getElementById('server-version').textContent = '';
        document.getElementById('health-details').innerHTML = '';
      } else {
        // Show retrying message
        document.getElementById('server-status-text').textContent = `Retrying... (${i + 1}/${maxRetries})`;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

// Enhanced health display
function updateHealthDisplay(data) {
  const healthDetails = document.getElementById('health-details');
  if (!healthDetails) return;
  
  healthDetails.innerHTML = `
    <div class="health-grid">
      <div class="health-metric">
        <span class="label">Memory:</span>
        <span class="value">${data.memory.rss}</span>
      </div>
      <div class="health-metric">
        <span class="label">Heap:</span>
        <span class="value">${data.memory.heapUsed} / ${data.memory.heapTotal}</span>
      </div>
      <div class="health-metric">
        <span class="label">Uptime:</span>
        <span class="value">${data.uptimeFormatted}</span>
      </div>
      <div class="health-metric">
        <span class="label">Gateway:</span>
        <span class="value">${data.openclawGateway.status}</span>
      </div>
      <div class="health-metric">
        <span class="label">Session:</span>
        <span class="value">${data.session.tokens} (${data.session.contextPercent})</span>
      </div>
      <div class="health-metric">
        <span class="label">PID:</span>
        <span class="value">${data.pid}</span>
      </div>
    </div>
  `;
}

// Poll health every 5 seconds
checkServerStatus();
setInterval(checkServerStatus, 5000);
```

---

### UI (`index.html` or dynamic)

**Add health details section:**

```html
<!-- Existing server status -->
<div class="server-status">
  <div id="server-indicator" class="status-dot online"></div>
  <span id="server-status-text">Server online</span>
  <span id="server-version">v2.7.1 (2026-03-17)</span>
</div>

<!-- New health details section -->
<div id="health-details" class="health-details">
  <!-- Populated by updateHealthDisplay() -->
</div>
```

**CSS styling:**

```css
.health-details {
  background: rgba(0, 20, 40, 0.6);
  border: 1px solid #00d9ff;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  font-size: 0.85rem;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.health-metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.health-metric .label {
  color: #00d9ff;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.health-metric .value {
  color: #64ffda;
  font-family: 'Courier New', monospace;
}
```

---

## Testing Checklist

- [ ] `/health` endpoint returns rich JSON data
- [ ] UI shows "Server online" only when health responds
- [ ] Retry logic works (3 attempts, 1s delay)
- [ ] Timeout handling works (5s max wait)
- [ ] Health dashboard displays all metrics
- [ ] OpenClaw Gateway status shows correctly
- [ ] Session tokens display accurately
- [ ] Memory/CPU values are reasonable
- [ ] Uptime formats correctly (Xh Ym Zs)
- [ ] Offline state clears on reconnect

---

## Files to Edit

1. `~/SCI-FI/apps/JARVIS/jarvis-server.js` — Enhance `/health` endpoint
2. `~/SCI-FI/apps/JARVIS/app.js` — Add retry logic, parse health data, update display
3. `~/SCI-FI/apps/JARVIS/assets/index.html` — Add health details section (if not dynamic)
4. `~/SCI-FI/apps/JARVIS/assets/style.css` — Add health dashboard styling

---

## Dependencies

- `child_process` (built-in Node.js) — exec for OpenClaw status
- `net` (built-in Node.js) — socket for port check
- Existing health endpoint (already exists, just enhance)

---

## Security Notes

- Health endpoint is localhost-only (127.0.0.1:18787)
- No sensitive data exposed (PIDs, memory are safe)
- OpenClaw gateway status is read-only (no write access)
- Rate limit: 5s polling interval (user-controlled)

---

## Future Enhancements (Post-MVP)

1. **Historical health data** — Chart memory/CPU over time
2. **Alerts** — Warn when memory >500MB, session >150k tokens
3. **Export health** — Download as JSON for debugging
4. **Remote health** — Tailscale/SSH tunnel health access
5. **Heartbeat integration** — Auto-log health to `~/JARVIS/RAW/learnings/`

---

## Ready for Cursor

**This plan is complete.** Hand to Cursor, let them implement. Test in UI. Archive the session. Create learnings.

**Let's build this.**
