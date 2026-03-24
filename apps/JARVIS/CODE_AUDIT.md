# Code Audit Report - JARVIS UI

**Audit Date:** 2026-03-24  
**Auditor:** Jarvis Coder Subagent  
**Location:** `/Users/paulvisciano/JARVIS/skills/jarvis-ui/sci-fi/apps/JARVIS/`  
**Files Analyzed:** 4 (app.js, jarvis-server.js, device-registry.js, index.html)

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 2 | Issues that can cause crashes, security vulnerabilities, or data loss |
| **High** | 5 | Significant bugs or anti-patterns affecting functionality |
| **Medium** | 8 | Code smells, maintainability issues, technical debt |
| **Low** | 6 | Minor inconsistencies, style issues, optimizations |

**Total Issues Found:** 21

---

## Critical Issues (2)

### 1. Missing Import in device-registry.js
**File:** `device-registry.js`  
**Line:** ~107  
**Issue:** `execSync` is called but not imported at the top of the file.

```javascript
// Line 107 uses execSync but it's not imported:
const output = execSync(`/usr/sbin/arp -a`, { encoding: 'utf8', timeout: 3000 });
```

**Impact:** Runtime error `ReferenceError: execSync is not defined` when ARP lookup is attempted.  
**Fix:** Add `const { execSync } = require('child_process');` at the top of the file.

### 2. Function Called Before Definition (Hoisting Issue)
**File:** `app.js`  
**Line:** ~437  
**Issue:** `window.showQRCode = showQRCode;` is assigned before the function is defined in the IIFE scope.

```javascript
// Line 437: Assignment before function declaration
window.showQRCode = showQRCode;

// Line 467: Function defined later in the same scope
function showQRCode(ip) { ... }
```

**Impact:** Works due to function hoisting, but this is fragile and confusing. If converted to arrow function or moved, will break.  
**Fix:** Move the assignment after the function definition, or use proper function declaration order.

---

## High Issues (5)

### 3. Hardcoded Paths Despite "Portable" Claims
**Files:** `jarvis-server.js`, `device-registry.js`  
**Issue:** Multiple hardcoded paths contradict the "portable" configuration claims.

```javascript
// jarvis-server.js line 17:
const HTTPS_OPTIONS = {
    key: fs.readFileSync(path.join(__dirname, 'assets', 'https-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'assets', 'https-cert.pem'))
};

// device-registry.js line 10:
const REGISTRY_DIR = path.join(process.env.HOME, 'JARVIS', 'registry');
```

**Impact:** Breaks portability across different deployments. Will fail if run from different user accounts or directory structures.  
**Fix:** Make all paths configurable via environment variables or config file.

### 4. Race Condition in Transcript Polling
**File:** `app.js`  
**Lines:** 270-350  
**Issue:** `pollForTranscript` has complex state management with multiple status checks that can race.

```javascript
// Multiple status checks without proper state synchronization
if (data.status === 'transcribing') { ... }
else if (data.status === 'processing' && data.transcript) { ... }
else if (data.status === 'done' && data.transcript) { ... }
```

**Impact:** UI can show incorrect status (e.g., "Transcribing..." after transcript is ready). The `alreadyHaveTranscript` check is a band-aid fix.  
**Fix:** Implement proper state machine or use a single source of truth for transcription status.

### 5. No Input Validation on Device Registration
**File:** `jarvis-server.js`  
**Lines:** 208-230  
**Issue:** `/api/register-device` endpoint accepts any MAC, name, owner without validation.

```javascript
// No validation on MAC format, name length, or owner values
const { mac, name, owner } = data;

if (!mac) { ... } // Only checks existence, not format
```

**Impact:** Can accept malformed MAC addresses, XSS vectors in name/owner fields, or injection attacks.  
**Fix:** Add MAC address format validation, sanitize name/owner fields, implement length limits.

### 6. Memory Leak - setInterval Never Cleared
**File:** `app.js`  
**Lines:** 527-528  
**Issue:** `checkServerStatus` interval runs forever with no cleanup mechanism.

```javascript
checkServerStatus();
setInterval(checkServerStatus, 5000); // Runs forever
```

