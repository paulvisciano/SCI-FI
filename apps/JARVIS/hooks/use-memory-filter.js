/**
 * use-memory-filter.js - Time-based filter hook for NeuroGraph
 * Filters neurons by createdAt timestamp
 */

/**
 * Filter neurons by time range
 * @param {Array} nodes - Array of neuron nodes
 * @param {string} timeRange - Time range: '10m', '30m', '24h', '7d', 'all'
 * @returns {Array} Filtered nodes
 */
function filterNodesByTime(nodes, timeRange) {
  const now = Date.now();
  const ranges = {
    '10m': 10 * 60 * 1000,      // 10 minutes
    '30m': 30 * 60 * 1000,      // 30 minutes
    '24h': 24 * 60 * 60 * 1000, // 24 hours
    '7d': 7 * 24 * 60 * 60 * 1000, // 7 days
    'all': Infinity              // All time (no filter)
  };
  
  const cutoff = now - ranges[timeRange];
  
  return nodes.filter(n => {
    if (timeRange === 'all') return true;
    if (!n.createdAt) return false; // Skip nodes without timestamp
    return n.createdAt >= cutoff;
  });
}

/**
 * Format time range for display
 * @param {string} timeRange - Time range key
 * @returns {string} Display label
 */
function formatTimeRange(timeRange) {
  const labels = {
    '10m': 'Last 10 minutes',
    '30m': 'Last 30 minutes',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    'all': 'All time'
  };
  return labels[timeRange] || labels['24h'];
}

/**
 * Get time range label from current selection
 * @param {string} selected - Selected time range
 * @param {number} nodeCount - Total node count (for "all" option)
 * @returns {string} Formatted label
 */
function getTimeRangeLabel(selected, nodeCount) {
  if (selected === 'all') {
    return `All time (${nodeCount} nodes)`;
  }
  return formatTimeRange(selected);
}

/**
 * Hook: useMemoryFilter
 * Provides time-based filtering for NeuroGraph
 * @param {Array} nodes - All nodes from neurograph
 * @param {string} defaultRange - Default time range (default: '24h')
 * @returns {Object} Filter state and handlers
 */
function useMemoryFilter(nodes, defaultRange = '24h') {
  const [selectedRange, setSelectedRange] = useState(defaultRange);
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  
  // Filter nodes when range changes
  useEffect(() => {
    const filtered = filterNodesByTime(nodes, selectedRange);
    setFilteredNodes(filtered);
    setFilteredCount(filtered.length);
  }, [nodes, selectedRange]);
  
  // Handler for filter change
  const handleRangeChange = (newRange) => {
    setSelectedRange(newRange);
  };
  
  return {
    selectedRange,
    filteredNodes,
    filteredCount,
    handleRangeChange,
    formatTimeRange,
    getTimeRangeLabel,
    isAllTime: selectedRange === 'all'
  };
}

// Export functions for direct use
export { filterNodesByTime, formatTimeRange, getTimeRangeLabel };
export default useMemoryFilter;
