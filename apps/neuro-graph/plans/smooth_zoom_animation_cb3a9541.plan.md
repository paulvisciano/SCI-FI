---
name: Smooth zoom animation
overview: Add a smooth, easing-based zoom animation to the neuro-graph zoom +/- buttons so zoom-in feels like accelerating toward the graph and zoom-out like backing away, instead of an instant jump.
todos: []
isProject: false
---

# Smooth Zoom Animation for Neuro-Graph

Zoom in/out currently happens instantly in [neuro-graph/shared/neural-graph.js](SCI-FI/apps/neuro-graph/shared/neural-graph.js). The goal is to animate `viewZoom` over ~400–500ms with direction-aware easing: **zoom in** = ease-in (accelerate toward), **zoom out** = ease-out (decelerate as you back away).

## Where zoom lives

- **State**: `viewZoom` (line 509), clamped to `VIEW_ZOOM_MIN` (0.25) and `VIEW_ZOOM_MAX` (5).
- **Buttons**: In `ensureZoomControls()` (lines 1497–1536): minus does `viewZoom /= 1.25`, plus does `viewZoom *= 1.25`, then clamp.
- **Render**: `render()` runs every frame via `requestAnimationFrame(render)` (line 753) and uses `viewZoom` in `project()` and drawing.

## Approach

1. **Animation state** (next to `viewZoom`, ~line 511)
  Add a small object, e.g. `zoomAnim`, with: `active`, `startZoom`, `targetZoom`, `startTime`, `duration` (e.g. 480ms).
2. **Easing**
  - **Zoom in** (target > start): ease-in (e.g. cubic `t³`) so the motion starts slow and accelerates into the graph.  
  - **Zoom out** (target < start): ease-out (e.g. `1 - (1-t)³`) so it starts fast and decelerates as you back away.  
   Implement two helpers or one that takes direction and `t in [0,1]`.
3. **Per-frame update**
  At the top of `render()` (right after `time++`):  
  - If `zoomAnim.active`, compute `elapsed = performance.now() - zoomAnim.startTime`, then `t = Math.min(1, elapsed / zoomAnim.duration)`.  
  - Apply the chosen easing to `t` based on zoom direction.  
  - Set `viewZoom = zoomAnim.startZoom + (zoomAnim.targetZoom - zoomAnim.startZoom) * easedT`.  
  - If `t >= 1`, set `zoomAnim.active = false` and `viewZoom = zoomAnim.targetZoom` (snap to final).
4. **Button handlers**
  Replace the direct `viewZoom *= / /= zoomStep` in both button listeners with:  
  - Compute **target** zoom (same as now: current * 1.25 or / 1.25, then clamp to `VIEW_ZOOM_MIN`/`VIEW_ZOOM_MAX`).  
  - Set `zoomAnim.startZoom = viewZoom` (current value, so mid-animation clicks work).  
  - Set `zoomAnim.targetZoom = target`, `zoomAnim.startTime = performance.now()`, `zoomAnim.duration = 480`, `zoomAnim.active = true`.  
   Do **not** set `viewZoom` directly; the render loop will drive it.
5. **Wheel zoom**
  Leave wheel/pinch zoom as-is (instant) so scroll stays responsive; only the +/- buttons get the smooth animation. If desired later, the same animation could be triggered from wheel with a short debounce.

## Files to change

- **[neuro-graph/shared/neural-graph.js](SCI-FI/apps/neuro-graph/shared/neural-graph.js)**  
  - Add `zoomAnim` and easing helper(s) near `viewZoom`.  
  - In `render()`, add the zoom interpolation block at the top.  
  - In `ensureZoomControls()`, replace the two button `click` handlers with animation kickoff as above.

## Optional polish

- If the user clicks +/- again while animating, reusing the same `zoomAnim` and setting `startZoom = viewZoom` and a new `targetZoom` gives a natural “extend or reverse” behavior.  
- Slight duration tweak (e.g. 400–550ms) can be tuned to taste.

