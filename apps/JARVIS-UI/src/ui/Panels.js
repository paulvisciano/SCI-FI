export function createPanels(host, eventBus) {
  const panel = document.createElement('div');
  panel.className = 'jarvis-overlay';
  panel.style.top = '5.5rem';
  panel.style.left = '0';
  panel.style.inset = '5.5rem auto auto 0';
  panel.innerHTML = '<h1>Streams</h1><p id="jarvis-stream-summary">Waiting for stream map...</p>';
  host.append(panel);

  const summary = panel.querySelector('#jarvis-stream-summary');

  const unsubscribe = eventBus.on('orb:hover', ({ x, y }) => {
    panel.title = `Pointer ${x}, ${y}`;
  });

  return {
    setStreamSummary(text) {
      summary.textContent = text;
    },
    destroy() {
      unsubscribe();
      panel.remove();
    },
  };
}
