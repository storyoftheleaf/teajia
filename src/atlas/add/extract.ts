// Read a PDF with pdf.js into lines and picture references, page by page.
// No AI and no guessing about meaning: this only recovers what is printed and
// where, in reading order. Splitting and styling happen later, in pure code.
//
// Runs in the browser (the Worker cannot run PDF tools: 10 ms of CPU per
// request) and in Node for the tests, which is why pdf.js is passed in rather
// than imported here.

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PdfDoc, PdfLine, PdfOutlineEntry, PdfPage, PdfPictureRef } from './types.ts';

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  hasEOL?: boolean;
}

interface RawLine extends PdfLine {
  eol: boolean;
}

const isTextItem = (item: unknown): item is TextItemLike =>
  typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;

/**
 * Older fonts print small capitals and old-style figures from Adobe's
 * private-use range (U+F721 to U+F77E is the ASCII letter or digit plus
 * 0xF700), which shows as boxes. The letter is the letter.
 */
export const plainLetters = (t: string) => t.replace(/[\uF721-\uF77E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xf700));

/** Items, in the order the PDF draws them, joined into lines. */
export function itemsToLines(items: unknown[], pageHeight: number): PdfLine[] {
  const lines: RawLine[] = [];
  let cur: RawLine | null = null;
  for (const item of items) {
    if (!isTextItem(item)) continue;
    if (!item.str) {
      if (item.hasEOL && cur) cur.eol = true;
      continue;
    }
    const [a, b, c, d, e, f] = item.transform;
    // Rotated text (spines, vertical captions) is left out of the flow.
    if (Math.abs(b) > Math.abs(a) * 0.2 && Math.abs(c) > Math.abs(d) * 0.2) continue;
    const size = Math.hypot(c, d) || Math.hypot(a, b);
    const x = e;
    const y = pageHeight - f;
    const s = Math.max(size, cur?.size ?? 0);
    // A drop cap sits on the first line's baseline at several times its size;
    // it stays its own line so joinDropCaps can attach it without a space.
    const ratio = cur ? Math.max(size, cur.size) / Math.max(0.1, Math.min(size, cur.size)) : 1;
    const same = cur && !cur.eol && ratio < 1.8
      && Math.abs(y - cur.y) <= s * 0.4
      && x >= cur.right - s * 0.6
      && x - cur.right <= s * 2.5;
    if (cur && same) {
      const gap = x - cur.right;
      if (gap > s * 0.15 && !cur.text.endsWith(' ') && !item.str.startsWith(' ')) cur.text += ' ';
      cur.text += item.str;
      cur.right = Math.max(cur.right, x + item.width);
      cur.size = Math.max(cur.size, size);
    } else {
      cur = { text: item.str, size, x, right: x + item.width, y, eol: false };
      lines.push(cur);
    }
    if (item.hasEOL) cur.eol = true;
  }
  return lines
    .map(({ eol: _eol, ...l }) => ({ ...l, text: plainLetters(l.text).replace(/\s+/g, ' ').trim() }))
    .filter(l => l.text);
}

/**
 * A drop cap arrives as its own giant one-letter line, often drawn after the
 * paragraph it starts. Put it back on the front of the line it belongs to.
 */
export function joinDropCaps(lines: PdfLine[]): PdfLine[] {
  const sizes = lines.map(l => l.size).sort((p, q) => p - q);
  const body = sizes[Math.floor(sizes.length / 2)] ?? 10;
  const out = [...lines];
  for (let i = 0; i < out.length; i++) {
    const cap = out[i];
    if (!/^\p{Lu}$/u.test(cap.text) || cap.size < body * 2) continue;
    const target = out
      .filter(l => l !== cap && /^\p{Ll}/u.test(l.text)
        && l.x >= cap.x + cap.size * 0.2 && l.x <= cap.x + cap.size * 1.6
        && l.y >= cap.y - cap.size * 1.3 && l.y <= cap.y + l.size)
      .sort((p, q) => p.y - q.y)[0];
    if (!target) continue;
    const idx = out.indexOf(target);
    out[idx] = { ...target, text: cap.text + target.text, x: cap.x };
    out.splice(i, 1);
    i--;
  }
  return out;
}

interface Block {
  lines: PdfLine[];
  x: number;
  right: number;
  top: number;
}

/**
 * Put a page's lines in reading order. PDFs draw text frames in whatever order
 * the layout program kept them; a magazine page often draws its right column
 * first. Consecutive lines form blocks; wide blocks (titles, single-column
 * text) cut the page into bands; inside a band, narrow blocks read column by
 * column, top to bottom.
 */
