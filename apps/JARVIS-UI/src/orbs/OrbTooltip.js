const SHOW_DELAY_MS = 60;
const HIDE_DELAY_MS = 80;
const PREVIEW_MAX_CHARS = 100;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readTimestamp(node) {
  const value = node?.timestamp || node?.createdAt || node?.date || node?.day;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString();
    }
    return value;
  }
  return 'Unknown time';
}

function readPreview(node) {
  const source = (
    node?.preview ||
    node?.summary ||
    node?.excerpt ||
    node?.content ||
    node?.body ||
    node?.description ||
    node?.title ||
    ''
  ).toString().trim();
  if (!source) {
    return 'No preview available.';
  }
  return source.length > PREVIEW_MAX_CHARS
    ? `${source.slice(0, PREVIEW_MAX_CHARS).trimEnd()}...`
    : source;
}

function readTitle(node) {
  return node?.title || node?.name || node?.id || 'Untitled node';
}

export class OrbTooltip {
  constructor(host) {
    this.host = host;
    this.showTimer = null;
    this.hideTimer = null;
    this.visible = false;
    this.node = null;

    this.element = document.createElement('aside');
    this.element.className = 'orb-tooltip';
    this.element.setAttribute('aria-hidden', 'true');
    this.host.append(this.element);
  }

  show(node, x, y) {
    this.node = node;
    this.render(node);
    this.move(x, y);
    window.clearTimeout(this.hideTimer);

    if (this.visible) {
      return;
    }

    window.clearTimeout(this.showTimer);
    this.showTimer = window.setTimeout(() => {
      this.visible = true;
      this.element.classList.add('orb-tooltip--visible');
      this.element.setAttribute('aria-hidden', 'false');
    }, SHOW_DELAY_MS);
  }

  move(x, y) {
    this.element.style.left = `${x + 14}px`;
    this.element.style.top = `${y + 14}px`;
  }

  hide() {
    window.clearTimeout(this.showTimer);
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.visible = false;
      this.node = null;
      this.element.classList.remove('orb-tooltip--visible');
      this.element.setAttribute('aria-hidden', 'true');
    }, HIDE_DELAY_MS);
  }

  render(node) {
    this.element.innerHTML = `
      <h3>${escapeHtml(readTitle(node))}</h3>
      <p class="orb-tooltip__timestamp">${escapeHtml(readTimestamp(node))}</p>
      <p>${escapeHtml(readPreview(node))}</p>
    `;
  }

  destroy() {
    window.clearTimeout(this.showTimer);
    window.clearTimeout(this.hideTimer);
    this.element.remove();
  }
}
