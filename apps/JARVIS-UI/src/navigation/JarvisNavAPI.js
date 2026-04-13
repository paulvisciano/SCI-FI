export class JarvisNavAPI {
  constructor(cameraController) {
    this.cameraController = cameraController;
    this.onWheel = (event) => {
      this.cameraController.flyTime(event.deltaY * this.cameraController.scrollSpeed);
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
    window.addEventListener('keydown', this.onKeyDown);
  }

  update(distance) {
    if (distance < 6) {
      this.cameraController.approachFocus();
    }
  }

  destroy() {
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
