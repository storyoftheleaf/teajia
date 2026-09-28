// Tea Atlas: tidy the blocks of a web page saved as PDF (scripts/atlas-web-sources.mjs).
//
// A shop's page printed from a browser carries the shop around the article:
// the menu before it, a side menu read into the middle of it, the footer and
// comments after it, and every link's address printed in brackets. Browsers
// also lose the "fi", "fl", "ff" and "Th" letter pairs a font draws as one
// glyph. This takes the shop out and puts the letters back.
//
// Pure: blocks in, blocks out, so the test can hold it to real examples.

// A link's address, closed or cut off by the end of a printed line: it runs to
// its ")", or to the next word that starts a sentence, or to the end.
const LINK = /\s*\((?:\/|https?:\/\/)[^)]*?(?:\)|(?=\s+[A-Z“"$]|$))/g;
const HAS_LINK = /\((?:\/|https?:\/\/)[^)]*\)/;
/** Where the article ends and the page's own furniture begins. */
const FOOTER = [/^COMMENTS \(\d+\)/i, /^Top of Page$/i, /^Stay In Touch$/i, /All rights reserved/i, /^Leave a comment/i];
/** A blog's "CATEGORY MON 22" line above the text. */
const DATELINE = /^[A-Z][A-Z .&-]+ (JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) \d{1,2}$/;
const TEXT = new Set(['p', 'h', 'aside']);
/** Breadcrumb arrows, review stars and price tags: a block carrying one is the shop's furniture. */
const FURNITURE = /[\uf0da\uf005]|\$\d[\d,]*\.\d{2} USD|\bSold Out\b/;
/** The shop's own promotions, printed between paragraphs. */
const PROMO = [/^Learn Menu$/i, /^Ask (The|\ue013e) Tea Wizard$/i, /^Don't know which tea is right/i, /^Ask Now\b/i, /^for you\? Answer a few questions/i, /^taste\.$/i];

/** Every word in a body of text, lowercased: the spelling reference for repairLigatures. */
export function vocabularyOf(texts) {
  const words = new Set();
  for (const t of texts) for (const w of t.toLowerCase().match(/\p{L}+/gu) ?? []) words.add(w);
  return words;
}

/**
 * The Chinese Tea Shop's font draws "Th" as one private glyph, U+E013 ("\ue013e
 * Quick Way"). The "fi", "fl" and "ff" pairs arrive as U+0000 and are put back
 * earlier, on the whole document, by repairLigatures (src/atlas/add/text.ts).
 */
export function repairWords(text) {
  return text.replace(/\ue013/g, 'Th');
}

/** The article, without the shop around it. */
export function cleanWebBlocks(blocks, title = '') {
  // 1. Link addresses out; a short block that was mostly links is a menu item.
  let list = [];
  for (const b of blocks) {
    if (!TEXT.has(b.t)) { list.push(b); continue; }
    if (FURNITURE.test(b.v) || PROMO.some(re => re.test(b.v.trim()))) continue;
    const had = HAS_LINK.test(b.v);
    const v = b.v.replace(LINK, '').replace(/\s+/g, ' ').trim();
    if (!v || (had && v.length < 70)) {
      // A menu item split over two lines leaves its first half as a heading.
      if (list.length && list[list.length - 1].t === 'h' && list[list.length - 1].v.length < 40) list.pop();
      continue;
    }
    list.push({ ...b, v });
  }

  // 2. Everything from the footer on.
  const firstText = list.findIndex(b => TEXT.has(b.t) && b.v.length >= 40);
  const cut = list.findIndex((b, i) => i > firstText && TEXT.has(b.t) && FOOTER.some(re => re.test(b.v)));
  if (cut > 0) list = list.slice(0, cut);

  // 3. Everything before the first real sentence, but keep the heading that introduces it.
  let start = list.findIndex(b => TEXT.has(b.t) && b.v.length >= 40);
  if (start > 0 && list[start - 1].t === 'h' && !DATELINE.test(list[start - 1].v)) start -= 1;
  if (start > 0) list = list.slice(start);
  list = list.filter(b => !(b.t === 'h' && DATELINE.test(b.v)));

  // The page's own title, printed again above the text: the reader already shows it.
  const plain = t => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const firstH = list.findIndex(b => b.t === 'h');
  if (title && firstH >= 0 && firstH < 2 && plain(list[firstH].v).startsWith(plain(title))) list.splice(firstH, 1);

  // 4. The side menu repeats the article's tables; keep the first of anything said twice.
  const seen = new Set();
  list = list.filter(b => {
    if (!TEXT.has(b.t) || b.v.length < 20) return true;
    if (seen.has(b.v)) return false;
    seen.add(b.v);
    return true;
  });

  // 5. A table read line by line comes out as scraps; run each set of scraps into one line.
  const joined = [];
  for (const b of list) {
    const prev = joined[joined.length - 1];
    const scrap = b.t === 'p' && b.v.length < 30;
    if (scrap && prev?.t === 'p' && prev.scrap) { prev.v = `${prev.v} ${b.v}`; continue; }
    joined.push(scrap ? { ...b, scrap: true } : b);
  }
  list = joined.map(({ scrap: _s, ...b }) => b);

  // 6. Letters back; page markers only where text follows them.
  list = list
    .map(b => (TEXT.has(b.t) ? { ...b, v: repairWords(b.v.replace(LINK, '').trim()) } : b))
    .filter(b => !TEXT.has(b.t) || (b.v && !PROMO.some(re => re.test(b.v))));
  return list.filter((b, i) => b.t !== 'page' || (list[i + 1] !== undefined && list[i + 1].t !== 'page'));
}
