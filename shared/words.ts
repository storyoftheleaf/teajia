// Shared word library, read side (vendored from AR Create).
//
// AR Create owns the library of names and terms Adrian's voice should be transcribed with (people, places, tea
// terms, Gene Keys, hexagrams). Each project keeps a committed, versioned copy in `shared/words.snapshot.json`,
// refreshed one way by `words-sync` (~/builds/words-sync.mjs). Nothing here reads AR Create's installed data folder
// and nothing here writes back.
//
// This file is the same logic in mandalacodes, teajia and i64os (same file, three repos). If you change it, change
// the others: each repo's words test pins the behaviour.
//
// Two jobs:
//   buildWordsPrompt  the vocabulary prompt for Whisper, inside its ~224 token limit (AR Create's own budget: 160
//                     by its estimate), most useful words first for this project.
//   applyKnownFixes   replace known mishearings in a transcript, reporting every change, so the caller can keep the
//                     raw text next to the fixed text. Only `heard` variants are rewritten; `alias` variants (another
//                     valid name) are never touched.
import raw from './words.snapshot.json';

export type WordCategory = 'person' | 'place' | 'tea-term' | 'gene-key' | 'hexagram' | 'other';
export interface WordVariant { text: string; kind: 'heard' | 'alias'; languages?: string[] }
export interface WordEntry {
  spelling: string;
  category: WordCategory | string;
  languages?: string[];
  zh?: string;
  pinyin?: string;
  sets?: string[];
  core?: boolean;
  variants?: WordVariant[];
  source?: { kind?: string; ref?: string };
  addedAt?: string;
  status?: string;
}
export interface WordSnapshot { schema?: string; version?: string; exportedAt?: string; entries: WordEntry[] }
export interface WordFix { from: string; to: string; count: number }

/** The snapshot committed in this repo. An unreadable or empty file means no priming and no fixes, never an error. */
export const wordSnapshot: WordSnapshot = (raw as unknown as WordSnapshot) ?? { entries: [] };

