export function createLodPolicy() {
  return {
    distanceFor(cameraDistance) {
      if (cameraDistance < 6) {
        return 'high';
      }
      if (cameraDistance < 10) {
        return 'medium';
      }
      return 'low';
    },
  };
}
