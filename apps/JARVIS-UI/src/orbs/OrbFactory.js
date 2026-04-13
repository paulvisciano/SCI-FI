import * as THREE from 'three';

const orbGeometry = new THREE.IcosahedronGeometry(1.5, 8);
const orbMaterial = new THREE.MeshStandardMaterial({
  color: 0x6cd6ff,
  emissive: 0x133154,
  roughness: 0.25,
  metalness: 0.55,
});

const nodeGeometry = new THREE.SphereGeometry(0.16, 16, 16);
const nodePrivateOpacity = 0.8;
const nodePublicOpacity = 1;
const nodeColorByCategory = {
  commit: new THREE.Color(0x88f4ff),
  learning: new THREE.Color(0xa2b5ff),
  conversation: new THREE.Color(0xe8c9ff),
  audio: new THREE.Color(0xffb3e1),
  image: new THREE.Color(0x9fffc7),
  video: new THREE.Color(0xffd28d),
  document: new THREE.Color(0xc5d3ff),
  reflection: new THREE.Color(0xb9ffe9),
};

const textureCache = new Map();

function textureFromCanvas(key, draw) {
  if (textureCache.has(key)) {
    return textureCache.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  draw(context, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

function drawIconCategory(category, context, size) {
  const c = size / 2;
  const s = size * 0.62;
  const left = c - s / 2;
  const top = c - s / 2;
  const right = c + s / 2;
  const bottom = c + s / 2;
  const midY = c;

  context.strokeStyle = '#E9F7FF';
  context.fillStyle = '#E9F7FF';
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  switch (category) {
    case 'commit':
      context.beginPath();
      context.moveTo(left + 12, top + 20);
      context.lineTo(right - 16, top + 20);
      context.lineTo(right - 16, bottom - 24);
      context.stroke();
      context.beginPath();
      context.arc(left + 12, top + 20, 9, 0, Math.PI * 2);
      context.arc(right - 16, top + 20, 9, 0, Math.PI * 2);
      context.arc(right - 16, bottom - 24, 9, 0, Math.PI * 2);
      context.fill();
      return;
    case 'learning':
      context.beginPath();
      context.moveTo(left + 12, top + 20);
      context.lineTo(c - 4, top + 10);
      context.lineTo(c - 4, bottom - 18);
      context.lineTo(left + 12, bottom - 8);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.moveTo(c + 4, top + 10);
      context.lineTo(right - 12, top + 20);
      context.lineTo(right - 12, bottom - 8);
      context.lineTo(c + 4, bottom - 18);
      context.closePath();
      context.stroke();
      return;
    case 'conversation':
      context.beginPath();
      context.roundRect(left + 12, top + 20, s - 24, s - 28, 16);
      context.stroke();
      context.beginPath();
      context.moveTo(left + 40, bottom - 14);
      context.lineTo(left + 36, bottom + 6);
      context.lineTo(left + 54, bottom - 8);
      context.stroke();
      return;
    case 'audio':
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const x = left + 16 + i * 18;
        const h = [18, 30, 42, 30, 18][i];
        context.moveTo(x, midY - h / 2);
        context.lineTo(x, midY + h / 2);
      }
      context.stroke();
      return;
    case 'image':
      context.beginPath();
      context.roundRect(left + 12, top + 18, s - 24, s - 22, 10);
      context.stroke();
      context.beginPath();
      context.arc(right - 30, top + 34, 7, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(left + 24, bottom - 18);
      context.lineTo(c - 2, midY + 4);
      context.lineTo(c + 18, bottom - 26);
      context.lineTo(right - 20, bottom - 18);
      context.stroke();
      return;
    case 'video':
      context.beginPath();
      context.roundRect(left + 12, top + 20, s - 24, s - 24, 12);
      context.stroke();
      context.beginPath();
      context.moveTo(c - 10, midY - 16);
      context.lineTo(c + 16, midY);
      context.lineTo(c - 10, midY + 16);
      context.closePath();
      context.fill();
      return;
    case 'document':
      context.beginPath();
      context.moveTo(left + 20, top + 12);
      context.lineTo(right - 28, top + 12);
      context.lineTo(right - 12, top + 28);
      context.lineTo(right - 12, bottom - 14);
      context.lineTo(left + 20, bottom - 14);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.moveTo(right - 28, top + 12);
      context.lineTo(right - 28, top + 28);
      context.lineTo(right - 12, top + 28);
      context.stroke();
      return;
    case 'reflection':
      context.beginPath();
      context.arc(c, midY - 4, 24, Math.PI * 0.15, Math.PI * 1.85);
      context.stroke();
      context.beginPath();
      context.moveTo(c - 16, bottom - 28);
      context.lineTo(c + 16, bottom - 28);
      context.stroke();
      context.beginPath();
      context.arc(c - 8, midY - 8, 2.8, 0, Math.PI * 2);
      context.arc(c + 8, midY - 8, 2.8, 0, Math.PI * 2);
      context.fill();
      return;
    default:
      context.beginPath();
      context.arc(c, c, 22, 0, Math.PI * 2);
      context.stroke();
  }
}

function createIconTexture(category) {
  return textureFromCanvas(`icon:${category}`, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    drawIconCategory(category, context, width);
  });
}

function createBorderTexture(privacy) {
  const dotted = privacy === 'private';
  return textureFromCanvas(`border:${privacy}`, (context, width, height) => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = width * 0.37;
    context.clearRect(0, 0, width, height);
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.lineWidth = 7;
    context.strokeStyle = '#D6EEFF';
    context.setLineDash(dotted ? [6, 8] : []);
    context.stroke();
  });
}

function drawOverlayIcon(kind, context, width, height) {
  const c = width / 2;
  const midY = height / 2;
  context.strokeStyle = '#FFFFFF';
  context.fillStyle = '#FFFFFF';
  context.lineWidth = 7;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (kind === 'lock') {
    context.beginPath();
    context.roundRect(c - 20, midY - 4, 40, 30, 8);
    context.stroke();
    context.beginPath();
    context.arc(c, midY - 8, 13, Math.PI, 0);
    context.stroke();
    return;
  }

  context.beginPath();
  context.arc(c, midY, 22, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(c, midY, 11, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(c - 22, midY);
  context.lineTo(c + 22, midY);
  context.moveTo(c, midY - 22);
  context.lineTo(c, midY + 22);
  context.stroke();
}

function createOverlayTexture(privacy) {
  const kind = privacy === 'private' ? 'lock' : 'globe';
  return textureFromCanvas(`overlay:${kind}`, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    drawOverlayIcon(kind, context, width, height);
  });
}

function categoryForNode(node) {
  const type = `${node.type || node.kind || node.stream || ''}`.toLowerCase();
  const title = `${node.title || ''}`.toLowerCase();

  if (type.includes('commit')) {return 'commit';}
  if (type.includes('learn') || title.includes('learn')) {return 'learning';}
  if (type.includes('conversation') || type.includes('chat')) {return 'conversation';}
  if (type.includes('audio') || type.includes('voice')) {return 'audio';}
  if (type.includes('image') || type.includes('photo')) {return 'image';}
  if (type.includes('video')) {return 'video';}
  if (type.includes('document') || type.includes('doc') || type.includes('file')) {return 'document';}
  if (type.includes('reflect') || type.includes('memory') || title.includes('reflect')) {return 'reflection';}
  return 'conversation';
}

function privacyForNode(node) {
  const visibility = `${node.privacy || node.visibility || ''}`.toLowerCase();
  if (visibility === 'private') {
    return 'private';
  }
  if (visibility === 'public') {
    return 'public';
  }
  if (node.private === true || node.isPrivate === true || node.access === 'private') {
    return 'private';
  }
  return 'public';
}

export const OrbFactory = {
  createPrimaryOrb() {
    const mesh = new THREE.Mesh(orbGeometry, orbMaterial.clone());
    mesh.name = 'jarvis-primary-orb';
    return mesh;
  },

  createAmbientParticles() {
    const particleGeometry = new THREE.BufferGeometry();
    const points = new Float32Array(300);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (Math.random() - 0.5) * 22;
      points[i + 1] = (Math.random() - 0.5) * 16;
      points[i + 2] = (Math.random() - 0.5) * 22;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({
      size: 0.03,
      color: 0x8addff,
      transparent: true,
      opacity: 0.8,
    });

    return new THREE.Points(particleGeometry, material);
  },

  animatePrimaryOrb(mesh, elapsed) {
    mesh.rotation.y = elapsed * 0.35;
    mesh.rotation.x = Math.sin(elapsed * 0.45) * 0.14;
    mesh.position.y = Math.sin(elapsed) * 0.2;
  },

  createTimelineNodeOrb(node) {
    const category = categoryForNode(node);
    const privacy = privacyForNode(node);
    const color = nodeColorByCategory[category] || nodeColorByCategory.conversation;
    const orbOpacity = privacy === 'private' ? nodePrivateOpacity : nodePublicOpacity;

    const group = new THREE.Group();

    const mesh = new THREE.Mesh(
      nodeGeometry,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.22),
        roughness: 0.3,
        metalness: 0.45,
        transparent: true,
        opacity: orbOpacity,
      })
    );
    group.add(mesh);

    const border = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createBorderTexture(privacy),
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    border.scale.set(0.5, 0.5, 1);
    group.add(border);

    const icon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createIconTexture(category),
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    icon.scale.set(0.34, 0.34, 1);
    icon.position.set(0, 0.01, 0.13);
    group.add(icon);

    const overlay = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createOverlayTexture(privacy),
        color: privacy === 'private' ? 0xfff1b2 : 0xb2e2ff,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      })
    );
    overlay.scale.set(0.17, 0.17, 1);
    overlay.position.set(0.2, 0.2, 0.13);
    group.add(overlay);

    group.userData.node = node;
    group.userData.lod = {
      icon,
      overlay,
      border,
      mesh,
      baseOpacity: orbOpacity,
    };
    return group;
  },

  updateTimelineNodeLod(nodeGroup, cameraPosition) {
    const lod = nodeGroup?.userData?.lod;
    if (!lod) {
      return;
    }

    const distance = cameraPosition.distanceTo(nodeGroup.position);
    const iconScale = THREE.MathUtils.clamp(distance * 0.016, 0.32, 0.68);
    lod.icon.scale.set(iconScale, iconScale, 1);
    lod.border.scale.set(iconScale * 1.48, iconScale * 1.48, 1);

    const far = distance > 14;
    lod.overlay.visible = !far;
    lod.overlay.material.opacity = distance > 9 ? 0.8 : 0.96;
    lod.mesh.material.opacity = distance > 18
      ? Math.max(0.62, lod.baseOpacity * 0.86)
      : lod.baseOpacity;
  },
};
