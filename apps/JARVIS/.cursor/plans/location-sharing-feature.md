# Location Sharing Feature — Plan for Cursor

**Created:** March 17, 2026, 14:07 GMT+7  
**Priority:** High  
**Type:** New capability (location → archive → neurograph)  
**Status:** Ready for implementation

---

## The Goal

Let Paul share his GPS location with Jarvis via the web UI. When he shares:
- Location gets archived to `~/RAW/archive/YYYY-MM-DD/context/locations/`
- Neuron created in neurograph (location type, linked to temporal + person nodes)
- Reverse geocode to get place name (coffee shop, hotel, beach, etc.)
- Timestamp + coordinates stored
- Future: learn patterns (favorite spots, routines, places that matter)

---

## User Flow

1. **Paul clicks "Share Location" button** in Jarvis UI
2. **Browser requests permission** (navigator.geolocation.getCurrentPosition)
3. **Location sent to server** via POST `/location`
4. **Server processes:**
   - Reverse geocode (coordinates → place name)
   - Archive to dated folder
   - Create neurograph neuron
   - Respond with confirmation
5. **UI shows:** "Location archived: [place name] at [coords]"

---

## Technical Implementation

### Frontend (app.js)

**New button in UI:**
```html
<button id="share-location-btn">📍 Share Location</button>
```

**Click handler:**
```javascript
document.getElementById('share-location-btn').addEventListener('click', async () => {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by your browser', 'error');
    return;
  }

  showStatus('Requesting location...', 'info');
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      
      // Send to server
      const response = await fetch('/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      showStatus(`Location archived: ${result.placeName} (${result.address})`, 'success');
      
      // Auto-archive confirmation (optional)
      // Could trigger a recording: "Just shared my location with you"
    },
    (error) => {
      showStatus(`Location error: ${error.message}`, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});
```

**Styling:** Match existing button style (pulsating, cyan theme)

---

### Backend (jarvis-server.js)

**New route:** `POST /location`

```javascript
app.post('/location', async (req, res) => {
  const { latitude, longitude, accuracy, timestamp } = req.body;
  
  // Reverse geocode (use free API, no key needed)
  const placeName = await reverseGeocode(latitude, longitude);
  
  // Archive location
  const today = new Date().toISOString().split('T')[0];
  const locationDir = path.join(archiveBase, today, 'context', 'locations');
  await fs.mkdir(locationDir, { recursive: true });
  
  const locationFile = path.join(locationDir, `location-${Date.now()}.json`);
  const locationData = {
    timestamp,
    coordinates: { latitude, longitude, accuracy },
    placeName,
    archivedAt: new Date().toISOString()
  };
  
  await fs.writeFile(locationFile, JSON.stringify(locationData, null, 2));
  
  // Create neurograph neuron
  await createLocationNeuron(locationData);
  
  res.json({
    success: true,
    placeName,
    address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    archived: locationFile
  });
});
```

