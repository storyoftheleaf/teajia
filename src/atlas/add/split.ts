// Where each article starts. Code only, three methods in order of trust:
//
//   1. the PDF's own bookmarks (a book's chapters);
//   2. a contents page ("12  Title" lines) matched to the pages;
//   3. headings printed much larger than the body.
//
// Whatever it proposes, the person checks and fixes it before anything is
// published. For magazines too messy for all three there is an optional AI
// step (./suggestSplits.ts), OFF by default and not built.

import { bodySize, pageOffset, runningLines } from './text.ts';
import type { PdfDoc, PdfLine, PdfOutlineEntry, ProposedSection, SplitProposal } from './types.ts';

export const OPENING_TITLE = 'Cover & contents';

const FRONT_MATTER = /^(cover|title page|half title|contents|table of contents|copyright|originally published|front matter|dedication|imprint|about this (book|edition))\b/i;

const clean = (t: string) => t.replace(/\s+/g, ' ').replace(/[\s.·…_]+$/, '').trim();

/** Sorted by page, one start per page, and the first page always covered. */
function tidy(sections: ProposedSection[]): ProposedSection[] {
  const byPage = new Map<number, ProposedSection>();
  for (const s of [...sections].sort((a, b) => a.start - b.start)) {
    if (!byPage.has(s.start) && s.title) byPage.set(s.start, { ...s, title: clean(s.title) });
  }
  const out = [...byPage.values()];
  if (!out.length || out[0].start !== 0) out.unshift({ title: OPENING_TITLE, start: 0 });
  return out;
}

/** Parts longer than this many pages are opened up into their chapters. */
const LONG_PART = 30;
/** About how long an article runs, in pages (Global Tea Hut's run 2 to 10). */
const ARTICLE_PAGES = 6;

function chapters(entries: PdfOutlineEntry[], end: number): PdfOutlineEntry[] {
  const out: PdfOutlineEntry[] = [];
  entries.forEach((e, i) => {
    const next = entries[i + 1]?.page ?? end;
    const kids = (e.children ?? []).filter(c => c.page >= e.page && c.page < next);
    if (next - e.page > LONG_PART && kids.length >= 2) {
      // The part's own opening pages keep the part's name.
      if (kids[0].page > e.page) out.push({ title: e.title, page: e.page });
      out.push(...chapters(kids, next));
    } else {
      out.push({ title: e.title, page: e.page });
    }
  });
  return out;
}

export function fromOutline(doc: PdfDoc): ProposedSection[] | null {
  const entries = chapters(doc.outline.filter(e => e.page >= 0 && e.page < doc.pageCount), doc.pageCount);
  if (entries.length < 2) return null;
  // A leading run of title page, copyright, contents... is one opening section.
  let firstReal = 0;
  while (firstReal < entries.length - 1 && FRONT_MATTER.test(entries[firstReal].title)) firstReal++;
  const sections: ProposedSection[] = [];
  entries.slice(firstReal).forEach((e, i, list) => {
    sections.push({ title: e.title, start: e.page });
    // A long part with no bookmarks inside: its large headings split it, at
    // the heading level whose pieces come closest to an article's length.
    // Measured on Louise Cheadle's Tea Book: its 160-page world tour becomes
    // 16 regions rather than 64 single countries, its recipes one per recipe.
    const end = list[i + 1]?.page ?? doc.pageCount;
    if (end - e.page > LONG_PART) {
      for (const h of fromHeadings(doc, { from: e.page + 1, to: end, aimPages: ARTICLE_PAGES }) ?? []) sections.push(h);
    }
  });
  if (firstReal > 0) sections.unshift({ title: OPENING_TITLE, start: 0 });
  return tidy(sections);
}

interface ContentsEntry { n: number; title: string; author?: string }

const hasWords = (t: string) => (t.match(/\p{L}/gu) ?? []).length >= 3;
const BY = /^by\s+(.{2,80})$/i;

