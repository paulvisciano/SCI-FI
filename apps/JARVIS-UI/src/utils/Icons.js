const streamIcons = {
  control: '[CTRL]',
  memory: '[MEM]',
  output: '[OUT]',
  unassigned: '[N/A]',
};

export function iconForStream(streamName) {
  return streamIcons[streamName] ?? streamIcons.unassigned;
}
