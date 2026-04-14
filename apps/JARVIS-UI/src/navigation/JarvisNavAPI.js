export class JarvisNavAPI {
  constructor(cameraController) {
    this.cameraController = cameraController;
    this.dragState = null;
    this.pinchDistance = null;
    this.flyVelocity = 0;
    this.flyAnimFrame = null;
    this.onWheel = (event) => {
      this.flyVelocity += event.deltaY * this.cameraController.scrollSpeed * 0.9;
      this.startFlyMomentum();
    };
    this.onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      this.dragState = { x: event.clientX, y: event.clientY };
    };
    this.onPointerMove = (event) => {
      if (!this.dragState) {
        return;
      }
      const dx = event.clientX - this.dragState.x;
      const dy = event.clientY - this.dragState.y;
      this.dragState = { x: event.clientX, y: event.clientY };
      this.cameraController.strafe(
        dx * 0.02,
        -dy * 0.02
      );
    };
    this.onPointerUp = () => {
      this.dragState = null;
    };
    this.onTouchStart = (event) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.dragState = { x: touch.clientX, y: touch.clientY };
      }
      if (event.touches.length === 2) {
        this.pinchDistance = this.touchDistance(event.touches[0], event.touches[1]);
      }
    };
    this.onTouchMove = (event) => {
      if (event.touches.length === 1 && this.dragState) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.dragState.x;
        const dy = touch.clientY - this.dragState.y;
        this.dragState = { x: touch.clientX, y: touch.clientY };
        this.cameraController.strafe(dx * 0.02, -dy * 0.02);
      }
      if (event.touches.length === 2) {
        const nextDistance = this.touchDistance(event.touches[0], event.touches[1]);
        if (this.pinchDistance != null) {
          const pinchDelta = (this.pinchDistance - nextDistance) * 0.03;
          this.cameraController.flyTime(pinchDelta);
        }
        this.pinchDistance = nextDistance;
      }
    };
    this.onTouchEnd = () => {
      this.pinchDistance = null;
      if (!this.dragState) {
        return;
      }
      this.dragState = null;
    };
    this.onKeyDown = (event) => {
      const step = this.cameraController.strafeStep;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          this.cameraController.strafe(-step, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.cameraController.strafe(step, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.cameraController.strafe(0, step);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.cameraController.strafe(0, -step);
          break;
        case 'Home':
          event.preventDefault();
          this.cameraController.returnToPresent();
          break;
        default:
          break;
      }
    };
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
  }

  touchDistance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  startFlyMomentum() {
    if (this.flyAnimFrame) {
      return;
    }
    const tick = () => {
      this.cameraController.flyTime(this.flyVelocity);
      this.flyVelocity *= 0.82;
      if (Math.abs(this.flyVelocity) < 0.0008) {
        this.flyVelocity = 0;
        this.flyAnimFrame = null;
        return;
      }
      this.flyAnimFrame = window.requestAnimationFrame(tick);
    };
    this.flyAnimFrame = window.requestAnimationFrame(tick);
  }

  update(distance) {
    if (distance < 6) {
      this.cameraController.approachFocus();
    }
  }

  destroy() {
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.flyAnimFrame) {
      window.cancelAnimationFrame(this.flyAnimFrame);
      this.flyAnimFrame = null;
    }
  }
}
