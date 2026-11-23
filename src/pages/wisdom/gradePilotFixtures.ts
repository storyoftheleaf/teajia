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
 * rev 2 is scoped to loose ripe pu'er in T/MHC 003–2020, Table 5. `gradePilotClaims(2)`
 * is the set after the correction; `gradePilotClaims(1)` the set before it.
 */
import type { ClaimRevision, DraftClaim, DraftReferencePage, PublicTeaReferenceSource } from '../../wisdom/reference/claims';

export const STANDARD_SOURCE_ID = 'menghai-tea-alliance-t-mhc-003-2020';
export const JINGMAI_SOURCE_ID = 'yunnan-sourcing-jingmai-gong-ting';
export const NANNUO_SOURCE_ID = 'yunnan-sourcing-nannuo-gong-ting-2006';
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
  scope: "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020, Table 5",
  text: "In the Menghai Tea Alliance's 2020 group standard for loose ripe pu'er, Gong Ting is the grade of fine, tender material with conspicuous golden buds. It is a category in that standard, not a general measure of quality.",
  approvedAt: '2026-11-25',
  reason: 'Scoped to the loose-tea table',
  evidenceIds: ['EVIDENCE-PILOT-GONG-TING-TABLE-5'],
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
    listingEligible: true,
    appliesWhen: { grade: 'gong-ting' },
    terms: GONG_TING_TERMS,
    rev: revision.rev,
    scope: revision.scope,
    text: revision.text,
    sourceIds: current === 1 ? [] : [STANDARD_SOURCE_ID],
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
      reason: 'Pilot entry',
      evidenceIds: [`EVIDENCE-PILOT-${claim.claimId.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`],
    }],
  };
}

const NEIGHBOURING_GRADES = approvedRev1({
  claimId: 'gong-ting:neighbouring-grades',
  pageId: 'gong-ting',
  sectionKey: 'neighbouring-grades',
  label: 'The rows beside it',
  axis: 'grade',
  listingEligible: false,
  appliesWhen: {},
  terms: [
    { original: '特级', pinyin: 'tèjí', gloss: 'special grade' },
    { original: '七级', pinyin: 'qījí', gloss: 'seventh grade' },
  ],
  scope: "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020, Table 5",
  text: 'The special-grade row of the same table allows some tender stems. The seventh-grade row describes coarser leaf and allows stems. Each row is a sorting category for loose tea in that standard.',
  sourceIds: [STANDARD_SOURCE_ID],
});

const BLENDING = approvedRev1({
  claimId: 'gong-ting:blending',
  pageId: 'gong-ting',
  sectionKey: 'blending',
  label: 'Grades in a pressed tea',
  axis: 'process',
  listingEligible: false,
  appliesWhen: {},
  terms: [{ original: '拼配', pinyin: 'pīnpèi', gloss: 'blending' }],
  scope: "Ripe pu'er production practice, as described alongside T/MHC 003–2020",
  text: 'A maker can select or blend different grades for a pressed tea, so the grade rows of the loose-tea table do not by themselves describe a cake.',
  sourceIds: [STANDARD_SOURCE_ID],
});

const JINGMAI_NOTES = approvedRev1({
  claimId: 'gong-ting:jingmai-seller-notes',
  pageId: 'gong-ting',
  sectionKey: 'jingmai-seller-notes',
  label: 'Seller observations',
  axis: 'sensory_observation',
  listingEligible: false,
  appliesWhen: {},
  attribution: {
    sourceId: JINGMAI_SOURCE_ID,
    sourceRole: 'seller_own_batch',
    sample: 'Jingmai Mountain Gong Ting loose ripe, Yunnan Sourcing listing',
  },
  terms: [],
  scope: 'One seller batch: Jingmai Mountain Gong Ting loose ripe pu’er',
  text: 'Yunnan Sourcing describes its loose Jingmai Gong Ting as thick, with a fruity creaminess.',
  sourceIds: [JINGMAI_SOURCE_ID],
});

const NANNUO_NOTES = approvedRev1({
  claimId: 'gong-ting:nannuo-seller-notes',
  pageId: 'gong-ting',
  sectionKey: 'nannuo-seller-notes',
  label: 'Seller observations',
  axis: 'sensory_observation',
  listingEligible: false,
  appliesWhen: {},
  attribution: {
    sourceId: NANNUO_SOURCE_ID,
    sourceRole: 'seller_own_batch',
    sample: '2006 Lao Man E brand Nannuo Gong Ting ripe cake, Yunnan Sourcing listing',
  },
  terms: [],
  scope: 'One seller batch: an aged 2006 Nannuo Gong Ting ripe cake',
  text: 'For an aged 2006 Nannuo Gong Ting cake, the same seller describes fruit and light hardwood.',
  sourceIds: [NANNUO_SOURCE_ID],
});

