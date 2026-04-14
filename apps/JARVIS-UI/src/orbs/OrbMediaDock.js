function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mediaKindFor(node) {
  const type = `${node?.type || ''}`.toLowerCase();
  const ext = `${node?.ext || ''}`.toLowerCase();
  if (type === 'audio' || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
    return 'audio';
  }
  if (type === 'image' || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
    return 'image';
  }
  return null;
}

export class OrbMediaDock {
  constructor(host, serverOrigin = window.location.origin) {
    this.host = host;
    this.serverOrigin = serverOrigin.replace(/\/$/, '');
    this.element = document.createElement('aside');
    this.element.className = 'orb-media-dock';
    this.element.setAttribute('aria-hidden', 'true');
    this.host.append(this.element);
  }

  show(node) {
    const kind = mediaKindFor(node);
    if (!kind || !node?.sourcePath) {
      this.hide();
      return;
    }
    const sourcePath = encodeURIComponent(node.sourcePath);
    const src = `${this.serverOrigin}/api/bootstrap/archive-file?sourcePath=${sourcePath}`;
    const title = escapeHtml(node?.title || node?.sourcePath || 'Archive media');

    if (kind === 'audio') {
      this.element.innerHTML = `
        <h3>${title}</h3>
        <audio controls autoplay preload="metadata" src="${src}"></audio>
      `;
    } else {
      this.element.innerHTML = `
        <h3>${title}</h3>
        <img src="${src}" alt="${title}" loading="lazy" />
      `;
    }
    this.element.classList.add('orb-media-dock--visible');
    this.element.setAttribute('aria-hidden', 'false');
  }

  hide() {
    const audio = this.element.querySelector('audio');
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    this.element.classList.remove('orb-media-dock--visible');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = '';
  }

  destroy() {
    this.hide();
    this.element.remove();
  }
}
