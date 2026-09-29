/**
 * The shape of a conversation piece on /read: a conversation told as a story, in parts:
 * Adrian's opening, the subject's words drawn out by a few of his questions and
 * held together by his own telling, the subject's closing saying, Adrian's close.
 *
 * An article is this data and nothing else. `ConversationArticle` draws any
 * spec, so the next conversation is a new spec file, not a copy of the last
 * article's layout code. Rules for these pieces live here and in
 * conversation.test.ts, where they fail the build instead of relying on
 * whoever writes the next one to remember them:
 *
 *   - Every question and answer comes from the interview transcript. Adrian's
 *     telling (`n`), opening and close are his own words, approved in his draft.
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
  /**
   * Adrian telling the story between his words: a connecting line in Adrian's
   * own voice, approved by him in the magazine draft. It is never the subject's
   * words, so the transcript check does not trace it; it hands the turn back,
   * so whatever the subject says next carries his name.
   */
  | { kind: 'n'; id: string; text: string }
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
  /** `words` is how the story byline refers to their words: "in his own words". Defaults to "their". */
  subject: { name: string; nameCn?: string; role: string; href?: string; words?: 'his' | 'her' | 'their' };
  /** The names hung in the margin beside each turn, as a printed interview marks its speakers. */
  speakers: { author: string; subject: string };
  /** How the piece names itself under the cover: 'story' is Adrian's telling ("By Adrian, with him"),
   *  the default is a conversation ("him in conversation with Adrian"). */
  form?: 'story' | 'conversation';
  author: { name: string; links: { label: string; href: string }[] };
  portrait: Shot;
  /** Adrian's own opening, before the conversation starts. */
  intro: string;
  /** Adrian's own close, after the subject's closing saying; his words, from his context note. */
  closing?: string;
  /** Anything between the intro and part one; usually nothing, when part one opens with a photograph. */
  opening: Block[];
  parts: Part[];
  /** The last exchange, then his closing saying, then the whole closing photograph. */
  ending: { blocks: Block[]; saying: { id: string; text: string }; shot: Shot; aspect: string };
  /** Closing credit lines. Say how the conversation reached the page. */
  credit: string[];
  next: MoreLink[];
  /** The share card: one of the piece's own lines, by id, and one object photograph to set above it. */
  share?: { line: string; photo?: Shot };
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
  const texts = [spec.intro, spec.ending.saying.text, spec.closing ?? ''];
  allBlocks(spec).forEach((b) => {
    if (b.kind === 'q' || b.kind === 'a' || b.kind === 'n' || b.kind === 'line' || b.kind === 'on-photo') texts.push(b.text);
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

/** Where his turn begins: the first answer, or large line, after a question. It carries his name, so
 *  nothing he says ever sits unattributed between a question and the answer. */
export function turnStarts(spec: ConversationSpec): Set<string> {
  // His words begin a turn wherever they follow anything but his own words: a
  // question, a line of Adrian's telling, or the start of a part. Words that
  // run on from his previous answer need no second name.
  const starts = new Set<string>();
  const walk = (blocks: Block[], last: { v: 'q' | 'a' | null }) => blocks.forEach((b) => {
    if (b.kind === 'q' || b.kind === 'n') last.v = 'q';
    else if (b.kind === 'a' || b.kind === 'line') { if (last.v !== 'a') starts.add(b.id); last.v = 'a'; }
    else if (b.kind === 'side' || b.kind === 'glyph') walk(b.blocks, last);
  });
  walk(spec.opening, { v: null });
  spec.parts.forEach((p) => walk(p.blocks, { v: null }));
  walk(spec.ending.blocks, { v: null });
  return starts;
}
