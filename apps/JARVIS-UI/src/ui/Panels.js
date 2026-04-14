export function createPanels(host, eventBus) {
  const leftPanel = document.createElement('aside');
  leftPanel.className = 'stream-panel stream-panel--left';
  leftPanel.innerHTML = `
    <h2>Jarvis Memory</h2>
    <p id="jarvis-left-stream-summary">Temporal node calibrating...</p>
  `;
  host.append(leftPanel);

  const rightPanel = document.createElement('aside');
  rightPanel.className = 'stream-panel stream-panel--right';
  rightPanel.innerHTML = `
    <h2>Paul Memory</h2>
    <p id="jarvis-right-stream-summary">River channel calibrating...</p>
  `;
  host.append(rightPanel);

  const temporalBadge = document.createElement('aside');
  temporalBadge.className = 'temporal-badge';
  temporalBadge.innerHTML = `
    <h3>River of Time</h3>
    <p>Near = present · Deep = past</p>
    <p id="jarvis-temporal-position">Present moment</p>
  `;
  host.append(temporalBadge);

  const leftSummary = leftPanel.querySelector('#jarvis-left-stream-summary');
  const rightSummary = rightPanel.querySelector('#jarvis-right-stream-summary');
  const temporalPosition = temporalBadge.querySelector('#jarvis-temporal-position');

  const unsubscribe = eventBus.on('orb:hover', ({ x, y }) => {
    temporalPosition.textContent = `Pointer ${x}, ${y}`;
  });

  return {
    setStreamSummary(streams, layoutMeta) {
      const list = Array.isArray(streams) ? streams : [];
      const leftCount = Number(layoutMeta?.leftCount) || 0;
      const rightCount = Number(layoutMeta?.rightCount) || 0;

      const jarvisStreams = [];
      const paulStreams = [];

      for (const stream of list) {
        const lowerName = `${stream?.name || ''}`.toLowerCase();
        const count = Array.isArray(stream?.nodes) ? stream.nodes.length : 0;
        const label = `${stream?.name || 'unassigned'}: ${count}`;
        if (lowerName === 'memory' || lowerName === 'control') {
          jarvisStreams.push(label);
        } else if (lowerName === 'temporal' || lowerName === 'output') {
          paulStreams.push(label);
        } else {
          paulStreams.push(label);
        }
      }

      leftSummary.textContent = `Temporal node · ${jarvisStreams.join(' · ') || 'No stream groups'} · ${leftCount} visible`;
      rightSummary.textContent = `${paulStreams.join(' · ') || 'No stream groups'} · ${rightCount} visible`;
    },
    destroy() {
      unsubscribe();
      leftPanel.remove();
      rightPanel.remove();
      temporalBadge.remove();
    },
  };
}