export const PROMPT_TOKENS = 160;
const CJK = /[㐀-鿿]/;
const CJK_G = /[㐀-鿿，。、]/g;
const norm = (s: string) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`\-‐–]/g, ' ').replace(/\s+/g, ' ').trim();

/** AR Create's budget estimate: about three Latin characters to a token, one and a half per CJK one. */
export const estimateTokens = (s: string) => Math.ceil(s.replace(CJK_G, '').length / 3) + Math.ceil((s.match(CJK_G) || []).length * 1.5);

const HEAD = { en: 'Names and terms in this conversation: ', zh: '以下是访谈中出现的名字和术语：' };
const TAIL = { en: '.', zh: '。' };
const SEP = { en: ', ', zh: '、' };
const CATEGORY_ORDER = ['person', 'place', 'tea-term', 'hexagram', 'gene-key', 'other'];

export interface PromptProfile {
  /** Categories in the order this project needs them. Entries outside the list are left out unless `others` is set. */
  categories?: string[];
  /** Also use entries from categories not listed, after the listed ones. */
  others?: boolean;
  /** `category-first` spends the budget on the listed categories in order; `tier-first` is AR Create's own order
   *  (words Adrian corrected, then core words, then words with known mishearings, then by category). */
  order?: 'category-first' | 'tier-first';
  /** A sentence that always opens the prompt, before the list of words (the project's own context). */
  intro?: string;
  /** What introduces the list itself. Default is AR Create's. */
  head?: string;
  budget?: number;
  language?: 'en' | 'zh';
}
export interface BuiltPrompt { prompt: string; words: string[]; tokens: number; budget: number }

const heardOf = (e: WordEntry) => (e.variants || []).filter(v => v.kind !== 'alias');
/** Plain lowercase English words are spelled correctly already: spend no budget on them. */
const needsHelp = (e: WordEntry) => e.core || heardOf(e).length > 0 || e.source?.kind === 'confirmed-answer' || !/^[a-z ]+$/.test(e.spelling);
const tierOf = (e: WordEntry) => (e.source?.kind === 'confirmed-answer' ? 0 : e.core ? 1 : heardOf(e).length ? 2 : 3);
const learnedOf = (e: WordEntry) => (e.source?.kind === 'confirmed-answer' ? -Date.parse(e.addedAt || '0') || 0 : 0);

export function buildWordsPrompt(snapshot: WordSnapshot = wordSnapshot, profile: PromptProfile = {}): BuiltPrompt {
  const language = profile.language === 'zh' ? 'zh' : 'en';
  const budget = profile.budget ?? PROMPT_TOKENS;
  const intro = profile.intro ? profile.intro.trim() + ' ' : '';
  const head = intro + (profile.head ?? HEAD[language]);
  const listed = profile.categories ?? CATEGORY_ORDER;
  const rank = (e: WordEntry) => { const i = listed.indexOf(e.category); return i >= 0 ? i : listed.length + Math.max(0, CATEGORY_ORDER.indexOf(e.category)); };
  const pool = (snapshot.entries || []).filter(e => (e.status ?? 'confirmed') === 'confirmed' && needsHelp(e)
    && (profile.categories === undefined || profile.others || listed.includes(e.category)));
  const byAlpha = (a: WordEntry, b: WordEntry) => a.spelling.localeCompare(b.spelling);
  const ordered = [...pool].sort(profile.order === 'category-first'
    ? (a, b) => rank(a) - rank(b) || tierOf(a) - tierOf(b) || learnedOf(a) - learnedOf(b) || byAlpha(a, b)
    : (a, b) => tierOf(a) - tierOf(b) || learnedOf(a) - learnedOf(b) || rank(a) - rank(b) || byAlpha(a, b));
  const words: string[] = [], seen = new Set<string>();
  for (const e of ordered) {
    const w = language === 'zh' ? e.zh : e.spelling;
    if (!w || seen.has(w)) continue;
    if (estimateTokens(head + [...words, w].join(SEP[language]) + TAIL[language]) > budget) break;
    seen.add(w); words.push(w);
  }
  if (!words.length) { const bare = intro.trim(); return { prompt: bare, words: [], tokens: estimateTokens(bare), budget }; }
  const prompt = head + words.join(SEP[language]) + TAIL[language];
  return { prompt, words, tokens: estimateTokens(prompt), budget };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
interface Rule { from: string; to: string; re: RegExp }
const ruleCache = new WeakMap<WordSnapshot, Record<string, Rule[]>>();

/** Known mishearings of confirmed words, longest first, as whole-word patterns. A heard text that two entries claim, or
 *  that is itself another entry's spelling, is left alone: under-fixing is the safe direction. */
function rulesFor(snapshot: WordSnapshot, language: 'en' | 'zh'): Rule[] {
  let byLang = ruleCache.get(snapshot);
  if (!byLang) { byLang = {}; ruleCache.set(snapshot, byLang); }
  if (byLang[language]) return byLang[language];
  const entries = (snapshot.entries || []).filter(e => (e.status ?? 'confirmed') === 'confirmed');
  const spellings = new Set(entries.map(e => norm(e.spelling)));
  const owners = new Map<string, Set<string>>();
  const found: { from: string; to: string }[] = [];
  for (const e of entries) {
    const to = language === 'zh' ? e.zh : e.spelling;
    if (!to) continue;
    for (const v of heardOf(e)) {
      const text = v.text.trim();
      if (!text || (language === 'zh') !== CJK.test(text)) continue;
      if (v.languages && v.languages.length && !v.languages.includes(language)) continue;
      if (norm(text) === norm(e.spelling) || text === to) continue;
      const key = norm(text);
      if (!CJK.test(text) && (key.replace(/ /g, '').length < 3 || spellings.has(key))) continue;
      (owners.get(key) ?? owners.set(key, new Set()).get(key)!).add(to);
      found.push({ from: text, to });
    }
  }
  const rules = found.filter(f => owners.get(norm(f.from))!.size === 1)
    .sort((a, b) => b.from.length - a.from.length)
    .map(f => ({ ...f, re: new RegExp(CJK.test(f.from) ? escapeRe(f.from) : `(?<![\\p{L}\\p{N}])${escapeRe(f.from).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu') }));
  byLang[language] = rules;
  return rules;
}

/** Replace known mishearings. Returns the fixed text and what changed; `text` is returned as given when nothing did. */
export function applyKnownFixes(text: string, snapshot: WordSnapshot = wordSnapshot, language: 'en' | 'zh' = 'en'): { text: string; fixes: WordFix[] } {
  if (typeof text !== 'string' || !text) return { text: text ?? '', fixes: [] };
  let out = text;
  const fixes: WordFix[] = [];
  for (const rule of rulesFor(snapshot, language)) {
    let count = 0, firstFrom = '';
    out = out.replace(rule.re, m => { count++; firstFrom ||= m; return rule.to; });
    if (count) fixes.push({ from: firstFrom, to: rule.to, count });
  }
  return { text: out, fixes };
}
