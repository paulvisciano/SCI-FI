import * as THREE from 'three';
import { CameraController } from '../navigation/CameraController.js';
import { OrbFactory } from '../orbs/OrbFactory.js';
import { PerformanceMonitor } from '../utils/Performance.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030915);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    this.camera.position.set(0, 2, 9);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.performance = new PerformanceMonitor();
    this.clock = new THREE.Clock();
    this.cameraController = new CameraController(this.camera);

    this.neuroOrb = OrbFactory.createPrimaryOrb();
    this.timelineNodesGroup = null;
    this.timelineNodeOrbs = [];
    this.scene.add(this.neuroOrb);
    this.scene.add(OrbFactory.createAmbientParticles());
    this.addDefaultLights();
  }

  addDefaultLights() {
    this.scene.add(new THREE.AmbientLight(0x6ac8ff, 0.65));

    const key = new THREE.PointLight(0x42d8ff, 1.4, 100);
    key.position.set(5, 8, 6);
    this.scene.add(key);

    const rim = new THREE.PointLight(0x2f7bff, 0.8, 100);
    rim.position.set(-6, -2, -5);
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
      this.timelineNodeOrbs.push(orb);
      this.timelineNodesGroup.add(orb);
    }

    this.scene.add(this.timelineNodesGroup);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = this.clock.getDelta();
    this.cameraController.update(dt);
    OrbFactory.animatePrimaryOrb(this.neuroOrb, this.clock.elapsedTime);
    for (const nodeOrb of this.timelineNodeOrbs) {
      OrbFactory.updateTimelineNodeLod(nodeOrb, this.camera.position);
    }
    this.performance.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
