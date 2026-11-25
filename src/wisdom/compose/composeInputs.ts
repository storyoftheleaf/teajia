/**
 * Phase 2 of todo/plans/tea-wisdom-composed-entry.md: what the writer is given
 * for one tea, and the checks its draft must pass. Pure functions; the Mac
 * script (scripts/tea-wisdom-compose/compose.mjs) bundles this file, calls the
 * model and writes the drafts.
 *
 * The layer stack, most specific first: lot, maker, grade, place, age, type,
 * then brewing and what people often notice. A layer the tea lacks is left out,
 * never guessed, and nothing is read from the name.
 */
import type { DraftReferencePage, PublicClaim } from '../reference/claims';
import { appliesTo } from '../reference/listingPassages';
import { listingFacts } from '../reference/listingFacts';
import { reviewedLotProse } from '../reference/namedTeaLots';
import { entrySegments, type ComposedEntry, type ComposedParagraph } from '../reference/composedEntry';

/** The public product fields the writer may see. Mirrors /api/products/public. */
export interface ComposeProduct {
  id: string;
  product_name: string;
  chinese_name?: string | null;
  type?: string | null;
  form?: string | null;
  year?: number | string | null;
  origin_region?: string | null;
  origin_country?: string | null;
  lore?: string | null;
  terroir?: string | null;
  processing_notes?: string | null;
}

export type AgeBand = 'age-young' | 'age-settling' | 'age-aged';

export interface ComposeInputs {
  productId: string;
  record: {
    name: string;
    chineseName?: string;
    type?: string;
    form?: string;
    year?: string;
    ageYears?: number;
    origin?: string;
    /** The record's own prose. May hold unverified detail; the writer keeps only lot history. */
    notes: string[];
  };
  /** Claims the writer may use, by layer. */
  /** `named`: the sourced history of this exact tea, when its lot is a confirmed named tea. It leads. */
  layers: Partial<Record<'named' | 'grade' | 'place' | 'age' | 'type', PublicClaim[]>>;
  /**
   * Brewing and the style line come straight from the kit, worded once in
   * Wisdom and fitted only to the tea's form and age. The writer never
   * rewords them.
   */
  fixed: { brewing?: ComposedParagraph; notice?: ComposedParagraph & { styleName: string }; claimIds: string[] };
  allowNotice: boolean;
  missing: string[];
}

/** A page that can serve as a tea's kit: its family (Dark, Pu'er) or its type within one (Liu Bao, Shou). */
type KitPage = Pick<DraftReferencePage, 'id' | 'kind' | 'label'>;
const KIT_KINDS: readonly DraftReferencePage['kind'][] = ['tea_type', 'tea_family'];

/** Kit sections that are not story: they fill the age, brewing and notice slots. */
const AGE_KEYS = ['age-young', 'age-settling', 'age-aged'] as const;
const SLOT_KEYS = new Set<string>([...AGE_KEYS, 'ageing', 'brewing', 'brewing-pressed', 'brewing-simmer', 'common-impressions', 'notice-aged']);

const PLACE_LEADS = new Set(['Taiwan', 'Yunnan', 'Fujian', 'Wuyi', 'Anxi', 'Phoenix', 'Guangdong', 'Anhua', 'Sichuan']);
const TYPE_WORDS = new Set(['Oolong', 'Green', 'White', 'Yellow', 'Red', 'Dark', 'Herbal']);

/** "Shou (ripe pu’er)" reads as "ripe pu’er"; "Dark tea (hei cha)" as "dark tea"; a proper name like "Liu Bao" stays. */
export function styleName(label: string): string {
  const inner = /\(([^)]+)\)/.exec(label)?.[1]?.trim();
  const outer = label.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // A parenthesis is the English name only when it reads as one ("ripe pu’er"), not a romanisation ("hei cha").
  const name = inner && /pu[’']er/i.test(inner) ? inner : outer;
  // A bare type word ("Oolong") reads in lower case; a style's own name ("Liu Bao") keeps its capitals.
  const properName = !TYPE_WORDS.has(name) && name.split(/\s+/).every(word => /^[A-Z]/.test(word));
  // A style named for its place ("Taiwan oolong") keeps the place's capital.
  const placeLed = PLACE_LEADS.has(name.split(/\s+/)[0]);
  return properName || placeLed ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** A year field as written ("1990", 2015, "1990s"); a decade reads as its middle. */
export function yearOf(value: ComposeProduct['year']): { label: string; year: number } | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const decade = /^(\d{4})s$/.exec(text);
  if (decade) return { label: `the ${text}`, year: Number(decade[1]) + 5 };
  const year = /^(\d{4})$/.exec(text);
  return year ? { label: text, year: Number(year[1]) } : null;
}

