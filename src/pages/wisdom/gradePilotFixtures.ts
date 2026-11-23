/**
 * Tea Wisdom pilot fixtures: the Gong Ting leaf grade and its neighbours, as
 * the preview build would project them. Contract: docs/_notes/tea-wisdom-claims.md.
 *
 * Stand-ins until the integration thread's generatedDraftClaims.ts carries the
 * gong-ting, special-grade and seventh-grade pages. Loaded only through a
 * mode-guarded dynamic import (DEV or tea-reference-preview), never in a
 * production bundle. Every entry conforms to `DraftClaim`, so the swap to the
 * generated module changes the import and nothing else.
 *
 * Rev 1 of `gong-ting:definition` is the legacy wording (src/wisdom/generated/marks.ts),
 * rev 2 narrows it to loose ripe pu'er grading.
 *
 * Adrian, 2026-11-23 (contract, "Adrian's decisions"): what the grades mean is
 * trade knowledge, written in our own words with no citation (`basis:
 * 'trade_knowledge'`, empty sourceIds), and taste is one uncredited sentence of
 * what people often notice in the style, never a named seller. `gradePilotClaims(2)`
 * is the set after the correction; `gradePilotClaims(1)` the set before it.
 */
import type { ClaimRevision, DraftClaim, DraftReferencePage, PublicTeaReferenceSource } from '../../wisdom/reference/claims';

/** The place the standard was issued: the grade page links here. */
export const STANDARD_PLACE_PAGE_ID = 'menghai-county';

const GONG_TING_REV_1: ClaimRevision = {
  rev: 1,
  origin: 'legacy_import',
  legacyRef: 'marks:gong-ting',
  scope: "General grade designation (shou pu'er and aged Taiwanese oolong)",
  text: "A 'palace' or 'imperial court' designation for the highest grade classification within a tea's production, indicating the finest bud or tip material. Seen on shou pu-erh (finest bud material) and on aged Taiwanese oolong (finest buds and leaves).",
  approvedAt: '2026-11-24',
  reason: 'Imported from the legacy marks corpus',
  evidenceIds: [],
};

const GONG_TING_REV_2: ClaimRevision = {
  rev: 2,
  origin: 'approved',
  scope: "Loose ripe pu'er grading",
  text: "Gong Ting is a grade name for loose ripe pu'er: fine, tender leaf with plenty of golden buds. It names a sorting category for loose tea, not a general measure of quality.",
  approvedAt: '2026-11-25',
  reason: 'Narrowed to loose ripe pu\'er grading',
  evidenceIds: [],
};

const GONG_TING_TERMS = [
  { original: '宫廷', pinyin: 'gōngtíng', gloss: 'palace; used here as a grade name' },
  { original: '散茶', pinyin: 'sǎnchá', gloss: 'loose tea' },
] as const;

/** `gong-ting:definition` as it stands when `current` is its approved revision. */
export function gongTingDefinition(current: 1 | 2): DraftClaim {
  const revision = current === 1 ? GONG_TING_REV_1 : GONG_TING_REV_2;
  return {
    claimId: 'gong-ting:definition',
    pageId: 'gong-ting',
    sectionKey: 'definition',
    label: 'What the grade names',
    axis: 'grade',
    basis: 'trade_knowledge',
    listingEligible: true,
    appliesWhen: { grade: 'gong-ting' },
    terms: GONG_TING_TERMS,
    rev: revision.rev,
    scope: revision.scope,
    text: revision.text,
    sourceIds: [],
    reviewState: 'approved',
    previousRevisions: current === 1 ? [GONG_TING_REV_1] : [GONG_TING_REV_1, GONG_TING_REV_2],
    pageVisibility: 'draft',
  };
}

function approvedRev1(claim: Omit<DraftClaim, 'rev' | 'reviewState' | 'previousRevisions' | 'pageVisibility'>): DraftClaim {
  return {
    ...claim,
    rev: 1,
    reviewState: 'approved',
    pageVisibility: 'draft',
    previousRevisions: [{
      rev: 1,
      origin: 'approved',
      scope: claim.scope,
      text: claim.text,
      approvedAt: '2026-11-25',
      reason: 'Pilot entry, trade knowledge',
      evidenceIds: [],
    }],
  };
}

const LOOSE_GRADING = "Loose ripe pu'er grading";

