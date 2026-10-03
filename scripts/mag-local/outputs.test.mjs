import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { markdownTranscript, reviewEligibility, writeWorkingOutputs } from './outputs.mjs';
const job = { id: 'record-1', story: 'Tea: "Hong Kong"', source: '/private/audio.m4a', raw: '/private/RAW.md' };
const result = { speakers: [{ id: 'SPEAKER_00', name: 'Adrian' }], segments: [{ start: 61.2, end: 63.8, speaker: 'SPEAKER_00', text: 'Tea.' }] };
test('working Markdown retains record specific mapping, timestamps and honest review status', () => {
  const md = markdownTranscript(job, result);
  assert.match(md, /title: "Tea: \\"Hong Kong\\""/);
  assert.match(md, /speaker_map: {"SPEAKER_00":"Adrian"}/);
  assert.match(md, /\[00:01:01–00:01:03\] Adrian/);
  assert.match(md, /review_status: unreviewed/);
  assert.match(md, /kind: transcript/);
  assert.match(markdownTranscript(job, result, {reviewBaseUrl:"http:\/\/private.test:8766\/"}), /source_url: "http:\/\/private.test:8766\/transcription\/record-1\/view"/);
  assert.match(md, /attribution and text still need checking/);
  assert.equal(reviewEligibility(result), true);
  assert.equal(reviewEligibility({ ...result, speakers: [{id:'SPEAKER_00',name:''}] }), false);
  assert.equal(reviewEligibility({ ...result, segments: [{ ...result.segments[0], speaker: null }] }), false);
  assert.equal(reviewEligibility({ ...result, segments: [{ ...result.segments[0], speaker: 'unknown' }] }), false);
});
test('automatic outputs overwrite only working exports', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-outputs-'));
  try {
    const raw = path.join(dir, 'raw.md'); fs.writeFileSync(raw, 'immutable');
    const output = path.join(dir, 'working');
    await writeWorkingOutputs({ ...job, output, raw }, result);
    assert.match(fs.readFileSync(path.join(output,'transcript.txt'),'utf8'), /Adrian: Tea/);
    assert.match(fs.readFileSync(path.join(output,'transcript.md'),'utf8'), /review_status: unreviewed/);
    await writeWorkingOutputs({ ...job, output, raw }, {...result,metadata:{review:{status:'reviewed',reviewedAt:'2026-10-04T00:00:00Z'}}});
    assert.match(fs.readFileSync(path.join(output,'transcript.md'),'utf8'), /review_status: reviewed/);
    assert.equal(fs.readFileSync(raw,'utf8'),'immutable');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('failed i64 export preserves local working outputs and records a retryable error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-export-error-'));
  try {
    const pending = { ...job, output: dir };
    await writeWorkingOutputs(pending, result, {i64Export:{enabled:true}});
    assert.equal(pending.export.state, 'failed');
    assert.ok(pending.export.error);
    assert.match(fs.readFileSync(path.join(dir,'transcript.md'),'utf8'), /Adrian/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
