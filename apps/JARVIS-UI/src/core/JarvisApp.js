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
import { iconForStream } from '../utils/Icons.js';

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
    this.overlay = createOverlays(this.host);
    this.panels = createPanels(this.host, this.eventBus);
    this.gatewayInspector = createGatewayInspector(this.host, {
      serverOrigin: this.loader.serverOrigin
    });
    this.stopInteractions = attachOrbInteractions(this.canvas, this.eventBus, this.sceneManager, this.host);

    window.addEventListener('resize', () => this.sceneManager.resize());
  }

  async start() {
    const nodes = await this.loader.loadBootstrap((snapshot) => {
      if (!snapshot || !snapshot.message) {
        return;
      }
      const progress = Number.isFinite(snapshot.progress) ? `${snapshot.progress}%` : '';
      const count = Number.isFinite(snapshot.nodeCount) && snapshot.nodeCount > 0
        ? ` · ${snapshot.nodeCount} nodes`
        : '';
      this.overlay.setStatus(`${snapshot.message}${progress ? ` (${progress})` : ''}${count}`);
    });
    const layout = this.streamLayout.layout(nodes);
    const positionedNodes = layout.nodes;
    const streams = this.streamAssigner.assign(positionedNodes);
    this.sceneManager.setTimelineNodes(positionedNodes);
    this.panels.setStreamSummary(
      streams.map((stream) => `${iconForStream(stream.name)} ${stream.name}: ${stream.nodes.length}`).join(' | ')
    );
    this.overlay.setStatus(
      `Vite + modular scene online · ${positionedNodes.length} nodes · left ${layout.meta.leftCount} / right ${layout.meta.rightCount}`
    );
    this.loop();
  }

  loop() {
    this.sceneManager.render();
    this.nav.update(this.lodPolicy.distanceFor(this.sceneManager.camera.position.length()));
    this.raf = window.requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.stopInteractions();
    this.nav.destroy();
    this.gatewayInspector.destroy();
    window.cancelAnimationFrame(this.raf);
  }
}
