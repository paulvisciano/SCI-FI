import { EventBus } from './EventBus.js';
import { SceneManager } from './SceneManager.js';
import { JarvisNavAPI } from '../navigation/JarvisNavAPI.js';
import { attachOrbInteractions } from '../orbs/OrbInteractions.js';
import { NeurographLoader } from '../data/NeurographLoader.js';
import { StreamAssigner } from '../data/StreamAssigner.js';
import { StreamLayout } from '../data/StreamLayout.js';
import { createPanels } from '../ui/Panels.js';
import { createOverlays } from '../ui/Overlays.js';
import { createGatewayInspector } from '../ui/GatewayInspector.js';
import { createLodPolicy } from '../utils/LOD.js';
import { attachPilotVoiceRecorder } from '../voice/PilotVoiceRecorder.js';

export class JarvisApp {
  constructor(host) {
    this.host = host;
    this.eventBus = new EventBus();

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'jarvis-canvas';
    this.host.append(this.canvas);

    this.sceneManager = new SceneManager(this.canvas);
    this.nav = new JarvisNavAPI(this.sceneManager.cameraController);
    this.loader = new NeurographLoader();
    this.streamAssigner = new StreamAssigner();
    this.streamLayout = new StreamLayout();
    this.lodPolicy = createLodPolicy();
    this.panels = createPanels(this.host, this.eventBus);
    this.overlay = createOverlays(this.host);
    this.gatewayInspector = createGatewayInspector(this.host, {
      serverOrigin: this.loader.serverOrigin
    });
    this.stopInteractions = attachOrbInteractions(this.canvas, this.eventBus, this.sceneManager, this.host, {
      serverOrigin: this.loader.serverOrigin,
    });
    this.windowDays = 7;
    this.offsetDays = 0;
    this.hasMoreHistory = true;
    this.loadingMoreHistory = false;
    this.loadedNodeMap = new Map();

    this.stopVoiceRecorder = attachPilotVoiceRecorder({
      apiBase: this.loader.serverOrigin,
      pilotHud: this.overlay.pilotHud,
      pilotOrbEl: this.overlay.pilotOrbEl,
      pilotHintEl: this.overlay.pilotHintEl,
      setVoiceStatus: (text) => this.panels.setVoiceStatus(text),
    });

    window.addEventListener('resize', () => this.sceneManager.resize());
  }

  async start() {
    const payload = await this.loader.loadBootstrap((snapshot) => {
      if (!snapshot || !snapshot.message) {
        return;
      }
      const progress = Number.isFinite(snapshot.progress) ? `${snapshot.progress}%` : '';
      const count = Number.isFinite(snapshot.nodeCount) && snapshot.nodeCount > 0
        ? ` · ${snapshot.nodeCount} nodes`
        : '';
      this.panels.setStatus(`${snapshot.message}${progress ? ` (${progress})` : ''}${count}`);
    });
    const initialNodes = this.onlyTimelineNodes(payload?.nodes || []);
    this.hasMoreHistory = Boolean(payload?.meta?.window?.hasMore);
    this.offsetDays = this.windowDays;
    this.mergeNodes(initialNodes);
    this.refreshScene();
    this.loop();
  }

  loop() {
    this.sceneManager.render();
    this.nav.update(this.lodPolicy.distanceFor(this.sceneManager.camera.position.length()));
    this.maybeLoadMoreHistory();
    this.raf = window.requestAnimationFrame(() => this.loop());
  }

  onlyTimelineNodes(nodes) {
    return nodes.filter((node) => {
      if (node.kind === 'day-anchor') {
        return true;
      }
      if (node.kind === 'commit-satellite') {
        return true;
      }
      return node.kind === 'raw-archive-node';
    });
  }

  mergeNodes(nodes) {
    for (const node of nodes) {
      if (!node || !node.id) {
        continue;
      }
      this.loadedNodeMap.set(node.id, node);
    }
  }

  refreshScene() {
    const allNodes = [...this.loadedNodeMap.values()];
    const layout = this.streamLayout.layout(allNodes);
    const positionedNodes = layout.nodes;
    const streams = this.streamAssigner.assign(positionedNodes);
    if (positionedNodes.length) {
      const zValues = positionedNodes.map((node) => node?.position?.z).filter((z) => Number.isFinite(z));
      if (zValues.length) {
        const minZ = Math.min(...zValues);
        const maxZ = Math.max(...zValues);
        const padding = 10;
        this.sceneManager.cameraController.setDepthBounds(minZ - padding, Math.max(maxZ + padding, 18));
      }
    }
    this.sceneManager.setTimelineNodes(positionedNodes);
    this.panels.setStreamSummary(streams, layout.meta);
    this.panels.setStatus(
      `Vite + modular scene online · ${positionedNodes.length} nodes · left ${layout.meta.leftCount} / right ${layout.meta.rightCount}`
    );
  }

  async maybeLoadMoreHistory() {
    if (!this.hasMoreHistory || this.loadingMoreHistory) {
      return;
    }
    const depthMin = this.sceneManager.cameraController.depthBounds?.min;
    const currentZ = this.sceneManager.camera.position.z;
    if (!Number.isFinite(depthMin) || !Number.isFinite(currentZ)) {
      return;
    }
    if (currentZ > depthMin + 16) {
      return;
    }
    this.loadingMoreHistory = true;
    try {
      const payload = await this.loader.loadBootstrap(() => {}, {
        offsetDays: this.offsetDays,
        windowDays: this.windowDays,
      });
      const nodes = this.onlyTimelineNodes(payload?.nodes || []);
      if (nodes.length > 0) {
        this.mergeNodes(nodes);
        this.refreshScene();
      }
      this.hasMoreHistory = Boolean(payload?.meta?.window?.hasMore);
      this.offsetDays += this.windowDays;
    } finally {
      this.loadingMoreHistory = false;
    }
  }

  destroy() {
    this.stopInteractions();
    if (this.stopVoiceRecorder) {
      this.stopVoiceRecorder();
    }
    this.nav.destroy();
    this.gatewayInspector.destroy();
    window.cancelAnimationFrame(this.raf);
  }
}
