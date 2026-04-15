import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.lookTarget = new THREE.Vector3(0, 2.5, -6);
    this.presentPosition = camera.position.clone();
    this.currentPosition = camera.position.clone();
    this.desiredPosition = camera.position.clone();
    this.focusPosition = new THREE.Vector3(0, 0.5, 1.5);
    this.lookYaw = 0;   // accumulated from drag, radians
    this.lookPitch = 0; // accumulated from drag, radians
    this.scrollSpeed = 0.014;
    this.strafeStep = 0.42;
    this.timeBounds = { min: -20, max: 20 };
    this.altitudeBounds = { min: -5, max: 10 };
    this.lateralBounds = { min: -18, max: 18 };
    this.depthBounds = { min: -180, max: 18 };
    this.damping = 8;
    this._nodeFlyDamping = null; // lower damping while flying to a node
    this.parallaxFactor = 0.35;
  }

  update(dt) {
    // Use slower damping while cinematic node-fly is in progress
    const activeDamping = this._nodeFlyDamping ?? this.damping;
    const blend = 1 - Math.exp(-activeDamping * dt);
    this.currentPosition.lerp(this.desiredPosition, blend);
    // Once we've arrived, restore normal damping
    if (this._nodeFlyDamping !== null && this.currentPosition.distanceTo(this.desiredPosition) < 0.15) {
      this._nodeFlyDamping = null;
    }
    this.camera.position.copy(this.currentPosition);
    
    // Look direction is purely yaw/pitch — no position parallax, no cursor drift.
    // This means flying never changes the apparent view angle.
    const lookDist = 9;
    this.lookTarget.x = this.currentPosition.x + Math.sin(this.lookYaw) * lookDist;
    this.lookTarget.y = this.currentPosition.y + 2.2 + Math.sin(this.lookPitch) * lookDist;
    this.lookTarget.z = this.currentPosition.z - Math.cos(this.lookYaw) * lookDist;
    
    this.camera.lookAt(this.lookTarget);
  }

  flyTo(position) {
    this.desiredPosition.copy(position);
  }

  // Cinematic slow fly — uses low damping so the camera glides in over ~2-3 s
  flyToNode(position) {
    this.desiredPosition.copy(position);
    this._nodeFlyDamping = 1.2;
  }

  setDepthBounds(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return;
    }
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    this.depthBounds = { min: safeMin, max: safeMax };
    this.desiredPosition.z = THREE.MathUtils.clamp(this.desiredPosition.z, safeMin, safeMax);
    this.currentPosition.z = THREE.MathUtils.clamp(this.currentPosition.z, safeMin, safeMax);
  }

  flyTime(delta) {
    this.desiredPosition.z = THREE.MathUtils.clamp(
      this.desiredPosition.z + delta,
      this.depthBounds.min,
      this.depthBounds.max
    );
  }

  flyTimeAt(delta, anchorX = 0, anchorY = 0) {
    this.flyTime(delta);
    const factor = THREE.MathUtils.clamp(Math.abs(delta) * 2.8, 0.02, 0.24);
    this.desiredPosition.x = THREE.MathUtils.clamp(
      this.desiredPosition.x + anchorX * factor,
      this.lateralBounds.min,
      this.lateralBounds.max
    );
    this.desiredPosition.y = THREE.MathUtils.clamp(
      this.desiredPosition.y + anchorY * factor * 0.7,
      this.altitudeBounds.min,
      this.altitudeBounds.max
    );
  }

  // Fly along the 3D ray through the cursor position.
  // Positive delta = fly backward (away from cursor); negative = fly toward cursor.
  // This replaces the Z-only flyTimeAt for scroll and pinch.
  flyTowardCursor(delta, nx, ny) {
    // Unproject NDC cursor to get the world-space ray direction
    const ray = new THREE.Vector3(nx, ny, 0.5)
      .unproject(this.camera)
      .sub(this.camera.position)
      .normalize();

    this.desiredPosition.x = THREE.MathUtils.clamp(
      this.desiredPosition.x - ray.x * delta, this.lateralBounds.min, this.lateralBounds.max);
    this.desiredPosition.y = THREE.MathUtils.clamp(
      this.desiredPosition.y - ray.y * delta, this.altitudeBounds.min, this.altitudeBounds.max);
    this.desiredPosition.z = THREE.MathUtils.clamp(
      this.desiredPosition.z - ray.z * delta, this.depthBounds.min, this.depthBounds.max);
  }

  strafe(horizontalDelta, verticalDelta) {
    this.desiredPosition.x = THREE.MathUtils.clamp(
      this.desiredPosition.x + horizontalDelta,
      this.lateralBounds.min,
      this.lateralBounds.max
    );
    this.desiredPosition.y = THREE.MathUtils.clamp(
      this.desiredPosition.y + verticalDelta,
      this.altitudeBounds.min,
      this.altitudeBounds.max
    );
    this.desiredPosition.z = THREE.MathUtils.clamp(
      this.desiredPosition.z + horizontalDelta * 0.15,
      this.depthBounds.min,
      this.depthBounds.max
    );
  }

  // Accumulate yaw/pitch from drag
  adjustView(dYaw, dPitch) {
    this.lookYaw   = THREE.MathUtils.clamp(this.lookYaw + dYaw, -Math.PI * 0.55, Math.PI * 0.55);
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + dPitch, -Math.PI * 0.28, Math.PI * 0.35);
  }

  resetView() {
    this.lookYaw = 0;
    this.lookPitch = 0;
  }

  // Fly toward a screen-space direction (nx, ny normalized -1..+1)
  // Moves the camera in the direction the user double-clicked
  flyToward(nx, ny, distance = 14) {
    const yaw   = this.lookYaw + nx * Math.PI * 0.35;
    const pitch = this.lookPitch + ny * Math.PI * 0.18;
    const dx = Math.sin(yaw) * distance;
    const dy = Math.sin(pitch) * distance * 0.6;
    const dz = -Math.cos(yaw) * distance;
    this.desiredPosition.x = THREE.MathUtils.clamp(
      this.currentPosition.x + dx, this.lateralBounds.min, this.lateralBounds.max);
    this.desiredPosition.y = THREE.MathUtils.clamp(
      this.currentPosition.y + dy, this.altitudeBounds.min, this.altitudeBounds.max);
    this.desiredPosition.z = THREE.MathUtils.clamp(
      this.currentPosition.z + dz, this.depthBounds.min, this.depthBounds.max);
    this._nodeFlyDamping = 1.2; // glide smoothly rather than snap
  }

  returnToPresent() {
    this.flyTo(this.presentPosition);
    this.resetView();
  }

  approachFocus() {
    const distanceToFocus = this.desiredPosition.distanceTo(this.focusPosition);
    if (distanceToFocus > 0.08) {
      this.desiredPosition.lerp(this.focusPosition, 0.18);
    }
  }
}
