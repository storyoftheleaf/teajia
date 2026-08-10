import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { REPO_ROOT } from '../load-preview.mjs';
import { startTeajiaPreview, VITE_BIN } from '../teajia-preview.mjs';

test('wrapper verifies the handoff and passes its resolved path only in the child environment', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-teajia-wrapper-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  await fs.writeFile(handoffPath, '{}');
  let invocation;

  const exitCode = await startTeajiaPreview({
    argv: ['--handoff', handoffPath],
    parentEnv: { PATH: '/test/bin', TEA_REFERENCE_HANDOFF_PATH: 'stale.json' },
    spawnProcess(command, args, options) {
      invocation = { command, args, options };
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(invocation.command, VITE_BIN);
  assert.deepEqual(invocation.args, ['--mode', 'tea-reference-preview']);
  assert.equal(invocation.options.cwd, REPO_ROOT);
  assert.equal(invocation.options.stdio, 'inherit');
  assert.equal(invocation.options.env.TEA_REFERENCE_HANDOFF_PATH, path.resolve(handoffPath));
  assert.doesNotMatch(invocation.args.join(' '), /website-handoff|tea-reference-teajia-wrapper/);
});

test('wrapper rejects an unreadable handoff before spawning Vite', async () => {
  let spawned = false;
  await assert.rejects(
    startTeajiaPreview({
      argv: ['--handoff', '/missing/private-handoff.json'],
      spawnProcess() {
        spawned = true;
      },
    }),
    /cannot read.*handoff/i,
  );
  assert.equal(spawned, false);
});
