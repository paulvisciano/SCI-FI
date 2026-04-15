import * as THREE from 'three';
import { CameraController } from '../navigation/CameraController.js';
import { OrbFactory } from '../orbs/OrbFactory.js';
import { PerformanceMonitor } from '../utils/Performance.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020508);
    this.scene.fog = new THREE.FogExp2(0x020508, 0.010);

    this.camera = new THREE.PerspectiveCamera(82, 1, 0.1, 1000);
    this.camera.position.set(0, -0.4, 2.8);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.performance = new PerformanceMonitor();
    this.clock = new THREE.Clock();
    this.cameraController = new CameraController(this.camera);

    this.neuroOrb = null; // Orb lives in its own dedicated renderer (OrbVideoRenderer)
    this.timelineNodesGroup = null;
    this.timelineNodeOrbs = [];
    this.scene.add(OrbFactory.createAmbientParticles());
    this.addDefaultLights();
  }

  addDefaultLights() {
    this.scene.add(new THREE.AmbientLight(0x8bcfff, 0.82));
    this.scene.add(new THREE.HemisphereLight(0x7fd5ff, 0x080d18, 0.72));

    const key = new THREE.PointLight(0x42d8ff, 1.8, 120);
    key.position.set(4, 7, 6);
    this.scene.add(key);

    const warmFill = new THREE.PointLight(0xffa533, 1.6, 180);
    warmFill.position.set(9, 2, -6);
    this.scene.add(warmFill);

    const rim = new THREE.PointLight(0x2f7bff, 1.15, 100);
    rim.position.set(-6, -2, -6);
    this.scene.add(rim);
  }


  setTimelineNodes(nodes) {
    if (this.timelineNodesGroup) {
      this.scene.remove(this.timelineNodesGroup);
      this.timelineNodeOrbs = [];
      this.timelineNodesGroup = null;
    }

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return;
    }

    this.timelineNodesGroup = new THREE.Group();
    this.timelineNodesGroup.name = 'jarvis-timeline-orbs';

    for (const node of nodes) {
      const pos = node.position || { x: 0, y: 0, z: 0 };
      const orb = OrbFactory.createTimelineNodeOrb(node);
      orb.position.set(pos.x, pos.y, pos.z);
      orb.userData.floatPhase = Math.random() * Math.PI * 2;
      orb.userData.baseY = pos.y;
      this.timelineNodeOrbs.push(orb);
      this.timelineNodesGroup.add(orb);
    }

    this.scene.add(this.timelineNodesGroup);
  }

  focusNodeOrb(nodeOrb) {
    if (!nodeOrb) {
      return;
    }
    const focusOffset = new THREE.Vector3(0, 1.15, 4.8);
    const targetCameraPosition = nodeOrb.position.clone().add(focusOffset);
    this.cameraController.flyToNode(targetCameraPosition);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    this.cameraController.update(dt);
    for (const nodeOrb of this.timelineNodeOrbs) {
      if (typeof nodeOrb.userData.baseY === 'number') {
        nodeOrb.position.y = nodeOrb.userData.baseY + Math.sin(elapsed * 0.8 + nodeOrb.userData.floatPhase) * 0.11;
      }
      OrbFactory.updateTimelineNodeLod(nodeOrb, this.camera.position, elapsed);
    }
    this.performance.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
