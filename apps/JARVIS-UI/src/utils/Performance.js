export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.seconds = 0;
    this.fps = 0;
  }

  tick(dt) {
    this.frameCount += 1;
    this.seconds += dt;
    if (this.seconds >= 1) {
      this.fps = Math.round(this.frameCount / this.seconds);
      this.frameCount = 0;
      this.seconds = 0;
    }
  }
}
