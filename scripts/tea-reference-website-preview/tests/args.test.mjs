import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePreviewArgs } from '../args.mjs';

test('accepts read-only handoff, current snapshot, and local server options', () => {
  assert.deepEqual(parsePreviewArgs([
    '--handoff',
    '/tmp/website-handoff.json',
    '--existing',
    '/tmp/current.json',
    '--port',
    '7791',
    '--no-open',
  ]), {
    handoffPath: '/tmp/website-handoff.json',
    existingPath: '/tmp/current.json',
    port: 7791,
    open: false,
  });
});

test('defaults to an isolated local port and browser opening', () => {
  assert.deepEqual(parsePreviewArgs(['--handoff', 'handoff.json']), {
    handoffPath: 'handoff.json',
    existingPath: '',
    port: 7787,
    open: true,
  });
});

test('requires a handoff and rejects write-shaped arguments', () => {
  assert.throws(() => parsePreviewArgs([]), /handoff.*required/i);
  for (const argument of ['--output', '--apply', '--publish', '--approve', '--assimilate', '--database']) {
    assert.throws(
      () => parsePreviewArgs(['--handoff', 'handoff.json', argument, 'value']),
      new RegExp(`unknown argument.*${argument.slice(2)}`, 'i'),
    );
  }
});

test('rejects invalid ports', () => {
  assert.throws(() => parsePreviewArgs(['--handoff', 'handoff.json', '--port', '0']), /port/i);
  assert.throws(() => parsePreviewArgs(['--handoff', 'handoff.json', '--port', 'abc']), /port/i);
});
