const DAY_MS = 24 * 60 * 60 * 1000;

const LEFT_TYPES = new Set(['temporal-commit', 'learning', 'commit-satellite']);
const RIGHT_TYPES = new Set(['conversation', 'audio']);

export class StreamLayout {
  constructor(config = {}) {
    this.config = {
      streamOffset: config.streamOffset ?? 4.6,
      orbitalRadius: config.orbitalRadius ?? 1.05,
      daySpacing: config.daySpacing ?? 1.5,
      orbitalJitter: config.orbitalJitter ?? 0.18,
    };
  }

  layout(nodes = []) {
    const sorted = [...nodes].sort((a, b) => this.epochFor(a) - this.epochFor(b));
    const days = this.buildDayIndex(sorted);
    const orbitCounters = new Map();
    const dayCounts = new Map();

    for (const node of sorted) {
      const dayKey = this.dayKeyFor(node);
      dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
    }

    let leftCount = 0;
    let rightCount = 0;

    const positioned = sorted.map((node, index) => {
      const dayKey = this.dayKeyFor(node);
      const dayIndex = days.get(dayKey) || 0;
      const totalDays = Math.max(days.size, 1);
      const y = (dayIndex - (totalDays - 1) / 2) * this.config.daySpacing;
      const isAnchor = node.kind === 'day-anchor';
      const side = isAnchor ? 0 : this.sideFor(node);

      if (side < 0) {
        leftCount += 1;
      } else if (side > 0) {
        rightCount += 1;
      }

      const localIndex = orbitCounters.get(dayKey) || 0;
      orbitCounters.set(dayKey, localIndex + 1);
      const dayPopulation = Math.max(dayCounts.get(dayKey) || 1, 1);
      const angleOffset = side < 0 ? Math.PI * 0.72 : Math.PI * 0.28;
      const angle = ((localIndex % dayPopulation) / dayPopulation) * Math.PI * 2 + angleOffset;
      const jitter = Math.sin(index * 2.173) * this.config.orbitalJitter;
      const radial = this.config.orbitalRadius + jitter;
      const x = isAnchor ? 0 : side * (this.config.streamOffset + Math.abs(Math.cos(angle)) * radial * 0.35);
      const z = isAnchor ? 0 : Math.sin(angle) * radial;

      return {
        ...node,
        position: { x, y, z },
        layout: {
          side,
          dayKey,
          dayIndex,
          isAnchor,
          epochMs: this.epochFor(node),
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
}