**Impact:** Continuous resource consumption. If page is left open for extended periods, unnecessary network requests continue.  
**Fix:** Add cleanup on page unload, or make interval configurable/pausable.

### 7. Inconsistent Error Handling
**File:** `jarvis-server.js`  
**Issue:** Some endpoints return proper error objects, others silently fail or return generic messages.

```javascript
// Some endpoints:
res.end(JSON.stringify({ error: err.message, details: stderr }));

// Others:
res.end(JSON.stringify({ status: 'error', message: 'Failed' }));
```

**Impact:** Debugging is difficult. Client cannot distinguish between different error types.  
**Fix:** Standardize error response format across all endpoints with consistent structure.

---

## Medium Issues (8)

### 8. Excessive console.log Statements in Production
**Files:** `app.js`, `jarvis-server.js`  
**Issue:** 40+ console.log statements scattered throughout production code.

```javascript
console.log('[UI v2.9.11] Server status faded out');
console.log('[DeviceIdentity] Loaded', data.devices.length, 'devices from registry');
console.log('📥 Received:', filename, `(${audioData.length} bytes)`);
```

**Impact:** Clutters logs, potential performance impact, information leakage.  
**Fix:** Implement proper logging framework with log levels, strip debug logs in production.

### 9. Version String Mismatch
**Files:** `app.js`, `index.html`  
**Issue:** Client version defined as 2.9.25 but displayed as 2.9.10.

```javascript
// app.js line 4:
const CLIENT_VERSION = '2.9.25';

// index.html line 419:
<span id="client-version-inline">v2.9.10</span>
```

**Impact:** Confusing for users, makes debugging version issues difficult.  
**Fix:** Single source of truth for version, auto-inject at build time.

### 10. Duplicate CSS Rules
**File:** `index.html`  
**Issue:** `.network-dot-tooltip h4` and `p` rules defined twice (lines 157-162 and 176-181).

```css
/* First definition line 157 */
.network-dot-tooltip h4 { margin: 0 0 6px 0; font-size: 11px; color: #00d9ff; }
.network-dot-tooltip p { margin: 3px 0; color: #aabbcc; }

/* Duplicate definition line 176 */
.network-dot-tooltip h4 { margin: 0 0 6px 0; font-size: 11px; color: #00d9ff; }
.network-dot-tooltip p { margin: 3px 0; color: #aabbcc; }
```

**Impact:** Code maintainability, confusion for future developers.  
**Fix:** Remove duplicate rules.

### 11. Duplicate @keyframes Definition
**File:** `app.js`  
**Issue:** `orb-record-pulse` animation defined twice (lines 179-184 and 201-206).

**Impact:** Same as above - maintainability issue.  
**Fix:** Keep single definition, likely in CSS file rather than JS.

### 12. Hardcoded FFmpeg Path
**File:** `jarvis-server.js`  
**Line:** 606  
**Issue:** FFmpeg path hardcoded to Homebrew location.

```javascript
const ffmpegPath = '/opt/homebrew/bin/ffmpeg';
```

**Impact:** Will fail on non-Homebrew installations, Linux systems, or different macOS setups.  
**Fix:** Auto-detect ffmpeg from PATH, make configurable via environment variable.

### 13. No Debouncing on Resize Events
**File:** `app.js`  
**Line:** 506  
**Issue:** Window resize triggers full re-render of network dots without debouncing.

```javascript
window.addEventListener('resize', renderDots); // Fires on every pixel change
```

**Impact:** Performance degradation during resize, unnecessary DOM manipulation.  
**Fix:** Add debounce/throttle (100-200ms) to resize handler.

### 14. Mixed HTTP/HTTPS Configuration
**File:** `jarvis-server.js`  
**Issue:** `HTTPS_ENABLED = true` hardcoded, but configuration suggests portability.

```javascript
const HTTPS_ENABLED = true; // Hardcoded
```

**Impact:** Cannot run in HTTP-only environments (development, testing).  
**Fix:** Make configurable via environment variable `VOICE_HTTPS_ENABLED`.

### 15. TODO: Missing Graceful Shutdown for Active Transcriptions
**File:** `jarvis-server.js`  
**Issue:** SIGINT handler closes server but doesn't wait for active transcriptions to complete.

