import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { markdownTranscript, reviewEligibility, writeWorkingOutputs, saveToMag } from './outputs.mjs';
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

test('save bundles named current originals and fresh translations while preserving RAW and excluding old translations', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mag-save-'));
  try {
    const {translationSourceDigest}=await import('./translation.mjs');
    const raw=path.join(dir,'RAW.md');fs.writeFileSync(raw,'immutable original');
    const savedJob={...job,id:'12345678-1234-1234-1234-123456789abc',output:path.join(dir,'outputs'),raw};
    fs.mkdirSync(path.join(savedJob.output,'translations'),{recursive:true});
    for(const [language,version,sourceDigest] of [['es',3,translationSourceDigest(result)],['fr',3,'changed'],['de',2,translationSourceDigest(result)]]) {
      fs.writeFileSync(path.join(savedJob.output,'translations',`${language}.state.json`),JSON.stringify({language,version,state:'complete',sourceDigest}));
      fs.writeFileSync(path.join(savedJob.output,`translation.${language}.json`),JSON.stringify({...result,language,metadata:{translation:{version,sourceDigest,sourceLanguage:'en',model:'local'}}}));
    }
    const saved=await saveToMag(savedJob,result,{i64Export:{enabled:true}});
    assert.equal(saved.state,'saved');assert.equal(saved.files.length,3);
    assert.deepEqual(saved.excludedTranslations.map(t=>t.language).sort(),['de','fr']);
    assert.equal(saved.files[2].url,`/transcription/${savedJob.id}/translation.md?language=es`);
    assert.match(fs.readFileSync(path.join(savedJob.output,'translation.es.md'),'utf8'),/Adrian/);
    assert.equal(fs.existsSync(path.join(savedJob.output,'translation.fr.md')),false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(savedJob.output,'transcript.json'))),result);
    assert.equal(fs.readFileSync(raw,'utf8'),'immutable original');
    assert.equal(savedJob.export.state,'failed');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