**Reverse geocode function:**
```javascript
async function reverseGeocode(lat, lon) {
  try {
    // Use OpenStreetMap Nominatim (free, no API key)
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await response.json();
    
    // Extract meaningful name
    if (data.address?.cafe) return `${data.address.cafe} (coffee shop)`;
    if (data.address?.shop) return `${data.address.shop} (shop)`;
    if (data.address?.hotel) return `${data.address.hotel} (hotel)`;
    if (data.address?.beach) return `${data.address.beach} (beach)`;
    if (data.address?.road) return `${data.address.road} area`;
    if (data.address?.neighbourhood) return `${data.address.neighbourhood}`;
    if (data.address?.city) return `${data.address.city}`;
    
    return `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  } catch (err) {
    console.error('Geocode error:', err);
    return `Coordinates (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  }
}
```

**Create neurograph neuron:**
```javascript
async function createLocationNeuron(locationData) {
  const nodes = await fs.readFile(path.join(jarvisDir, 'RAW', 'memories', 'nodes.json'), 'utf8');
  const synapses = await fs.readFile(path.join(jarvisDir, 'RAW', 'memories', 'synapses.json'), 'utf8');
  
  const nodeId = `location-${Date.now()}`;
  const today = new Date().toISOString().split('T')[0];
  const todayNodeId = today.replace(/-/g, '_');
  
  const newNode = {
    id: nodeId,
    type: 'location',
    label: locationData.placeName,
    timestamp: locationData.timestamp,
    coordinates: locationData.coordinates,
    rawContentPath: locationData.archived,
    moments: ['location', 'context'],
    category: 'archive'
  };
  
  nodes.push(newNode);
  
  // Link to temporal node (today)
  synapses.push({
    source: nodeId,
    target: todayNodeId,
    weight: 1.0,
    type: 'temporal'
  });
  
  // Link to Paul (person node)
  synapses.push({
    source: nodeId,
    target: 'paul_visciano',
    weight: 1.0,
    type: 'context'
  });
  
  await fs.writeFile(path.join(jarvisDir, 'RAW', 'memories', 'nodes.json'), JSON.stringify(nodes, null, 2));
  await fs.writeFile(path.join(jarvisDir, 'RAW', 'memories', 'synapses.json'), JSON.stringify(synapses, null, 2));
  
  // Git commit
  await gitCommit('location', `📍 ${locationData.placeName}`);
}
```

---

## Archive Structure

```
~/RAW/archive/YYYY-MM-DD/context/locations/
├── location-1234567890.json
│   {
│     "timestamp": "2026-03-17T14:07:00Z",
│     "coordinates": { "latitude": 12.9308, "longitude": 100.8787, "accuracy": 10 },
│     "placeName": "Weed Coffee Shop (Jomtien)",
│     "archivedAt": "2026-03-17T14:07:05Z"
│   }
└── location-1234567891.json
```

---

## Neurograph Integration

**New neuron type:** `location` (orange? or green for places)

**Moments:** `['location', 'context']`

**Category:** `archive` (not temporal, not learning — it's a life context file)

**Links:**
- Temporal (today's date node)
- Paul Visciano (person node)
- Future: other locations nearby (cluster by geography)

---

## Future Enhancements (Post-MVP)

1. **Location history view** — See all places archived on a map
2. **Pattern recognition** — "You've been to this coffee shop 12 times"
3. **Auto-location** — Detect when Paul arrives somewhere new (background geofencing)
4. **Photo + location link** — When he shares a photo, auto-tag with current location
5. **Voice + location** — "I'm at [place]" → auto-capture location + transcribe

---

## Testing Checklist

- [ ] Button appears in UI
- [ ] Browser permission prompt works
- [ ] Location sends to server
- [ ] Reverse geocode returns meaningful name
- [ ] Archive file created in correct folder
- [ ] Neuron created in neurograph
- [ ] Synapses link to temporal + person nodes
- [ ] Git commit succeeds
- [ ] UI shows success message with place name
- [ ] Error handling works (no GPS, timeout, etc.)

---

## Files to Edit

1. `~/SCI-FI/apps/JARVIS/app.js` — Add button + click handler
2. `~/SCI-FI/apps/JARVIS/jarvis-server.js` — Add POST /location route
3. `~/SCI-FI/apps/JARVIS/assets/index.html` — Add button HTML (if not dynamic)

---

## Dependencies

- Browser geolocation API (built-in, no library needed)
- OpenStreetMap Nominatim (free reverse geocode, rate limit: 1 req/sec)
- Existing archive + neurograph functions (reuse gitCommit, etc.)

---

## Security Notes

- Location data is private (stored in ~/RAW/, gitignored)
- HTTPS required for geolocation in browser (already enabled)
- No external API calls except Nominatim (sovereign otherwise)
- User must grant permission each time (browser security)

---

## Ready for Cursor

**This plan is complete.** Hand to Cursor, let them implement. Test in UI. Archive the session. Create learnings.

**Let's build this.**
