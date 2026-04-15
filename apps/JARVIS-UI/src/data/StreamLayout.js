const DAY_MS = 24 * 60 * 60 * 1000;

const LEFT_TYPES = new Set(['temporal-commit', 'learning', 'commit-satellite']);
const RIGHT_TYPES = new Set(['conversation', 'audio']);

export class StreamLayout {
  constructor(config = {}) {
    this.config = {
      streamOffset: config.streamOffset ?? 9.4,
      orbitalRadius: config.orbitalRadius ?? 3.8,
      daySpacing: config.daySpacing ?? 2.8,
      orbitalJitter: config.orbitalJitter ?? 0.56,
      temporalDepthScale: config.temporalDepthScale ?? 6.2,
      maxTemporalDepth: config.maxTemporalDepth ?? 140,
      presentZOffset: config.presentZOffset ?? 0,
    };
  }

  layout(nodes = []) {
    const sorted = [...nodes].sort((a, b) => this.epochFor(a) - this.epochFor(b));
    const days = this.buildDayIndex(sorted);
    const orbitCounters = new Map();
    const dayCounts = new Map();
    const laneCounts = new Map();
    const totalDays = Math.max(days.size, 1);
    const computedDepthSpan = (totalDays - 1) * this.config.daySpacing * this.config.temporalDepthScale;
    const dynamicMaxTemporalDepth = Math.max(this.config.maxTemporalDepth, computedDepthSpan + 12);

    for (const node of sorted) {
      const dayKey = this.dayKeyFor(node);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
      const side = node.kind === 'day-anchor' ? 0 : this.sideFor(node);
      const laneKey = `${dayKey}:${side}`;
      laneCounts.set(laneKey, (laneCounts.get(laneKey) || 0) + 1);
    }

    let leftCount = 0;
    let rightCount = 0;

    const positioned = sorted.map((node, index) => {
      const dayKey = this.dayKeyFor(node);
      const dayIndex = days.get(dayKey) || 0;
      const centeredDayIndex = dayIndex - (totalDays - 1) / 2;
      const normalizedDay = totalDays <= 1 ? 0 : centeredDayIndex / ((totalDays - 1) / 2 || 1);
      const depthIndexFromPresent = (totalDays - 1) - dayIndex;
      const dayDepth = -depthIndexFromPresent * this.config.daySpacing * this.config.temporalDepthScale;
      const zAnchor = THREEClamp(dayDepth, -dynamicMaxTemporalDepth, dynamicMaxTemporalDepth) + this.config.presentZOffset;
      const isAnchor = node.kind === 'day-anchor';
      const side = isAnchor ? 0 : this.sideFor(node);

      if (side < 0) {
        leftCount += 1;
      } else if (side > 0) {
        rightCount += 1;
      }

      // Per-type counter key — nodes of the same type on the same day share a Y band
      const typeKey = isAnchor ? dayKey : `${dayKey}:${this.typeBandFor(node)}`;
      const localIndex = orbitCounters.get(typeKey) || 0;
      orbitCounters.set(typeKey, localIndex + 1);

      // X spread still uses side lane population for horizontal density
      const laneKey = `${dayKey}:${side}`;
      const lanePopulation = Math.max((isAnchor ? dayCounts.get(dayKey) : laneCounts.get(laneKey)) || 1, 1);
      const jitter = Math.sin(index * 2.173) * this.config.orbitalJitter;
      const radial = this.config.orbitalRadius + jitter + (localIndex % 4) * 0.16;
      const depthFraction = totalDays <= 1 ? 0 : depthIndexFromPresent / (totalDays - 1);
      const convergence = 1 + depthFraction * 0.72;
      const laneSpread = Math.ceil(lanePopulation / 4);
      const laneIndex = (localIndex % Math.max(laneSpread, 1)) - (Math.max(laneSpread, 1) - 1) / 2;

      // Y: type-band center + small intra-band grid (col/row within type group)
      const depthTilt = Math.abs(zAnchor) * 0.04;
      const bandCenter = isAnchor ? 0 : this.typeBandFor(node);
      const col = (localIndex % 3) - 1;   // −1, 0, +1 columns
      const row = Math.floor(localIndex / 3);
      const y = isAnchor
        ? depthTilt * 0.5
        : bandCenter + col * 0.58 + row * 0.42 + depthTilt;

      const x = isAnchor
        ? 0
        : side * (
          this.config.streamOffset * convergence
          + radial * 0.55
          + laneIndex * 0.9
        );
      const z = isAnchor
        ? zAnchor
        : zAnchor + laneIndex * 0.18 - row * 0.28;

      return {
        ...node,
        position: { x, y, z },
        layout: {
          side,
          dayKey,
          dayIndex,
          isAnchor,
          epochMs: this.epochFor(node),
          normalizedDay,
        },
      };
    });

    return {
      nodes: positioned,
      meta: {
        dayCount: days.size,
        leftCount,
        rightCount,
      },
    };
  }

  // Maps node type to a Y band center so same-type orbs cluster vertically
  typeBandFor(node) {
    const type = `${node.type || node.kind || ''}`.toLowerCase();
    const side  = this.sideFor(node);

    if (side > 0) {
      // Right stream — Paul's archive
      if (type === 'audio' || type.includes('voice'))                    { return 5.5;  }
      if (type === 'image' || type.includes('photo'))                    { return 2.5;  }
      if (type === 'video')                                              { return 2.5;  }
      if (type === 'conversation' || type.includes('chat'))              { return -0.5; }
      if (type === 'document' || type === 'text' || type.includes('file')) { return -3.5; }
      return 0;
    }
    // Left stream — Jarvis memory
    if (type.includes('commit'))                                         { return 4.0;  }
    if (type.includes('learn'))                                          { return 0.5;  }
    if (type.includes('reflect') || type.includes('memory'))             { return -3.0; }
    return 0;
  }

  sideFor(node) {
    const type = `${node.type || node.kind || ''}`.toLowerCase();
    if (LEFT_TYPES.has(type)) {
      return -1;
    }
    if (RIGHT_TYPES.has(type)) {
      return 1;
    }
    if (`${node.stream || ''}`.toLowerCase() === 'memory') {
      return -1;
    }
    if (`${node.stream || ''}`.toLowerCase() === 'temporal') {
      return 1;
    }
    return 1;
  }

  buildDayIndex(nodes) {
    const dayKeys = [...new Set(nodes.map((node) => this.dayKeyFor(node)))];
    dayKeys.sort((a, b) => this.epochFromDayKey(a) - this.epochFromDayKey(b));
    return new Map(dayKeys.map((day, index) => [day, index]));
  }

  dayKeyFor(node) {
    if (node.day && /^\d{4}-\d{2}-\d{2}$/.test(node.day)) {
      return node.day;
    }

    const epoch = this.epochFor(node);
    const date = new Date(epoch);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  epochFor(node) {
    const candidates = [node.timestamp, node.createdAt, node.date, node.day];
    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return Date.UTC(2020, 0, 1) + DAY_MS;
  }

  epochFromDayKey(dayKey) {
    const parsed = Date.parse(`${dayKey}T00:00:00.000Z`);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  dayFractionFor(node) {
    const epoch = this.epochFor(node);
    if (!Number.isFinite(epoch)) {
      return 0;
    }
    const date = new Date(epoch);
    const seconds =
      (date.getUTCHours() * 3600) +
      (date.getUTCMinutes() * 60) +
      date.getUTCSeconds() +
      (date.getUTCMilliseconds() / 1000);
    return seconds / 86400;
  }
}

function THREEClamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
