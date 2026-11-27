import assert from 'node:assert/strict';
import test from 'node:test';
import { judgePrompt, parseVerdict } from '../lib/judge.mjs';

test('a clear approval is read as an approval', () => {
  assert.deepEqual(parseVerdict('{"choice": "approve", "reason": "Every fact is in the note."}'), { choice: 'approve', reason: 'Every fact is in the note.' });
});

test('anything unreadable goes to Adrian, never up', () => {
  assert.equal(parseVerdict('I think this is fine.').choice, 'ask');
  assert.equal(parseVerdict('{"choice": "yes"}').choice, 'ask');
  assert.equal(parseVerdict('{"choice": "approve", "reason": ').choice, 'ask');
});

test('a rework carries its fix', () => {
  assert.deepEqual(parseVerdict('{"choice": "rework", "reason": "No research note.", "fix": "Research the route."}'), { choice: 'rework', reason: 'No research note.', fix: 'Research the route.' });
});

test('the prompt carries the page rules and says when the research note is missing', () => {
  const prompt = judgePrompt({ kind: 'claim', groupLabel: 'Naka', groupMeta: 'Place', label: 'Where it is', text: 'Naka is a village.', before: null, scope: 'Naka', sources: [] }, { pages: 'RULE-ONE', voice: 'VOICE' }, null);
  assert.match(prompt, /RULE-ONE/);
  assert.match(prompt, /research note behind the page is missing/);
});