/**
 * "12 Title", "p. 12 Title", "Title ....... 12", or a number with the title on
 * the next line. A title broken over two lines (the second indented, printed
 * at the same size) is joined; a smaller "By ..." line under it is the author.
 */
export function contentsEntries(lines: PdfLine[]): ContentsEntry[] {
  const out: ContentsEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const l = line.text.trim();
    let entry: ContentsEntry | null = null;
    let m = /^(?:p\.?\s*)?(\d{1,3})[\s.·:|-]+(.{3,120})$/i.exec(l);
    if (m && hasWords(m[2])) entry = { n: Number(m[1]), title: m[2] };
    if (!entry && (m = /^(.{3,120}?)[\s.·…_|-]+(\d{1,3})$/.exec(l)) && hasWords(m[1])) entry = { n: Number(m[2]), title: m[1] };
    if (!entry && /^\d{1,3}$/.test(l)) {
      const next = lines[i + 1]?.text.trim() ?? '';
      if (hasWords(next) && !/\d{1,3}$/.test(next) && next.length <= 120) {
        entry = { n: Number(l), title: next };
        i++;
      }
    }
    if (!entry) continue;
    const head = lines[i];
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const next = lines[j];
      const by = BY.exec(next.text.trim());
      if (by && next.size < head.size) { entry.author = by[1].trim(); i = j; break; }
      const continues = Math.abs(next.size - head.size) <= head.size * 0.1 && next.x > head.x + 2
        && next.y > lines[j - 1].y && next.y - lines[j - 1].y <= head.size * 1.6
        && !/^(?:p\.?\s*)?\d/i.test(next.text.trim());
      if (!continues) break;
      entry.title += ` ${next.text.trim()}`;
      i = j;
    }
    out.push(entry);
  }
  return out;
}

const firstWords = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2).slice(0, 2);

export function fromContents(doc: PdfDoc): ProposedSection[] | null {
  const offset = pageOffset(doc);
  const body = bodySize(doc);
  let found: { page: number; entries: ContentsEntry[] } | null = null;
  for (const page of doc.pages.slice(0, Math.min(12, doc.pageCount))) {
    // Magazines list features and regular columns in separate runs, each in
    // page order, so the entries are sorted rather than required to increase.
    const seen = new Set<number>();
    const entries = contentsEntries(page.lines)
      .filter(e => e.n + offset - 1 > page.index && e.n + offset - 1 < doc.pageCount)
      .sort((a, b) => a.n - b.n)
      .filter(e => !seen.has(e.n) && seen.add(e.n));
    if (entries.length >= 3 && (!found || entries.length > found.entries.length)) found = { page: page.index, entries };
  }
  if (!found) return null;
  const sections: ProposedSection[] = [];
  for (const e of found.entries) {
    let start = e.n + offset - 1;
    if (start <= found.page || start >= doc.pageCount) continue;
    // Printed numbers are sometimes a page early or late: prefer the
    // neighbouring page whose large text carries the title's first words.
    const words = firstWords(e.title);
    const onPage = (i: number) => doc.pages[i]?.lines.some(l => l.size > body * 1.2 && words.every(w => l.text.toLowerCase().includes(w)));
    if (words.length && !onPage(start)) {
      const near = [start - 1, start + 1].find(i => i > found!.page && i < doc.pageCount && onPage(i));
      if (near !== undefined) start = near;
    }
    sections.push(e.author ? { title: e.title, author: e.author, start } : { title: e.title, start });
  }
  return sections.length >= 3 ? tidy(sections) : null;
}

interface HeadingOptions {
  /** Only look at these 0-based pages (a long part of a book). */
  from?: number;
  to?: number;
  /** At most this many sections per page; stricter size thresholds are tried until it fits. */
  perPage?: number;
  /**
   * Instead of the first level that fits: the heading level whose sections
   * come closest to this many pages on average (inside a long part of a book).
   */
  aimPages?: number;
}

