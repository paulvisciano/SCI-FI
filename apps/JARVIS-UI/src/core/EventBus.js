export class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(eventName, handler) {
    const handlers = this.events.get(eventName) ?? new Set();
    handlers.add(handler);
    this.events.set(eventName, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(eventName);
      }
    };
  }

  emit(eventName, payload) {
    const handlers = this.events.get(eventName);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => handler(payload));
  }
}
