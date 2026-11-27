// When a new tea is posted: what the Wisdom Base still needs for it.
// Spec: docs/TEA_WISDOM_BASE.md, "When a new tea is posted: what the Wisdom Base needs".
//
// Pure. The caller passes the Wisdom it has: the shop and Curate pass the
// published pages and approved claims; the Mac command
// (scripts/tea-wisdom-compose/needs.mjs) also passes the drafts, so a page
// written but not yet approved reads as drafted rather than missing.
// The matching rules are the composer's own (teaMatching.ts), so what this
// reports as covered is what composing the tea's entry will find.
import type { PublicClaim } from './claims';
import { listingFacts } from './listingFacts';
import { normalizedWords, placeAliases } from './catalogue';
import { namedTeaIdForLot } from './namedTeaLots';
import { gradeIdsIn, kitPagesFor, processesIn, teaNames, type WisdomPageRef } from './teaMatching';
import { findMarkById, findProducerById, matchMarks, matchProducers } from '../producers';
import { findNamedTeaById, matchNamedTea } from '../namedTeas';
import { findRegion } from '../regions';
import { NON_TEA_TYPES, TEA_PROCESSES } from '../vocabulary';

export type WisdomNeedKind = 'style' | 'place' | 'grade' | 'process' | 'producer' | 'named';

/** written: a published page. drafted: a page waiting for approval. record: a thin index row only. missing: nothing. */
export type WisdomNeedState = 'written' | 'drafted' | 'record' | 'missing';

export interface WisdomNeed {
  kind: WisdomNeedKind;
  label: string;
  why: string;
  /** True only when a published, approved page covers it. */
  covered: boolean;
  state: WisdomNeedState;
  pageId?: string;
}

export interface WisdomNeedsProduct {
  id?: string | null;
  type?: string | null;
  form?: string | null;
  product_name?: string | null;
  given_name?: string | null;
  chinese_name?: string | null;
  origin_region?: string | null;
  origin_country?: string | null;
  year?: number | string | null;
}

export interface WisdomLayer {
  pages: readonly WisdomPageRef[];
  claims: readonly PublicClaim[];
}

export interface WisdomNeedsSources {
  /** Public pages and approved claims: what a reader can see. */
  published: WisdomLayer;
  /** Every page and claim in any state. Optional; without it nothing reads as drafted. */
  drafts?: WisdomLayer;
}

const PLACE_KINDS = new Set<WisdomPageRef['kind']>(['tea_area', 'major_region']);
/** Pages that are a process in their own right (GABA, tea heads), not a section of a style kit. */
const PROCESS_PAGE_IDS = new Set(TEA_PROCESSES.filter(process => !process.sectionKey).map(process => process.pageId));
const UNKNOWN_ORIGIN = new Set(['unknown', 'n a', 'na', 'none', 'tbc', 'tbd']);
const KIND_ORDER: readonly WisdomNeedKind[] =['style', 'place', 'grade', 'process', 'producer', 'named'];

const hasPage = (layer: WisdomLayer | undefined, id: string) => Boolean(layer?.pages.some(page => page.id === id));
const hasSection = (layer: WisdomLayer | undefined, pageId: string, sectionKey?: string) => hasPage(layer, pageId)
  && (!sectionKey || Boolean(layer?.claims.some(claim => claim.claimId === `${pageId}:${sectionKey}`)));

function stateOf(sources: WisdomNeedsSources, pageId: string, hasRecord: boolean, sectionKey?: string): WisdomNeedState {
  if (hasSection(sources.published, pageId, sectionKey)) return 'written';
  if (hasSection(sources.drafts, pageId, sectionKey)) return 'drafted';
  return hasRecord ? 'record' : 'missing';
}

/** The plain reason for each state; a need whose `why` differs says something more (a broader place, a type to choose). */
export const WHY: Record<WisdomNeedState, string> = {
  written: 'Written up',
  drafted: 'Page drafted, waiting for approval',
  record: 'Record only, no write-up',
  missing: 'Nothing in the Wisdom Base yet',
};

function need(kind: WisdomNeedKind, label: string, state: WisdomNeedState, pageId?: string, why = WHY[state]): WisdomNeed {
  return { kind, label, why, covered: state === 'written', state, ...(pageId && state !== 'missing' && state !== 'record' ? { pageId } : {}) };
}

