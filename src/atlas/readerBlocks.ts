// Tidies an article's blocks for reading. The package is built from print
// layouts, so a display title arrives as several heading and aside fragments
// ("Gongfu &" · "工" · "Wuyi Cliff Tea" · "夫"), and a heading that wrapped in
// print arrives as two headings. This only regroups what is there; it never
// drops text a reader has not already seen in the page title.

import type { AtlasBlock } from './types';

const CJK = /[　-〿㐀-鿿豈-﫿]/;

/** Latin letters and digits only, lowercased: "Gongfu & Wuyi 岩茶" → "gongfuwuyi". */
function latinKey(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function joinText(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  // Two runs of Chinese characters join without a space, as they were printed.
  if (CJK.test(left.slice(-1)) && CJK.test(right.charAt(0))) return left + right;
  return `${left} ${right}`;
}

export function tidyBlocks(blocks: AtlasBlock[], title: string): AtlasBlock[] {
  const firstParagraph = blocks.findIndex(b => b.t === 'p');
  const leadEnd = firstParagraph === -1 ? 0 : firstParagraph;

  // The printed title, repeated as headings before the text starts, is
  // already the page's h1.
  const titleKey = latinKey(title);
  const leadHeadings = blocks.slice(0, leadEnd).filter(b => b.t === 'h') as Array<{ t: 'h'; v: string }>;
  const leadKey = latinKey(leadHeadings.map(h => h.v).join(' '));
  const dropLeadHeadings = titleKey.length > 0 && leadKey === titleKey;

  const out: AtlasBlock[] = [];
  blocks.forEach((block, i) => {
    if (dropLeadHeadings && i < leadEnd && block.t === 'h') return;
    const last = out[out.length - 1];
    if (last && (block.t === 'h' || block.t === 'aside') && last.t === block.t) {
      out[out.length - 1] = { t: block.t, v: joinText(last.v, block.v) };
      return;
    }
    // Two page markers in a row: the text of the first page is empty here,
    // so only the page the reading continues on is worth a marker.
    if (last && block.t === 'page' && last.t === 'page') {
      out[out.length - 1] = block;
      return;
    }
    out.push(block);
  });
  return out;
}

/** Minutes at an unhurried 230 words a minute, never less than one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}

/** "19–28" → "pages 19–28", "5" → "page 5", "0" or "" → "". */
export function pagesLabel(pages: string | undefined): string {
  if (!pages || pages === '0') return '';
  return /[–-]/.test(pages) ? `pages ${pages}` : `page ${pages}`;
}
