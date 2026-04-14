import * as THREE from 'three';

const orbGeometry = new THREE.SphereGeometry(1, 48, 48);
const nodeGeometry = new THREE.SphereGeometry(0.16, 28, 28);

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

function createPrimaryOrbTexture() {
  return textureFromCanvas('primary-orb:surface', (context, width, height) => {
    const gradient = context.createRadialGradient(
      width * 0.5,
      height * 0.35,
      width * 0.05,
      width * 0.5,
      height * 0.5,
      width * 0.5
    );
    gradient.addColorStop(0, '#d8eeff');
    gradient.addColorStop(0.36, '#8ec5ff');
    gradient.addColorStop(0.72, '#2a4169');
    gradient.addColorStop(1, '#141d35');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.85;
    context.fillStyle = '#f0c48a';
    context.beginPath();
    context.ellipse(width * 0.5, height * 0.86, width * 0.38, width * 0.11, 0, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.55;
    for (let i = 0; i < 65; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 1.6 + 0.5;
      context.fillStyle = '#f6fbff';
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
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

function streamTintForNode(node) {
  const side = node?.layout?.side;
  if (side < 0) {
    return new THREE.Color(0x77d7ff);
  }
  if (side > 0) {
    return new THREE.Color(0xffbd84);
  }
  return new THREE.Color(0xdaf0ff);
}

function sizeForNode(node, category) {
  const base = node?.importance || node?.weight || node?.score || 1;
  const title = `${node?.title || node?.id || category}`;
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const variance = Math.abs(hash % 5) * 0.035;
  const categoryBoost = category === 'commit' ? 0.08 : 0.12;
  return THREE.MathUtils.clamp(0.95 + variance + Math.min(base * 0.04, 0.16) + categoryBoost, 0.92, 1.35);
}

export const OrbFactory = {
  createPrimaryOrb() {
    const mesh = new THREE.Mesh(
      orbGeometry,
      new THREE.MeshPhysicalMaterial({
        map: createPrimaryOrbTexture(),
        color: 0xc9e4ff,
        emissive: 0x18223f,
        emissiveIntensity: 0.62,
        roughness: 0.2,
        metalness: 0.06,
        transmission: 0.15,
        clearcoat: 0.95,
        clearcoatRoughness: 0.2,
      })
    );
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x8fc4ff,
        transparent: true,
        opacity: 0.12,
      })
    );
    mesh.add(aura);
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
    mesh.position.y = Math.sin(elapsed * 0.95) * 0.09;
  },

  createTimelineNodeOrb(node) {
    const category = categoryForNode(node);
    const privacy = privacyForNode(node);
    const categoryColor = nodeColorByCategory[category] || nodeColorByCategory.conversation;
    const color = categoryColor.clone().lerp(streamTintForNode(node), 0.33);
    const orbOpacity = privacy === 'private' ? nodePrivateOpacity : nodePublicOpacity;
    const isCommit = category === 'commit';
    const nodeScale = sizeForNode(node, category);

    const group = new THREE.Group();

    const mesh = new THREE.Mesh(
      nodeGeometry,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(isCommit ? 0.08 : 0.19),
        roughness: isCommit ? 0.2 : 0.3,
        metalness: isCommit ? 0.18 : 0.45,
        transparent: true,
        opacity: orbOpacity,
      })
    );
    mesh.scale.setScalar(nodeScale);
    group.add(mesh);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 20),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isCommit ? 0.14 : 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    aura.scale.setScalar(nodeScale * (isCommit ? 1.55 : 1.8));
    group.add(aura);

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
        opacity: 0.88,
        depthWrite: false,
      })
    );
    icon.scale.set(0.16, 0.16, 1);
    icon.position.set(0, 0.01, 0.13);
    if (!isCommit) {
      group.add(icon);
    }

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
      aura,
      mesh,
      baseOpacity: orbOpacity,
      category,
      scale: nodeScale,
    };
    return group;
  },

  updateTimelineNodeLod(nodeGroup, cameraPosition) {
    const lod = nodeGroup?.userData?.lod;
    if (!lod) {
      return;
    }

    const distance = cameraPosition.distanceTo(nodeGroup.position);
    const scale = lod.scale || 1;
    const iconScale = THREE.MathUtils.clamp(distance * 0.0085, 0.12, 0.28) * scale;
    lod.icon.scale.set(iconScale, iconScale, 1);
    lod.border.scale.set(iconScale * 2.55, iconScale * 2.55, 1);
    lod.aura.scale.setScalar(scale * THREE.MathUtils.clamp(1.1 + distance * 0.02, 1.3, 1.95));

    const far = distance > 14;
    lod.overlay.visible = !far;
    lod.overlay.material.opacity = distance > 9 ? 0.8 : 0.96;
    lod.aura.material.opacity = distance > 16
      ? (lod.category === 'commit' ? 0.08 : 0.12)
      : (lod.category === 'commit' ? 0.14 : 0.2);
    if (lod.category === 'commit') {
      lod.overlay.visible = false;
      lod.border.visible = false;
    }
    lod.mesh.material.opacity = distance > 18
      ? Math.max(0.62, lod.baseOpacity * 0.86)
      : lod.baseOpacity;
  },
};
