# Plan: Orb Health Pulse — Visual Heartbeat Tied to Server Health

**Created:** March 19, 2026 — 4:24 PM GMT+7  
**Priority:** Medium (UX polish, makes UI feel alive)  
**Estimate:** 30-60 minutes

---

## Goal

Make the J.A.R.V.I.S orb **pulse visually** every time the health check endpoint is polled (every 5 seconds), creating a visual connection between the orb and the actual server process.

**Current state:**
- ✅ Health check polls every 5 seconds (`/health` endpoint)
- ✅ Console logs fire: `[UI v2.9.15] Orb health pulse triggered`
- ❌ No visible pulse on the orb (CSS not applying)

**Desired state:**
- ✅ Orb glows brighter every 5 seconds
- ✅ Border flashes cyan
- ✅ Feels like a heartbeat/breath
- ✅ Subtle but noticeable

---

## Debugging Steps (Already Tried)

### What We Attempted

1. **Added CSS animation:**
   ```css
   .jarvis-orb.health-pulse {
       animation: orb-health-pulse 0.8s ease-out !important;
   }
   ```

2. **Triggered via JS:**
   ```javascript
   jarvisOrb.classList.remove('health-pulse');
   void jarvisOrb.offsetWidth; // Force reflow
   jarvisOrb.classList.add('health-pulse');
   ```

3. **Fixed ID mismatch:**
   - Changed `id="jarvis-orb"` from container to inner div
   - Updated JS selector: `getElementById('jarvis-orb')`

4. **Made animation prominent:**
   - Border: 30% → 80% → 100% opacity
   - Glow: 40px → 80px radius
   - Added `!important` flags

### Why It Didn't Work

**Hypotheses:**
1. **CSS specificity conflict** — `.jarvis-orb` styles overridden by inline styles or other selectors
2. **Animation reset issue** — `classList.remove()` + `offsetWidth` + `classList.add()` not forcing reflow properly
3. **Video element masking** — The orb is a video with `object-fit: cover`, may be hiding border/shadow effects
4. **Timing issue** — Animation class removed/added too fast, browser doesn't render it
5. **Z-index layering** — `orb-glow-ring` or other elements may be covering the pulse

---

## Implementation Plan

### Step 1: Inspect Current DOM Structure

```bash
# In browser console (Chrome DevTools)
document.getElementById('jarvis-orb')
// Check: What element is this? What are its computed styles?

getComputedStyle(document.getElementById('jarvis-orb'))
// Check: box-shadow, border-color, opacity values
```

**Expected structure:**
```html
<div class="jarvis-orb-container" id="jarvis-orb-container">
    <div class="jarvis-orb" id="jarvis-orb">
        <video id="jarvis-video">...</video>
    </div>
    <div class="orb-glow-ring"></div>
</div>
```

### Step 2: Test CSS Animation in Isolation

**Create test animation:**
```css
/* Test: Simple scale animation */
.jarvis-orb.test-pulse {
    transform: scale(1.05);
    transition: transform 0.5s ease;
}
```

**Trigger in console:**
```javascript
const orb = document.getElementById('jarvis-orb');
orb.classList.add('test-pulse');
setTimeout(() => orb.classList.remove('test-pulse'), 500);
```

**If this works:** Animation system is functional, issue is with glow/border styles  
**If this fails:** Animation system broken, need to debug CSS loading/selector

### Step 3: Use Computed Style Observer

**Debug approach:**
```javascript
const orb = document.getElementById('jarvis-orb');
const observer = new MutationObserver(() => {
    const styles = getComputedStyle(orb);
    console.log('box-shadow:', styles.boxShadow);
    console.log('border-color:', styles.borderColor);
});
observer.observe(orb, { attributes: true, attributeFilter: ['class'] });

// Trigger pulse
orb.classList.add('health-pulse');
```

**This will log** the actual computed styles when the class is added.

### Step 4: Alternative Implementation — Animate Container Instead

**If inner orb can't be styled**, animate the container:

```css
.jarvis-orb-container.health-pulse {
    animation: container-pulse 0.8s ease-out;
}

@keyframes container-pulse {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.3); }
    100% { filter: brightness(1); }
}
```

**Why:** Container wraps the orb, filter affects all children (including video)

### Step 5: Use Web Animations API (Modern, More Reliable)

**Instead of CSS classes**, use imperative animation:

