import * as THREE from 'three';

/**
 * Self-contained Three.js orb renderer.
 * Owns its own scene + camera + renderer, mounted inside the button element.
 * Mirrors the implementation from main/app.js.
 */
export class OrbVideoRenderer {
  constructor(mountEl, videoSrc = '/jarvis-orb-video.mp4') {
    this.mount = mountEl;
    this.mesh = null;
    this.recording = false;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 2.58);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.mount.appendChild(this.renderer.domElement);

    // Hidden video element — feeds the texture
    this.video = document.createElement('video');
    this.video.src = videoSrc;
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.loop = true;
    this.video.playsInline = true;
    this.video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;clip:rect(0,0,0,0)';
    document.body.appendChild(this.video);

    this.video.addEventListener('loadeddata', () => this._createSphere());
    this.video.play().catch(() => {});

    this._resize();
    this._raf = null;
    this._animate();
  }

  _createSphere() {
    if (this.mesh) { return; }
    const texture = new THREE.VideoTexture(this.video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy
      ? this.renderer.capabilities.getMaxAnisotropy() : 1;
    texture.anisotropy = Math.min(8, maxAniso);

    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.x = -1; // mirror so video reads correctly
    this.scene.add(this.mesh);
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    if (this.mesh) {
      this.mesh.rotation.y += 0.003;
      this.mesh.rotation.x = Math.sin(Date.now() * 0.0004) * 0.06;
    }
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const rect = this.mount.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width || 132, rect.height || 132));
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size, size);
  }

  setRecording(isRecording) {
    this.recording = isRecording;
    if (this.mesh) {
      this.mesh.material.color.setHex(isRecording ? 0xff8888 : 0xffffff);
    }
  }

  resize() {
    this._resize();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.video.remove();
    this.renderer.dispose();
  }
}