export function fromHeadings(doc: PdfDoc, opts: HeadingOptions = {}): ProposedSection[] | null {
  const body = bodySize(doc);
  const running = runningLines(doc);
  const pages = doc.pages.filter(p => p.index >= (opts.from ?? 0) && p.index < (opts.to ?? doc.pageCount));
  const limit = Math.max(2, pages.length * (opts.perPage ?? 0.6));
  // Large text that recurs on many pages (a magazine's name) is not a title.
  const repeats = new Map<string, number>();
  for (const page of doc.pages) {
    for (const t of new Set(page.lines.filter(l => l.size >= body * 1.6).map(l => l.text))) repeats.set(t, (repeats.get(t) ?? 0) + 1);
  }
  // Thresholds from the sizes actually printed, smallest first: each step keeps
  // only the larger tiers of heading, until the sections are not too many.
  const tiers = [...new Set(pages.flatMap(p => p.lines)
    .map(l => Math.floor((l.size / body) * 10) / 10)
    .filter(r => r >= 1.55))].sort((a, b) => a - b);
  let best: { sections: ProposedSection[]; miss: number } | null = null;
  for (const factor of tiers) {
    const sections: ProposedSection[] = [];
    for (const page of pages) {
      const big = page.lines.filter(l =>
        l.size >= body * factor - 0.01 && hasWords(l.text) && l.y < page.height * 0.6
        && !running.has(l.text.replace(/\d+/g, '#')) && (repeats.get(l.text) ?? 0) < 3);
      if (!big.length) continue;
      // The topmost large line, and the lines of its size right under it. The
      // largest line is often a pull quote; the title sits above it.
      const first = big.reduce((a, b) => (b.y < a.y ? b : a));
      const run = [first];
      for (const l of page.lines.filter(x => x.y > first.y && x.size >= body * factor - 0.01).sort((a, b) => a.y - b.y)) {
        const prev = run[run.length - 1];
        if (run.length >= 3 || Math.abs(l.size - first.size) > first.size * 0.15 || l.y - prev.y > l.size * 1.8) break;
        run.push(l);
      }
      const title = run.map(l => l.text).join(' ');
      if (title.length <= 140) sections.push({ title, start: page.index });
    }
    if (opts.aimPages) {
      if (sections.length < 2) continue;
      const miss = Math.abs(Math.log(pages.length / sections.length / opts.aimPages));
      if (!best || miss < best.miss) best = { sections, miss };
      continue;
    }
    if (sections.length && sections.length <= limit) return opts.from === undefined ? tidy(sections) : sections;
  }
  return best?.sections ?? null;
}

/** A title for the whole document, when nothing splits it. */
export function documentTitle(doc: PdfDoc, fileName = ''): string {
  if (doc.title) return clean(doc.title);
  const first = doc.pages[0]?.lines ?? [];
  if (first.length) {
    const top = Math.max(...first.map(l => l.size));
    const t = first.filter(l => l.size >= top * 0.9).slice(0, 3).map(l => l.text).join(' ');
    if (hasWords(t)) return clean(t);
  }
  return clean(fileName.replace(/\.pdf$/i, '')) || 'Untitled';
}

export function proposeSplit(doc: PdfDoc, fileName = ''): SplitProposal {
  const outline = fromOutline(doc);
  if (outline && outline.length >= 2) return { method: 'outline', sections: outline };
  const contents = fromContents(doc);
  if (contents) return { method: 'contents', sections: contents };
  const headings = fromHeadings(doc);
  if (headings && headings.length >= 2) return { method: 'headings', sections: headings };
  // One large title and nothing else (a saved web article): one article, under that title.
  if (headings?.length === 1 && headings[0].title !== OPENING_TITLE) return { method: 'whole', sections: headings };
  return { method: 'whole', sections: [{ title: documentTitle(doc, fileName), start: 0 }] };
}
