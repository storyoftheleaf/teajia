export function parsePreviewArgs(argv) {
  const parsed = {
    handoffPath: '',
    existingPath: '',
    port: 7787,
    open: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-open') {
      parsed.open = false;
      continue;
    }
    if (!['--handoff', '--existing', '--port'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Value required for ${argument}`);
    index += 1;
    if (argument === '--handoff') parsed.handoffPath = value;
    if (argument === '--existing') parsed.existingPath = value;
    if (argument === '--port') {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid local preview port: ${value}`);
      parsed.port = port;
    }
  }

  if (!parsed.handoffPath) throw new Error('--handoff is required');
  return Object.freeze(parsed);
}
