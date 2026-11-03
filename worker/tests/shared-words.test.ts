import { describe, expect, it } from 'vitest';
import { applyKnownFixes, buildWordsPrompt, estimateTokens, wordSnapshot, type WordSnapshot } from '../../shared/words';
import { TEA_WORDS_PROFILE } from '../../shared/teaWords';

const entry = (spelling: string, variants: WordSnapshot['entries'][number]['variants'] = [], extra = {}) => ({ spelling, category: 'person', status: 'confirmed', variants, ...extra });

describe('the committed shared word snapshot', () => {
  it('is a versioned AR Create export with words in it', () => {
    expect(wordSnapshot.schema).toBe('ar-create.word-library.export.v1');
    expect(wordSnapshot.version).toMatch(/^\d+\.[a-f0-9]{8}$/);
    expect(wordSnapshot.entries.length).toBeGreaterThan(100);
  });

  it('with no profile builds exactly the prompt AR Create exports, so the two never drift', () => {
    expect(buildWordsPrompt(wordSnapshot).prompt).toBe((wordSnapshot as unknown as { prompts: { en: string } }).prompts.en);
  });
});

describe('the Teajia prompt', () => {
  const built = buildWordsPrompt(wordSnapshot, TEA_WORDS_PROFILE);
  it('carries people, places and tea terms inside the token budget, and nothing from the oracle', () => {
    for (const word of ['Lu Yu', 'Yixing', 'Da Hong Pao']) expect(built.words).toContain(word);
    expect(built.words.some(word => /siddhi|gene keys|abundance/i.test(word))).toBe(false);
    expect(estimateTokens(built.prompt)).toBeLessThanOrEqual(160);
  });
  it('lets a word Adrian confirmed in the app jump the queue, newest first', () => {
    const snap: WordSnapshot = { entries: [
      entry('Older', [], { category: 'tea-term', source: { kind: 'confirmed-answer' }, addedAt: '2026-11-01T00:00:00Z' }),
      entry('Newer', [], { category: 'tea-term', source: { kind: 'confirmed-answer' }, addedAt: '2026-11-02T00:00:00Z' }),
      entry('Lu Yu', [{ text: 'luyu', kind: 'heard' }], { core: true }),
    ] };
    expect(buildWordsPrompt(snap, TEA_WORDS_PROFILE).words).toEqual(['Newer', 'Older', 'Lu Yu']);
  });
  it('stops at the budget rather than overrunning it', () => {
    const many: WordSnapshot = { entries: Array.from({ length: 200 }, (_, i) => entry(`Name${String(i).padStart(3, '0')}x`, [], { core: true })) };
    const out = buildWordsPrompt(many, TEA_WORDS_PROFILE);
    expect(out.words.length).toBeGreaterThan(5);
    expect(out.words.length).toBeLessThan(200);
    expect(estimateTokens(out.prompt)).toBeLessThanOrEqual(160);
  });
});

describe('known mishearing fixes', () => {
  it('fixes a heard spelling, leaves the original string alone and reports the change', () => {
    const raw = 'We drank with luyu today.';
    expect(applyKnownFixes(raw, wordSnapshot)).toEqual({ text: 'We drank with Lu Yu today.', fixes: [{ from: 'luyu', to: 'Lu Yu', count: 1 }] });
    expect(raw).toBe('We drank with luyu today.');
  });
  it('never rewrites an alias, which is another valid name', () => {
    const snap: WordSnapshot = { entries: [entry('Baisao', [{ text: 'by sow', kind: 'alias' }, { text: 'bai sao', kind: 'heard' }])] };
    expect(applyKnownFixes('by sow and bai sao', snap).text).toBe('by sow and Baisao');
  });
  it('matches whole words only', () => {
    const snap: WordSnapshot = { entries: [entry('Lu Yu', [{ text: 'luyu', kind: 'heard' }])] };
    expect(applyKnownFixes('Luyu wrote it. Not xluyux.', snap).text).toBe('Lu Yu wrote it. Not xluyux.');
  });
  it('skips a mishearing two words claim, one that is another word\'s spelling, and very short ones', () => {
    const snap: WordSnapshot = { entries: [
      entry('Alpha', [{ text: 'shared sound', kind: 'heard' }, { text: 'ab', kind: 'heard' }]),
      entry('Beta', [{ text: 'shared sound', kind: 'heard' }, { text: 'gamma', kind: 'heard' }]),
      entry('Gamma'),
    ] };
    expect(applyKnownFixes('shared sound ab gamma', snap)).toEqual({ text: 'shared sound ab gamma', fixes: [] });
  });
});
