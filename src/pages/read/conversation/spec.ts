/**
 * The shape of a conversation piece on /read: an interview told in parts.
 *
 * An article is this data and nothing else. `ConversationArticle` draws any
 * spec, so the next conversation is a new spec file, not a copy of the last
 * article's layout code. Rules for these pieces live here and in
 * conversation.test.ts, where they fail the build instead of relying on
 * whoever writes the next one to remember them:
 *
 *   - Every question and answer comes from the interview transcript.
 *   - A sentence set large is lifted OUT of its paragraph, never repeated
 *     beside it, and it is always a whole sentence of his.
 *   - Words sit on a photograph only where the photograph has empty space.
 *   - No more than two photographs in a row, so a phone never stacks a wall
 *     of pictures with no words between them.
 *
 * Text markup, kept deliberately small so the owner can edit it on the page:
 *   _words_    emphasis (italic, in the warm tone)
 *   ==words==  the bronze highlight inside a large line
 *   Chinese characters are found and marked as Chinese automatically.
 */
import type { MoreLink } from '../immersive';

export type Shot = {
  /** Stable key for the photo frame; the owner's replacement photo is stored under it. */
  slot: string;
  /** File under the article's image folder. */
  file: string;
  alt: string;
  /** Focal point, 0..1. */
  x?: number;
  y?: number;
};

export type LineSize = 'xl' | 'l' | 'm';

/** Every block that carries words has an `id`: its text is stored under that key when edited. */
export type Block =
  | { kind: 'q'; id: string; text: string }
  | { kind: 'a'; id: string; text: string }
  /** A sentence set large. `follow` is the plain sentence that continues it, set on the column below. */
  | { kind: 'line'; id: string; text: string; size: LineSize; follow?: { id: string; text: string } }
  /** A photograph beside words. `bleed` runs the photograph to the page edge and narrows the words; use it on a few, on purpose. */
  | { kind: 'side'; shot: Shot; flip?: boolean; bleed?: boolean; blocks: Block[] }
  | { kind: 'photos'; shots: Shot[]; aspect?: string; caption?: { id: string; text: string }; stagger?: boolean; narrow?: boolean }
  /** One photograph. `offset` pushes it to one edge of the page instead of the centre. */
  | { kind: 'wide'; shot: Shot; aspect?: string; narrow?: boolean; offset?: 'left' | 'right' }
  | { kind: 'bleed'; shot: Shot }
  /** Words set on the photograph's empty space. `ink` and `accent` are measured against that one photo. */
  | { kind: 'on-photo'; id: string; shot: Shot; text: string; ink: string; accent: string; aspect: string }
  /** A large vertical Chinese word hung beside the words that explain it. */
  | { kind: 'glyph'; glyph: string; blocks: Block[] };

/** `opener` opens the part as a spread: the photograph on one side, the part and its title on the other. */
export type Part = { title: string; opener?: Shot; blocks: Block[] };

export interface ConversationSpec {
  /** Story-edit slug; the owner's edits are stored under it. */
  slug: string;
  /** Route, e.g. /read/porcelain-and-tea */
  path: string;
  /** Folder the photographs ship in, e.g. /read/porcelain-and-tea/ */
  images: string;
  /** The transcript note in Adrian's vault this piece is drawn from; the tests trace every answer back to it. */
  source: string;
  /** Browser tab title. */
  pageTitle: string;
  /** Cover title: first line roman, second line bronze italic. */
  title: [string, string];
  dek: string;
  subject: { name: string; nameCn?: string; role: string; href?: string };
  /** The names hung in the margin beside each turn, as a printed interview marks its speakers. */
  speakers: { author: string; subject: string };
  author: { name: string; links: { label: string; href: string }[] };
  /** Short facts set in the cover credits, e.g. Craft, Place. */
  facts: [string, string][];
  portrait: Shot;
  /** Adrian's own opening, before the conversation starts. */
  intro: string;
  /** Anything between the intro and part one; usually nothing, when part one opens with a photograph. */
  opening: Block[];
  parts: Part[];
  /** The last exchange, then his closing saying, then the whole closing photograph. */
  ending: { blocks: Block[]; saying: { id: string; text: string }; shot: Shot; aspect: string };
  /** Closing credit lines. Say how the conversation reached the page. */
  credit: string[];
  next: MoreLink[];
}

/** Every block, depth first, including those nested in sides and glyphs. */
export function allBlocks(spec: ConversationSpec): Block[] {
  const out: Block[] = [];
  const walk = (bs: Block[]) => bs.forEach((b) => {
    out.push(b);
    if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks);
  });
  walk(spec.opening);
  spec.parts.forEach((p) => walk(p.blocks));
  walk(spec.ending.blocks);
  return out;
}

/** The markup stripped, so text can be counted and compared. */
export function plain(text: string): string {
  return text.replace(/==/g, '').replace(/_([^_]+)_/g, '$1');
}

export function wordCount(spec: ConversationSpec): number {
  const texts = [spec.intro, spec.ending.saying.text];
  allBlocks(spec).forEach((b) => {
    if (b.kind === 'q' || b.kind === 'a' || b.kind === 'line' || b.kind === 'on-photo') texts.push(b.text);
    if (b.kind === 'line' && b.follow) texts.push(b.follow.text);
  });
  return texts.map(plain).join(' ').split(/\s+/).filter(Boolean).length;
}

/** Minutes to read, at an unhurried 220 words a minute. */
export function readingMinutes(spec: ConversationSpec): number {
  return Math.max(1, Math.round(wordCount(spec) / 220));
}

export function photoCount(spec: ConversationSpec): number {
  let n = 2 + spec.parts.filter((p) => p.opener).length; // the portrait, the closing photograph, the part openers
  allBlocks(spec).forEach((b) => {
    if (b.kind === 'photos') n += b.shots.length;
    else if (b.kind === 'side' || b.kind === 'wide' || b.kind === 'bleed' || b.kind === 'on-photo') n += 1;
  });
  return n;
}

/** The answers that begin his turn: the first answer after a question. They carry his name in the margin. */
export function turnStarts(spec: ConversationSpec): Set<string> {
  const starts = new Set<string>();
  let last: 'q' | 'a' | null = null;
  allBlocks(spec).forEach((b) => {
    if (b.kind === 'q') last = 'q';
    else if (b.kind === 'a') { if (last === 'q') starts.add(b.id); last = 'a'; }
  });
  return starts;
}
