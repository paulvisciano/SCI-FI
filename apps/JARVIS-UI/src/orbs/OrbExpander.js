function fullContentFor(node) {
  return (
    node?.content ||
    node?.body ||
    node?.description ||
    node?.summary ||
    node?.preview ||
    node?.title ||
    'No content available.'
  ).toString().trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function timestampFor(node) {
  const value = node?.timestamp || node?.createdAt || node?.date || node?.day;
  if (!value) {
    return 'Unknown';
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleString();
  }
  return value;
}

function extractConnections(node) {
  if (Array.isArray(node?.connections)) {
    return node.connections.map((connection) => connection?.title || connection?.id || String(connection));
  }
  if (typeof node?.connections === 'number') {
    return [`${node.connections} linked nodes`];
  }
  if (node?.connections && typeof node.connections === 'object') {
    return Object.keys(node.connections);
  }
  if (typeof node?.links === 'string') {
    return node.links.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function extractMetadata(node) {
  const metadata = {
    id: node?.id,
    kind: node?.kind,
    type: node?.type,
    stream: node?.stream,
    day: node?.day,
    hash: node?.shortHash || node?.hash,
    visibility: node?.visibility || node?.privacy,
    commitCount: node?.commitCount
  };

  return Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');
}

export class OrbExpander {
  constructor(host) {
    this.host = host;
    this.open = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'orb-expander';
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.backdrop.innerHTML = `
      <article class="orb-expander__card" role="dialog" aria-modal="true" aria-label="Orb details">
        <header class="orb-expander__header">
          <h2 id="orb-expander-title">Node details</h2>
          <button type="button" class="orb-expander__close" aria-label="Close details">&times;</button>
        </header>
        <p class="orb-expander__timestamp" id="orb-expander-time"></p>
        <section>
          <h3>Content</h3>
          <p class="orb-expander__content" id="orb-expander-content"></p>
        </section>
        <section>
          <h3>Connections</h3>
          <ul id="orb-expander-connections"></ul>
        </section>
        <section>
          <h3>Metadata</h3>
          <ul id="orb-expander-meta"></ul>
        </section>
      </article>
    `;
    this.host.append(this.backdrop);

    this.titleEl = this.backdrop.querySelector('#orb-expander-title');
    this.timeEl = this.backdrop.querySelector('#orb-expander-time');
    this.contentEl = this.backdrop.querySelector('#orb-expander-content');
    this.connectionsEl = this.backdrop.querySelector('#orb-expander-connections');
    this.metaEl = this.backdrop.querySelector('#orb-expander-meta');
    this.closeButton = this.backdrop.querySelector('.orb-expander__close');

    this.closeButton.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', (event) => {
      if (event.target === this.backdrop) {
        this.hide();
      }
    });
  }

  show(node) {
    this.render(node);
    this.open = true;
    this.backdrop.classList.add('orb-expander--visible');
    this.backdrop.setAttribute('aria-hidden', 'false');
    window.addEventListener('keydown', this.handleKeyDown);
  }

  hide() {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.backdrop.classList.remove('orb-expander--visible');
    this.backdrop.setAttribute('aria-hidden', 'true');
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  render(node) {
    this.titleEl.textContent = node?.title || node?.name || node?.id || 'Untitled node';
    this.timeEl.textContent = timestampFor(node);
    this.contentEl.textContent = fullContentFor(node);

    const connections = extractConnections(node);
    this.connectionsEl.innerHTML = connections.length
      ? connections.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>No linked nodes</li>';

    const metadata = extractMetadata(node);
    this.metaEl.innerHTML = metadata.length
      ? metadata
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`)
        .join('')
      : '<li>No metadata available</li>';
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      this.hide();
    }
  }

  destroy() {
    this.hide();
    this.backdrop.remove();
  }
}
