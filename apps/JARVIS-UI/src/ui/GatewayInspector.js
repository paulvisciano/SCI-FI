const TOOL_CALL_LIMIT = 60;
const SESSION_EVENT_LIMIT = 40;
const POLL_INTERVAL_MS = 4000;

function formatJson(value) {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function limitNewest(items, limit) {
  return items.slice(Math.max(0, items.length - limit));
}

function inferInput(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'input')) {
    return payload.input;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'args')) {
    return payload.args;
  }
  return payload;
}

function inferOutput(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'output')) {
    return payload.output;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'result')) {
    return payload.result;
  }
  return null;
}

export function createGatewayInspector(host, options = {}) {
  const serverOrigin = (options.serverOrigin || window.location.origin).replace(/\/$/, '');
  const container = options.container || host;
  const panel = document.createElement('section');
  panel.className = `gateway-inspector${container !== host ? ' gateway-inspector--embedded' : ''}`;
  panel.innerHTML = `
    <button type="button" class="gateway-inspector__toggle" aria-expanded="false">
      <span>Gateway Inspector</span>
      <span class="gateway-inspector__chevron">+</span>
    </button>
    <div class="gateway-inspector__body" hidden>
      <div class="gateway-inspector__status">
        <strong id="gateway-inspector-phase">Idle</strong>
        <span id="gateway-inspector-meta">Awaiting connection...</span>
      </div>
      <label class="gateway-inspector__search">
        <span>Filter tools</span>
        <input id="gateway-inspector-filter" type="search" placeholder="tool name..." autocomplete="off" />
      </label>
      <div class="gateway-inspector__columns">
        <div>
          <h2>Tool Calls</h2>
          <div id="gateway-inspector-tools" class="gateway-inspector__list"></div>
        </div>
        <div>
          <h2>Session Events</h2>
          <div id="gateway-inspector-events" class="gateway-inspector__list"></div>
        </div>
      </div>
    </div>
  `;
  container.append(panel);

  const toggleButton = panel.querySelector('.gateway-inspector__toggle');
  const body = panel.querySelector('.gateway-inspector__body');
  const chevron = panel.querySelector('.gateway-inspector__chevron');
  const phaseEl = panel.querySelector('#gateway-inspector-phase');
  const metaEl = panel.querySelector('#gateway-inspector-meta');
  const filterInput = panel.querySelector('#gateway-inspector-filter');
  const toolsEl = panel.querySelector('#gateway-inspector-tools');
  const eventsEl = panel.querySelector('#gateway-inspector-events');

  let expanded = false;
  let currentPhase = 'idle';
  let currentProgress = 0;
  let currentMessage = 'Awaiting data';
  let toolCalls = [];
  let sessionEvents = [];
  let eventSource = null;
  let pollTimer = null;

  function addSessionEvent(name, detail = '') {
    sessionEvents = limitNewest(
      [...sessionEvents, { id: `evt-${Date.now()}-${Math.random()}`, name, detail, at: new Date().toISOString() }],
      SESSION_EVENT_LIMIT
    );
  }

  function syncToolCalls(calls) {
    if (!Array.isArray(calls)) {
      return;
    }
    const normalized = calls
      .filter((call) => call && typeof call === 'object')
      .map((call) => ({
        id: call.id || `tool-${call.name || 'unknown'}-${call.at || Date.now()}`,
        name: call.name || 'unknown',
        payload: call.payload ?? null,
        at: call.at || new Date().toISOString()
      }));
    toolCalls = limitNewest(normalized, TOOL_CALL_LIMIT);
  }

  function render() {
    if (!expanded) {
      return;
    }

    const progressSuffix = Number.isFinite(currentProgress) ? ` (${currentProgress}%)` : '';
    phaseEl.textContent = `${currentPhase || 'idle'}${progressSuffix}`;
    metaEl.textContent = currentMessage || 'No status message';

    const filter = (filterInput.value || '').trim().toLowerCase();
    const visibleCalls = toolCalls
      .filter((call) => call.name.toLowerCase().includes(filter))
      .slice()
      .reverse();

    if (visibleCalls.length === 0) {
      toolsEl.innerHTML = '<p class="gateway-inspector__empty">No tool calls match the current filter.</p>';
    } else {
      toolsEl.innerHTML = visibleCalls.map((call) => {
        const input = formatJson(inferInput(call.payload));
        const outputValue = inferOutput(call.payload);
        const output = outputValue === null ? 'No output captured for this call yet.' : formatJson(outputValue);
        return `
          <details class="gateway-inspector__item">
            <summary>
              <strong>${call.name}</strong>
              <span>${new Date(call.at).toLocaleTimeString()}</span>
            </summary>
            <div class="gateway-inspector__io">
              <h3>Input</h3>
              <pre>${input}</pre>
              <h3>Output</h3>
              <pre>${output}</pre>
            </div>
          </details>
        `;
      }).join('');
    }

    const visibleEvents = sessionEvents.slice().reverse();
    if (visibleEvents.length === 0) {
      eventsEl.innerHTML = '<p class="gateway-inspector__empty">No session events yet.</p>';
    } else {
      eventsEl.innerHTML = visibleEvents.map((event) => `
        <article class="gateway-inspector__event">
          <strong>${event.name}</strong>
          <span>${new Date(event.at).toLocaleTimeString()}</span>
          ${event.detail ? `<p>${event.detail}</p>` : ''}
        </article>
      `).join('');
    }
  }

  function applySnapshot(snapshot, sourceLabel) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    currentPhase = snapshot.phase || currentPhase;
    currentProgress = Number.isFinite(snapshot.progress) ? snapshot.progress : currentProgress;
    currentMessage = snapshot.message || currentMessage;
    syncToolCalls(snapshot.toolCalls);
    addSessionEvent(sourceLabel, `${snapshot.phase || 'unknown'} (${snapshot.progress ?? 'n/a'}%)`);
    render();
  }

  async function pollStatus() {
    try {
      const response = await fetch(`${serverOrigin}/api/bootstrap/status`);
      if (!response.ok) {
        throw new Error(`Status request failed (${response.status})`);
      }
      const snapshot = await response.json();
      applySnapshot(snapshot, 'poll:update');
    } catch (error) {
      addSessionEvent('poll:error', error.message);
      render();
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function connect() {
    disconnect();
    addSessionEvent('session:connect', 'Listening for bootstrap events');
    render();

    eventSource = new EventSource(`${serverOrigin}/api/bootstrap/events`);
    eventSource.addEventListener('open', () => {
      addSessionEvent('session:open', 'Gateway stream connected');
      render();
    });
    eventSource.addEventListener('error', () => {
      addSessionEvent('session:error', 'Gateway stream dropped; polling fallback is active');
      render();
    });
    ['bootstrap:snapshot', 'bootstrap:update', 'bootstrap:ready', 'bootstrap:error'].forEach((eventName) => {
      eventSource.addEventListener(eventName, (event) => {
        try {
          const snapshot = JSON.parse(event.data);
          applySnapshot(snapshot, eventName);
        } catch (_) {
          addSessionEvent('parse:error', `Failed to parse ${eventName}`);
          render();
        }
      });
    });

    pollStatus();
    pollTimer = window.setInterval(() => {
      pollStatus();
    }, POLL_INTERVAL_MS);
  }

  toggleButton.addEventListener('click', () => {
    expanded = !expanded;
    body.hidden = !expanded;
    toggleButton.setAttribute('aria-expanded', String(expanded));
    chevron.textContent = expanded ? '−' : '+';
    if (expanded) {
      connect();
      render();
    } else {
      disconnect();
    }
  });

  filterInput.addEventListener('input', () => {
    render();
  });

  return {
    destroy() {
      disconnect();
      panel.remove();
    }
  };
}
