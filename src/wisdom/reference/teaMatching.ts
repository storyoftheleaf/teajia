// What the Wisdom Base holds for one tea: its style kit pages, a grade its name
// carries, the ways of making its name carries. One set of rules, read by the
// composer (composeInputs.ts) and by the needs check (wisdomNeeds.ts), so the
// check reports exactly what composing would find.
import type { DraftReferencePage, ListingFacts, PublicClaim } from './claims';
import { appliesTo } from './listingPassages';
import { matchMarks, matchNamedIn } from '../producers';
import { TEA_PROCESSES, type TeaProcess } from '../vocabulary';

/** A page as these rules need it. */
export type WisdomPageRef = Pick<DraftReferencePage, 'id' | 'kind' | 'label'> & { nativeName?: string };

/** A page that can serve as a tea's kit: its family (Dark, Pu'er) or its type within one (Liu Bao, Shou). */
export const KIT_KINDS: readonly DraftReferencePage['kind'][] = ['tea_type', 'tea_family'];

/** The tea's kit pages, most specific first: a type within a family (Liu Bao, Shou) before the family (Dark, Pu'er). */
export function kitPagesFor<P extends WisdomPageRef>(facts: ListingFacts, claims: readonly PublicClaim[], pages: readonly P[]): P[] {
  const kinds = new Map(pages.map(page => [page.id, page]));
  return [...new Set(claims
    .filter(claim => KIT_KINDS.includes(kinds.get(claim.pageId)?.kind as DraftReferencePage['kind']) && appliesTo(claim.appliesWhen, facts))
    .map(claim => claim.pageId))]
    .map(id => kinds.get(id)!)
    .sort((left, right) => KIT_KINDS.indexOf(left.kind) - KIT_KINDS.indexOf(right.kind));
}

/** The names a tea is known by, in the order they are trusted. */
export function teaNames(product: { product_name?: string | null; given_name?: string | null; chinese_name?: string | null }): string[] {
  return [product.product_name, product.given_name, product.chinese_name].filter((name): name is string => Boolean(name?.trim()));
}

/**
 * Grade words the names carry: a grade mark ("Palace Grade" is Gong Ting) or
 * a leaf_grade page named outright. Ids are shared, so a mark and its page
 * answer to the same id. Each id once, mark matches first.
 */
export function gradeIdsIn(names: readonly string[], pages: readonly WisdomPageRef[]): string[] {
  const gradePages = pages.filter(page => page.kind === 'leaf_grade')
    .map(page => ({ id: page.id, name: page.label, chineseName: page.nativeName, altNames: [] as string[] }));
  return [...new Set([
    ...matchMarks(...names).map(mark => mark.id),
    ...matchNamedIn(gradePages, ...names).map(page => page.id),
  ])];
}

/**
 * The grade the composer may use: a grade the name carries that has a
 * leaf_grade page. A mark with no grade page (Golden Bull) is not a grade.
 */
export function gradeIdFor(names: readonly string[], pages: readonly WisdomPageRef[]): string | undefined {
  const gradePageIds = new Set(pages.filter(page => page.kind === 'leaf_grade').map(page => page.id));
  return gradeIdsIn(names, pages).find(id => gradePageIds.has(id));
}

/** Ways of making the names carry (GABA, tea heads), from the one word list in vocabulary.ts. */
export function processesIn(names: readonly string[]): TeaProcess[] {
  return matchNamedIn(TEA_PROCESSES, ...names);
}
