function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mediaKindFor(node) {
  const type = `${node?.type || node?.kind || ''}`.toLowerCase();
  const ext = `${node?.ext || ''}`.toLowerCase();
  if (type === 'audio' || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
    return 'audio';
  }
  if (type === 'image' || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
    return 'image';
  }
  if (type === 'document' || type === 'conversation' || type === 'text' || type === 'voice-live-node') {
    return 'text';
  }
  if (`${node?.preview || node?.content || ''}`.trim()) {
    return 'text';
  }
  return null;
}

export class OrbMediaDock {
  constructor(host, serverOrigin = window.location.origin) {
    this.host = host;
    this.serverOrigin = serverOrigin.replace(/\/$/, '');
    this.currentNode = null;
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioData = null;
    this.waveformFrame = null;
    this.mediaSource = null;

    // ── Minimized hover card ──────────────────────────────────────────────
    this.element = document.createElement('aside');
    this.element.className = 'orb-media-dock';
    this.element.setAttribute('aria-hidden', 'true');
    this.host.append(this.element);

    // ── Maximized overlay ─────────────────────────────────────────────────
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'orb-media-expanded-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.host.append(this.backdrop);

    this.expandedEl = document.createElement('div');
    this.expandedEl.className = 'orb-media-expanded';
    this.expandedEl.setAttribute('aria-hidden', 'true');
    this.host.append(this.expandedEl);

    this.backdrop.addEventListener('click', () => this.collapse());
  }

  get isVisible() {
    return this.element.classList.contains('orb-media-dock--visible');
  }

  // ── Hover: compact corner card ────────────────────────────────────────────
  show(node, screenX, screenY) {
    const kind = mediaKindFor(node);
    if (!kind) { this.hide(); return; }

    this.currentNode = node;
    const src = this._src(node);
    const title = escapeHtml(node?.title || node?.sourcePath || 'Archive media');

    if (kind === 'image') {
      this.element.innerHTML = `
        <img src="${src}" alt="${title}" loading="lazy" />
        <div class="orb-media-dock__footer">
          <h3>${title}</h3>
          <span class="orb-media-dock__hint">click to expand</span>
        </div>`;
      const img = this.element.querySelector('img');
      if (img) {
        img.addEventListener('error', () => {
          this.element.innerHTML = `<div class="orb-media-dock__footer"><h3>${title}</h3><p>Preview unavailable</p></div>`;
        }, { once: true });
      }
    } else if (kind === 'audio') {
      this.element.innerHTML = `
        <div class="orb-media-dock__footer">
          <h3>${title}</h3>
          <span class="orb-media-dock__hint">click to play</span>
        </div>`;
    } else {
      const preview = escapeHtml(`${node?.preview || node?.content || ''}`.trim().slice(0, 140));
      const ellipsis = (node?.preview || node?.content || '').length > 140 ? '…' : '';
      this.element.innerHTML = `
        <div class="orb-media-dock__footer">
          <h3>${title}</h3>
          <p class="orb-media-dock__preview-text">${preview}${ellipsis}</p>
          <span class="orb-media-dock__hint">click to expand</span>
        </div>`;
    }

    this._positionCorner(screenX, screenY);
    this.element.classList.add('orb-media-dock--visible');
    this.element.setAttribute('aria-hidden', 'false');
  }

