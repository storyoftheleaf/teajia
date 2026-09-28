// Printed lines → paragraphs, headings and small lines, copying every word as
// printed. A port of the rules in ~/builds/tea-atlas.py (running heads, drop
// caps, vertical Chinese titles, reflow, headings, 茶人 bylines), so a source
// added here reads the same as the Global Tea Hut archive. No AI.
//
// tea-atlas.py only had the text; here pdf.js also gives sizes and positions,
// so a line printed larger than the body is a heading for certain, and a gap
// or an indent starts a paragraph. Where there is no such signal the Python
// rules decide, unchanged.

import { tokenize } from '../searchText.ts';
import type { PdfDoc, PdfLine, PdfPage } from './types.ts';

export interface Para {
  text: string;
  /** Printed larger than the body: certainly a heading. */
  heading: boolean;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const isNumber = (t: string) => /^\d+$/.test(t);

/** The body text size: the size most characters are printed in. */
export function bodySize(doc: PdfDoc): number {
  const weight = new Map<number, number>();
  for (const page of doc.pages) {
    for (const l of page.lines) {
      const s = Math.round(l.size * 2) / 2;
      weight.set(s, (weight.get(s) ?? 0) + l.text.length);
    }
  }
  let best = 10;
  let most = -1;
  for (const [s, n] of weight) if (n > most) { most = n; best = s; }
  return best;
}

/** A line with its digits blurred, so "3/11" and "4/11" count as the same footer. */
const shapeOf = (t: string) => t.replace(/\d+/g, '#');

/**
 * Page furniture, not text: a line at the top or bottom of 3+ pages (running
 * heads and footers, as tea-atlas.py strips), or a short line printed anywhere
 * on at least half the pages (a saved web page's menu and shop banner, which
 * the browser prints on every page). Measured on the test PDFs: the web
 * article's menu is on 10 of 11 pages; nothing in the books or the magazine
 * comes near half.
 */
export function runningLines(doc: PdfDoc): Set<string> {
  const edges = new Map<string, number>();
  const anywhere = new Map<string, number>();
  for (const page of doc.pages) {
    const ls = page.lines.filter(l => !isNumber(l.text) && l.text.length < 90);
    const edge = new Set([...ls.slice(0, 2), ...ls.slice(-2)].map(l => shapeOf(l.text)));
    for (const s of edge) edges.set(s, (edges.get(s) ?? 0) + 1);
    for (const s of new Set(ls.map(l => shapeOf(l.text)))) anywhere.set(s, (anywhere.get(s) ?? 0) + 1);
  }
  const half = Math.max(3, doc.pages.length / 2);
  return new Set([
    ...[...edges].filter(([, n]) => n >= 3).map(([s]) => s),
    ...[...anywhere].filter(([, n]) => n >= half).map(([s]) => s),
  ]);
}

/**
 * PDF page minus printed page number. From the PDF's own page labels when it
 * has numeric ones, otherwise voted from pages whose edge line is a bare
 * number, as tea-atlas.py does. With neither, the PDF page is the page.
 */
export function pageOffset(doc: PdfDoc): number {
  if (doc.labels) {
    const votes = new Map<number, number>();
    doc.labels.forEach((label, i) => {
      if (isNumber(label)) votes.set(i + 1 - Number(label), (votes.get(i + 1 - Number(label)) ?? 0) + 1);
    });
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  const votes = new Map<number, number>();
  for (const page of doc.pages) {
    const ls = page.lines;
    for (const l of [ls[0], ls[ls.length - 1]]) {
      if (l && isNumber(l.text) && Number(l.text) > 0 && Number(l.text) < 1000) {
        const off = page.index + 1 - Number(l.text);
        votes.set(off, (votes.get(off) ?? 0) + 1);
      }
    }
  }
  const best = [...votes].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : 0;
}

/** The page number printed on a PDF page (0-based index in). */
export const printedPage = (index: number, offset: number) => index + 1 - offset;

/**
 * What a page is called when a span is shown or cited: the PDF's own label
 * ("iv", "Cover A") when it has labels, otherwise the printed number.
 */
export function pageName(doc: PdfDoc, index: number, offset: number): string {
  const label = doc.labels?.[index]?.trim();
  return label || String(printedPage(index, offset));
}

const CJK_CHAR = /^[　-鿿豈-﫿]$/;
const CJK_RUN = /^[　-鿿豈-﫿]+$/;

/** Vertical Chinese titles arrive one character per line: 紅 / 藥 / 中 → 紅藥中. */
function joinVertical(lines: PdfLine[]): PdfLine[] {
  const out: PdfLine[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (CJK_CHAR.test(l.text) && prev && CJK_RUN.test(prev.text)) out[out.length - 1] = { ...prev, text: prev.text + l.text };
    else out.push(l);
  }
  return out;
}

const ENDS = ['.', ',', ';', ':', '!', '?', '"', '”', '’', ')', '—', '-'];
const PARA_ENDS = ['.', '!', '?', '”', '"', '’', ':', '—', ')'];

/** A short Title Case line: a heading, by the rule tea-atlas.py uses. */
export function isHeadingText(p: string): boolean {
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 9 || p.length > 60 || ENDS.some(e => p.endsWith(e)) || !/^\p{Lu}/u.test(p)) return false;
  if (/^[\d\s]+$/.test(p)) return false;
  const long = words.filter(w => w.length > 3 && /^\p{L}/u.test(w));
  return long.length > 0 && long.filter(w => /^\p{Lu}/u.test(w)).length / long.length >= 0.6;
}

/**
 * One page's lines as paragraphs. Words are never changed, only line breaks:
 * a hyphen at a line end joins the halves, as in tea-atlas.py.
 */
export function pageParas(page: PdfPage, body: number, running: Set<string>): Para[] {
  const lines = joinVertical(page.lines.filter(l => !isNumber(l.text) && !running.has(shapeOf(l.text))));
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i].y - lines[i - 1].y;
    if (d > 0 && Math.abs(lines[i].size - body) < body * 0.15 && Math.abs(lines[i].x - lines[i - 1].x) < body * 4) gaps.push(d);
  }
  const leading = median(gaps) || body * 1.25;

  const paras: Para[] = [];
  let cur = '';
  let curHeading = false;
  let last: PdfLine | null = null;
  const flush = () => {
    if (cur) paras.push({ text: cur, heading: curHeading });
    cur = '';
    curHeading = false;
  };

  lines.forEach((l, i) => {
    const big = l.size >= body * 1.25;
    if (big) {
      // Consecutive large lines of one size are one heading broken over lines.
      const joins = curHeading && last && Math.abs(last.size - l.size) <= l.size * 0.15 && l.y - last.y > 0 && l.y - last.y <= l.size * 1.8;
      if (!joins) flush();
      cur = cur ? `${cur} ${l.text}` : l.text;
      curHeading = true;
      last = l;
      return;
    }
    if (curHeading) flush();

    if (last && cur) {
      const gap = l.y - last.y;
      const sameColumn = Math.abs(l.x - last.x) < page.width * 0.25 && gap > 0;
      const indented = sameColumn && l.x - last.x > body * 0.8 && l.x - last.x < body * 5;
      const spaced = sameColumn && gap > leading * 1.6;
      if (indented || spaced) flush();
    }

    // Standalone Title Case lines between sentences, as tea-atlas.py reflows.
    const next = lines[i + 1]?.text ?? '';
    if (isHeadingText(l.text) && /^\p{Lu}/u.test(next) && (!cur || PARA_ENDS.some(e => cur.endsWith(e)))) {
      flush();
      paras.push({ text: l.text, heading: false });
      last = l;
      return;
    }

    if (!cur) cur = l.text;
    else if (cur.endsWith('-') && /^\p{Ll}/u.test(l.text)) cur = cur.slice(0, -1) + l.text;
    else cur += ` ${l.text}`;

    const near = lines.slice(Math.max(0, i - 4), i + 5).map(x => x.text.length).filter(n => n > 12);
    const typical = median(near) || 40;
    const ends = PARA_ENDS.some(e => l.text.endsWith(e));
    if ((ends && l.text.length < 0.75 * typical) || l.text.length < 0.35 * typical) flush();
    last = l;
  });
  flush();
  return paras;
}

