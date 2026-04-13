export class NeurographLoader {
  constructor() {
    this.serverOrigin = (import.meta.env.VITE_JARVIS_SERVER_ORIGIN || 'http://localhost:18787').replace(/\/$/, '');
  }

  async loadBootstrap(onProgress = () => {}) {
    let events;
    try {
      events = new EventSource(`${this.serverOrigin}/api/bootstrap/events`);
      events.addEventListener('bootstrap:snapshot', (event) => onProgress(JSON.parse(event.data)));
      events.addEventListener('bootstrap:update', (event) => onProgress(JSON.parse(event.data)));
      events.addEventListener('bootstrap:ready', (event) => onProgress(JSON.parse(event.data)));
      events.addEventListener('bootstrap:error', (event) => onProgress(JSON.parse(event.data)));
    } catch (_) {
      // EventSource can fail in restricted environments; fetch path still works.
    }

    try {
      const response = await fetch(`${this.serverOrigin}/api/bootstrap/nodes`);
      if (!response.ok) {
        throw new Error(`Bootstrap request failed (${response.status})`);
      }
      const payload = await response.json();
      onProgress({
        phase: 'ready',
        progress: 100,
        message: 'Bootstrap ready',
        nodeCount: payload.nodes.length
      });
      return payload.nodes;
    } finally {
      if (events) {
        events.close();
      }
    }
  }
}
