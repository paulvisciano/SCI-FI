import * as THREE from 'three';
import { CameraController } from '../navigation/CameraController.js';
import { OrbFactory } from '../orbs/OrbFactory.js';
import { PerformanceMonitor } from '../utils/Performance.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030915);
    this.scene.fog = new THREE.FogExp2(0x030915, 0.012);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1000);
    this.camera.position.set(0, 1.2, 7.2);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.performance = new PerformanceMonitor();
    this.clock = new THREE.Clock();
    this.cameraController = new CameraController(this.camera);

    this.neuroOrb = OrbFactory.createPrimaryOrb();
    this.neuroOrb.scale.setScalar(0.9);
    this.hudOrbOffset = new THREE.Vector3(0, -1.2, -3.08);
    this.timelineNodesGroup = null;
    this.timelineNodeOrbs = [];
    this.scene.add(this.neuroOrb);
    this.scene.add(OrbFactory.createAmbientParticles());
    this.addDefaultLights();
    this.addRiverGuides();
  }

  addDefaultLights() {
    this.scene.add(new THREE.AmbientLight(0x8bcfff, 0.82));
    this.scene.add(new THREE.HemisphereLight(0x7fd5ff, 0x080d18, 0.72));

    const key = new THREE.PointLight(0x42d8ff, 1.8, 120);
    key.position.set(4, 7, 6);
    this.scene.add(key);

    const warmFill = new THREE.PointLight(0xffb982, 1.45, 120);
    warmFill.position.set(0, -3.6, 4.2);
    this.scene.add(warmFill);

    const rim = new THREE.PointLight(0x2f7bff, 1.15, 100);
    rim.position.set(-6, -2, -6);
    this.scene.add(rim);
  }

  addRiverGuides() {
    const group = new THREE.Group();
    group.name = 'jarvis-river-guides';

    const createRibbonCurve = (side, phase, amplitude = 1) => {
      const points = [];
      for (let i = 0; i <= 54; i += 1) {
        const t = i / 54;
        const y = -9 + i * 0.38;
        const x = side * (1.45 + (1 - t) * 3.2 + Math.sin(i * 0.22 + phase) * 0.95 * amplitude);
        const z = -1.2 - t * 7.2 + Math.cos(i * 0.18 + phase) * 1.25 * amplitude + side * -0.35;
        points.push(new THREE.Vector3(x, y, z));
      }
      return new THREE.CatmullRomCurve3(points);
    };

    const createRibbonLine = (curve, colorHex, opacity) => {
      const sampled = curve.getPoints(320);
      const geometry = new THREE.BufferGeometry().setFromPoints(sampled);
      const material = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Line(geometry, material);
    };

    const createRibbonTube = (curve, colorHex, opacity, radius) => {
      const geometry = new THREE.TubeGeometry(curve, 180, radius, 10, false);
      const material = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.Mesh(geometry, material);
    };

    const createFlowParticles = (side, colorHex, phase) => {
      const curve = createRibbonCurve(side, phase, 0.82);
      const points = [];
      for (let i = 0; i < 260; i += 1) {
        const t = i / 259;
        const base = curve.getPoint(t);
        points.push(
          base.x + (Math.random() - 0.5) * 0.95,
          base.y + (Math.random() - 0.5) * 0.75,
          base.z + (Math.random() - 0.5) * 1.2
        );
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const material = new THREE.PointsMaterial({
        color: colorHex,
        size: 0.11,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloud = new THREE.Points(geometry, material);
      cloud.userData.phase = phase;
      cloud.userData.side = side;
      return cloud;
    };

    const leftPrimaryCurve = createRibbonCurve(-1, 0, 1);
    const leftSecondaryCurve = createRibbonCurve(-1, 1.3, 0.84);
    const rightPrimaryCurve = createRibbonCurve(1, 0.68, 1);
    const rightSecondaryCurve = createRibbonCurve(1, 2.08, 0.84);

    group.add(
      createRibbonTube(leftPrimaryCurve, 0x57bfff, 0.18, 0.2),
      createRibbonTube(leftSecondaryCurve, 0xa9edff, 0.12, 0.14),
      createRibbonTube(rightPrimaryCurve, 0xffb16a, 0.2, 0.2),
      createRibbonTube(rightSecondaryCurve, 0xffd7ac, 0.12, 0.14),
      createRibbonLine(leftPrimaryCurve, 0x71ccff, 1),
      createRibbonLine(leftSecondaryCurve, 0x8ce7ff, 0.72),
      createRibbonLine(rightPrimaryCurve, 0xffbc88, 1),
      createRibbonLine(rightSecondaryCurve, 0xffd1aa, 0.72),
      createFlowParticles(-1, 0x93dcff, 0.2),
      createFlowParticles(1, 0xffc994, 0.9)
    );

    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -22, -1),
      new THREE.Vector3(0, 22, -12),
    ]);
    const axisMaterial = new THREE.LineDashedMaterial({
      color: 0xbbe9ff,
      transparent: true,
      opacity: 0.32,
      dashSize: 0.7,
      gapSize: 0.34,
    });
    const axis = new THREE.Line(axisGeometry, axisMaterial);
    axis.computeLineDistances();
    group.add(axis);

    this.scene.add(group);
    this.riverGuidesGroup = group;
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

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    this.cameraController.update(dt);
    OrbFactory.animatePrimaryOrb(this.neuroOrb, elapsed);
    const hudOffset = this.hudOrbOffset.clone().applyQuaternion(this.camera.quaternion);
    this.neuroOrb.position.copy(this.camera.position).add(hudOffset);
    this.neuroOrb.quaternion.copy(this.camera.quaternion);
    for (const nodeOrb of this.timelineNodeOrbs) {
      if (typeof nodeOrb.userData.baseY === 'number') {
        nodeOrb.position.y = nodeOrb.userData.baseY + Math.sin(elapsed * 0.8 + nodeOrb.userData.floatPhase) * 0.06;
      }
      OrbFactory.updateTimelineNodeLod(nodeOrb, this.camera.position);
    }
    if (this.riverGuidesGroup) {
      for (const child of this.riverGuidesGroup.children) {
        if (child.isPoints) {
          child.rotation.y = Math.sin(elapsed * 0.05 + (child.userData.phase || 0)) * 0.02;
          child.position.z = Math.sin(elapsed * 0.5 + (child.userData.phase || 0)) * 0.18;
        }
      }
    }
    this.performance.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
