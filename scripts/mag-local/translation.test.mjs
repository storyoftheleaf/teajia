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
    const prompt = JSON.parse(request.prompt);
    const translated = await callback(++calls, prompt);
    const segments = prompt.segments.map((segment, index) => ({ id: segment.id, translated_text: Array.isArray(translated) ? translated[index] : translated }));
    return { ok: true, json: async () => ({ done: true, response: JSON.stringify({ segments }) }) };
  };
  return { config: { translation: { model: 'qwen3:8b', fetch } }, calls: () => calls };
}
test('local translation saves both without rewriting original, retains speaker/time, excludes translated word alignment', async t => {
  const { job, result } = fixture(t), before = JSON.stringify(result), engine = mock(() => ['Hello', 'Drink tea']);
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
  const { job, result } = fixture(t);
  result.segments = Array.from({ length: 13 }, (_, i) => ({ ...result.segments[i % 2], id: String(i), start: i, end: i + 1 }));
  const engine = mock(i => { if (i === 2) throw new Error('local model stopped'); return i === 1 ? 'Hello' : 'Drink tea'; });
  await assert.rejects(translateTranscript(engine.config, job, result, 'en'), /local model stopped/);
  assert.equal(translationStatus(job, result)[0].completed, 12);
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

test('conversation batches include adjacent turns, retain source text and map reordered IDs without moving timestamps', async t => {
  const { job, result } = fixture(t);
  result.segments = Array.from({ length: 14 }, (_, index) => ({ id: String(index), start: index, end: index + 1, speaker: index % 2 ? 'SPEAKER_01' : 'SPEAKER_00', text: `原文 ${index}` }));
  const requests = [];
  const config = { translation: { fetch: async (_url, options) => {
    const request = JSON.parse(options.body), prompt = JSON.parse(request.prompt);
    requests.push(prompt);
    return { ok: true, json: async () => ({ done: true, response: JSON.stringify({ segments: prompt.segments.toReversed().map(segment => ({ id: segment.id, translated_text: `Translated ${segment.id}` })) }) }) };
  } } };
  const translated = await translateTranscript(config, job, result, 'en');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].segments.length, 12);
  assert.deepEqual(requests[0].next.map(segment => segment.source_text), ['原文 12', '原文 13']);
  assert.deepEqual(requests[1].previous.map(segment => segment.source_text), ['原文 9', '原文 10', '原文 11']);
  assert.equal(requests[0].segments[1].speaker, 'SPEAKER_01');
  assert.deepEqual(translated.segments.map(segment => [segment.id, segment.start, segment.end, segment.speaker, segment.sourceText]), result.segments.map(segment => [segment.id, segment.start, segment.end, segment.speaker, segment.text]));
  assert.equal(translated.segments[0].text, 'Translated segment:0');
  assert.equal(translated.metadata.translation.method, 'conversation-batches');
  assert.equal(translationStatus(job, result)[0].completed, 14);
});
test('rejects missing, duplicate and invented IDs before caching or publishing a translation', async t => {
  for (const segments of [
    [{ id: 'segment:0', translated_text: 'Hello' }],
    [{ id: 'segment:0', translated_text: 'Hello' }, { id: 'segment:0', translated_text: 'Tea' }],
    [{ id: 'segment:0', translated_text: 'Hello' }, { id: 'invented', translated_text: 'Tea' }],
  ]) {
    const { job, result } = fixture(t);
    const config = { translation: { fetch: async () => ({ ok: true, json: async () => ({ done: true, response: JSON.stringify({ segments }) }) }) } };
    await assert.rejects(translateTranscript(config, job, result, 'en'), /incomplete translation batch|translation IDs/);
    assert.equal(loadTranslation(job, result, 'en'), null);
    assert.equal(fs.existsSync(path.join(job.output, 'translations/en.cache.json')), false);
    assert.equal(translationStatus(job, result)[0].completed, 0);
  }
});
test('old fragment cache is not reused for conversation translation and truncated batches never publish', async t => {
  const { job, result } = fixture(t);
  fs.mkdirSync(path.join(job.output, 'translations'));
  fs.writeFileSync(path.join(job.output, 'translations/en.cache.json'), JSON.stringify({ old: 'Sloppy old result' }));
  const engine = mock(() => ['Hello', 'Drink tea']);
  await translateTranscript(engine.config, job, result, 'en');
  assert.equal(engine.calls(), 1);
  const saved = fs.readFileSync(path.join(job.output, 'translation.en.json'), 'utf8');
  result.segments[0].text = '更正';
  await assert.rejects(translateTranscript({ translation: { fetch: async () => ({ ok: true, json: async () => ({ done_reason: 'length', response: '{}' }) }) } }, job, result, 'en'), /truncated/);
  assert.equal(fs.readFileSync(path.join(job.output, 'translation.en.json'), 'utf8'), saved);
  assert.equal(loadTranslation(job, result, 'en').stale, true);
});
test('older fragment translations remain readable and are distinguished from source changes', async t => {
  const { job, result } = fixture(t);
  await translateTranscript(mock().config, job, result, 'en');
  const json = path.join(job.output, 'translation.en.json'), stateFile = path.join(job.output, 'translations/en.state.json');
  const saved = JSON.parse(fs.readFileSync(json)), state = JSON.parse(fs.readFileSync(stateFile));
  delete saved.metadata.translation.version; delete state.version;
  fs.writeFileSync(json, JSON.stringify(saved)); fs.writeFileSync(stateFile, JSON.stringify(state));
  assert.equal(loadTranslation(job, result, 'en').outdated, true);
  assert.equal(loadTranslation(job, result, 'en').stale, false);
  assert.equal(translationStatus(job, result)[0].outdated, true);
  assert.equal(translationStatus(job, result)[0].stale, false);
});
test('large source turns bound batches independently of segment count', async t => {
  const { job, result } = fixture(t);
  result.segments = Array.from({ length: 4 }, (_, index) => ({ id: String(index), start: index, end: index + 1, text: '茶'.repeat(1000) }));
  const sizes = [];
  const engine = mock((_call, prompt) => { sizes.push(prompt.segments.length); return 'Tea'; });
  await translateTranscript(engine.config, job, result, 'en');
  assert.deepEqual(sizes, [2, 2]);
});
test('rejects source-language copying without replacing the existing good translation', async t => {
  const { job, result } = fixture(t);
  result.segments[0].text = '好的,是在录制中';
  await translateTranscript(mock(() => ['Okay, it is recording.', 'Drink tea']).config, job, result, 'en');
  const file = path.join(job.output, 'translation.en.json'), before = fs.readFileSync(file, 'utf8');
  result.segments[1].text = '喝茶的时候不要急';
  const copying = mock((_call, prompt) => prompt.segments.map(segment => segment.source_text));
  await assert.rejects(translateTranscript(copying.config, job, result, 'en'), /did not translate/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(translationStatus(job, result)[0].state, 'failed');
});
test('target-language checks allow Chinese names and already-English turns within mixed recordings', async t => {
  const { job, result } = fixture(t);
  result.segments = [{ id: 'a', start: 0, end: 1, text: 'Good morning, this tea is from Hong Kong.' }, { id: 'b', start: 1, end: 2, text: '張三' }];
  const engine = mock(() => [result.segments[0].text, '張三']);
  const translated = await translateTranscript(engine.config, job, result, 'en');
  assert.equal(translated.segments[0].text, result.segments[0].text);
  assert.equal(translated.segments[1].text, '張三');
});
test('rejects English-only sentences requested as Chinese', async t => {
  const { job, result } = fixture(t);
  result.language = 'en'; result.segments = [{ start: 0, end: 1, text: 'This tea was stored in Hong Kong for many years.' }];
  await assert.rejects(translateTranscript(mock((_call, prompt) => prompt.segments.map(segment => segment.source_text)).config, job, result, 'zh'), /did not produce a Chinese translation/);
  assert.equal(loadTranslation(job, result, 'zh'), null);
});
