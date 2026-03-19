# Mobile UI Improvements — v271

**Created:** March 18, 2026  
**Priority:** High (Eric + Paul testing, production-ready needed)  
**Target:** JARVIS mobile UI (Android + iOS)

---

## **Overview**

Three critical improvements needed for mobile UX based on field testing:

1. **Video compression** — 14 MB files are choppy on mobile
2. **Double-tap detection** — Orb touch events not firing reliably on Android
3. **Client tracking** — Detect mobile vs desktop for analytics + conditional serving
4. **TTS disabled by default** — Robotic voice is annoying, users prefer silent text

---

## **1. Video Compression for Mobile**

### **Problem**
- Current video: ~14 MB (full quality)
- Mobile playback: choppy, slow loading, data-heavy
- Desktop: fine with full quality

### **Solution**
**Option A: Transcode on Upload (Recommended)**
- Detect mobile client via User-Agent
- Run ffmpeg to create compressed version
- Serve compressed to mobile, full to desktop

**Option B: Pre-generate Multiple Versions**
- Keep 14 MB original
- Create ~2-3 MB mobile version upfront
- Serve based on client type

### **Implementation**

**Server-side (jarvis-server.js):**
```javascript
// In the upload handler, after saving the file:
const userAgent = req.headers['user-agent'] || 'unknown';
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

if (isMobile && videoFile) {
    // Compress video for mobile
    const compressedPath = filepath.replace('.mp4', '-mobile.mp4');
    exec(`/opt/homebrew/bin/ffmpeg -i "${filepath}" -vf scale=640:-1 -crf 28 -preset fast "${compressedPath}"`, (err) => {
        if (err) console.error('Compression failed:', err);
        else console.log('✓ Mobile video created:', compressedPath);
    });
}
```

**Frontend (index.html or app.js):**
```javascript
// Serve appropriate video based on device
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
const videoSrc = isMobile ? 'video-mobile.mp4' : 'video.mp4';
```

### **Acceptance Criteria**
- [ ] Mobile users receive ~2-3 MB video files
- [ ] Desktop users receive full quality (14 MB)
- [ ] Playback is smooth on Android + iOS
- [ ] Compression happens automatically on upload

---

### **2. Double-Tap Focus Issue (Orb Touch Events)**

### **Problem**
- Eric (Android): Double-tap on orb not detecting reliably
- Had to "tap harder" or tap live transcription first
- Likely CSS z-index or touch-event bubbling issue

### **Root Cause Hypotheses**
1. **z-index conflict** — Orb overlay beneath another div
2. **pointer-events: none** — Accidentally disabled touch
3. **touch-action CSS** — Not properly configured for mobile
4. **Event listener conflict** — Multiple handlers fighting

### **Implementation**

**Frontend (index.html or CSS):**
```css
/* Ensure orb captures touch events */
.orb-container {
    touch-action: manipulation; /* Allows double-tap */
    pointer-events: auto; /* Explicitly enable */
    z-index: 1000; /* Ensure on top */
    position: relative; /* Establish stacking context */
}

.orb {
    touch-action: manipulation;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent; /* Remove default highlight */
}
```

**JavaScript (event listener):**
```javascript
// Use touchstart for faster response than click
orb.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    activateSpeechMode();
}, { passive: false });

// Also keep click for desktop
orb.addEventListener('click', activateSpeechMode);
```

**Debug steps:**
1. Open Chrome DevTools on Android (remote debugging)
2. Inspect orb element, check computed styles
3. Look for overlapping divs (z-index stack)
4. Test touchstart vs click events

### **Acceptance Criteria**
- [ ] Double-tap works reliably on Android
- [ ] Double-tap works on iOS
- [ ] No need to "tap harder"
- [ ] No need to tap live transcription first
- [ ] Touch events fire consistently

---

## **3. Client Tracking + UI Display (User-Agent Detection)**

### **Problem**
- No visibility into which client/device is messaging
- Can't distinguish Paul-on-Android vs Paul-on-Desktop vs Eric-on-Android
- Messages all look the same — no context about source

### **Solution**
Extract User-Agent, detect device type, **display in UI** with visual indicators (icons, bubbles, labels).

**User story:**
> "When I'm talking to you from my phone vs from the desktop, you can start distinguishing and showing all those details in the UI... you can kind of identify where the message came from."

### **Implementation**