export function readingOrder(lines: PdfLine[], pageWidth: number): PdfLine[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let prev: PdfLine | null = null;
  for (const line of lines) {
    // Measured by the smaller of the two lines, so a giant title cannot swallow
    // the first line of the column beside it.
    const s = Math.min(line.size, prev?.size ?? line.size);
    const ratio = prev ? Math.max(line.size, prev.size) / Math.min(line.size, prev.size) : 1;
    const continues = cur && prev
      && line.y > prev.y && line.y - prev.y <= s * 2.6
      && Math.abs(line.x - cur.x) <= s * 4
      && (ratio < 1.3 || line.y - prev.y <= Math.max(line.size, prev.size) * 1.6);
    if (cur && continues) {
      cur.lines.push(line);
      cur.x = Math.min(cur.x, line.x);
      cur.right = Math.max(cur.right, line.right);
    } else {
      cur = { lines: [line], x: line.x, right: line.right, top: line.y - line.size };
      blocks.push(cur);
    }
    prev = line;
  }
  if (blocks.length < 2) return lines;

  const wide = (b: Block) => b.right - b.x > pageWidth * 0.55;
  const spans = blocks.filter(wide).sort((p, q) => p.top - q.top);
  const narrow = blocks.filter(b => !wide(b));

  // Columns by left edge.
  const xs = [...new Set(narrow.map(b => b.x))].sort((p, q) => p - q);
  const colOf = new Map<number, number>();
  let col = 0;
  xs.forEach((x, i) => {
    if (i > 0 && x - xs[i - 1] > pageWidth * 0.18) col++;
    colOf.set(x, col);
  });

  const ordered: Block[] = [];
  const bandOf = (b: Block) => spans.filter(sp => sp.top <= b.top).length;
  for (let band = 0; band <= spans.length; band++) {
    if (band > 0) ordered.push(spans[band - 1]);
    ordered.push(...narrow
      .filter(b => bandOf(b) === band)
      .sort((p, q) => (colOf.get(p.x)! - colOf.get(q.x)!) || (p.top - q.top)));
  }
  return ordered.flatMap(b => b.lines);
}

async function pageIndexOf(doc: PDFDocumentProxy, dest: unknown): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || !explicit[0]) return null;
    const ref = explicit[0];
    if (typeof ref === 'number') return ref;
    return await doc.getPageIndex(ref);
  } catch {
    return null;
  }
}

interface OutlineNode {
  title: string;
  dest: unknown;
  items?: OutlineNode[];
}

async function outlineLevel(doc: PDFDocumentProxy, nodes: OutlineNode[], depth: number): Promise<PdfOutlineEntry[]> {
  const out: PdfOutlineEntry[] = [];
  for (const node of nodes) {
    const page = await pageIndexOf(doc, node.dest);
    const title = (node.title || '').replace(/\s+/g, ' ').trim();
    if (page === null || !title) continue;
    const children = depth < 3 && node.items?.length ? await outlineLevel(doc, node.items, depth + 1) : [];
    out.push(children.length ? { title, page, children } : { title, page });
  }
  return out;
}

/** The bookmarks, starting below a lone "book title" bookmark if there is one. */
async function readOutline(doc: PDFDocumentProxy): Promise<PdfOutlineEntry[]> {
  let level = ((await doc.getOutline()) ?? []) as OutlineNode[];
  while (level.length === 1 && level[0].items && level[0].items.length > 1) level = level[0].items;
  return outlineLevel(doc, level, 0);
}

/** Called for every picture drawn on a page; answer false to leave it out. */
export type PictureSink = (page: PDFPageProxy, ref: PdfPictureRef, image: unknown) => Promise<boolean> | boolean;

export interface ExtractOptions {
  /** pdf.js OPS table (passed in so this file does not import pdf.js). */
  ops: Record<string, number>;
  onPicture?: PictureSink;
  onProgress?: (done: number, total: number) => void;
}

/**
 * A picture's decoded pixels. pdf.js may still be decoding it (JPEGs are
 * decoded off the main thread) when the drawing instructions are ready, so
 * this waits for it rather than asking once and missing it.
 */
function objectFor(page: PDFPageProxy, name: string, waitMs = 15_000): Promise<unknown> {
  const store = (name.startsWith('g_') ? page.commonObjs : page.objs) as unknown as {
    get(id: string, callback?: (data: unknown) => void): unknown;
  };
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: unknown) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish(null), waitMs);
    try {
      store.get(name, finish);
    } catch {
      finish(null);
    }
  });
}

export async function extractPdf(doc: PDFDocumentProxy, opts: ExtractOptions): Promise<PdfDoc> {
  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as { Title?: string; Author?: string };
  const pages: PdfPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const view = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    const lines = readingOrder(joinDropCaps(itemsToLines(text.items, view.height)), view.width);

    const pictures: PdfPictureRef[] = [];
    const ops = await page.getOperatorList();
    const seen = new Set<string>();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn !== opts.ops.paintImageXObject && fn !== opts.ops.paintImageXObjectRepeat) continue;
      const name = ops.argsArray[i]?.[0];
      if (typeof name !== 'string' || seen.has(name)) continue;
      seen.add(name);
      const image = (await objectFor(page, name)) as { width?: number; height?: number } | null;
      if (!image?.width || !image?.height) continue;
      const ref: PdfPictureRef = { name, width: image.width, height: image.height };
      if (!opts.onPicture || (await opts.onPicture(page, ref, image))) pictures.push(ref);
    }
    pages.push({ index: p - 1, width: view.width, height: view.height, lines, pictures });
    page.cleanup();
    opts.onProgress?.(p, doc.numPages);
  }
  return {
    title: (info.Title || '').trim(),
    author: (info.Author || '').trim(),
    pageCount: doc.numPages,
    labels: await doc.getPageLabels().catch(() => null),
    outline: await readOutline(doc),
    pages,
  };
}
