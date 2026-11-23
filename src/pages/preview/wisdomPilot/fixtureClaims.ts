// Fixture claims for the Tea Wisdom listing pilot. Stand-in for
// GENERATED_DRAFT_CLAIMS until the integration thread generates it; every
// function that reads these also accepts the real generated arrays.
// Wording: "Tea Wisdom editorial pilot" review draft, 21 Nov 2026.
// Text carries no Han script; Chinese lives only in `terms`.
import type { ClaimRevision, PublicClaim } from '../../../wisdom/reference/claims';

const GONG_TING_REV_1: ClaimRevision = {
  rev: 1,
  origin: 'legacy_import',
  legacyRef: 'marks:gong-ting',
  scope: 'General grade designation (shou pu\'er and aged Taiwanese oolong)',
  text: 'A \'palace\' or \'imperial court\' designation for the highest grade classification within a tea\'s production, indicating the finest bud or tip material. Seen on shou pu-erh (finest bud material) and on aged Taiwanese oolong (finest buds and leaves).',
  approvedAt: '2026-11-24',
  reason: 'Imported from the legacy marks corpus',
  evidenceIds: [],
};

const GONG_TING_REV_2: ClaimRevision = {
  rev: 2,
  origin: 'approved',
  scope: 'Loose ripe pu\'er, Menghai Tea Alliance standard T/MHC 003–2020',
  text: 'Gong Ting is the name used for a fine, bud-rich grade of loose ripe pu\'er in the Menghai Tea Alliance standard.',
  approvedAt: '2026-11-25',
  reason: 'Scoped to the loose-tea table',
  evidenceIds: ['EVIDENCE-tmhc-003-2020-table-5-gong-ting'],
};

export const GONG_TING_REVISIONS: readonly ClaimRevision[] = [GONG_TING_REV_1, GONG_TING_REV_2];

