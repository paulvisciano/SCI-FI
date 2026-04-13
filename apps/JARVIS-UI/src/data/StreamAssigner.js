export class StreamAssigner {
  assign(nodes) {
    const grouped = nodes.reduce((acc, node) => {
      const key = node.stream || 'unassigned';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(node);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, streamNodes]) => ({
      name,
      nodes: streamNodes,
    }));
  }
}