  // ── Click: full centered overlay ──────────────────────────────────────────
  maximize(node) {
    const kind = mediaKindFor(node);
    if (!kind) { return; }

    this.currentNode = node;
    const src = this._src(node);
    const title = escapeHtml(node?.title || node?.sourcePath || 'Archive media');
    this.stopWaveform();

    let bodyHtml = '';
    if (kind === 'image') {
      bodyHtml = `<img src="${src}" alt="${title}" class="orb-media-expanded__img" />`;
    } else if (kind === 'audio') {
      bodyHtml = `
        <canvas class="orb-media-dock__waveform" width="800" height="140" aria-hidden="true"></canvas>
        <audio controls preload="auto" src="${src}" class="orb-media-expanded__audio"></audio>`;
    } else {
      const full = escapeHtml(`${node?.preview || node?.content || 'No content available.'}`);
      const response = `${node?.jarvisResponse || ''}`.trim();
      const respHtml = response
        ? `<div class="orb-media-expanded__response"><strong>Jarvis</strong><p>${escapeHtml(response)}</p></div>`
        : '';
      bodyHtml = `<p class="orb-media-expanded__text">${full}</p>${respHtml}`;
    }

    this.expandedEl.innerHTML = `
      <div class="orb-media-expanded__header">
        <h2>${title}</h2>
        <button class="orb-media-expanded__close" aria-label="Close">✕</button>
      </div>
      <div class="orb-media-expanded__body">${bodyHtml}</div>`;

    this.expandedEl.querySelector('.orb-media-expanded__close')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this.collapse(); });

    if (kind === 'audio') {
      const audioEl = this.expandedEl.querySelector('audio');
      const waveformCanvas = this.expandedEl.querySelector('.orb-media-dock__waveform');
      if (audioEl && waveformCanvas) {
        this.startWaveform(audioEl, waveformCanvas);
        audioEl.play().catch(() => {});
      }
    }

    this.backdrop.setAttribute('aria-hidden', 'false');
    this.expandedEl.setAttribute('aria-hidden', 'false');
    this.backdrop.classList.add('orb-media-expanded-backdrop--visible');
    this.expandedEl.classList.add('orb-media-expanded--visible');
  }

  collapse() {
    this.stopWaveform();
    const audio = this.expandedEl.querySelector('audio');
    if (audio) { audio.pause(); audio.src = ''; }
    this.backdrop.classList.remove('orb-media-expanded-backdrop--visible');
    this.expandedEl.classList.remove('orb-media-expanded--visible');
    this.backdrop.setAttribute('aria-hidden', 'true');
    this.expandedEl.setAttribute('aria-hidden', 'true');
    this.expandedEl.innerHTML = '';
  }

  hide() {
    this.collapse();
    const audio = this.element.querySelector('audio');
    if (audio) { audio.pause(); audio.src = ''; }
    this.element.classList.remove('orb-media-dock--visible');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = '';
    this.currentNode = null;
  }

  destroy() {
    this.hide();
    if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
    this.element.remove();
    this.backdrop.remove();
    this.expandedEl.remove();
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  _src(node) {
    const sp = node?.sourcePath ? encodeURIComponent(node.sourcePath) : null;
    return sp ? `${this.serverOrigin}/api/bootstrap/archive-file?sourcePath=${sp}` : '';
  }

  // Position in the screen corner OPPOSITE to where the node is,
  // so the card is always fully on screen and visually separate.
  _positionCorner(screenX, screenY) {
    const pad = 16;
    const w = 284;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = screenX > vw / 2 ? pad : vw - w - pad;
    const y = screenY > vh / 2 ? pad + 8 : vh - 250 - pad;
    this.element.style.left  = `${x}px`;
    this.element.style.top   = `${y}px`;
    this.element.style.width = `${w}px`;
  }

  stopWaveform() {
    if (this.waveformFrame) { cancelAnimationFrame(this.waveformFrame); this.waveformFrame = null; }
    if (this.mediaSource) { this.mediaSource.disconnect(); this.mediaSource = null; }
    if (this.audioAnalyser) { this.audioAnalyser.disconnect(); this.audioAnalyser = null; }
    this.audioData = null;
  }

  startWaveform(audioEl, canvas) {
    this.stopWaveform();
    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { return; }
    if (!this.audioContext) { this.audioContext = new AudioCtx(); }
    if (this.audioContext.state === 'suspended') { this.audioContext.resume().catch(() => {}); }
    this.audioAnalyser = this.audioContext.createAnalyser();
    this.audioAnalyser.fftSize = 1024;
    this.audioData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    this.mediaSource = this.audioContext.createMediaElementSource(audioEl);
    this.mediaSource.connect(this.audioAnalyser);
    this.audioAnalyser.connect(this.audioContext.destination);
    const draw = () => {
      if (!this.audioAnalyser || !this.audioData) { return; }
      this.audioAnalyser.getByteTimeDomainData(this.audioData);
      const { width, height } = canvas;
      ctx.fillStyle = 'rgba(6, 14, 26, 0.92)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(126, 223, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < this.audioData.length; i += 1) {
        const x = (i / (this.audioData.length - 1)) * width;
        const y = (this.audioData[i] / 255) * height;
        if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
      this.waveformFrame = requestAnimationFrame(draw);
    };
    draw();
  }
}
