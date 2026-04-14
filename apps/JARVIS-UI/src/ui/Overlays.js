export function createOverlays(host) {
  const riverFallback = document.createElement('div');
  riverFallback.className = 'river-visual-fallback';
  riverFallback.innerHTML = `
    <div class="river-visual-fallback__lane river-visual-fallback__lane--left" aria-hidden="true"></div>
    <div class="river-visual-fallback__lane river-visual-fallback__lane--right" aria-hidden="true"></div>
  `;
  host.append(riverFallback);

  const frame = document.createElement('div');
  frame.className = 'cockpit-frame';
  frame.innerHTML = `
    <div class="cockpit-frame__top" aria-hidden="true"></div>
    <div class="cockpit-frame__left" aria-hidden="true"></div>
    <div class="cockpit-frame__right" aria-hidden="true"></div>
    <div class="cockpit-frame__deck" aria-hidden="true"></div>
  `;
  host.append(frame);

  const shell = document.createElement('div');
  shell.className = 'jarvis-overlay jarvis-overlay--system';
  shell.innerHTML = `
    <h1>J.A.R.V.I.S Timeline</h1>
    <p id="jarvis-overlay-status">Booting...</p>
    <p id="jarvis-voice-status" class="jarvis-overlay__voice" aria-live="polite"></p>
    <p class="jarvis-overlay__hint">Scroll/Pinch = depth travel · Drag = strafe · Click node = focus</p>
  `;
  host.append(shell);

  const rightHud = document.createElement('aside');
  rightHud.className = 'river-side-hud';
  rightHud.innerHTML = `
    <div class="river-side-hud__controls" aria-label="Timeline controls">
      <span>TIME</span>
      <span>ANCHOR</span>
      <span>FLOW</span>
    </div>
    <p class="river-side-hud__title">River of Time</p>
    <p class="river-side-hud__subtitle">One anchor per day · memory aligned in depth</p>
    <div class="river-side-hud__preview" role="img" aria-label="Memory preview image"></div>
  `;
  host.append(rightHud);

  const pilotHud = document.createElement('div');
  pilotHud.className = 'pilot-orb-hud';
  pilotHud.innerHTML = `
    <button type="button" class="pilot-orb-hud__orb" id="jarvis-pilot-orb" aria-label="Jarvis voice orb"></button>
    <p id="jarvis-pilot-hint">Jarvis · Press Spacebar to talk</p>
  `;
  host.append(pilotHud);

  const statusEl = shell.querySelector('#jarvis-overlay-status');
  const voiceStatusEl = shell.querySelector('#jarvis-voice-status');
  const pilotOrbEl = pilotHud.querySelector('#jarvis-pilot-orb');
  const pilotHintEl = pilotHud.querySelector('#jarvis-pilot-hint');

  return {
    setStatus(status) {
      statusEl.textContent = status;
    },
    setVoiceStatus(text) {
      voiceStatusEl.textContent = text || '';
    },
    pilotHud,
    pilotOrbEl,
    pilotHintEl,
  };
}
