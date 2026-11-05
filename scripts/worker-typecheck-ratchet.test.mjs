import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { diagnosticSignature, diffDiagnostics } from './worker-typecheck-signatures.mjs';

function diagnostics(source, name = '/repo/worker/src/example.ts') {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const host = ts.createCompilerHost({ noLib: true, strict: true });
  host.getSourceFile = path => path === name ? file : undefined;
  host.writeFile = () => {};
  const program = ts.createProgram([name], { noLib: true, strict: true }, host);
  return program.getSemanticDiagnostics().map(diagnostic => diagnosticSignature(diagnostic, '/repo'));
}

const original = 'const amount: number = "unknown";';

test('relocating unchanged errors and adding comments preserves signatures', () => {
  assert.deepEqual(diagnostics('\n// explanation\n\n' + original), diagnostics(original));
});

test('a genuinely new error is rejected', () => {
  assert.ok(diffDiagnostics(diagnostics(original), diagnostics(original + '\nconst cost: number = "missing";')).length);
});

test('a replacement with the same file, code and message is rejected', () => {
  assert.ok(diffDiagnostics(diagnostics(original), diagnostics('const cost: number = "unknown";')).length);
});

test('duplicate diagnostics are counted rather than collapsed', () => {
  const [known] = diagnostics(original);
  assert.ok(diffDiagnostics([known], [known, known]).length);
});

test('fixed diagnostics must be removed from the baseline', () => {
  assert.ok(diffDiagnostics(diagnostics(original), diagnostics('const amount: number = 0;')).length);
});

test('global and non-worker diagnostics cannot silently disappear', () => {
  assert.ok(diffDiagnostics([], [diagnosticSignature({ code: 2688, messageText: 'Missing types' }, '/repo')]).length);
  assert.ok(diffDiagnostics([], diagnostics(original, '/repo/shared/example.ts')).length);
});

test('message changes remain visible even with an unchanged statement', () => {
  const file = ts.createSourceFile('/repo/worker/src/example.ts', original, ts.ScriptTarget.Latest, true);
  const diagnostic = { file, start: 6, length: 6, code: 2322, messageText: 'Old type error' };
  assert.notEqual(diagnosticSignature(diagnostic, '/repo'), diagnosticSignature({ ...diagnostic, messageText: 'New type error' }, '/repo'));
});

test('the worker config resolves its own type dependencies and reports config failures', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { collectDiagnostics } = await import('./worker-typecheck-signatures.mjs');
  const root = mkdtempSync(path.join(tmpdir(), 'worker-ratchet-'));
  try {
    mkdirSync(path.join(root, 'worker/src'), { recursive: true });
    mkdirSync(path.join(root, 'worker/node_modules/@types/local'), { recursive: true });
    writeFileSync(path.join(root, 'worker/node_modules/@types/local/index.d.ts'), 'declare const localValue: number;');
    writeFileSync(path.join(root, 'worker/tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: ['local'] }, include: ['src/**/*.ts'] }));
    writeFileSync(path.join(root, 'worker/src/example.ts'), 'const amount: number = localValue;');
    assert.deepEqual(collectDiagnostics(root), []);
    writeFileSync(path.join(root, 'worker/src/example.ts'), original);
    assert.deepEqual(collectDiagnostics(root).map(d => d.code), [2322]);
    writeFileSync(path.join(root, 'worker/tsconfig.json'), '{ broken');
    assert.ok(collectDiagnostics(root).length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