const SPECIAL_GRADE = approvedRev1({
  claimId: 'special-grade:definition',
  pageId: 'special-grade',
  sectionKey: 'definition',
  label: 'What the grade names',
  axis: 'grade',
  listingEligible: true,
  appliesWhen: { grade: 'special-grade' },
  terms: [{ original: '特级', pinyin: 'tèjí', gloss: 'special grade' }],
  scope: "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020, Table 5",
  text: "In the Menghai Tea Alliance's 2020 group standard for loose ripe pu'er, the special-grade row describes tender material and allows some tender stems.",
  sourceIds: [STANDARD_SOURCE_ID],
});

const SEVENTH_GRADE = approvedRev1({
  claimId: 'seventh-grade:definition',
  pageId: 'seventh-grade',
  sectionKey: 'definition',
  label: 'What the grade names',
  axis: 'grade',
  listingEligible: true,
  appliesWhen: { grade: 'seventh-grade' },
  terms: [{ original: '七级', pinyin: 'qījí', gloss: 'seventh grade' }],
  scope: "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020, Table 5",
  text: "In the Menghai Tea Alliance's 2020 group standard for loose ripe pu'er, the seventh-grade row describes coarser leaf and allows stems.",
  sourceIds: [STANDARD_SOURCE_ID],
});

/** Every pilot grade claim, with `gong-ting:definition` at revision `gongTingRev`. */
export function gradePilotClaims(gongTingRev: 1 | 2 = 2): DraftClaim[] {
  return [
    gongTingDefinition(gongTingRev),
    NEIGHBOURING_GRADES,
    BLENDING,
    JINGMAI_NOTES,
    NANNUO_NOTES,
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
  sourceIds: [STANDARD_SOURCE_ID],
  sections,
});

const section = (key: string, label: string, sourceIds: readonly string[]) => ({ key, label, sourceIds });

export const GRADE_PILOT_PAGES: readonly DraftReferencePage[] = [
  gradePage('gong-ting', 'Gong Ting', '宫廷', [
    section('definition', 'What the grade names', [STANDARD_SOURCE_ID]),
    section('neighbouring-grades', 'The rows beside it', [STANDARD_SOURCE_ID]),
    section('blending', 'Grades in a pressed tea', [STANDARD_SOURCE_ID]),
    section('jingmai-seller-notes', 'Seller observations', [JINGMAI_SOURCE_ID]),
    section('nannuo-seller-notes', 'Seller observations', [NANNUO_SOURCE_ID]),
  ]),
  gradePage('special-grade', 'Special grade', '特级', [section('definition', 'What the grade names', [STANDARD_SOURCE_ID])]),
  gradePage('seventh-grade', 'Seventh grade', '七级', [section('definition', 'What the grade names', [STANDARD_SOURCE_ID])]),
];

export const GRADE_PILOT_SOURCES: readonly PublicTeaReferenceSource[] = [
  {
    sourceId: STANDARD_SOURCE_ID,
    publisher: 'Menghai Tea Alliance',
    publisherRoleLabel: 'Standard',
    title: 'T/MHC 003–2020, §5.3.3.2.2 and Table 5',
    author: 'Menghai Tea Alliance',
    publishedDate: '2020',
    url: 'https://qxb-img-osscache.qixin.com/standards/068d108c0ac9b689744bffab516e8c6d.pdf',
  },
  {
    sourceId: JINGMAI_SOURCE_ID,
    publisher: 'Yunnan Sourcing',
    publisherRoleLabel: 'Seller, own batch',
    title: 'Jingmai Mountain Gong Ting grade loose leaf ripe pu-erh',
    author: 'Yunnan Sourcing',
    publishedDate: '',
    url: 'https://yunnansourcing.com/en-sg/collections/ripe-pu-erh/products/jingmai-mountain-gong-ting-grade-loose-leaf-ripe-pu-erh-tea',
  },
  {
    sourceId: NANNUO_SOURCE_ID,
    publisher: 'Yunnan Sourcing',
    publisherRoleLabel: 'Seller, own batch',
    title: '2006 Lao Man E brand Nannuo Gong Ting ripe pu-erh tea cake',
    author: 'Yunnan Sourcing',
    publishedDate: '',
    url: 'https://yunnansourcing.com/products/2006-lao-mane-brand-nannuo-gong-ting-ripe-pu-erh-tea-cake',
  },
];