export function ageBand(ageYears: number): AgeBand {
  if (ageYears < 5) return 'age-young';
  if (ageYears < 10) return 'age-settling';
  return 'age-aged';
}

const usable = (claim: PublicClaim) => claim.reviewState !== 'withdrawn' && claim.text.trim().length > 0;

export function composeInputs(
  product: ComposeProduct,
  claims: readonly PublicClaim[],
  options: { thisYear: number; noNotice?: readonly string[]; pages: readonly KitPage[] },
): ComposeInputs {
  const origin = [product.origin_region, product.origin_country].filter(Boolean).join(', ');
  const facts = listingFacts({ id: product.id, type: product.type, form: product.form, originRegion: origin, name: product.product_name });
  const live = claims.filter(usable);
  // The tea's kit pages, most specific first: a type within a family (Liu Bao, Shou) before the family (Dark, Pu'er).
  const kinds = new Map(options.pages.map(page => [page.id, page]));
  const kitPages = [...new Set(live
    .filter(claim => KIT_KINDS.includes(kinds.get(claim.pageId)?.kind as DraftReferencePage['kind']) && appliesTo(claim.appliesWhen, facts))
    .map(claim => claim.pageId))]
    .map(id => kinds.get(id)!)
    .sort((left, right) => KIT_KINDS.indexOf(left.kind) - KIT_KINDS.indexOf(right.kind));
  const kitClaims = live.filter(claim => kitPages.some(page => page.id === claim.pageId) && appliesTo(claim.appliesWhen, facts));
  /** A slot's section from the most specific kit page that has it. */
  const onType = (key: string) => {
    for (const page of kitPages) {
      const claim = kitClaims.find(candidate => candidate.pageId === page.id && candidate.sectionKey === key);
      if (claim) return claim;
    }
    return undefined;
  };
  const mainKit = kitPages[0];
  const year = yearOf(product.year);
  const ageYears = year ? options.thisYear - year.year : undefined;
  const missing: string[] = [];

  const layers: ComposeInputs['layers'] = {};
  // A confirmed named tea (namedTeaLots.ts) brings its own sourced history, in its page's section order.
  const named = facts.namedTeaId
    ? live.filter(claim => claim.pageId === facts.namedTeaId && claim.axis === 'named_tea_history')
    : [];
  if (named.length) layers.named = named;
  const place = live.filter(claim => claim.axis === 'place' && appliesTo(claim.appliesWhen, facts));
  if (place.length) layers.place = place;
  else missing.push('A Wisdom entry for its place, or a more specific origin');
  const grade = facts.grade ? live.filter(claim => claim.axis === 'grade' && appliesTo(claim.appliesWhen, facts)) : [];
  if (grade.length) layers.grade = grade;
  if (ageYears !== undefined && mainKit) {
    const band = onType(ageBand(ageYears)) ?? onType('ageing');
    if (band) layers.age = [band];
  } else if (mainKit) missing.push('The year it was made: unlocks the age paragraph');
  // Story sections: every kit section that is not a slot, the specific page first, then the family's definition.
  // Each page's definition leads its own sections, whatever order the ledger keeps them in.
  const type = kitPages.flatMap((page, index) => kitClaims.filter(claim => (
    claim.pageId === page.id && !SLOT_KEYS.has(claim.sectionKey) && claim.axis !== 'sensory_observation'
    && (index === 0 || claim.sectionKey === 'definition')
  )).sort((left, right) => Number(right.sectionKey === 'definition') - Number(left.sectionKey === 'definition')));
  if (type.length) layers.type = type;
  else missing.push(`A Wisdom kit for ${product.type ?? 'this type'}`);
  const allowNotice = !(options.noNotice ?? []).includes(product.id);
  const fixed: ComposeInputs['fixed'] = { claimIds: [] };
  const brewing = onType('brewing');
  const pressed = facts.form !== undefined && !['Loose', 'Bag', 'Rolled'].includes(facts.form);
  const breaking = pressed ? onType('brewing-pressed') : undefined;
  if (brewing) {
    fixed.brewing = { layer: 'brewing', text: [breaking?.text, brewing.text].filter(Boolean).join(' ') };
    fixed.claimIds.push(...[breaking, brewing].filter((claim): claim is PublicClaim => Boolean(claim)).map(claim => claim.claimId));
  }
  // A kit with one general ageing section instead of bands (raw pu'er) still has an aged style line for an aged tea.
  const ageKey = layers.age?.[0]?.sectionKey;
  const aged = ageKey === 'age-aged' || (ageKey === 'ageing' && ageYears !== undefined && ageBand(ageYears) === 'age-aged');
  const agedNotice = aged ? onType('notice-aged') : undefined;
  const noticeClaim = agedNotice ?? onType('common-impressions');
  if (allowNotice && noticeClaim) {
    const name = styleName(kinds.get(noticeClaim.pageId)?.label ?? mainKit?.label ?? '');
    fixed.notice = { layer: 'notice', styleName: agedNotice ? `aged ${name}` : name, text: noticeClaim.text };
    fixed.claimIds.push(noticeClaim.claimId);
  }
  missing.push('A voice note from you on this lot', 'Photos');

  return {
    productId: product.id,
    record: {
      name: product.product_name,
      ...(product.chinese_name ? { chineseName: product.chinese_name } : {}),
      ...(product.type ? { type: product.type } : {}),
      ...(product.form ? { form: product.form } : {}),
      ...(year ? { year: year.label } : {}),
      ...(ageYears !== undefined ? { ageYears } : {}),
      ...(origin ? { origin } : {}),
      // Reviewed lot prose only: on a named tea, prose the review superseded is replaced or dropped, never fed in.
      notes: [
        reviewedLotProse(product.id, 'lore', product.lore),
        reviewedLotProse(product.id, 'terroir', product.terroir),
        reviewedLotProse(product.id, 'processingNotes', product.processing_notes),
      ].map(text => text?.trim()).filter((text): text is string => Boolean(text)),
    },
    layers,
    fixed,
    allowNotice,
    missing,
  };
}

