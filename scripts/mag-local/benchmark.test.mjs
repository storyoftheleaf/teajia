import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, editCounts, compare } from './benchmark.mjs';

test('normalization separates code-switched Han and folds full-width Latin', () => {
  assert.deepEqual(tokenize('Ｐｕｅｒ茶，Tea 安茶 ８５!'), ['puer', '茶', 'tea', '安', '茶', '85']);
  assert.deepEqual(tokenize('café CAFÉ'), ['café', 'café']);
});

test('counts insertions, deletions and substitutions, including empty text', () => {
  assert.deepEqual(editCounts(['a', 'b'], ['a', 'x', 'b']),
    { distance: 1, substitutions: 0, deletions: 0, insertions: 1 });
  assert.deepEqual(editCounts(['a', 'b', 'c'], ['a', 'c']),
    { distance: 1, substitutions: 0, deletions: 1, insertions: 0 });
  assert.deepEqual(editCounts(['茶', 'tea'], ['茶', 'oolong']),
    { distance: 1, substitutions: 1, deletions: 0, insertions: 0 });
  assert.equal(editCounts([], ['tea']).insertions, 1);
  assert.equal(editCounts(['tea'], []).deletions, 1);
});

const local = { metadata: { duration_seconds: 10 }, segments: [
  { start: 1, end: 5, text: '茶 is good', speaker: 'SPEAKER_00' },
] };
const spokenly = { content: { fileTranscription: { _0: {
  audioFile: { duration: 10 }, fileName: 'test.wav', state: { completed: { _0: {
    modelId: 'whisper-v3', segments: [{ start: 1, end: 5, text: '茶 is good', speakerId: 'Adrian' }],
  } } },
} } } };

test('compares actual Spokenly shape without treating label differences as errors', () => {
  const report = compare(local, spokenly);
  assert.equal(report.text.disagreement_rate, 0);
  assert.equal(report.local.speaker_count, 1);
  assert.equal(report.spokenly.model, 'whisper-v3');
  assert.match(report.warnings[0], /not human ground truth/);
  assert.equal(report.source.duration_delta_seconds, 0);
});

test('failed baseline and invalid timing are refused; empty baseline rate is null', () => {
  assert.throws(() => compare(local, { content: { fileTranscription: { _0: { state: { failed: {} } } } } }), /completed/);
  assert.throws(() => compare({ ...local, segments: [{ start: 5, end: 1, text: 'tea' }] }, spokenly), /timestamps/);
  const empty = structuredClone(spokenly);
  empty.content.fileTranscription._0.state.completed._0.segments = [];
  assert.equal(compare(local, empty).text.disagreement_rate, null);
});