/** Every pilot claim in its default preview state (Gong Ting at rev 2). */
export const PILOT_FIXTURE_CLAIMS: readonly PublicClaim[] = [
  {
    claimId: 'gong-ting:definition',
    pageId: 'gong-ting',
    sectionKey: 'definition',
    label: 'Gong Ting leaf',
    axis: 'grade',
    listingEligible: true,
    appliesWhen: { grade: 'gong-ting' },
    terms: [{ original: '宫廷', pinyin: 'gōngtíng', gloss: 'palace; used here as a grade name' }],
    rev: 2,
    scope: GONG_TING_REV_2.scope,
    text: GONG_TING_REV_2.text,
    sourceIds: ['tmhc-003-2020'],
    reviewState: 'approved',
    previousRevisions: GONG_TING_REVISIONS,
  },
  {
    claimId: 'menghai-county:mengsong-naka',
    pageId: 'menghai-county',
    sectionKey: 'mengsong-naka',
    label: 'Origin · Mengsong, Menghai',
    axis: 'place',
    listingEligible: true,
    appliesWhen: { origin_includes: ['mengsong'], name_includes: ['naka'] },
    terms: [
      { original: '勐宋', pinyin: 'Měngsòng', gloss: 'Mengsong, a tea area of Menghai County' },
      { original: '那卡', pinyin: 'Nàkǎ', gloss: 'Naka, a village in Mengsong' },
    ],
    rev: 1,
    scope: 'Naka village in Mengsong, Menghai County (TeaDB)',
    text: 'TeaDB places Naka in Mengsong, one of Menghai County\'s tea-growing areas.',
    sourceIds: ['teadb-menghai-county'],
    reviewState: 'approved',
  },
  {
    claimId: 'menghai-county:dayi-1973-1975',
    pageId: 'menghai-county',
    sectionKey: 'dayi-1973-1975',
    label: 'Menghai Tea Factory and wet piling',
    axis: 'maker_history',
    // A ledger entry can never make this listing-eligible; the resolver refuses the axis anyway.
    listingEligible: true,
    appliesWhen: { origin_includes: ['menghai'] },
    terms: [],
    rev: 1,
    scope: 'Dayi\'s own chronology, 1973 and 1975 entries',
    text: 'Dayi\'s own chronology dates the development of artificial wet piling at Menghai Tea Factory to 1973 and lists its 7572 ripe cake in 1975.',
    sourceIds: ['dayi-chronology'],
    reviewState: 'approved',
  },
  {
    claimId: 'shou:wet-piling',
    pageId: 'shou',
    sectionKey: 'wet-piling',
    label: 'About ripe pu\'er',
    axis: 'process',
    listingEligible: true,
    appliesWhen: { type: 'Shou' },
    terms: [
      { original: '熟普洱', pinyin: 'shú pǔ\'ěr', gloss: 'ripe pu\'er' },
      { original: '渥堆', pinyin: 'wò duī', gloss: 'wet piling' },
    ],
    rev: 1,
    scope: 'Ripe pu\'er as a tea type',
    text: 'Ripe pu\'er is made by fermenting tea leaf in a damp pile, a process called wet piling.',
    sourceIds: ['white2tea-ripe-process', 'mdpi-ripe-fermentation-aroma'],
    reviewState: 'approved',
  },
  {
    claimId: 'gong-ting:seller-jingmai-loose',
    pageId: 'gong-ting',
    sectionKey: 'seller-jingmai-loose',
    label: 'Seller observation · Jingmai loose Gong Ting',
    axis: 'sensory_observation',
    listingEligible: false,
    appliesWhen: { grade: 'gong-ting' },
    attribution: {
      sourceId: 'yunnan-sourcing-jingmai-gong-ting',
      sourceRole: 'seller_own_batch',
      sample: 'Jingmai Mountain Gong Ting loose ripe, Yunnan Sourcing listing',
    },
    terms: [],
    rev: 1,
    scope: 'One seller batch: Yunnan Sourcing, Jingmai loose Gong Ting',
    text: 'Yunnan Sourcing describes fruity creaminess in its Jingmai loose Gong Ting.',
    sourceIds: ['yunnan-sourcing-jingmai-gong-ting'],
    reviewState: 'approved',
  },
  {
    claimId: 'gong-ting:seller-nannuo-2006-cake',
    pageId: 'gong-ting',
    sectionKey: 'seller-nannuo-2006-cake',
    label: 'Seller observation · 2006 Nannuo Gong Ting cake',
    axis: 'sensory_observation',
    listingEligible: false,
    appliesWhen: { grade: 'gong-ting' },
    attribution: {
      sourceId: 'yunnan-sourcing-2006-nannuo-gong-ting',
      sourceRole: 'seller_own_batch',
      sample: '2006 Lao Man E brand Nannuo Gong Ting ripe cake, Yunnan Sourcing listing',
    },
    terms: [],
    rev: 1,
    scope: 'One seller batch: Yunnan Sourcing, aged 2006 Nannuo Gong Ting cake',
    text: 'Yunnan Sourcing describes fruit with light hardwood in an aged 2006 Nannuo Gong Ting cake.',
    sourceIds: ['yunnan-sourcing-2006-nannuo-gong-ting'],
    reviewState: 'approved',
  },
  {
    claimId: 'shou:study-yang-2025',
    pageId: 'shou',
    sectionKey: 'study-yang-2025',
    label: 'Study observation · twelve ripe pu\'ers, four areas',
    axis: 'sensory_observation',
    listingEligible: false,
    // Deliberately matches no listing. { type: 'Shou' } would also reach Naka,
    // whose listing must carry no sensory copy; see the pilot notes.
    appliesWhen: {},
    attribution: {
      sourceId: 'yang-2025-spgykj',
      sourceRole: 'study',
      sample: 'Twelve ripe pu\'ers from four producing areas at three storage durations (Yang et al., 2025)',
    },
    terms: [],
    rev: 1,
    scope: 'One study sample group: Yang et al., 2025',
    text: 'In a comparison of twelve ripe pu\'ers, Yang Hongyan and colleagues found that floral and fruity aromas changed in different directions across the four producing areas they sampled.',
    sourceIds: ['yang-2025-spgykj'],
    reviewState: 'approved',
  },
];