/** Words that belong to the tasting field or the notice, never to the story paragraphs. */
const TASTE = /\b(sweet\w*|smooth\w*|earthy|woody|fruit\w*|floral|honey\w*|camphor|mineral\w*|malt\w*|bitter\w*|creamy|cream|velvet\w*|silky|thick|astringen\w*|aroma\w*|notes?|flavou?rs?|tastes?)\b/i;
const SUPERLATIVE = /\b(best|finest|world-class|extraordinary|amazing|premium|prized|sought-after|transcends?|exceptional|rare)\b/i;

export interface EntryProblem { where: string; problem: string }

/**
 * Mechanical checks on a draft. A draft with any problem is not saved as ready;
 * the second, model-run pass checks the sentences against the inputs.
 */
export function entryProblems(entry: ComposedEntry, inputs: ComposeInputs): EntryProblem[] {
  const problems: EntryProblem[] = [];
  const allowed = new Set(Object.values(inputs.layers).flat().map(claim => claim!.claimId));
  const sourceText = [
    ...Object.values(inputs.layers).flat().map(claim => claim!.text),
    inputs.fixed.brewing?.text ?? '', inputs.fixed.notice?.text ?? '',
    ...inputs.record.notes,
    inputs.record.name, inputs.record.year ?? '', inputs.record.origin ?? '', String(inputs.record.ageYears ?? ''),
  ].join(' ');
  const numbers = new Set(sourceText.match(/\d+/g) ?? []);
  const parts = [
    ...entry.paragraphs.map((paragraph, index) => ({ where: `paragraph ${index + 1}`, text: paragraph.text, story: true })),
    ...(entry.brewing ? [{ where: 'brewing', text: entry.brewing.text, story: false }] : []),
    ...(entry.notice ? [{ where: 'notice', text: entry.notice.text, story: false }] : []),
  ];
  if (entry.paragraphs.length < 1 || entry.paragraphs.length > 3) problems.push({ where: 'entry', problem: `${entry.paragraphs.length} story paragraphs; write one to three` });
  if (entry.notice && !inputs.allowNotice) problems.push({ where: 'notice', problem: 'this listing carries no taste copy' });
  if (entry.notice && !inputs.fixed.notice) problems.push({ where: 'notice', problem: 'no notice claim was supplied' });
  if (entry.notice && /\b(it|its|this (brick|cake|tea|lot|tuo|leaf))\b/i.test(entry.notice.text)) {
    problems.push({ where: 'notice', problem: 'the notice speaks of this lot ("it", "this"); describe the style instead' });
  }
  for (const part of parts) {
    const plain = entrySegments(part.text).map(segment => segment.text).join('');
    for (const segment of entrySegments(part.text)) {
      if (segment.claimId && !allowed.has(segment.claimId)) problems.push({ where: part.where, problem: `links ${segment.claimId}, which was not supplied` });
    }
    if (/[—–]/.test(plain)) problems.push({ where: part.where, problem: 'uses a dash; the house style has none' });
    const superlative = SUPERLATIVE.exec(plain);
    if (superlative) problems.push({ where: part.where, problem: `superlative "${superlative[0]}"` });
    if (part.story) {
      const taste = TASTE.exec(plain);
      if (taste) problems.push({ where: part.where, problem: `taste word "${taste[0]}" belongs in the notice` });
    }
    for (const number of plain.match(/\d+/g) ?? []) {
      if (!numbers.has(number)) problems.push({ where: part.where, problem: `the number ${number} is in no input` });
    }
  }
  return problems;
}