```javascript
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => { ... }); // Doesn't wait for active processes
});
```

**Impact:** Active transcriptions are abandoned, orphaned files left in live/.  
**Fix:** Track active transcription promises, wait for completion before exit.

---

## Low Issues (6)

### 16. Magic Numbers in Polling Logic
**File:** `app.js`  
**Line:** 274  
**Issue:** `maxAttempts = 180` and `1000ms` interval are magic numbers.

```javascript
const maxAttempts = 180; // 3 min
// ...
}, 1000); // 1 second interval
```

**Impact:** Hard to adjust timeout behavior, unclear intent.  
**Fix:** Extract to constants with descriptive names: `POLL_INTERVAL_MS`, `MAX_POLL_ATTEMPTS`.

### 17. No Loading State for QR Generation
**File:** `app.js`  
**Issue:** QR modal shows "Generating..." but no spinner or progress indicator.

**Impact:** Users may think it's frozen on slow networks.  
**Fix:** Add visual loading indicator.

### 18. Inconsistent Date Formatting
**Files:** `app.js`, `jarvis-server.js`, `device-registry.js`  
**Issue:** Multiple date formatting patterns used throughout codebase.

```javascript
// Pattern 1:
new Date().toISOString().split('T')[0]

// Pattern 2:
new Date().toISOString().replace(/[:.]/g, '')

// Pattern 3:
date.toLocaleDateString()
```

**Impact:** Maintenance burden, potential bugs if format assumptions change.  
**Fix:** Create utility function for date formatting, use consistently.

### 19. No Unit Tests
**Files:** All  
**Issue:** `package.json` has test script that just exits with error.

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

**Impact:** No automated verification of functionality, regression risk.  
**Fix:** Add basic unit tests for critical functions (transcription, device registry, polling).

### 20. Overly Permissive CORS
**File:** `jarvis-server.js`  
**Line:** 94  
**Issue:** CORS allows all origins.

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Impact:** Security risk if server is exposed to network.  
**Fix:** Restrict to known origins, or validate Origin header.

### 21. No Rate Limiting on Endpoints
**File:** `jarvis-server.js`  
**Issue:** All endpoints accept unlimited requests without rate limiting.

**Impact:** Potential DoS vector, resource exhaustion.  
**Fix:** Implement rate limiting middleware, especially on `/upload` and `/api/register-device`.

---

## Recommendations

### Immediate Actions (Critical + High)
1. **Add missing `execSync` import** in device-registry.js
2. **Reorder function definitions** in app.js for clarity
3. **Add input validation** on device registration endpoint
4. **Fix hardcoded paths** to honor portable configuration claims
5. **Implement proper error handling** consistently

### Short-term Improvements (Medium)
1. Implement structured logging (replace console.log with logger)
2. Add debouncing to resize handlers
3. Fix version string mismatches
4. Remove duplicate CSS/animation definitions
5. Make FFmpeg path configurable

### Long-term Technical Debt (Low)
1. Add unit test coverage
2. Implement rate limiting
3. Create date formatting utilities
4. Add graceful shutdown for active processes
5. Restrict CORS origins

---

## File-by-File Summary

### app.js (Client-side)
- **Lines:** ~530
- **Issues:** 12 (1 critical, 3 high, 5 medium, 3 low)
- **Primary Concerns:** Race conditions, missing cleanup, console.log spam

### jarvis-server.js (Server)
- **Lines:** ~680
- **Issues:** 7 (1 critical, 2 high, 3 medium, 1 low)
- **Primary Concerns:** Hardcoded paths, input validation, error handling

### device-registry.js (Module)
- **Lines:** ~180
- **Issues:** 2 (1 critical, 1 high)
- **Primary Concerns:** Missing import, hardcoded paths

### index.html (UI)
- **Lines:** ~450
- **Issues:** 3 (0 critical, 0 high, 2 medium, 1 low)
- **Primary Concerns:** Duplicate CSS, version mismatch

---

**Report Generated:** 2026-03-24 21:50 GMT+7  
**Next Steps:** Review critical issues with team, prioritize fixes for next sprint.
