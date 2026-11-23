/**
 * One composed entry per tea: the plan in todo/plans/tea-wisdom-composed-entry.md.
 *
 * An entry is a few paragraphs, each built from one layer of the stack (lot,
 * maker, grade, place, age, type), closed by brewing and, where allowed, what
 * people often notice about the style. Terms the writer used are marked
 * `[shown text](page:section)`; the page turns a mark into a link only when
 * the Wisdom page behind it says more than the sentence did.
 *
 * Phase 1 entries are written by hand as the target. Phase 2's composer must
 * produce the same shape.
 */
import type { PublicClaim } from './claims';
import { wisdomHrefFor } from './listingPassages';

export type EntryLayer = 'lot' | 'maker' | 'grade' | 'place' | 'age' | 'type';

export interface ComposedParagraph {
  layer: EntryLayer | 'brewing' | 'notice';
  /** Plain prose with `[term](page:section)` marks. */
  text: string;
}

export interface ComposedEntry {
  productId: string;
  paragraphs: readonly ComposedParagraph[];
  brewing?: ComposedParagraph;
  /** The style sentence. Omitted where the listing carries no sensory copy. */
  notice?: ComposedParagraph & { styleName: string };
  /** What would make the entry richer, for the builder only. Never rendered to customers. */
  missing: readonly string[];
}

export type EntrySegment = { text: string; claimId?: undefined } | { text: string; claimId: string };

const MARK = /\[([^\]]+)\]\(([a-z0-9-]+:[a-z0-9-]+)\)/g;

export function entrySegments(text: string): EntrySegment[] {
  const segments: EntrySegment[] = [];
  let last = 0;
  for (const match of text.matchAll(MARK)) {
    if (match.index! > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[1], claimId: match[2] });
    last = match.index! + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/** Every claim an entry rests on, in reading order, without repeats. */
export function entryClaimUses(entry: ComposedEntry): string[] {
  const all = [...entry.paragraphs, ...(entry.brewing ? [entry.brewing] : []), ...(entry.notice ? [entry.notice] : [])];
  return [...new Set(all.flatMap(paragraph => entrySegments(paragraph.text).flatMap(s => (s.claimId ? [s.claimId] : []))))];
}

/**
 * Where a marked term links, or null. A term links only when its Wisdom page
 * holds at least two live sections, so the reader lands somewhere that says
 * more than the sentence they just read.
 */
export function entryLinkFor(claimId: string, claims: readonly PublicClaim[]): string | null {
  const claim = claims.find(entry => entry.claimId === claimId);
  if (!claim || claim.reviewState === 'withdrawn') return null;
  const sections = claims.filter(entry => entry.pageId === claim.pageId && entry.reviewState !== 'withdrawn');
  if (sections.length < 2) return null;
  const page = wisdomHrefFor(claim).split('#')[0];
  // Region pages show approved sections only and keep no section anchors, so a
  // place opens at the top of its page. Type and grade pages anchor each
  // section by its heading (ReferenceFactSections) and scroll to it.
  if (claim.axis === 'place') return page;
  return `${page}#reference-${claim.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
