/**
 * Memory Filter Component
 * Time-based filter dropdown for NeuroGraph (matches Orb v315 aesthetic)
 */

function MemoryFilter({ nodes, onRangeChange }) {
  const [selectedRange, setSelectedRange] = useState('24h');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  
  // Filter nodes by time range
  const filterNodesByTime = (nodes, range) => {
    const now = Date.now();
    const ranges = {
      '10m': 10 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
    
    const cutoff = now - ranges[range];
    return nodes.filter(n => {
      if (range === 'all') return true;
      if (!n.createdAt) return false;
      return n.createdAt >= cutoff;
    });
  };
  
  // Update filtered count when nodes change
  useEffect(() => {
    const filtered = filterNodesByTime(nodes, selectedRange);
    setFilteredCount(filtered.length);
  }, [nodes, selectedRange]);
  
  // Handle range change
  const handleChange = (newRange) => {
    setSelectedRange(newRange);
    setIsOpen(false);
    if (onRangeChange) {
      onRangeChange(newRange);
    }
  };
  
  // Format label
  const formatLabel = (range) => {
    if (range === 'all') {
      return `All time (${nodes.length} nodes)`;
    }
    const labels = {
      '10m': 'Last 10 minutes',
      '30m': 'Last 30 minutes',
      '24h': 'Last 24 hours',
      '7d': 'Last 7 days'
    };
    return labels[range] || labels['24h'];
  };
  
  return (
    <div className="memory-filter-container">
      {/* Filter Button */}
      <button
        className="memory-filter-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="filter-icon">⏳</span>
        <span className="filter-label">{formatLabel(selectedRange)}</span>
        <span className="filter-arrow">▼</span>
        
        {/* Glowing Effect */}
        <span className="filter-glow" />
        <span className="filter-ring" />
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="memory-filter-menu">
          {[
            { value: '10m', label: 'Last 10 minutes' },
            { value: '30m', label: 'Last 30 minutes' },
            { value: '24h', label: 'Last 24 hours' },
            { value: '7d', label: 'Last 7 days' },
            { value: 'all', label: `All time (${nodes.length} nodes)` }
          ].map((option) => (
            <button
              key={option.value}
              className={`memory-filter-item ${selectedRange === option.value ? 'active' : ''}`}
              onClick={() => handleChange(option.value)}
            >
              <span className="item-icon">{option.value === 'all' ? '⏱️' : '🕒'}</span>
              <span className="item-label">{option.label}</span>
              {selectedRange === option.value && <span className="checkmark">✓</span>}
            </button>
          ))}
        </div>
      )}
      
      {/* Node Count Display */}
      <span className="node-count-display">
        <span className="count-value">{filteredCount}</span>
        <span className="count-label">neurons active</span>
      </span>
    </div>
  );
}

// Styling
function MemoryFilterStyles() {
  return (
    <style>{`
      /* Memory Filter Container */
      .memory-filter-container {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
      }

      /* Filter Button */
      .memory-filter-btn {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(0, 255, 255, 0.1);
        border: 1px solid rgba(0, 255, 255, 0.3);
        backdrop-filter: blur(8px);
        color: #c8e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }

      .memory-filter-btn:hover {
        background: rgba(0, 255, 255, 0.15);
        border-color: rgba(0, 255, 255, 0.5);
        box-shadow:
          0 0 16px rgba(0, 255, 255, 0.1),
          0 0 4px rgba(0, 255, 255, 0.4) inset;
      }

      .memory-filter-btn:active {
        transform: scale(0.98);
      }

      /* Filter Icons */
      .filter-icon {
        font-size: 16px;
      }

      .filter-label {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .filter-arrow {
        font-size: 10px;
        color: rgba(0, 255, 255, 0.7);
      }

      /* Filter Glow Effect */
      .filter-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
        background: radial-gradient(circle, rgba(0, 255, 255, 0.2) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .memory-filter-btn:hover .filter-glow {
        opacity: 1;
      }

      /* Filter Ring Effect */
      .filter-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 120%;
        height: 120%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 1px solid rgba(0, 255, 255, 0.15);
        animation: spin 8s linear infinite;
      }

      @keyframes spin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      /* Filter Menu */
      .memory-filter-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        width: 240px;
        background: rgba(5, 10, 20, 0.98);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 16px;
        padding: 8px;
        box-shadow:
          0 16px 48px rgba(0, 0, 0, 0.8),
          0 0 32px rgba(0, 255, 255, 0.08);
        z-index: 5500;
        max-height: 320px;
        overflow-y: auto;
        animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes slide-down {
        from {
          opacity: 0;
          transform: translateY(-12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Filter Menu Items */
      .memory-filter-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 255, 255, 0.05);
        border: 1px solid rgba(0, 255, 255, 0.1);
        color: #c8e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .memory-filter-item:hover {
        background: rgba(0, 255, 255, 0.12);
        border-color: rgba(0, 255, 255, 0.4);
        transform: translateX(4px);
      }

      .memory-filter-item.active {
        background: rgba(0, 255, 255, 0.18);
        border-color: rgba(0, 255, 255, 0.6);
        box-shadow: 0 0 12px rgba(0, 255, 255, 0.15);
      }

      .item-icon {
        font-size: 14px;
      }

      .item-label {
        flex: 1;
      }

      .checkmark {
        font-size: 10px;
        color: rgba(0, 255, 136, 0.8);
      }

      /* Node Count Display */
      .node-count-display {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: rgba(0, 255, 255, 0.08);
        border: 1px solid rgba(0, 255, 255, 0.2);
        border-radius: 8px;
        color: #00ffff;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 0 8px rgba(0, 255, 255, 0.08);
      }

      .count-value {
        font-weight: 600;
        color: #00ffff;
      }

      .count-label {
        font-size: 10px;
        color: rgba(0, 255, 255, 0.7);
      }

      /* Mobile adjustments */
      @media (max-width: 768px) {
        .memory-filter-container {
          flex-direction: column;
          gap: 8px;
          align-items: flex-start;
        }

        .memory-filter-btn {
          width: 100%;
          justify-content: center;
        }

        .memory-filter-menu {
          width: 100%;
          left: 0;
        }

        .node-count-display {
          width: 100%;
          justify-content: center;
        }
      }
    `}</style>
  );
}

// Export component
function MemoryFilterWithStyles({ nodes, onRangeChange }) {
  return (
    <>
      <MemoryFilter nodes={nodes} onRangeChange={onRangeChange} />
      <MemoryFilterStyles />
    </>
  );
}

export default MemoryFilterWithStyles;
export { MemoryFilter };