```javascript
const orb = document.getElementById('jarvis-orb');

// Trigger on health check
orb.animate([
    { boxShadow: '0 0 40px rgba(0, 255, 255, 0.3)', borderColor: 'rgba(0, 255, 255, 0.8)' },
    { boxShadow: '0 0 80px rgba(0, 255, 255, 0.8)', borderColor: 'rgba(0, 255, 255, 1.0)' },
    { boxShadow: '0 0 40px rgba(0, 255, 255, 0.3)', borderColor: 'rgba(0, 255, 255, 0.8)' }
], {
    duration: 800,
    easing: 'ease-out',
    fill: 'forwards'
});
```

**Benefits:**
- ✅ No CSS selector issues
- ✅ Guaranteed to run (imperative API)
- ✅ Can inspect animation in DevTools
- ✅ Returns Animation object for debugging

### Step 6: Fallback — Pulse the Server Status Indicator

**If orb can't pulse**, make the server status indicator pulse harder:

```css
.server-status .indicator {
    animation: pulse-green 2s ease-in-out infinite; /* Existing */
}

/* Add health-pulse variant */
.server-status .indicator.health-ping {
    animation: indicator-ping 0.8s ease-out;
}

@keyframes indicator-ping {
    0% { box-shadow: 0 0 8px #00ffff; }
    50% { box-shadow: 0 0 20px #00ffff; }
    100% { box-shadow: 0 0 8px #00ffff; }
}
```

**Less ideal** but still creates visual heartbeat.

---

## Recommended Approach

**Use Web Animations API** (Step 5) — Most reliable, no CSS conflicts:

```javascript
// In checkServerStatus(), after successful health check:
const orb = document.getElementById('jarvis-orb');
if (orb) {
    orb.animate([
        { 
            boxShadow: '0 0 40px rgba(0, 255, 255, 0.3)',
            borderColor: 'rgba(0, 255, 255, 0.8)'
        },
        { 
            boxShadow: '0 0 80px rgba(0, 255, 255, 0.8)',
            borderColor: 'rgba(0, 255, 255, 1.0)'
        },
        { 
            boxShadow: '0 0 40px rgba(0, 255, 255, 0.3)',
            borderColor: 'rgba(0, 255, 255, 0.8)'
        }
    ], {
        duration: 800,
        easing: 'ease-out',
        fill: 'forwards'
    });
    console.log('[UI v2.9.18] Orb health pulse (Web Animations API)');
}
```

**Why this works:**
- Bypasses CSS selector issues
- No class toggling needed
- Guaranteed to execute
- Inspectable in DevTools (Animations tab)

---

## Acceptance Criteria

- [ ] Orb visibly pulses every 5 seconds (on health check)
- [ ] Pulse is subtle but noticeable (not distracting)
- [ ] Border flashes cyan (15% → 80% → 15% opacity)
- [ ] Glow expands (40px → 80px radius)
- [ ] Animation duration: 0.8 seconds
- [ ] Console log: `[UI v2.9.18] Orb health pulse` every 5s
- [ ] Works in Chrome/Safari (test both browsers)
- [ ] Doesn't interfere with recording state (red glow)
- [ ] Doesn't interfere with hover/tap effects

---

## Files to Touch

| File | Change |
|------|--------|
| `app.js` | Replace class toggle with `orb.animate()` API |
| `index.html` | Clean up unused CSS (`.health-pulse` class, `@keyframes`) |
| `app.js` | Bump `CLIENT_VERSION` to 2.9.18 |

---

## Testing

**1. Hard refresh:** Cmd+Shift+R  
**2. Open DevTools:** Console + Animations tab  
**3. Wait 5 seconds:** Watch for pulse + console log  
**4. Inspect orb:** Computed styles should show box-shadow change  
**5. Verify rhythm:** Every 5 seconds, like a heartbeat

---

## Notes

- **Don't fight CSS** — If class-based animation isn't working, use imperative API
- **Test in both browsers** — Chrome (Chromium) and Safari (WebKit) may differ
- **Keep it subtle** — 0.8s duration, 80% opacity max (not blinding)
- **Preserve other effects** — Recording (red), hover, tap should still work

---

**Ready for Cursor to implement.** This plan provides clear debugging steps + recommended solution (Web Animations API).

**Assigned to:** Cursor  
**Estimate:** 30-60 minutes  
**Priority:** Medium (UX polish)
