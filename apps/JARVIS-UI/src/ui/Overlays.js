export function createOverlays(host) {
  const frame = document.createElement('div');
  frame.className = 'cockpit-frame';
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
