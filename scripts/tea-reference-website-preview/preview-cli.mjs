#!/usr/bin/env node
import { parsePreviewArgs } from './args.mjs';
import { loadReceivingPreview } from './load-preview.mjs';

function operationCounts(operations) {
  const counts = {};
  for (const operation of operations) {
    if (!counts[operation.resourceType]) counts[operation.resourceType] = { create: 0, update: 0, noOp: 0, conflict: 0, held: 0 };
    const key = operation.action === 'no-op' ? 'noOp' : operation.action;
    counts[operation.resourceType][key] += 1;
  }
  return counts;
}

try {
  const options = parsePreviewArgs(process.argv.slice(2));
  const preview = await loadReceivingPreview(options);
  process.stdout.write(`${JSON.stringify({
    manifest: preview.manifest,
    summary: preview.summary,
    resources: operationCounts(preview.operations),
    publicPreview: {
      entries: preview.publicPreview.entryCount,
      sources: preview.publicPreview.sourceCount,
      sections: preview.publicPreview.sections.map(section => ({ id: section.id, entries: section.entries.length })),
    },
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