const NEIGHBOURING_GRADES = approvedRev1({
  claimId: 'gong-ting:neighbouring-grades',
  pageId: 'gong-ting',
  sectionKey: 'neighbouring-grades',
  label: 'The grades beside it',
  axis: 'grade',
  basis: 'trade_knowledge',
  listingEligible: false,
  appliesWhen: {},
  terms: [
    { original: '特级', pinyin: 'tèjí', gloss: 'special grade' },
    { original: '七级', pinyin: 'qījí', gloss: 'seventh grade' },
  ],
  scope: LOOSE_GRADING,
  text: 'Special grade is still tender leaf but allows some tender stems. Seventh grade is coarser leaf, with stems. Each is a sorting category for loose tea.',
  sourceIds: [],
});

const BLENDING = approvedRev1({
  claimId: 'gong-ting:blending',
  pageId: 'gong-ting',
  sectionKey: 'blending',
  label: 'Grades in a pressed tea',
  axis: 'process',
  basis: 'trade_knowledge',
  listingEligible: false,
  appliesWhen: {},
  terms: [{ original: '拼配', pinyin: 'pīnpèi', gloss: 'blending' }],
  scope: "Ripe pu'er production",
  text: 'A maker can select or blend different grades for a pressed tea, so a loose-tea grade does not by itself describe a cake.',
  sourceIds: [],
});

const COMMON_IMPRESSIONS = approvedRev1({
  claimId: 'gong-ting:common-impressions',
  pageId: 'gong-ting',
  sectionKey: 'common-impressions',
  label: 'What people often notice',
  axis: 'sensory_observation',
  basis: 'trade_knowledge',
  listingEligible: false,
  appliesWhen: {},
  terms: [],
  scope: "Gong Ting ripe pu'er as a style, not any one lot",
  text: 'Two Gong Ting teas can differ in the cup: one drinks fruity and creamy, while an aged cake leans to fruit and light wood.',
  sourceIds: [],
});

const SPECIAL_GRADE = approvedRev1({
  claimId: 'special-grade:definition',
  pageId: 'special-grade',
  sectionKey: 'definition',
  label: 'What the grade names',
  axis: 'grade',
  basis: 'trade_knowledge',
  listingEligible: true,
  appliesWhen: { grade: 'special-grade' },
  terms: [{ original: '特级', pinyin: 'tèjí', gloss: 'special grade' }],
  scope: LOOSE_GRADING,
  text: "Special grade is a grade name for loose ripe pu'er: tender leaf that allows some tender stems.",
  sourceIds: [],
});

const SEVENTH_GRADE = approvedRev1({
  claimId: 'seventh-grade:definition',
  pageId: 'seventh-grade',
  sectionKey: 'definition',
  label: 'What the grade names',
  axis: 'grade',
  basis: 'trade_knowledge',
  listingEligible: true,
  appliesWhen: { grade: 'seventh-grade' },
  terms: [{ original: '七级', pinyin: 'qījí', gloss: 'seventh grade' }],
  scope: LOOSE_GRADING,
  text: "Seventh grade is a grade name for loose ripe pu'er: coarser leaf, with stems.",
  sourceIds: [],
});

/** Every pilot grade claim, with `gong-ting:definition` at revision `gongTingRev`. */
export function gradePilotClaims(gongTingRev: 1 | 2 = 2): DraftClaim[] {
  return [
    gongTingDefinition(gongTingRev),
    NEIGHBOURING_GRADES,
    BLENDING,
    COMMON_IMPRESSIONS,
    SPECIAL_GRADE,
    SEVENTH_GRADE,
  ];
}

const gradePage = (id: string, label: string, nativeName: string, sections: DraftReferencePage['sections']): DraftReferencePage => ({
  id,
  slug: id,
  kind: 'leaf_grade',
  label,
  visibility: 'draft',
  nativeName,
  parentId: 'shou',
  sourceIds: [],
  sections,
});

const section = (key: string, label: string) => ({ key, label, sourceIds: [] as readonly string[] });

export const GRADE_PILOT_PAGES: readonly DraftReferencePage[] = [
  gradePage('gong-ting', 'Gong Ting', '宫廷', [
    section('definition', 'What the grade names'),
    section('neighbouring-grades', 'The grades beside it'),
    section('blending', 'Grades in a pressed tea'),
    section('common-impressions', 'What people often notice'),
  ]),
  gradePage('special-grade', 'Special grade', '特级', [section('definition', 'What the grade names')]),
  gradePage('seventh-grade', 'Seventh grade', '七级', [section('definition', 'What the grade names')]),
];

/** Trade knowledge carries no citation, so the pilot grades bring no sources of their own. */
export const GRADE_PILOT_SOURCES: readonly PublicTeaReferenceSource[] = [];
