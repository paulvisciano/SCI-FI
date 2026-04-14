import * as THREE from 'three';
import { OrbTooltip } from './OrbTooltip.js';
import { OrbExpander } from './OrbExpander.js';
import { OrbMediaDock } from './OrbMediaDock.js';

function nodeContainerForObject(object3d) {
  let current = object3d;
  while (current) {
    if (current.userData?.node) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isMediaPreviewNode(node) {
  if (!node || node.kind !== 'raw-archive-node') {
    return false;
  }
  const type = `${node.type || ''}`.toLowerCase();
  return type === 'audio' || type === 'image';
}

export function attachOrbInteractions(canvas, eventBus, sceneManager, host, options = {}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tooltip = new OrbTooltip(host);
  const expander = new OrbExpander(host);
  const mediaDock = new OrbMediaDock(host, options.serverOrigin);
  let hoveredNodeContainer = null;

  const pickNodeAtEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, sceneManager.camera);
    const intersections = raycaster.intersectObjects(sceneManager.timelineNodeOrbs, true);
    if (!intersections.length) {
      return null;
    }
    return nodeContainerForObject(intersections[0].object);
  };

  const handleMove = (event) => {
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
    mediaDock.show(node);
  };

  const handleLeave = () => {
    hoveredNodeContainer = null;
    tooltip.hide();
    mediaDock.hide();
  };

  const handleClick = (event) => {
    const nodeContainer = pickNodeAtEvent(event) || hoveredNodeContainer;
    if (!nodeContainer) {
      return;
    }
    sceneManager.focusNodeOrb(nodeContainer);
    expander.show(nodeContainer.userData.node);
    eventBus.emit('orb:expand', { node: nodeContainer.userData.node });
  };

  canvas.addEventListener('pointermove', handleMove);
  canvas.addEventListener('pointerleave', handleLeave);
  canvas.addEventListener('click', handleClick);

  return () => {
    canvas.removeEventListener('pointermove', handleMove);
    canvas.removeEventListener('pointerleave', handleLeave);
    canvas.removeEventListener('click', handleClick);
    tooltip.destroy();
    expander.destroy();
    mediaDock.destroy();
  };
}
