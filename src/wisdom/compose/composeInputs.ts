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
import type { PublicClaim } from '../reference/claims';
import { appliesTo } from '../reference/listingPassages';
import { listingFacts } from '../reference/listingFacts';
import { entrySegments, type ComposedEntry } from '../reference/composedEntry';

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
  layers: Partial<Record<'grade' | 'place' | 'age' | 'type' | 'brewing' | 'notice', PublicClaim[]>>;
  allowNotice: boolean;
  missing: string[];
}

/** Which tea_type page a product type belongs to. */
const TYPE_PAGE: Record<string, string> = { Shou: 'shou', Sheng: 'sheng' };

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
  options: { thisYear: number; noNotice?: readonly string[] },
): ComposeInputs {
  const origin = [product.origin_region, product.origin_country].filter(Boolean).join(', ');
  const facts = listingFacts({ type: product.type, form: product.form, originRegion: origin, name: product.product_name });
  const typePage = facts.type ? TYPE_PAGE[facts.type] : undefined;
  const live = claims.filter(usable);
  const onType = (key: string) => live.find(claim => claim.pageId === typePage && claim.sectionKey === key);
  const year = yearOf(product.year);
  const ageYears = year ? options.thisYear - year.year : undefined;
  const missing: string[] = [];

  const layers: ComposeInputs['layers'] = {};
  const place = live.filter(claim => claim.axis === 'place' && appliesTo(claim.appliesWhen, facts));
  if (place.length) layers.place = place;
  else missing.push('A Wisdom entry for its place, or a more specific origin');
  const grade = facts.grade ? live.filter(claim => claim.axis === 'grade' && appliesTo(claim.appliesWhen, facts)) : [];
  if (grade.length) layers.grade = grade;
  if (ageYears !== undefined && typePage) {
    const band = onType(ageBand(ageYears));
    if (band) layers.age = [band];
  } else if (typePage) missing.push('The year it was made: unlocks the age paragraph');
  const type = ['definition', 'wet-piling'].map(onType).filter((claim): claim is PublicClaim => Boolean(claim));
  if (type.length) layers.type = type;
  else missing.push(`A Wisdom kit for ${product.type ?? 'this type'}`);
  const brewing = onType('brewing');
  if (brewing) layers.brewing = [brewing];
  const allowNotice = !(options.noNotice ?? []).includes(product.id);
  const notice = [onType('common-impressions'), layers.age?.[0]].filter((claim): claim is PublicClaim => Boolean(claim));
  if (allowNotice && notice.length) layers.notice = notice;
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
      notes: [product.lore, product.terroir, product.processing_notes].map(text => text?.trim()).filter((text): text is string => Boolean(text)),
    },
    layers,
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
  if (entry.notice && !inputs.layers.notice) problems.push({ where: 'notice', problem: 'no notice claim was supplied' });
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
