import * as THREE from 'three';

// Radians per full viewport drag (horizontal / vertical)
const DRAG_YAW_FACTOR   = 4.2;
const DRAG_PITCH_FACTOR = 2.4;
// Wheel momentum decay per frame
const WHEEL_DECAY = 0.84;
// Drag momentum decay per frame (angle)
const DRAG_DECAY = 0.88;

export class JarvisNavAPI {
  constructor(cameraController) {
    this.cc = cameraController;

    this.dragState = null;         // { x, y } while pointer is held
    this.dragVel = { x: 0, y: 0 }; // velocity carried into release inertia
    this.dragMomRaf = null;

    this.flyVelocity = 0;
    this.flyAnimFrame = null;
    this.pinchVelocity = 0;
    this.pinchRaf = null;

    this.pinchDist = null;
    this.pointerNorm = { x: 0, y: 0 };

    // Whether a drag is in progress — exposed so node-hover can skip while dragging
    this.isDragging = false;

    this._onWheel = (e) => {
      this._updatePointerNorm(e.clientX, e.clientY);

      if (e.ctrlKey) {
        // Trackpad pinch — prevent browser page zoom, fly toward cursor instead.
        e.preventDefault();
        this.pinchVelocity += e.deltaY * this.cc.scrollSpeed * 4.5;
        this._startPinchMomentum();
        return;
      }

      // Regular two-finger scroll — depth travel only
      let delta = e.deltaY;
      if (e.deltaMode === 1) { delta *= 18; }
      if (e.deltaMode === 2) { delta *= window.innerHeight * 0.8; }
      this.flyVelocity += delta * this.cc.scrollSpeed * 0.9;
      this._startFlyMomentum();
    };

    this._onPointerDown = (e) => {
      if (e.button !== 0) { return; }
      this.isDragging = false;
      this.dragState = { x: e.clientX, y: e.clientY };
      this.dragVel = { x: 0, y: 0 };
      // Cancel any residual drag momentum when a new drag starts
      if (this.dragMomRaf) {
        cancelAnimationFrame(this.dragMomRaf);
        this.dragMomRaf = null;
      }
    };

    this._onPointerMove = (e) => {
      this._updatePointerNorm(e.clientX, e.clientY);

      if (!this.dragState) { return; }

      const dx = e.clientX - this.dragState.x;
      const dy = e.clientY - this.dragState.y;

      // Mark as a real drag after a small threshold (avoids accidental drags on click)
      if (!this.isDragging && Math.hypot(dx, dy) > 4) {
        this.isDragging = true;
      }
      if (!this.isDragging) { return; }

      const dYaw   = -(dx / window.innerWidth)  * DRAG_YAW_FACTOR;
      const dPitch =  (dy / window.innerHeight) * DRAG_PITCH_FACTOR;
      this.cc.adjustView(dYaw, dPitch);

      // Track instantaneous velocity for release inertia
      this.dragVel.x = dYaw;
      this.dragVel.y = dPitch;

      this.dragState = { x: e.clientX, y: e.clientY };
    };

    this._onPointerUp = () => {
      this.dragState = null;
      if (this.isDragging) {
        this._startDragMomentum();
      }
      // Reset isDragging next tick so click handlers fire correctly
      setTimeout(() => { this.isDragging = false; }, 0);
    };

    this._lastTap = 0;

    this._onTouchStart = (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this._updatePointerNorm(t.clientX, t.clientY);

        // Double-tap detection — fly toward tap point
        const now = Date.now();
        if (now - this._lastTap < 300) {
          this.cc.flyToward(this.pointerNorm.x, this.pointerNorm.y);
          this._lastTap = 0;
          return;
        }
        this._lastTap = now;

        this.dragState = { x: t.clientX, y: t.clientY };
        this.dragVel = { x: 0, y: 0 };
        this.isDragging = false;
      }
      if (e.touches.length === 2) {
        this._updatePointerNorm(
          (e.touches[0].clientX + e.touches[1].clientX) * 0.5,
          (e.touches[0].clientY + e.touches[1].clientY) * 0.5,
        );
        this.pinchDist = this._touchDist(e.touches[0], e.touches[1]);
        this.dragState = null;
      }
    };

