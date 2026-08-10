export function parsePreviewArgs(argv) {
  const parsed = {
    handoffPath: '',
    existingPath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--handoff', '--existing'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Value required for ${argument}`);
    index += 1;
    if (argument === '--handoff') parsed.handoffPath = value;
    if (argument === '--existing') parsed.existingPath = value;
  }

  if (!parsed.handoffPath) throw new Error('--handoff is required');
  return Object.freeze(parsed);
}

export function parseTeajiaPreviewArgs(argv) {
  let handoffPath = '';

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--handoff') throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Value required for ${argument}`);
    handoffPath = value;
    index += 1;
  }

  if (!handoffPath) throw new Error('--handoff is required');
  return Object.freeze({ handoffPath });
}
