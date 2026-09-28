// Tea Atlas full-text search: the one tokenizer, shared by the upload script
// that BUILDS the index (scripts/atlas-upload.mjs) and the reader that QUERIES
// it (src/atlas/search.ts). Two tokenizers would drift, and a query tokenized
// differently from the index finds nothing while looking like it works.
//
// No imports and only erasable TypeScript, so Node can load this file straight
// from the upload script.

const STOPWORDS = new Set((
  'a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in ' +
  'into is it its just me more most my no not now of on one or our out over so some such than that the their them ' +
  'then there these they this those through to too up upon us very was we were what when where which while who whom ' +
  'why will with would you your also all any each other only own same about after again against before below between ' +
  'both down during few further here off once under until am being having doing yours ours theirs itself himself ' +
  'herself themselves myself ourselves yourself'
).split(' '));

/** Lowercase, strip accents, split on anything that is not a letter or digit. */
export function tokenize(text: string): string[] {
  const folded = text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out: string[] = [];
  for (const raw of folded.split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue;
    // A run of Chinese or Japanese characters has no spaces; index each
    // character pair so a two-character name like 普洱 is findable.
    if (/\p{Script=Han}/u.test(raw)) {
      const chars = Array.from(raw);
      if (chars.length === 1) out.push(raw);
      for (let i = 0; i + 1 < chars.length; i++) out.push(chars[i] + chars[i + 1]);
      continue;
    }
    if (raw.length < 2 || raw.length > 32) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(raw);
  }
  return out;
}

/**
 * The shard a term lives in. Latin terms go by their first two characters
 * (`pu` holds puerh, pure, purple). Anything else, mostly Chinese character
 * pairs, is spread over 64 buckets by its first character, so a few thousand
 * distinct characters do not become a few thousand tiny files.
 */
export function shardFor(term: string): string {
  const chars = Array.from(term).slice(0, 2);
  if (chars.every(c => /^[a-z0-9]$/.test(c))) return chars.join('').padEnd(2, '_');
  return 'u' + (chars[0].codePointAt(0)! % 64).toString(16).padStart(2, '0');
}

/** Sorted article numbers → gaps, so a long list stays short in JSON. */
export function encodePostings(sorted: number[]): number[] {
  const out: number[] = [];
  let prev = 0;
  for (const n of sorted) { out.push(n - prev); prev = n; }
  return out;
}

export function decodePostings(gaps: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const g of gaps) { acc += g; out.push(acc); }
  return out;
}