/** The place page for one origin part: a place page whose id, label or place claims name it. */
function placePage(layer: WisdomLayer | undefined, part: string): WisdomPageRef | undefined {
  if (!layer) return undefined;
  const words = normalizedWords(part);
  return layer.pages.find(page => PLACE_KINDS.has(page.kind) && (
    page.id === words.replace(/ /g, '-')
    || placeAliases(page.label).some(alias => normalizedWords(alias) === words)
    || layer.claims.some(claim => claim.pageId === page.id && claim.appliesWhen.origin_includes?.includes(words))
  ));
}

function placeNeed(product: WisdomNeedsProduct, sources: WisdomNeedsSources): WisdomNeed {
  const parts = [product.origin_region, product.origin_country].filter(Boolean).join(',')
    .split(',').map(part => part.trim()).filter(part => normalizedWords(part) && !UNKNOWN_ORIGIN.has(normalizedWords(part)));
  if (parts.length === 0) return need('place', 'Origin', 'missing', undefined, 'No origin recorded: add where it is from');
  const [specific, ...broader] = parts;
  const written = placePage(sources.published, specific);
  if (written) return need('place', specific, 'written', written.id);
  const drafted = placePage(sources.drafts, specific);
  const state: WisdomNeedState = drafted ? 'drafted' : findRegion(specific) ? 'record' : 'missing';
  const wider = broader.map(part => ({ part, page: placePage(sources.published, part) })).find(found => found.page);
  const why = wider ? `${WHY[state]}; ${wider.part} is written up` : WHY[state];
  return need('place', specific, state, drafted?.id, why);
}

function styleNeed(product: WisdomNeedsProduct, facts: ReturnType<typeof listingFacts>, sources: WisdomNeedsSources): WisdomNeed {
  if (!facts.type) {
    const written = product.type?.trim();
    const hint = written && /pu.?er/i.test(written) ? ': say Sheng or Shou' : ': choose one of its types';
    return need('style', written || 'Type', 'missing', undefined,
      written ? `"${written}" is not a type the Wisdom Base knows${hint}` : 'No type recorded');
  }
  // A process page (GABA, tea heads) is reported as the process, not the style.
  const kit = (layer: WisdomLayer | undefined) => (layer ? kitPagesFor(facts, layer.claims, layer.pages) : [])
    .filter(page => !PROCESS_PAGE_IDS.has(page.id));
  const written = kit(sources.published);
  if (written.length) return need('style', written[0].label, 'written', written[0].id, `Style kit: ${written.map(page => page.label).join(', ')}`);
  const drafted = kit(sources.drafts);
  if (drafted.length) return need('style', drafted[0].label, 'drafted', drafted[0].id);
  return need('style', facts.type, 'missing', undefined, `No style kit for ${facts.type}`);
}

/** What the Wisdom Base holds and still needs for one tea, in the spec table's order. */
export function wisdomNeeds(product: WisdomNeedsProduct, sources: WisdomNeedsSources): WisdomNeed[] {
  // Teaware and the like share the records but are not tea.
  if ((NON_TEA_TYPES as readonly string[]).includes(product.type?.trim() ?? '')) return [];
  const names = teaNames(product);
  const origin = [product.origin_region, product.origin_country].filter(Boolean).join(', ');
  const facts = listingFacts({ id: product.id, type: product.type, form: product.form, originRegion: origin, name: product.product_name });
  const allPages = [...sources.published.pages, ...(sources.drafts?.pages ?? [])];
  const pageLabel = (id: string) => allPages.find(page => page.id === id)?.label;
  const needs: WisdomNeed[] = [styleNeed(product, facts, sources), placeNeed(product, sources)];

  for (const id of gradeIdsIn(names, allPages)) {
    const mark = findMarkById(id);
    needs.push(need('grade', mark?.name ?? pageLabel(id) ?? id, stateOf(sources, id, Boolean(mark)), id));
  }

  for (const process of processesIn(names)) {
    needs.push(need('process', process.name, stateOf(sources, process.pageId, false, process.sectionKey), process.pageId));
  }

  const producers = [...matchProducers(...names), ...matchMarks(...names).map(mark => findProducerById(mark.producerId)).filter(Boolean)];
  for (const producer of [...new Set(producers)]) {
    needs.push(need('producer', producer!.name, stateOf(sources, producer!.id, true), producer!.id));
  }

  const namedId = (product.id ? namedTeaIdForLot(product.id) : undefined) ?? matchNamedTea(...names)?.id;
  if (namedId) {
    needs.push(need('named', findNamedTeaById(namedId)?.name ?? pageLabel(namedId) ?? namedId, stateOf(sources, namedId, Boolean(findNamedTeaById(namedId))), namedId));
  }

  return needs.sort((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind));
}
