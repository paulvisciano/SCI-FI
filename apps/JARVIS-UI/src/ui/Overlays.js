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

  const pilotHud = document.createElement('div');
  pilotHud.className = 'pilot-orb-hud';
  pilotHud.innerHTML = `
    <button type="button" class="pilot-orb-hud__orb" id="jarvis-pilot-orb" aria-label="Jarvis voice orb"></button>
    <p id="jarvis-pilot-hint">Jarvis · Press Spacebar to talk</p>
  `;
  host.append(pilotHud);

  const pilotOrbEl = pilotHud.querySelector('#jarvis-pilot-orb');
  const pilotHintEl = pilotHud.querySelector('#jarvis-pilot-hint');

  return {
    pilotHud,
    pilotOrbEl,
    pilotHintEl,
  };
}
