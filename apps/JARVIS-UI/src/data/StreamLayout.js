const DAY_MS = 24 * 60 * 60 * 1000;

const LEFT_TYPES = new Set(['temporal-commit', 'learning', 'commit-satellite']);
const RIGHT_TYPES = new Set(['conversation', 'audio']);

export class StreamLayout {
  constructor(config = {}) {
    this.config = {
      streamOffset: config.streamOffset ?? 7.0,
      orbitalRadius: config.orbitalRadius ?? 3.2,
      daySpacing: config.daySpacing ?? 2.2,
      orbitalJitter: config.orbitalJitter ?? 0.56,
      temporalDepthScale: config.temporalDepthScale ?? 5.0,
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

      const laneKey = `${dayKey}:${side}`;
      const orbitCounterKey = isAnchor ? dayKey : laneKey;
      const localIndex = orbitCounters.get(orbitCounterKey) || 0;
      orbitCounters.set(orbitCounterKey, localIndex + 1);
      const dayPopulation = Math.max((isAnchor ? dayCounts.get(dayKey) : laneCounts.get(laneKey)) || 1, 1);
      const jitter = Math.sin(index * 2.173) * this.config.orbitalJitter;
      const radial = this.config.orbitalRadius + jitter + (localIndex % 4) * 0.16;
      // Older (deeper) nodes spread wider in X — perspective makes them appear at same screen density
      const depthFraction = totalDays <= 1 ? 0 : depthIndexFromPresent / (totalDays - 1);
      const convergence = 1 + depthFraction * 0.65;
      const laneSpread = Math.ceil(dayPopulation / 5);
      const laneIndex = (localIndex % Math.max(laneSpread, 1)) - (Math.max(laneSpread, 1) - 1) / 2;
      const repulsion = Math.pow(localIndex + 1, 0.62);

      // Flatten Y — horizontal fan is dominant, vertical spread is secondary
      const yBand = Math.floor(localIndex / Math.max(laneSpread, 1));
      const depthTilt = Math.abs(zAnchor) * 0.04;
      const y = isAnchor
        ? depthTilt * 0.5
        : (laneIndex * 0.34) + (side < 0 ? -0.1 : 0.1) + (yBand * 0.28) + (repulsion * 0.05) + depthTilt;

      const x = isAnchor
        ? 0
        : side * (
          this.config.streamOffset * convergence
          + radial * 0.48
          + laneIndex * 0.85
          + repulsion * 0.38
        );
      const z = isAnchor
        ? zAnchor
        : zAnchor - yBand * 0.48 - repulsion * 0.18 + laneIndex * 0.12;

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
