export function createPanels(host, eventBus) {
  const drawer = document.createElement('aside');
  drawer.className = 'jarvis-info-drawer';
  drawer.innerHTML = `
    <div class="jarvis-info-drawer__body">
      <p id="jarvis-drawer-status">Booting…</p>
      <p id="jarvis-drawer-voice-status" class="jarvis-info-drawer__voice"></p>
      <p id="jarvis-left-stream-summary">Jarvis stream calibrating…</p>
      <p id="jarvis-right-stream-summary">Paul stream calibrating…</p>
    </div>
    <button type="button" class="jarvis-info-drawer__toggle" aria-expanded="false" aria-label="Toggle timeline info">
      <span class="jarvis-info-drawer__chevron">›</span>
      <span>Info</span>
    </button>
  `;
  host.append(drawer);

  const toggleButton = drawer.querySelector('.jarvis-info-drawer__toggle');
  const chevron = drawer.querySelector('.jarvis-info-drawer__chevron');
  const statusEl = drawer.querySelector('#jarvis-drawer-status');
  const voiceStatusEl = drawer.querySelector('#jarvis-drawer-voice-status');
  const leftSummary = drawer.querySelector('#jarvis-left-stream-summary');
  const rightSummary = drawer.querySelector('#jarvis-right-stream-summary');

  let expanded = false;
  toggleButton.addEventListener('click', () => {
    expanded = !expanded;
    drawer.classList.toggle('jarvis-info-drawer--open', expanded);
    toggleButton.setAttribute('aria-expanded', String(expanded));
    chevron.textContent = expanded ? '‹' : '›';
  });

  // No-op unsubscribe since we removed the hover position display
  const unsubscribe = eventBus.on('orb:hover', () => {});

  return {
    bodyElement: drawer.querySelector('.jarvis-info-drawer__body'),
    setStatus(text) {
      statusEl.textContent = text || '';
    },
    setVoiceStatus(text) {
      voiceStatusEl.textContent = text || '';
    },
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

      leftSummary.textContent = `Jarvis stream · ${jarvisStreams.join(' · ') || 'No stream groups'} · ${leftCount} visible`;
      rightSummary.textContent = `Paul stream · ${paulStreams.join(' · ') || 'No stream groups'} · ${rightCount} visible`;
    },
    destroy() {
      unsubscribe();
      drawer.remove();
    },
  };
}
