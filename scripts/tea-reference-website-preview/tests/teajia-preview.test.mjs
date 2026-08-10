import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

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

test('wrapper rejects directories and FIFOs before spawning Vite', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-handoff-kind-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const directoryPath = path.join(temp, 'handoff-directory');
  const fifoPath = path.join(temp, 'handoff-fifo');
  await fs.mkdir(directoryPath);
  const fifo = spawnSync('mkfifo', [fifoPath], { encoding: 'utf8' });
  assert.equal(fifo.status, 0, fifo.stderr);
  let spawnCount = 0;

  for (const handoffPath of [directoryPath, fifoPath]) {
    await assert.rejects(
      startTeajiaPreview({
        argv: ['--handoff', handoffPath],
        spawnProcess() {
          spawnCount += 1;
        },
      }),
      /regular file/i,
    );
  }
  assert.equal(spawnCount, 0);
});

test('wrapper forwards termination and removes its signal listeners after child exit', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-signal-forwarding-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  await fs.writeFile(handoffPath, '{}');
  const signalTarget = new EventEmitter();
  const child = new EventEmitter();
  const forwarded = [];
  let spawned;
  const didSpawn = new Promise(resolve => { spawned = resolve; });
  child.kill = signal => {
    forwarded.push(signal);
    queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };

  const running = startTeajiaPreview({
    argv: ['--handoff', handoffPath],
    signalTarget,
    spawnProcess() {
      spawned();
      return child;
    },
  });
  await didSpawn;
  assert.equal(signalTarget.listenerCount('SIGINT'), 1);
  assert.equal(signalTarget.listenerCount('SIGTERM'), 1);

  signalTarget.emit('SIGTERM');
  const exitCode = await running;

  assert.equal(exitCode, 1);
  assert.deepEqual(forwarded, ['SIGTERM']);
  assert.equal(signalTarget.listenerCount('SIGINT'), 0);
  assert.equal(signalTarget.listenerCount('SIGTERM'), 0);
});

function listenOnAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

function waitForReady(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for child readiness: ${output}`)), timeoutMs);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/READY:(\d+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(Number(match[1]));
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Lifecycle harness exited before readiness (${code ?? signal})`));
    });
  });
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve({ code: child.exitCode, signal: child.signalCode });
    const timer = setTimeout(() => reject(new Error('Timed out waiting for lifecycle harness exit')), timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function canListen(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

test('terminating the wrapper does not orphan its real child process or occupied port', { timeout: 12000 }, async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-real-lifecycle-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const handoffPath = path.join(temp, 'website-handoff.json');
  await fs.writeFile(handoffPath, '{}');
  const port = await listenOnAvailablePort();
  const previewModuleUrl = pathToFileURL(path.join(REPO_ROOT, 'scripts', 'tea-reference-website-preview', 'teajia-preview.mjs')).href;
  const serverSource = `
    const net = require('node:net');
    const server = net.createServer();
    server.listen(Number(process.argv[1]), '127.0.0.1', () => console.log('READY:' + process.pid));
    const close = () => server.close(() => process.exit(0));
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
  `;
  const harnessSource = `
    const { startTeajiaPreview } = await import(process.argv[1]);
    const exitCode = await startTeajiaPreview({
      argv: ['--handoff', process.argv[2]],
      viteBin: process.execPath,
      viteArgs: ['--eval', process.argv[4], process.argv[3]],
    });
    process.exitCode = exitCode;
  `;
  const harness = spawn(process.execPath, [
    '--input-type=module',
    '--eval',
    harnessSource,
    previewModuleUrl,
    handoffPath,
    String(port),
    serverSource,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let childPid;
  t.after(() => {
    if (harness.exitCode === null) harness.kill('SIGKILL');
    if (childPid) {
      try {
        process.kill(childPid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  });

  childPid = await waitForReady(harness);
  harness.kill('SIGTERM');
  await waitForExit(harness);

  assert.equal(await canListen(port), true, `child ${childPid} still owns port ${port}`);
});