export type Block =
  | { t: 'p'; v: string }
  | { t: 'h'; v: string }
  | { t: 'aside'; v: string }
  | { t: 'img'; src: string }
  | { t: 'page'; n: number };

export type Piece = Para | { img: string } | { page: number };

const ONLY_CJK = /^[　-鿿豈-﫿＀-￯\s·•]+$/;
const BYLINE = /^(.{3,70}?)\s*茶人\s*[:：]\s*(.{2,60})$/;
const CHAJIN = /^茶人\s*[:：]/;

function addHeading(out: Block[], text: string) {
  const prev = out[out.length - 1];
  if (prev?.t === 'h' && (/(&|\b(of|and|the|to|in|for|vs\.?|a|on|with))$/i.test(prev.v) || text.length <= 12)) prev.v += ` ${text}`;
  else out.push({ t: 'h', v: text });
}

/** Paragraphs → typed blocks, as tea-atlas.py styles a note. Returns the byline author, if printed. */
export function styleBlocks(pieces: Piece[], title: string): { blocks: Block[]; author: string } {
  const out: Block[] = [];
  let author = '';
  const isText = (p: Piece): p is Para => 'text' in p;
  pieces.forEach((piece, n) => {
    if ('img' in piece) { out.push({ t: 'img', src: piece.img }); return; }
    if ('page' in piece) { out.push({ t: 'page', n: piece.page }); return; }
    const p = piece.text.trim();
    if (!p || p.toLowerCase() === title.trim().toLowerCase()) return;
    const by = BYLINE.exec(p);
    if (by) {
      author ||= by[2].trim();
      if (isHeadingText(by[1])) addHeading(out, by[1].trim());
      out.push({ t: 'aside', v: `茶人: ${by[2].trim()}` });
      return;
    }
    if (CHAJIN.test(p) && p.length < 70) {
      author ||= p.replace(/^茶人\s*[:：]\s*/, '');
      out.push({ t: 'aside', v: p });
      return;
    }
    if (ONLY_CJK.test(p)) { out.push({ t: 'aside', v: p }); return; }
    const next = pieces.slice(n + 1).find(isText)?.text ?? '';
    if (piece.heading || (isHeadingText(p) && (/^\p{Lu}/u.test(next) || !/^[\x00-\x7f]/.test(next)))) {
      addHeading(out, p);
      return;
    }
    out.push({ t: 'p', v: p });
  });
  return { blocks: out, author };
}

