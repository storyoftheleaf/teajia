import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMedia, safeStory, rawDocument, runIntake } from './intake.mjs';

test('media support and story path safety', () => {
  assert.equal(isMedia('Interview.M4A'), true);
  assert.equal(isMedia('notes.docx'), false);
  for (const value of ['..', '.hidden', 'a/b', 'a\\b', '', 'a\nb']) assert.throws(() => safeStory(value));
  assert.equal(safeStory('茶 — Interview'), '茶 — Interview');
});
test('RAW frontmatter quotes title safely and retains original speaker text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-raw-'));
  try {
    const source = path.join(dir, 'original.m4a'); fs.writeFileSync(source, 'source');
    const doc = rawDocument('Tea: "Hong Kong"', source, {language:'zh',metadata:{diarization_adapter:'sherpa-onnx:public-models'}}, '[00:00:03] Speaker 1: 這茶很好。');
    assert.ok(doc.includes('title: "Tea: \\"Hong Kong\\""'));
    assert.ok(doc.includes('這茶很好。'));
    assert.ok(doc.includes('type: RAW'));
    assert.ok(doc.includes('sherpa-onnx:public-models'));
    assert.ok(!doc.includes('Pyannote Community-1'));
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
test('intake refuses existing immutable RAW before copying or processing source', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-existing-'));
  try {
    const inbox = path.join(dir, 'vault/Workflow/0-Inbox'); fs.mkdirSync(inbox, {recursive:true});
    const raw = path.join(inbox, 'RAW - Tea.md'); fs.writeFileSync(raw, 'immutable');
    await assert.rejects(runIntake({magVault:path.join(dir,'vault'),magFiles:path.join(dir,'files')}, {id:'test',story:'Tea',source:'/missing.m4a'}), /never overwritten/);
    assert.equal(fs.readFileSync(raw,'utf8'),'immutable');
    assert.equal(fs.existsSync(path.join(dir,'files')),false);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
