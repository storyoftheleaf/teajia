import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { writeReviewWorkbook } from '../review-workbook.mjs';

const bundledModules = process.env.TEA_REFERENCE_ARTIFACT_NODE_MODULES;

test('review workbook retains sources, evidence and claim decisions', { skip: !bundledModules && 'bundled artifact runtime not supplied' }, async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'tea-reference-workbook-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  await fs.symlink(bundledModules, path.join(temp, 'node_modules'), 'dir');
  const requireFromTemp = createRequire(path.join(temp, 'resolver.cjs'));
  const artifactTool = requireFromTemp('@oai/artifact-tool');
  const outputPath = path.join(temp, 'review.xlsx');
  const source = {
    sourceId: 'specialist-yiwu',
    url: 'https://example.test/yiwu',
    publisher: 'Example Specialist',
    publisherQualifications: 'Tea-history editorial publication',
    publisherRole: 'specialist_editorial',
    sourceFamily: 'specialist-article',
    language: 'en',
  };
  const evidence = {
    evidenceId: 'EVIDENCE-1', sourceId: source.sourceId, exact: 'Yiwu is in eastern Xishuangbanna.',
    heading: 'Geography', section: 'Geography', start: 0, end: 36, excerptSha256: 'abc',
  };
  const claims = [
    {
      claimId: 'CLAIM-1', sourceId: source.sourceId, evidenceId: evidence.evidenceId, subject: 'Yiwu',
      entityKind: 'tea_area', claimScope: 'geography', predicate: 'source_description', value: evidence.exact,
      sourceTerm: 'Geography', assertingPublisherRole: 'specialist_editorial', status: 'captured', uncertaintyReason: '', payloadSha256: 'hash-1',
    },
    {
      claimId: 'CLAIM-2', sourceId: 'specialist-yunnan', evidenceId: evidence.evidenceId, subject: 'Yiwu',
      entityKind: 'tea_area', claimScope: 'common_characteristics', predicate: 'source_description', value: 'Often described as fragrant.',
      sourceTerm: 'Character', assertingPublisherRole: 'specialist_editorial', status: 'held', uncertaintyReason: 'Needs private review.', payloadSha256: 'hash-2',
    },
  ];
  const capture = {
    manifest: {
      complete: true,
      continualCaptureEligible: true,
      errorCount: 0,
      duplicateSnapshotGroupCount: 0,
      autoMergeCandidateCount: 0,
      genuineContradictionCount: 0,
    },
    preview: { added: 2, changed: 0, unchanged: 0, missing: 0 },
    sources: [{
      source,
      metadata: { title: 'Yiwu Tea Region', author: 'Example Researcher', publishedDate: '2024-04-10' },
      retrieval: { accessedDate: '2026-08-10', originalSha256: 'original-hash', normalizedSha256: 'normalized-hash' },
    }],
    evidence: [evidence], claims, errors: [],
  };

  await writeReviewWorkbook({ capture, outputPath, artifactTool });
  const file = await artifactTool.FileBlob.load(outputPath);
  const workbook = await artifactTool.SpreadsheetFile.importXlsx(file);
  const sheets = (await workbook.inspect({ kind: 'sheet', include: 'name', maxChars: 5000 })).ndjson
    .trim().split('\n').map((line) => JSON.parse(line).name);
  assert.deepEqual(sheets, ['START HERE', 'SOURCES', 'EVIDENCE', 'CLAIMS', 'HELD', 'RELATIONSHIPS', 'ENTITY RESOLUTION', 'WEBSITE HANDOFF', 'COVERAGE']);
  const start = workbook.worksheets.getItem('START HERE').getRange('A3:B12').values;
  assert.deepEqual(start[1], ['Continual capture gate', 'Eligible for capped capture-only batches']);
  assert.match(workbook.worksheets.getItem('START HERE').getRange('A20').values[0][0], /website-handoff\.json is the machine feed/i);
  const values = workbook.worksheets.getItem('CLAIMS').getRange('A1:P3').values;
  assert.equal(values[0][15], 'Adrian decision');
  assert.equal(values[1][2], 'https://example.test/yiwu');
  assert.equal(values[1][3], 'EVIDENCE-1');
  const relationships = workbook.worksheets.getItem('RELATIONSHIPS').getRange('A1:M3').values;
  assert.equal(relationships[0][1], 'Classification');
  assert.equal(relationships[1][1], 'different_scope_or_method');
  const resolution = workbook.worksheets.getItem('ENTITY RESOLUTION').getRange('A1:O2').values;
  assert.equal(resolution[0][8], 'Proposed action');
  assert.equal(resolution[1][1], 'Yiwu');
  assert.equal(resolution[1][11], false);
  const handoff = workbook.worksheets.getItem('WEBSITE HANDOFF').getRange('A1:N3').values;
  assert.equal(handoff[0][6], 'Website holding');
  assert.equal(handoff[0][7], 'Website field');
  assert.equal(handoff[0][8], 'Candidate value');
  assert.equal(handoff[1][6], 'regions');
  assert.equal(handoff[1][8], 'Yiwu is in eastern Xishuangbanna.');
  assert.equal(handoff[1][11], 'hold');
  if (process.env.TEA_REFERENCE_WORKBOOK_RENDER_DIR) {
    const renderDir = process.env.TEA_REFERENCE_WORKBOOK_RENDER_DIR;
    await fs.mkdir(renderDir, { recursive: true });
    await fs.copyFile(outputPath, path.join(renderDir, 'review.xlsx'));
    for (const sheetName of sheets) {
      const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
      await fs.writeFile(path.join(renderDir, `${sheetName.toLowerCase().replaceAll(' ', '-')}.png`), new Uint8Array(await preview.arrayBuffer()));
    }
  }
});