/** Words in the text blocks, counted as tea-atlas-export.py counts them. */
export const wordCount = (blocks: Block[]) =>
  blocks.reduce((n, b) => n + ('v' in b ? b.v.split(/\s+/).filter(Boolean).length : 0), 0);

// ── Ligatures a PDF lost ─────────────────────────────────────────────────
//
// Browsers saving a web page as PDF often print "fi", "fl", "ff", "ffi" and
// "ffl" as one ligature glyph with no letters behind it, so the text reads
// "dierences" and "rst". pdf.js marks the spot with U+0000. Which pair it was
// is recovered, not guessed: each is tried, and the one that makes a word the
// library already knows (its search index, or the same document) is kept.

const LIGATURES = ['fi', 'fl', 'ff', 'ffi', 'ffl'];
const LOST = /\u0000/;
const LOST_WORD = /[\p{L}]*\u0000[\p{L}\u0000]*/gu;

/** The words with a lost ligature, and every spelling that could repair them. */
export function lostLigatureWords(doc: PdfDoc): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const page of doc.pages) {
    for (const l of page.lines) {
      if (!LOST.test(l.text)) continue;
      for (const word of l.text.match(LOST_WORD) ?? []) {
        if (out.has(word)) continue;
        let spellings = [word];
        while (spellings.some(w => LOST.test(w))) {
          spellings = spellings.flatMap(w => (LOST.test(w) ? LIGATURES.map(lig => w.replace('\u0000', lig)) : [w]));
        }
        out.set(word, spellings);
      }
    }
  }
  return out;
}

/**
 * Put the letters back. `known` answers whether a lowercased word is in the
 * library; words elsewhere in this document count too. Where nothing matches,
 * the commonest ligature, "fi", is used, so the text never carries a hole.
 */
export function repairLigatures(doc: PdfDoc, known: (word: string) => boolean): PdfDoc {
  const lost = lostLigatureWords(doc);
  if (!lost.size) return doc;
  const own = new Set(doc.pages.flatMap(p => p.lines.flatMap(l => (LOST.test(l.text) ? [] : tokenize(l.text)))));
  const fix = new Map<string, string>();
  for (const [word, spellings] of lost) {
    const hit = spellings.find(w => own.has(w.toLowerCase())) ?? spellings.find(w => known(w.toLowerCase()));
    fix.set(word, hit ?? word.replace(/\u0000/g, 'fi'));
  }
  return {
    ...doc,
    pages: doc.pages.map(page => ({
      ...page,
      lines: page.lines.map(l => (LOST.test(l.text)
        ? { ...l, text: l.text.replace(LOST_WORD, w => fix.get(w) ?? w).replace(/\u0000/g, '') }
        : l)),
    })),
  };
}
