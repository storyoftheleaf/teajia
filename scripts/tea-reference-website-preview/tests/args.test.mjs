import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePreviewArgs, parseTeajiaPreviewArgs } from '../args.mjs';

test('accepts read-only handoff and current snapshot options', () => {
  assert.deepEqual(parsePreviewArgs([
    '--handoff',
    '/tmp/website-handoff.json',
    '--existing',
    '/tmp/current.json',
  ]), {
    handoffPath: '/tmp/website-handoff.json',
    existingPath: '/tmp/current.json',
  });
});

test('defaults to no current snapshot', () => {
  assert.deepEqual(parsePreviewArgs(['--handoff', 'handoff.json']), {
    handoffPath: 'handoff.json',
    existingPath: '',
  });
});

test('requires a handoff and rejects write-shaped arguments', () => {
  assert.throws(() => parsePreviewArgs([]), /handoff.*required/i);
  for (const argument of ['--output', '--apply', '--publish', '--approve', '--assimilate', '--database', '--port', '--no-open']) {
    assert.throws(
      () => parsePreviewArgs(['--handoff', 'handoff.json', argument, 'value']),
      new RegExp(`unknown argument.*${argument.slice(2)}`, 'i'),
    );
  }
});

test('Teajia preview accepts only an explicit handoff path', () => {
  assert.deepEqual(parseTeajiaPreviewArgs(['--handoff', '/tmp/website-handoff.json']), {
    handoffPath: '/tmp/website-handoff.json',
  });
  assert.throws(() => parseTeajiaPreviewArgs([]), /handoff.*required/i);
  assert.throws(
    () => parseTeajiaPreviewArgs(['--handoff', 'handoff.json', '--output', 'public.json']),
    /unknown argument.*output/i,
  );
});
