export function createOverlays(host) {
  const shell = document.createElement('div');
  shell.className = 'jarvis-overlay';
  shell.innerHTML = `
    <h1>J.A.R.V.I.S Neural Core</h1>
    <p id="jarvis-overlay-status">Booting...</p>
  `;
  host.append(shell);

  const statusEl = shell.querySelector('#jarvis-overlay-status');

  return {
    setStatus(status) {
      statusEl.textContent = status;
    },
  };
}
