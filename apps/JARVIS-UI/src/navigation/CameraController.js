import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.lookTarget = new THREE.Vector3(0, 0.5, 0);
    this.presentPosition = camera.position.clone();
    this.currentPosition = camera.position.clone();
    this.desiredPosition = camera.position.clone();
    this.focusPosition = new THREE.Vector3(0, 1.5, 5.8);
    this.scrollSpeed = 0.014;
    this.strafeStep = 0.42;
    this.timeBounds = { min: -26, max: 14 };
    this.altitudeBounds = { min: -5, max: 10 };
    this.lateralBounds = { min: -18, max: 18 };
    this.damping = 8;
  }

  update(dt) {
    const blend = 1 - Math.exp(-this.damping * dt);
    this.currentPosition.lerp(this.desiredPosition, blend);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.lookTarget);
  }

  flyTo(position) {
    this.desiredPosition.copy(position);
  }

  flyTime(delta) {
    this.desiredPosition.z = THREE.MathUtils.clamp(
      this.desiredPosition.z + delta,
      this.timeBounds.min,
      this.timeBounds.max
    );
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
  }

  returnToPresent() {
    this.flyTo(this.presentPosition);
  }

  approachFocus() {
    const distanceToFocus = this.desiredPosition.distanceTo(this.focusPosition);
    if (distanceToFocus > 0.08) {
      this.desiredPosition.lerp(this.focusPosition, 0.18);
    }
  }
}
