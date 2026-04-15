import * as THREE from 'three';

const orbGeometry = new THREE.SphereGeometry(1, 48, 48);
const nodeGeometry = new THREE.SphereGeometry(0.16, 28, 28);

const nodePrivateOpacity = 0.8;
const nodePublicOpacity = 1;
const nodeColorByCategory = {
  commit: new THREE.Color(0x00d4ff),
  learning: new THREE.Color(0x6677ff),
  conversation: new THREE.Color(0xcc55ff),
  audio: new THREE.Color(0xff44bb),
  image: new THREE.Color(0x22ffaa),
  video: new THREE.Color(0xff9922),
  document: new THREE.Color(0x7799ff),
  reflection: new THREE.Color(0x33ffdd),
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

function createNodeSurfaceTexture(category) {
  return textureFromCanvas(`surface:${category}`, (context, width, height) => {
    const gradient = context.createRadialGradient(
      width * 0.36,
      height * 0.32,
      width * 0.08,
      width * 0.52,
      height * 0.56,
      width * 0.62
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
    gradient.addColorStop(0.36, 'rgba(170, 225, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(15, 35, 58, 0.92)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.3;
    context.strokeStyle = 'rgba(216, 242, 255, 0.8)';
    context.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = 12 + i * 24;
      context.beginPath();
      context.moveTo(8, y);
      context.lineTo(width - 8, y + ((i % 2 === 0) ? 10 : -10));
      context.stroke();
    }
    context.globalAlpha = 1;

    context.strokeStyle = 'rgba(230, 247, 255, 0.95)';
    context.fillStyle = 'rgba(230, 247, 255, 0.95)';
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const c = width / 2;
    const r = width * 0.24;
    switch (category) {
    case 'audio':
      for (let i = 0; i < 5; i += 1) {
        const x = c - 28 + i * 14;
        const h = [12, 22, 30, 22, 12][i];
        context.beginPath();
        context.moveTo(x, c - h / 2);
        context.lineTo(x, c + h / 2);
        context.stroke();
      }
      break;
    case 'image':
      context.beginPath();
      context.roundRect(c - r, c - r, r * 2, r * 2, 10);
      context.stroke();
      context.beginPath();
      context.arc(c + 14, c - 10, 5, 0, Math.PI * 2);
      context.fill();
      break;
    case 'video':
      context.beginPath();
      context.arc(c, c, r, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(c - 8, c - 12);
      context.lineTo(c + 12, c);
      context.lineTo(c - 8, c + 12);
      context.closePath();
      context.fill();
      break;
    case 'document':
      context.beginPath();
      context.moveTo(c - 18, c - 20);
      context.lineTo(c + 10, c - 20);
      context.lineTo(c + 18, c - 12);
      context.lineTo(c + 18, c + 20);
      context.lineTo(c - 18, c + 20);
      context.closePath();
      context.stroke();
      break;
    case 'conversation':
      context.beginPath();
      context.roundRect(c - 22, c - 16, 44, 30, 11);
      context.stroke();
      break;
    default:
      context.beginPath();
      context.arc(c, c, 16, 0, Math.PI * 2);
      context.stroke();
    }
  });
}

function materialProfileForCategory(category) {
  switch (category) {
  case 'audio': return { roughness: 0.16, metalness: 0.52, clearcoat: 1.0 };
  case 'image': return { roughness: 0.1, metalness: 0.42, clearcoat: 1.0 };
  case 'video': return { roughness: 0.14, metalness: 0.58, clearcoat: 0.94 };
  case 'document': return { roughness: 0.2, metalness: 0.36, clearcoat: 0.88 };
  case 'conversation': return { roughness: 0.18, metalness: 0.34, clearcoat: 0.9 };
  default: return { roughness: 0.12, metalness: 0.35, clearcoat: 0.92 };
  }
}

function formatDayAnchorLabel(node) {
  const rawDay = `${node?.day || node?.title || ''}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDay)) {
    return rawDay || 'Timeline';
  }
  const [year, month, day] = rawDay.split('-').map(Number);
  const labelDate = new Date(year, month - 1, day);
  if (!Number.isFinite(labelDate.getTime())) {
    return rawDay;
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const labelStart = new Date(labelDate.getFullYear(), labelDate.getMonth(), labelDate.getDate());
  const daysAgo = Math.round((todayStart.getTime() - labelStart.getTime()) / (24 * 60 * 60 * 1000));

  if (daysAgo < 0) {
    return labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (daysAgo === 0) {
    return 'Today';
  }
  if (daysAgo === 1) {
    return 'Yesterday';
  }
  if (daysAgo <= 6) {
    return labelDate.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function createDayAnchorLabelSprite(node) {
  const text = formatDayAnchorLabel(node);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(8, 18, 34, 0.72)';
  ctx.strokeStyle = 'rgba(174, 225, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 20);
  ctx.fill();
  ctx.stroke();
  ctx.font = '600 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#dff4ff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.set(1.45, 0.42, 1);
  sprite.position.set(0, 0.75, 0);
  return sprite;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { lines.push(line); }
  return lines;
}

function statusStyleFor(node) {
  const title = `${node?.title || ''}`.toLowerCase();
  const isDone = Boolean(`${node?.jarvisResponse || ''}`.trim()) || title === 'voice note';
  if (title.includes('error'))    { return { dot: '✕', color: '#ff6666', border: 'rgba(255,80,80,0.7)',   pulse: false }; }
  if (isDone)                     { return { dot: '✓', color: '#66ffcc', border: 'rgba(80,240,160,0.7)',  pulse: false }; }
  if (title.includes('transcrib')){ return { dot: '◈', color: '#ffcc44', border: 'rgba(255,190,50,0.7)', pulse: true  }; }
  return                            { dot: '●', color: '#ff8844', border: 'rgba(255,120,50,0.8)',         pulse: true  }; // recording
}

function createVoiceNodeCard(node) {
  const style    = statusStyleFor(node);
  const title    = `${node?.title || 'Voice note'}`;
  const preview  = `${node?.preview || ''}`.trim();
  const response = `${node?.jarvisResponse || ''}`.trim();

  const W   = 720;
  const PAD = 26;
  const LH_BODY = 32;
  const LH_RESP = 30;

  const FONT_LABEL = '700 18px Inter,sans-serif';
  const FONT_TITLE = '700 28px Inter,sans-serif';
  const FONT_BODY  = '400 22px Inter,sans-serif';
  const FONT_RESP  = '400 21px Inter,sans-serif';

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = FONT_BODY;
  const previewLines  = preview  ? wrapText(measure, preview,  W - PAD * 2).slice(0, 6) : [];
  measure.font = FONT_RESP;
  const responseLines = response ? wrapText(measure, response, W - PAD * 2).slice(0, 6) : [];

  // Height: title + (you section) + (jarvis section)
  let H = PAD + 36; // title
  if (previewLines.length)  { H += 20 + previewLines.length * LH_BODY + 8; }
  if (responseLines.length) { H += 20 + responseLines.length * LH_RESP + 8; }
  H += PAD;
  H = Math.max(H, 90);

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Card background — darker, more opaque
  ctx.fillStyle = 'rgba(4, 10, 20, 0.96)';
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 18);
  ctx.fill();
  ctx.stroke();

  // Status title
  ctx.font = FONT_TITLE;
  ctx.fillStyle = style.color;
  ctx.fillText(`${style.dot}  ${title}`, PAD, PAD + 28);

  let y = PAD + 36;

  // "YOU" section
  if (previewLines.length) {
    y += 14;
    ctx.font = FONT_LABEL;
    ctx.fillStyle = 'rgba(140, 200, 255, 0.55)';
    ctx.fillText('YOU', PAD, y);
    y += 6;
    ctx.strokeStyle = 'rgba(140, 200, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 18;
    ctx.font = FONT_BODY;
    ctx.fillStyle = 'rgba(225, 248, 255, 0.95)';
    for (const line of previewLines) {
      ctx.fillText(line, PAD, y);
      y += LH_BODY;
    }
  }

  // "JARVIS" section
  if (responseLines.length) {
    y += 14;
    ctx.font = FONT_LABEL;
    ctx.fillStyle = 'rgba(255, 195, 100, 0.55)';
    ctx.fillText('JARVIS', PAD, y);
    y += 6;
    ctx.strokeStyle = 'rgba(255, 195, 100, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 18;
    ctx.font = FONT_RESP;
    ctx.fillStyle = 'rgba(255, 225, 170, 0.97)';
    for (const line of responseLines) {
      ctx.fillText(line, PAD, y);
      y += LH_RESP;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  const aspect  = W / H;
  const spriteH = 2.0 + (previewLines.length + responseLines.length) * 0.18;
  sprite.scale.set(spriteH * aspect, spriteH, 1);
  sprite.position.set(spriteH * aspect * 0.52 + 0.5, 0.1, 0);
  return sprite;
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
    return new THREE.Color(0x22aaff);
  }
  if (side > 0) {
    return new THREE.Color(0xff7722);
  }
  return new THREE.Color(0x88ddff);
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
  const baseScale = THREE.MathUtils.clamp(1.05 + variance + Math.min(base * 0.04, 0.16) + categoryBoost, 1.0, 1.5);
  return baseScale * 2;
}

export const OrbFactory = {
  createPrimaryOrb() {
    // Video element — plays silently as the sphere surface texture
    const video = document.createElement('video');
    video.src = '/jarvis-orb-video.mp4';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.play().catch(() => {});

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const mesh = new THREE.Mesh(
      orbGeometry,
      new THREE.MeshStandardMaterial({
        map: videoTexture,
        color: 0xcfe8ff,
        emissive: new THREE.Color(0x17325f),
        emissiveIntensity: 0.38,
        roughness: 0.18,
        metalness: 0.08,
      })
    );

    mesh.name = 'jarvis-primary-orb';
    mesh.userData.video = video;
    return mesh;
  },

  createAmbientParticles() {
    const particleGeometry = new THREE.BufferGeometry();
    const points = new Float32Array(1800);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (Math.random() - 0.5) * 48;
      points[i + 1] = (Math.random() - 0.5) * 32;
      points[i + 2] = (Math.random() - 0.5) * 48;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      color: 0x8addff,
      transparent: true,
      opacity: 0.7,
    });

    return new THREE.Points(particleGeometry, material);
  },

  animatePrimaryOrb(mesh, elapsed) {
    if (!mesh) { return; }
    mesh.rotation.y = elapsed * 0.18;
    mesh.rotation.x = Math.sin(elapsed * 0.38) * 0.10;
  },

  createTimelineNodeOrb(node) {
    const category = categoryForNode(node);
    const isDayAnchor = `${node?.kind || ''}`.toLowerCase() === 'day-anchor';
    const privacy = privacyForNode(node);
    const categoryColor = nodeColorByCategory[category] || nodeColorByCategory.conversation;
    const color = (isDayAnchor ? new THREE.Color(0xf7f0b0) : categoryColor).clone().lerp(streamTintForNode(node), isDayAnchor ? 0.15 : 0.33);
    const orbOpacity = privacy === 'private' ? nodePrivateOpacity : nodePublicOpacity;
    const isCommit = category === 'commit';
    const isRawArchiveNode = `${node?.kind || ''}`.toLowerCase() === 'raw-archive-node';
    const nodeScale = sizeForNode(node, category) * (isDayAnchor ? 2.35 : 1);
    const materialProfile = materialProfileForCategory(category);
    const typeSurfaceTexture = isRawArchiveNode ? createNodeSurfaceTexture(category) : null;

    const group = new THREE.Group();

    const mesh = new THREE.Mesh(
      nodeGeometry,
      new THREE.MeshPhysicalMaterial({
        color,
        map: typeSurfaceTexture,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: isDayAnchor ? 0.08 : materialProfile.roughness,
        metalness: isDayAnchor ? 0.45 : materialProfile.metalness,
        clearcoat: isDayAnchor ? 0.92 : materialProfile.clearcoat,
        clearcoatRoughness: 0.1,
        reflectivity: 1,
        transparent: true,
        opacity: orbOpacity,
      })
    );
    mesh.scale.setScalar(nodeScale);
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
    border.scale.set(isDayAnchor ? 0.74 : 0.5, isDayAnchor ? 0.74 : 0.5, 1);
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

    if (isDayAnchor) {
      group.add(createDayAnchorLabelSprite(node));
    }

    const isLiveVoice = `${node?.kind || ''}` === 'voice-live-node';
    if (isLiveVoice) {
      group.add(createVoiceNodeCard(node));
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
    overlay.scale.set(isDayAnchor ? 0.25 : 0.17, isDayAnchor ? 0.25 : 0.17, 1);
    overlay.position.set(0.2, 0.2, 0.13);
    group.add(overlay);

    group.userData.node = node;
    group.userData.lod = {
      icon,
      overlay,
      border,
      mesh,
      baseOpacity: orbOpacity,
      category,
      scale: nodeScale,
      isDayAnchor,
      isLiveVoice,
    };
    return group;
  },

  updateTimelineNodeLod(nodeGroup, cameraPosition, elapsed = 0) {
    const lod = nodeGroup?.userData?.lod;
    if (!lod) {
      return;
    }

    // Live voice node: pulse while active, settle once response arrives
    if (lod.isLiveVoice) {
      const node  = nodeGroup.userData.node;
      const style = statusStyleFor(node);
      lod.border.visible  = false;
      lod.icon.visible    = false;
      lod.overlay.visible = false;
      if (style.pulse) {
        const p = 0.5 + Math.sin(elapsed * 3.5) * 0.4;
        lod.mesh.material.emissiveIntensity = p;
        lod.mesh.material.color.setHex(0xff7733);
        lod.mesh.material.emissive.setHex(0xff5500);
        nodeGroup.scale.setScalar(1 + Math.sin(elapsed * 3.5) * 0.08);
      } else {
        // Response received — settle to calm green glow, no scale jitter
        lod.mesh.material.emissiveIntensity = 0.35;
        lod.mesh.material.color.setHex(0x44ffaa);
        lod.mesh.material.emissive.setHex(0x00cc66);
        nodeGroup.scale.setScalar(1);
      }
    } else {
      lod.mesh.material.emissiveIntensity = 0;
      nodeGroup.scale.setScalar(1);
    }

    const distance = cameraPosition.distanceTo(nodeGroup.position);
    if (lod.isLiveVoice) { return; } // card handles all visuals for live nodes

    const scale = lod.scale || 1;
    const iconScale = THREE.MathUtils.clamp(distance * 0.0085, 0.12, 0.28) * scale;
    lod.icon.scale.set(iconScale, iconScale, 1);
    lod.border.scale.set(iconScale * 2.55, iconScale * 2.55, 1);
    const far = distance > 14;
    lod.overlay.visible = !far;
    lod.overlay.material.opacity = distance > 9 ? 0.8 : 0.96;
    if (lod.category === 'commit') {
      lod.overlay.visible = false;
      lod.border.visible = false;
    }
    if (lod.isDayAnchor) {
      lod.overlay.visible = false;
      lod.border.visible = true;
      lod.border.material.opacity = distance > 22 ? 0.65 : 0.92;
    }
    lod.mesh.material.opacity = distance > 18
      ? Math.max(0.62, lod.baseOpacity * 0.86)
      : lod.baseOpacity;
  },
};
