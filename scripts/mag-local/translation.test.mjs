import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { translateTranscript, translationStatus, loadTranslation, translatedMarkdown, refreshTranslationOutputs } from './translation.mjs';
function fixture(t) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mag-translation-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const result = { language: 'zh', speakers: [{ id: 'SPEAKER_00', name: 'Adrian' }], segments: [{ id: 'a', speaker: 'SPEAKER_00', start: 1, end: 2, text: '你好', words: [{ text: '你好', start: 1, end: 2 }] }, { id: 'b', speaker: 'SPEAKER_00', start: 2, end: 3, text: '喝茶' }], metadata: { review: { status: 'reviewed' } } };
  fs.writeFileSync(path.join(output, 'transcript.json'), JSON.stringify(result));
  fs.writeFileSync(path.join(output, 'transcript.md'), 'ORIGINAL MARKDOWN');
  fs.writeFileSync(path.join(output, 'RAW.md'), 'IMMUTABLE RAW');
  return { job: { output, id: 'test', story: 'Tea interview' }, result };
}
function mock(callback = () => 'Hello') {
  let calls = 0;
  const fetch = async (url, options) => {
    assert.equal(url.hostname, '127.0.0.1');
    const request = JSON.parse(options.body);
    assert.equal(request.stream, false);
    assert.equal(request.format.type, 'object');
    const text = await callback(++calls, JSON.parse(request.prompt));
    return { ok: true, json: async () => ({ done: true, response: JSON.stringify({ text }) }) };
  };
  return { config: { translation: { model: 'qwen3:8b', fetch } }, calls: () => calls };
}
test('local translation saves both without rewriting original, retains speaker/time, excludes translated word alignment', async t => {
  const { job, result } = fixture(t), before = JSON.stringify(result), engine = mock((i) => i === 1 ? 'Hello' : 'Drink tea');
  const translated = await translateTranscript(engine.config, job, result, 'en');
  assert.equal(JSON.stringify(result), before);
  assert.equal(fs.readFileSync(path.join(job.output, 'transcript.json'), 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(job.output, 'transcript.md'), 'utf8'), 'ORIGINAL MARKDOWN');
  assert.equal(fs.readFileSync(path.join(job.output, 'RAW.md'), 'utf8'), 'IMMUTABLE RAW');
  assert.deepEqual(translated.segments.map(s => [s.id, s.start, s.end, s.speaker, s.text]), [['a', 1, 2, 'SPEAKER_00', 'Hello'], ['b', 2, 3, 'SPEAKER_00', 'Drink tea']]);
  assert.equal(translated.segments[0].words, undefined);
  assert.equal(translated.metadata.review.status, 'unreviewed');
  assert.equal(translated.metadata.translation.wordAlignment, false);
  assert.match(fs.readFileSync(path.join(job.output, 'translation.en.md'), 'utf8'), /Unreviewed machine translation/);
  assert.equal(translationStatus(job, result)[0].state, 'complete');
  assert.equal(translationStatus(job, result)[0].stale, false);
});
test('completed segment cache resumes failed translation, names regenerate without stale flag or inference', async t => {
  const { job, result } = fixture(t), engine = mock(i => { if (i === 2) throw new Error('local model stopped'); return i === 1 ? 'Hello' : 'Drink tea'; });
  await assert.rejects(translateTranscript(engine.config, job, result, 'en'), /local model stopped/);
  assert.equal(translationStatus(job, result)[0].completed, 1);
  assert.equal(translationStatus(job, result)[0].state, 'failed');
  assert.equal(loadTranslation(job, result, 'en'), null);
  await translateTranscript(engine.config, job, result, 'en');
  assert.equal(engine.calls(), 3);
  result.speakers[0].name = 'Matthew';
  const loaded = loadTranslation(job, result, 'en');
  assert.equal(loaded.stale, false);
  assert.match(translatedMarkdown(job, loaded), /Matthew/);
  await refreshTranslationOutputs({},job,result);
  assert.match(fs.readFileSync(path.join(job.output,'translation.en.md'),'utf8'), /Matthew/);
  assert.match(fs.readFileSync(path.join(job.output,'translation.en.txt'),'utf8'), /Matthew/);
  await translateTranscript(engine.config, job, result, 'en');
  assert.equal(engine.calls(), 3);
  result.segments[0].text = '更正';
  assert.equal(loadTranslation(job, result, 'en').stale, true);
  assert.equal(translationStatus(job, result)[0].stale, true);
  await refreshTranslationOutputs({},job,result);
  assert.match(fs.readFileSync(path.join(job.output,'translation.en.md'),'utf8'), /translation_stale: true/);
  assert.match(fs.readFileSync(path.join(job.output,'translation.en.txt'),'utf8'), /Original changed after translation/);
});
test('translation only permits localhost inference and safe language sidecars', async t => {
  const { job, result } = fixture(t);
  await assert.rejects(translateTranscript({ translation: { baseUrl: 'https://example.com' } }, job, result, 'en'), /local Ollama/);
  await assert.rejects(translateTranscript({ translation: { model: 'qwen3:cloud' } }, job, result, 'en'), /downloaded local/);
  await assert.rejects(translateTranscript({}, job, result, '../bad'), /language/);
});
test('invalid output is recoverable and interrupted worker exposes retry state', async t => {
  const { job, result } = fixture(t);
  const config = { translation: { fetch: async () => ({ ok: true, json: async () => ({ response: 'broken' }) }) } };
  await assert.rejects(translateTranscript(config, job, result, 'en'), /invalid translation JSON/);
  const file = path.join(job.output, 'translations/en.state.json');
  const state = JSON.parse(fs.readFileSync(file)); state.state = 'running'; state.pid = 99999999;
  fs.writeFileSync(file, JSON.stringify(state));
  fs.writeFileSync(path.join(job.output, 'translations/en.lock'), JSON.stringify({ pid: 99999999 }));
  assert.equal(translationStatus(job, result)[0].state, 'interrupted');
  await translateTranscript(mock().config, job, result, 'en');
  assert.equal(translationStatus(job, result)[0].state, 'complete');
});
