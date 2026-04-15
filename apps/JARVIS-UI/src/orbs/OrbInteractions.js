import * as THREE from 'three';
import { OrbTooltip } from './OrbTooltip.js';
import { OrbExpander } from './OrbExpander.js';
import { OrbMediaDock } from './OrbMediaDock.js';

function nodeContainerForObject(object3d) {
  let current = object3d;
  while (current) {
    if (current.userData?.node) { return current; }
    current = current.parent;
  }
  return null;
}

function isMediaPreviewNode(node) {
  if (!node) { return false; }
  if (node.kind === 'voice-live-node') { return true; }
  if (node.kind !== 'raw-archive-node') { return false; }
  const type = `${node.type || ''}`.toLowerCase();
  return type === 'audio' || type === 'image' || type === 'document' || type === 'conversation';
}

function screenPosOf(nodeContainer, camera, canvas) {
  const v = nodeContainer.position.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: (v.x + 1) / 2 * rect.width + rect.left,
    y: -(v.y - 1) / 2 * rect.height + rect.top,
  };
}

export function attachOrbInteractions(canvas, eventBus, sceneManager, host, options = {}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tooltip = new OrbTooltip(host);
  const expander = new OrbExpander(host);
  const mediaDock = new OrbMediaDock(host, options.serverOrigin);

  let hoveredNodeContainer = null;
  let pointerDownAt = null;
  let clickTimer = null; // debounce: cancel if second click arrives (double-click)

  const pickNodeAtEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, sceneManager.camera);
    const hits = raycaster.intersectObjects(sceneManager.timelineNodeOrbs, true);
    return hits.length ? nodeContainerForObject(hits[0].object) : null;
  };

  const handlePointerDown = (event) => {
    if (event.button === 0) {
      pointerDownAt = { x: event.clientX, y: event.clientY };
    }
  };

  const handleMove = (event) => {
    // While button is held, suppress overlays but preserve hover state for upcoming click
    if (event.buttons === 1) {
      tooltip.hide();
      return;
    }

    const x = (event.clientX / window.innerWidth).toFixed(3);
    const y = (event.clientY / window.innerHeight).toFixed(3);
    eventBus.emit('orb:hover', { x, y });

    const nodeContainer = pickNodeAtEvent(event);
    if (!nodeContainer) {
      hoveredNodeContainer = null;
      tooltip.hide();
      mediaDock.hide();
      return;
    }

    hoveredNodeContainer = nodeContainer;
    const node = nodeContainer.userData.node;
    if (isMediaPreviewNode(node)) {
      tooltip.hide();
    } else {
      tooltip.show(node, event.clientX, event.clientY);
    }
    const sp = screenPosOf(nodeContainer, sceneManager.camera, canvas);
    mediaDock.show(node, sp.x, sp.y);
  };

  const handleLeave = () => {
    hoveredNodeContainer = null;
    tooltip.hide();
    mediaDock.hide();
  };

  const handleClick = (event) => {
    // Ignore drags
    if (pointerDownAt) {
      const dist = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
      pointerDownAt = null;
      if (dist > 6) { return; }
    }

    const nodeContainer = pickNodeAtEvent(event) || hoveredNodeContainer;
    if (!nodeContainer) { return; }

    // Debounce: wait 220 ms to see if a second click arrives (double-click).
    // If it does, the dblclick handler cancels this timer so we don't expand.
    if (clickTimer) { clearTimeout(clickTimer); }
    const capturedContainer = nodeContainer;
    clickTimer = setTimeout(() => {
      clickTimer = null;
      const node = capturedContainer.userData.node;
      eventBus.emit('orb:expand', { node });
      if (hoveredNodeContainer === capturedContainer || isMediaPreviewNode(node)) {
        mediaDock.maximize(node);
        return;
      }
      sceneManager.focusNodeOrb(capturedContainer);
      expander.show(node);
    }, 220);
  };

  // Cancel pending single-click action when a double-click is detected
  const handleDblClick = () => {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handleMove);
  canvas.addEventListener('pointerleave', handleLeave);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('dblclick', handleDblClick);

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handleMove);
    canvas.removeEventListener('pointerleave', handleLeave);
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('dblclick', handleDblClick);
    if (clickTimer) { clearTimeout(clickTimer); }
    tooltip.destroy();
    expander.destroy();
    mediaDock.destroy();
  };
}
