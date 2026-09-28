// Checked sections → a web package, format 1, for one source: the same shape
// ~/builds/tea-atlas-export.py writes for Global Tea Hut (manifest + one JSON
// per article + pictures under media/<issue>/). docs/TEA_ATLAS.md.

import type { PackageArticleMeta, PackageManifest, PackageTopic } from '../indexShapes.ts';
import { bodySize, pageName, pageOffset, pageParas, printedPage, runningLines, styleBlocks, wordCount, type Block, type Piece } from './text.ts';
import type { PdfDoc } from './types.ts';

export type SourceKind = 'book' | 'magazine' | 'article';

export interface SourceDetails {
  name: string;
  kind: SourceKind;
  /** One line under the name: "Kakuzo Okakura, 1906". */
  subtitle: string;
  /** Printed with every article: who it comes from. */
  credit: string;
  /** Four digits, or empty. Groups the source under a year and starts its issue id. */
  year: string;
  /** What the one issue is called: the book's title, or "May 2018". */
  issueLabel: string;
}

export interface CheckedSection {
  title: string;
  author: string;
  /** 0-based PDF page; the section runs to the page before the next one starts. */
  start: number;
  topics: string[];
}

/** tea-atlas-export.py's slug: ASCII word characters only, runs of space, _ and - become one hyphen. */
export function slug(s: string): string {
  const t = s.toLowerCase().replace(/[^a-z0-9_\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  return t || 'x';
}

export function sourceIdFor(name: string): string {
  return slug(name).slice(0, 80).replace(/-+$/, '') || 'source';
}

export function issueIdFor(details: Pick<SourceDetails, 'name' | 'year'>): string {
  const base = sourceIdFor(details.name);
  return /^\d{4}$/.test(details.year) && !base.startsWith(details.year) ? `${details.year}-${base}` : base;
}

/** The media stem tea-atlas-media.py uses: <issue>-<pdf page>-<picture on page>. */
export const pictureStem = (issueId: string, pageIndex: number, n: number) =>
  `${issueId}-${String(pageIndex + 1).padStart(3, '0')}-${String(n).padStart(3, '0')}`;

export interface PackageArticle extends PackageArticleMeta {
  blocks: Block[];
}

export interface SourcePackage {
  manifest: PackageManifest;
  articles: PackageArticle[];
}

export interface BuildInput {
  doc: PdfDoc;
  details: SourceDetails;
  sections: CheckedSection[];
  /** The pictures kept on each page, as media paths (`<issue>/<stem>.jpg`), in order. */
  pictures: Map<number, string[]>;
  topics: PackageTopic[];
}

/** The printed page span of each section, and the blocks it reads as. */
export function sectionBlocks(doc: PdfDoc, sections: CheckedSection[], pictures: Map<number, string[]>) {
  const offset = pageOffset(doc);
  const body = bodySize(doc);
  const running = runningLines(doc);
  const ordered = [...sections].sort((a, b) => a.start - b.start);
  return ordered.map((s, i) => {
    const end = (ordered[i + 1]?.start ?? doc.pageCount) - 1;
    const pieces: Piece[] = [];
    for (let p = s.start; p <= end; p++) {
      // A page marker is for citing; pages before the printed page 0 (cover,
      // roman-numbered front matter) have no number to cite.
      if (printedPage(p, offset) >= 0) pieces.push({ page: printedPage(p, offset) });
      pieces.push(...pageParas(doc.pages[p], body, running));
      // Pictures go at the end of their page, as tea-atlas.py places the ones it finds late.
      for (const src of pictures.get(p) ?? []) pieces.push({ img: src });
    }
    const { blocks, author } = styleBlocks(pieces, s.title);
    const p1 = pageName(doc, s.start, offset);
    const p2 = pageName(doc, end, offset);
    return { section: s, blocks, author: s.author.trim() || author, pages: p1 === p2 ? p1 : `${p1}–${p2}`, first: printedPage(s.start, offset) };
  });
}

export function buildSourcePackage({ doc, details, sections, pictures, topics }: BuildInput): SourcePackage {
  const sourceId = sourceIdFor(details.name);
  const issueId = issueIdFor(details);
  const used = new Set<string>();
  const articles: PackageArticle[] = sectionBlocks(doc, sections, pictures).map((s, order) => {
    const title = s.section.title.replace(/\s+/g, ' ').trim() || 'Untitled';
    let id = slug(`${issueId} p${String(Math.max(s.first, 0)).padStart(2, '0')} ${title}`).slice(0, 150).replace(/-+$/, '');
    for (let n = 2; used.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    used.add(id);
    const cover = s.blocks.find((b): b is { t: 'img'; src: string } => b.t === 'img')?.src ?? null;
    return {
      id, source: sourceId, issue: issueId, title, author: s.author, pages: s.pages, order,
      topics: s.section.topics, words: wordCount(s.blocks), cover, blocks: s.blocks,
    };
  });
  const usedTopics = new Set(articles.flatMap(a => a.topics ?? []));
  const manifest: PackageManifest = {
    format: 1,
    sources: [{
      id: sourceId, name: details.name.trim(), kind: details.kind, subtitle: details.subtitle.trim(),
      credit: details.credit.trim() || details.name.trim(),
      issues: [{ id: issueId, label: details.issueLabel.trim() || details.name.trim(), articles: articles.map(a => a.id) }],
    }],
    topics: topics.filter(t => usedTopics.has(t.id)).map(t => ({ id: t.id, name: t.name, category: t.category, aliases: t.aliases ?? [] })),
    articles: articles.map(({ blocks: _blocks, ...meta }) => meta),
  };
  return { manifest, articles };
}

// ── Topics: keyword matches against the topic list's aliases, as tea-atlas.py counts them ──

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HAN = /[　-鿿]/;

export function countHits(text: string, aliases: string[]): number {
  let n = 0;
  for (const a of aliases) {
    if (!a) continue;
    if (HAN.test(a)) n += text.split(a).length - 1;
    else n += (text.match(new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRe(a)}(?![\\p{L}\\p{N}_-])`, 'giu')) ?? []).length;
  }
  return n;
}

/** Topics mentioned three times or more, or named in the title; most mentioned first. */
export function suggestTopics(title: string, blocks: Block[], topics: PackageTopic[]): string[] {
  const text = blocks.map(b => ('v' in b ? b.v : '')).join('\n\n');
  const low = title.toLowerCase();
  const hits: Array<[string, number]> = [];
  for (const t of topics) {
    const aliases = t.aliases?.length ? t.aliases : [t.name];
    const n = countHits(text, aliases);
    if (n >= 3 || aliases.some(a => a && low.includes(a.toLowerCase()))) hits.push([t.id, n]);
  }
  return hits.sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
