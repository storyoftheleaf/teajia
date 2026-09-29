/**
 * The rules for conversation pieces, held by the build instead of by memory.
 *
 * 1. A sentence set large appears once. It is lifted out of the paragraph it
 *    came from, never repeated beside it or elsewhere in the piece.
 * 2. No more than two photographs in a row.
 * 3. Every edit key is unique, so an owner's edit lands on one line only.
 * 4. The ending always offers a piece a visitor can open, so it never goes nowhere.
 * 5. Every question and answer traces back to the interview transcript. The
 *    transcript lives in Adrian's vault, not in this public repo, so this one
 *    runs only on a machine that has the vault; CI skips it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allBlocks, plain, type Block, type ConversationSpec } from './spec';
import { CONVERSATIONS } from './pieces';
import { isArticleVisible } from '../articleLive';

const PIECES: ConversationSpec[] = CONVERSATIONS;

const norm = (t: string) => plain(t)
  .toLowerCase()
  .replace(/[’‘`]/g, "'")
  .replace(/[“”"]/g, '')
  .replace(/[^a-z0-9'\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sentences = (t: string) => plain(t).split(/(?<=[.!?:])\s+/).map(norm).filter((s) => s.split(' ').length >= 4);

/** Each large sentence, and every other passage of words in the piece. */
function display(spec: ConversationSpec) {
  const large: { id: string; text: string }[] = [{ id: spec.ending.saying.id, text: spec.ending.saying.text }];
  const words: { id: string; text: string }[] = [];
  allBlocks(spec).forEach((b: Block) => {
    if (b.kind === 'line' || b.kind === 'on-photo') large.push({ id: b.id, text: b.text });
    if (b.kind === 'line' && b.follow) words.push(b.follow);
    if (b.kind === 'q' || b.kind === 'a') words.push({ id: b.id, text: b.text });
  });
  return { large, words };
}

describe.each(PIECES.map((p) => [p.slug, p] as const))('conversation %s', (_slug, spec) => {
  it('sets each large sentence once, and never repeats it in a paragraph', () => {
    const { large, words } = display(spec);
    const repeats: string[] = [];
    large.forEach((l) => {
      sentences(l.text).forEach((s) => {
        words.forEach((w) => { if (norm(w.text).includes(s)) repeats.push(`${l.id} repeats in ${w.id}: "${s}"`); });
        large.forEach((o) => { if (o.id !== l.id && norm(o.text).includes(s)) repeats.push(`${l.id} repeats in ${o.id}: "${s}"`); });
      });
    });
    expect(repeats).toEqual([]);
  });

  it('ends on at least one piece a visitor can open next', () => {
    expect(spec.next.filter((l) => isArticleVisible(l.to, false)).length).toBeGreaterThan(0);
  });

  it('never puts more than two photographs in a row', () => {
    const rows = allBlocks(spec).filter((b) => b.kind === 'photos').map((b) => (b.kind === 'photos' ? b.shots.length : 0));
    expect(rows.every((n) => n <= 2)).toBe(true);
  });

  it('gives every editable passage its own key', () => {
    const ids: string[] = ['title-1', 'title-2', 'dek-2', 'intro', spec.ending.saying.id];
    allBlocks(spec).forEach((b) => {
      if ('id' in b) ids.push(b.id);
      if (b.kind === 'line' && b.follow) ids.push(b.follow.id);
      if (b.kind === 'photos' && b.caption) ids.push(b.caption.id);
    });
    expect(ids.length).toBe(new Set(ids).size);
  });

  const vault = process.env.CONVERSATION_SOURCES_DIR
    ?? join(homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/Brands/Teajia/Magazine/Workflow/1-Source');
  const sourcePath = join(vault, spec.source);

  it.skipIf(!existsSync(sourcePath))('traces every question and answer to the transcript', () => {
    const transcript = norm(readFileSync(sourcePath, 'utf8'));
    const tWords = new Set(transcript.split(' '));
    // His answers and his lines: runs of three words in his order. Translated
    // and lightly trimmed, so not every run survives, but a passage nobody
    // said scores near zero.
    const runs = (t: string) => {
      const w = norm(t).split(' ');
      return w.length < 3 ? [w.join(' ')] : w.slice(0, w.length - 2).map((_, i) => w.slice(i, i + 3).join(' '));
    };
    // Adrian's questions are his to condense, so they are held to their key
    // words rather than to his spoken order.
    const keyWords = (t: string) => norm(t).split(' ').filter((w) => w.length >= 5);
    const { large, words } = display(spec);
    const questions = new Set(allBlocks(spec).filter((b) => b.kind === 'q').map((b) => (b as { id: string }).id));
    const untraced: string[] = [];
    [...large, ...words].forEach((p) => {
      const isQ = questions.has(p.id);
      // Each sentence of his is checked on its own, so one invented sentence
      // cannot hide inside a long answer that is otherwise his.
      const pieces = isQ ? [p.text] : plain(p.text).split(/(?<=[.!?:])\s+/).filter((x) => norm(x).split(' ').length >= 4);
      pieces.forEach((piece) => {
        const units = isQ ? keyWords(piece) : runs(piece);
        if (!units.length) return;
        const found = units.filter((x) => (isQ ? tWords.has(x) : transcript.includes(x))).length / units.length;
        if (found < (isQ ? 0.6 : 0.4)) untraced.push(`${p.id} (${Math.round(found * 100)}%): ${plain(piece).slice(0, 80)}`);
      });
    });
    expect(untraced).toEqual([]);
  });
});
