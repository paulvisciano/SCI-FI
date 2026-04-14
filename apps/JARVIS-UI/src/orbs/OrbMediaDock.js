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
    this.element = document.createElement('aside');
    this.element.className = 'orb-media-dock';
    this.element.setAttribute('aria-hidden', 'true');
    this.host.append(this.element);
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioData = null;
    this.waveformFrame = null;
    this.mediaSource = null;
  }

  show(node) {
    const kind = mediaKindFor(node);
    if (!kind) {
      this.hide();
      return;
    }
    const sourcePath = node?.sourcePath ? encodeURIComponent(node.sourcePath) : null;
    const src = sourcePath ? `${this.serverOrigin}/api/bootstrap/archive-file?sourcePath=${sourcePath}` : '';
    const title = escapeHtml(node?.title || node?.sourcePath || 'Archive media');

    if (kind === 'audio') {
      this.element.innerHTML = `
        <h3>${title}</h3>
        <canvas class="orb-media-dock__waveform" width="640" height="120" aria-hidden="true"></canvas>
        <audio controls preload="metadata" src="${src}"></audio>
      `;
      const audioEl = this.element.querySelector('audio');
      const waveformCanvas = this.element.querySelector('.orb-media-dock__waveform');
      if (audioEl) {
        audioEl.addEventListener('error', () => {
          this.element.innerHTML = `<h3>${title}</h3><p>Unable to load audio preview.</p>`;
        }, { once: true });
        if (waveformCanvas) {
          this.startWaveform(audioEl, waveformCanvas);
        }
        audioEl.play().catch(() => {
          // Autoplay can be blocked; controls remain available for manual play.
        });
      }
    } else if (kind === 'image') {
      this.element.innerHTML = `
        <h3>${title}</h3>
        <img src="${src}" alt="${title}" loading="lazy" />
      `;
      const imgEl = this.element.querySelector('img');
      if (imgEl) {
        imgEl.addEventListener('error', () => {
          this.element.innerHTML = `<h3>${title}</h3><p>Unable to load image preview.</p>`;
        }, { once: true });
      }
    } else {
      const preview = escapeHtml(`${node?.preview || node?.content || 'No text preview available.'}`);
      const response = `${node?.jarvisResponse || ''}`.trim();
      const responseHtml = response
        ? `<p class="orb-media-dock__response"><strong>Jarvis:</strong> ${escapeHtml(response)}</p>`
        : '';
      this.element.innerHTML = `
        <h3>${title}</h3>
        <p class="orb-media-dock__text">${preview}</p>
        ${responseHtml}
      `;
    }
    this.element.classList.add('orb-media-dock--visible');
    this.element.setAttribute('aria-hidden', 'false');
  }

  hide() {
    this.stopWaveform();
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
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.element.remove();
  }

  stopWaveform() {
    if (this.waveformFrame) {
      window.cancelAnimationFrame(this.waveformFrame);
      this.waveformFrame = null;
    }
    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }
    if (this.audioAnalyser) {
      this.audioAnalyser.disconnect();
      this.audioAnalyser = null;
    }
    this.audioData = null;
  }

  startWaveform(audioEl, canvas) {
    this.stopWaveform();
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    if (!this.audioContext) {
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    this.audioAnalyser = this.audioContext.createAnalyser();
    this.audioAnalyser.fftSize = 1024;
    this.audioData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    this.mediaSource = this.audioContext.createMediaElementSource(audioEl);
    this.mediaSource.connect(this.audioAnalyser);
    this.audioAnalyser.connect(this.audioContext.destination);

    const draw = () => {
      if (!this.audioAnalyser || !this.audioData) {
        return;
      }
      this.audioAnalyser.getByteTimeDomainData(this.audioData);
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(10, 20, 34, 0.92)';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(126, 223, 255, 0.95)';
      context.lineWidth = 2;
      context.beginPath();
      for (let i = 0; i < this.audioData.length; i += 1) {
        const x = (i / (this.audioData.length - 1)) * width;
        const y = (this.audioData[i] / 255) * height;
        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
      this.waveformFrame = window.requestAnimationFrame(draw);
    };
    draw();
  }
}
