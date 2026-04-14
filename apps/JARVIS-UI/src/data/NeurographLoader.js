export class NeurographLoader {
  constructor() {
    const configuredOrigin = import.meta.env.VITE_JARVIS_SERVER_ORIGIN;
    const fallbackOrigin = window.location.origin || 'http://localhost:18787';
    this.serverOrigin = (configuredOrigin || fallbackOrigin).replace(/\/$/, '');
  }

  async loadBootstrap(onProgress = () => {}, options = {}) {
    const offsetDays = Number.isFinite(options.offsetDays) ? options.offsetDays : 0;
    const windowDays = Number.isFinite(options.windowDays) ? options.windowDays : 7;
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
      const url = new URL(`${this.serverOrigin}/api/bootstrap/nodes`);
      url.searchParams.set('offsetDays', String(offsetDays));
      url.searchParams.set('windowDays', String(windowDays));
      const response = await fetch(url.toString());
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
      return payload;
    } finally {
      if (events) {
        events.close();
      }
    }
  }
}