**Server-side (jarvis-server.js):**
```javascript
// Add to the /upload handler:
const userAgent = req.headers['user-agent'] || 'unknown';
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
const deviceType = isMobile ? 'mobile' : 'desktop';
const platform = isMobile ? (userAgent.includes('android') ? 'Android' : 'iOS') : 'Desktop';

// Log it
console.log(`📱 Upload from: ${deviceType} (${platform}) - ${userAgent}`);

// Archive metadata
const metadata = {
    timestamp: new Date().toISOString(),
    deviceType,
    platform,
    userAgent,
    filename,
    filesize: audioData.length
};

// Save alongside archive
fs.writeFileSync(path.join(archiveDir, archivedName + '.metadata.json'), JSON.stringify(metadata, null, 2));

// Post to gateway WITH device info
const message = `${platform} ${deviceType === 'mobile' ? '📱' : '💻'}: ${userMessage}`;
execSync(`openclaw message send --message "${message.replace(/"/g, '\\"')}"`);
```

**Frontend (index.html / app.js — message display):**
```javascript
// When rendering messages, show device indicator
function renderMessage(message, metadata) {
    const icon = metadata.deviceType === 'mobile' ? '📱' : '💻';
    const platform = metadata.platform || 'Unknown';
    
    return `
        <div class="message-bubble ${metadata.deviceType}">
            <div class="message-header">
                <span class="device-icon">${icon}</span>
                <span class="platform-label">${platform}</span>
                <span class="timestamp">${new Date(metadata.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-body">${message.text}</div>
        </div>
    `;
}

// CSS styling per device type
.message-bubble.mobile {
    border-left: 3px solid #4CAF50; /* Green for mobile */
    background: #f1f8e9;
}

.message-bubble.desktop {
    border-left: 3px solid #2196F3; /* Blue for desktop */
    background: #e3f2fd;
}
```

**UI mockup:**
```
┌─────────────────────────────────────┐
│ 📱 Android • 16:04                  │
│ "Yeah, it's pretty sick that it     │
│  works. Also worked for Eric..."    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 💻 Desktop • 16:11                  │
│ "Yes, so create a plan for Cursor   │
│  to implement all three..."         │
└─────────────────────────────────────┘
```

### **Acceptance Criteria**
- [ ] Every message shows device icon (📱/💻)
- [ ] Platform label displayed (Android/iOS/Desktop)
- [ ] Message bubbles styled differently per device type
- [ ] Server logs device info
- [ ] Metadata archived with transcript
- [ ] Multi-user clarity (Paul vs Eric vs others)

---

## **4. TTS Disabled by Default**

### **Problem**
- TTS (text-to-speech) enabled by default
- Robotic voice is annoying
- Users prefer silent text reading

### **Solution**
Disable TTS by default in mobile UI, add toggle to enable if desired.

### **Implementation**

**Frontend (index.html or app.js):**
```javascript
// Change default setting
const ttsEnabled = false; // Was: true

// In settings UI:
<label>
    <input type="checkbox" id="tts-toggle" checked={ttsEnabled} />
    Enable text-to-speech
</label>

// Load from localStorage if user has preference
const savedTtsSetting = localStorage.getItem('ttsEnabled');
const ttsEnabled = savedTtsSetting ? JSON.parse(savedTtsSetting) : false;
```

**Where TTS is called:**
```javascript
// Only speak if enabled
if (ttsEnabled) {
    speakText(responseText);
}
```

### **Acceptance Criteria**
- [ ] TTS off by default on first load
- [ ] Toggle in settings to enable/disable
- [ ] Preference saved in localStorage
- [ ] No robotic voice unless user enables it

---

## **Implementation Order**

1. **TTS disabled** — Quick fix, immediate UX improvement (15 min)
2. **Client tracking** — Add User-Agent detection + logging (30 min)
3. **Double-tap fix** — CSS/JS touch event debugging (1-2 hours)
4. **Video compression** — ffmpeg integration, testing (2-3 hours)

---

## **Testing Plan**

**Devices:**
- Paul's Android phone (primary test)
- Eric's phone (Android — reported issues)
- iOS device (Safari mobile)
- Desktop (Chrome, Safari — regression test)

**Test scenarios:**
1. Upload voice message → verify transcription + archive
2. Double-tap orb → verify speech mode activates
3. Play video → verify smooth playback (mobile vs desktop)
4. Check TTS → verify silent by default
5. Check logs → verify device type logged

---

## **Files to Modify**

1. `/Users/paulvisciano/SCI-FI/apps/JARVIS/jarvis-server.js`
   - Add User-Agent detection
   - Add video compression logic
   - Add metadata archiving

2. `/Users/paulvisciano/SCI-FI/apps/JARVIS/index.html` (or `app.js`)
   - Fix orb touch events (CSS + JS)
   - Disable TTS by default
   - Add TTS toggle UI
   - Add client detection for video serving

3. `/Users/paulvisciano/SCI-FI/apps/JARVIS/plans/` (this file)
   - Implementation plan

---

## **Definition of Done**

- [ ] All 4 improvements implemented
- [ ] Tested on Android (Paul + Eric)
- [ ] Tested on iOS
- [ ] Tested on desktop (regression)
- [ ] Code committed to git
- [ ] Version bumped to 2.7.1
- [ ] Deployed + QR code regenerated for testing

---

**Let's build.** 🫀