    this._onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.dragState) {
        const t = e.touches[0];
        const dx = t.clientX - this.dragState.x;
        const dy = t.clientY - this.dragState.y;
        this._updatePointerNorm(t.clientX, t.clientY);
        if (!this.isDragging && Math.hypot(dx, dy) > 4) { this.isDragging = true; }
        if (this.isDragging) {
          const dYaw   = -(dx / window.innerWidth)  * DRAG_YAW_FACTOR;
          const dPitch =  (dy / window.innerHeight) * DRAG_PITCH_FACTOR;
          this.cc.adjustView(dYaw, dPitch);
          this.dragVel = { x: dYaw, y: dPitch };
        }
        this.dragState = { x: t.clientX, y: t.clientY };
      }
      if (e.touches.length === 2) {
        this._updatePointerNorm(
          (e.touches[0].clientX + e.touches[1].clientX) * 0.5,
          (e.touches[0].clientY + e.touches[1].clientY) * 0.5,
        );
        const next = this._touchDist(e.touches[0], e.touches[1]);
        if (this.pinchDist != null) {
          const delta = (this.pinchDist - next) * 0.055;
          this.cc.flyTowardCursor(delta, this.pointerNorm.x, this.pointerNorm.y);
        }
        this.pinchDist = next;
      }
    };

    this._onTouchEnd = () => {
      this.pinchDist = null;
      if (this.dragState && this.isDragging) {
        this._startDragMomentum();
      }
      this.dragState = null;
      setTimeout(() => { this.isDragging = false; }, 0);
    };

    this._onDblClick = (e) => {
      const nx = ((e.clientX / Math.max(window.innerWidth,  1)) - 0.5) * 2;
      const ny = (0.5 - (e.clientY / Math.max(window.innerHeight, 1))) * 2;
      this.cc.flyToward(nx, ny);
    };

    this._onKeyDown = (e) => {
      const step = this.cc.strafeStep;
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); this.cc.strafe(-step, 0); break;
        case 'ArrowRight': e.preventDefault(); this.cc.strafe(step, 0);  break;
        case 'ArrowUp':    e.preventDefault(); this.cc.strafe(0, step);  break;
        case 'ArrowDown':  e.preventDefault(); this.cc.strafe(0, -step); break;
        case 'Home':       e.preventDefault(); this.cc.returnToPresent(); break;
        default: break;
      }
    };

    window.addEventListener('dblclick', this._onDblClick);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: true });
    window.addEventListener('keydown', this._onKeyDown);
  }

  // ── Scroll momentum ──────────────────────────────────────────────────────
  _startFlyMomentum() {
    if (this.flyAnimFrame) { return; }
    const tick = () => {
      // Scroll is depth-only — no cursor-based X/Y drift
      this.cc.flyTime(this.flyVelocity);
      this.flyVelocity *= WHEEL_DECAY;
      if (Math.abs(this.flyVelocity) < 0.0006) {
        this.flyVelocity = 0;
        this.flyAnimFrame = null;
        return;
      }
      this.flyAnimFrame = requestAnimationFrame(tick);
    };
    this.flyAnimFrame = requestAnimationFrame(tick);
  }

  // ── Pinch momentum (toward cursor) ───────────────────────────────────────
  _startPinchMomentum() {
    if (this.pinchRaf) { return; }
    const tick = () => {
      this.cc.flyTowardCursor(this.pinchVelocity, this.pointerNorm.x, this.pointerNorm.y);
      this.pinchVelocity *= WHEEL_DECAY;
      if (Math.abs(this.pinchVelocity) < 0.0006) {
        this.pinchVelocity = 0;
        this.pinchRaf = null;
        return;
      }
      this.pinchRaf = requestAnimationFrame(tick);
    };
    this.pinchRaf = requestAnimationFrame(tick);
  }

  // ── Drag inertia ─────────────────────────────────────────────────────────
  _startDragMomentum() {
    if (this.dragMomRaf) { return; }
    const tick = () => {
      this.dragVel.x *= DRAG_DECAY;
      this.dragVel.y *= DRAG_DECAY;
      const mag = Math.abs(this.dragVel.x) + Math.abs(this.dragVel.y);
      if (mag < 0.0004) {
        this.dragVel = { x: 0, y: 0 };
        this.dragMomRaf = null;
        return;
      }
      this.cc.adjustView(this.dragVel.x, this.dragVel.y);
      this.dragMomRaf = requestAnimationFrame(tick);
    };
    this.dragMomRaf = requestAnimationFrame(tick);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _touchDist(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  _updatePointerNorm(clientX, clientY) {
    this.pointerNorm.x = ((clientX / Math.max(window.innerWidth, 1)) - 0.5) * 2;
    this.pointerNorm.y = (0.5 - (clientY / Math.max(window.innerHeight, 1))) * 2;
  }

  update(distance) {
    if (distance < 6) {
      this.cc.approachFocus();
    }
  }

  destroy() {
    window.removeEventListener('dblclick', this._onDblClick);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.flyAnimFrame) { cancelAnimationFrame(this.flyAnimFrame); }
    if (this.dragMomRaf)   { cancelAnimationFrame(this.dragMomRaf); }
    if (this.pinchRaf)     { cancelAnimationFrame(this.pinchRaf); }
  }
}
