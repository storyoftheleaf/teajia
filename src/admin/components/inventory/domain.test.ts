import { describe, expect, it } from 'vitest';

import type { Product } from '../../types';
import {
  MOVEMENT_REASON_LABELS,
  adaptInventorySummaryRows,
  deriveInventoryFacets,
  deriveInventoryStage,
  buildPersonalJournalHref,
  inventorySummaryStatusMessage,
  shouldApplyInventoryFacetFilter,
  effectivePurpose,
  getEffectivePublication,
  getPersonalTastingAction,
  inventoryMatchesFacetFilter,
  isInventoryPublicationGateChangeAllowed,
  isInventorySelectionPublishable,
  getTeaReadiness,
  groupInventoryByLifecycle,
  isMovementDirectionValid,
  legacyPurposeConflict,
} from './domain';
import { readInventoryFold, withInventoryFold, withParam } from './helpers';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'tea-1',
  type: 'Red',
  givenName: 'Ruby 18',
  productName: 'Ruby 18',
  originCountry: 'Taiwan',
  originRegion: 'Sun Moon Lake',
  pricePerGramUSD: 0.42,
  costPerGramUSD: 0.12,
  costAmount: 120,
  stockGrams: 0,
  lowStockThreshold: 50,
  description: 'A structured Taiwanese red tea.',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  costCurrency: 'USD',
  quantityPurchased: 1000,
  isPersonal: false,
  canReorder: true,
  isPublic: false,
  shownInShop: false,
  inventoryPurpose: 'working',
  stockKnownAt: '2026-07-12T00:00:00.000Z',
  ...overrides,
});

describe('effectivePurpose', () => {
  it('prefers a canonical purpose over contradictory legacy flags', () => {
    expect(effectivePurpose(product({ inventoryPurpose: 'personal', isSample: true }))).toBe('personal');
  });

  it('maps legacy sample and personal flags while defaulting ordinary stock to working', () => {
    expect(effectivePurpose(product({ inventoryPurpose: null, isSample: true }))).toBe('sample');
    expect(effectivePurpose(product({ inventoryPurpose: null, isPersonal: true }))).toBe('personal');
    expect(effectivePurpose(product({ inventoryPurpose: null }))).toBe('working');
  });

  it('uses sample as the deterministic legacy fallback when both old flags conflict', () => {
    expect(effectivePurpose(product({ inventoryPurpose: null, isSample: true, isPersonal: true }))).toBe('sample');
    expect(legacyPurposeConflict(product({ inventoryPurpose: null, isSample: true, isPersonal: true }))).toBe(true);
  });

  it('reports canonical-to-legacy disagreement during migration', () => {
    expect(legacyPurposeConflict(product({ inventoryPurpose: 'working', isSample: true }))).toBe(true);
    expect(legacyPurposeConflict(product({ inventoryPurpose: 'sample', isSample: true }))).toBe(false);
  });
});

describe('getTeaReadiness', () => {
  it('is not applicable to teaware or non-working holdings', () => {
    expect(getTeaReadiness(product({ type: 'Teaware' }))).toEqual({ state: 'not_applicable', missing: [] });
    expect(getTeaReadiness(product({ inventoryPurpose: 'sample' }))).toEqual({ state: 'not_applicable', missing: [] });
    expect(getTeaReadiness(product({ inventoryPurpose: 'personal' }))).toEqual({ state: 'not_applicable', missing: [] });
  });

  it('names every exact missing development requirement in display order', () => {
    expect(getTeaReadiness(product({
      description: '  ',
      fixedRetailPriceUSD: 0,
      pricePerGramUSD: 0,
      type: 'Misc',
      stockKnownAt: null,
    }))).toEqual({
      state: 'not_ready',
      missing: ['description', 'retail_price', 'classification', 'stock_amount'],
    });
  });

  it('accepts a positive fixed or calculated effective retail price', () => {
    expect(getTeaReadiness(product({ fixedRetailPriceUSD: 0.5, pricePerGramUSD: 0 }))).toEqual({ state: 'ready', missing: [] });
    expect(getTeaReadiness(product({ fixedRetailPriceUSD: null, pricePerGramUSD: 0.5 }))).toEqual({ state: 'ready', missing: [] });
  });

  it('treats known zero stock as ready and unknown positive stock as incomplete', () => {
    expect(getTeaReadiness(product({ stockGrams: 0 }))).toEqual({ state: 'ready', missing: [] });
    expect(getTeaReadiness(product({ stockGrams: 50, stockKnownAt: null }))).toEqual({
      state: 'not_ready',
      missing: ['stock_amount'],
    });
  });

  it('rejects non-finite stock even when the quantity has a known-at timestamp', () => {
    expect(getTeaReadiness(product({ stockGrams: Number.NaN })).missing).toContain('stock_amount');
    expect(getTeaReadiness(product({ stockGrams: Number.POSITIVE_INFINITY })).missing).toContain('stock_amount');
  });
});

describe('publication', () => {
  it('blocks publishing a selection that contains an incoming-only first arrival', () => {
    const incoming = product({ id: 'incoming', stockGrams: 0, isPublic: false, shownInShop: false });
    const ready = product({ id: 'ready', stockGrams: 100, isPublic: false, shownInShop: false });

    expect(isInventorySelectionPublishable([incoming, ready], {
      incoming: { hasOpenIncoming: true, remainingQuantity: 500 },
      ready: { hasOpenIncoming: false, remainingQuantity: 0 },
    }, 'ready')).toBe(false);
    expect(isInventorySelectionPublishable([ready], {
      ready: { hasOpenIncoming: false, remainingQuantity: 0 },
    }, 'ready')).toBe(true);
  });

  it.each(['loading', 'stale', 'error'] as const)(
    'fails closed while inventory summary status is %s',
    summaryStatus => {
      const ready = product({ id: 'ready', stockGrams: 100, isPublic: false, shownInShop: false });

      expect(isInventorySelectionPublishable([ready], {
        ready: { hasOpenIncoming: false, remainingQuantity: 0 },
      }, summaryStatus)).toBe(false);
    },
  );

  it('does not publish an empty selection even with a ready summary', () => {
    expect(isInventorySelectionPublishable([], {}, 'ready')).toBe(false);
  });

  it('blocks either publication gate from turning on for an incoming product, even if the other gate is already on', () => {
    const incoming = product({ id: 'incoming', stockGrams: 0, isPublic: true, shownInShop: false });
    const summaries = { incoming: { hasOpenIncoming: true, remainingQuantity: 500 } };

    expect(isInventoryPublicationGateChangeAllowed(
      incoming,
      'shownInShop',
      true,
      summaries,
      'ready',
    )).toBe(false);
    expect(isInventoryPublicationGateChangeAllowed(
      { ...incoming, shownInShop: true },
      'isPublic',
      false,
      summaries,
      'ready',
    )).toBe(true);
  });

  it('requires both existing publication gates', () => {
    expect(getEffectivePublication(product({ isPublic: true, shownInShop: true }))).toEqual({
      state: 'published', operatorGate: true, locationGate: true,
    });
    expect(getEffectivePublication(product({ isPublic: true, shownInShop: false }))).toEqual({
      state: 'hidden', operatorGate: true, locationGate: false,
    });
  });

  it('allows a ready working tea to remain deliberately hidden', () => {
    const hiddenReady = product({ isPublic: false, shownInShop: true });
    expect(getTeaReadiness(hiddenReady).state).toBe('ready');
    expect(getEffectivePublication(hiddenReady).state).toBe('hidden');
  });
});

describe('inventory lifecycle', () => {
  it('round-trips folded lifecycle sections through the inventory address', () => {
    const address = new URLSearchParams('vendor=Mountain+Source&panel=tea-1');
    const folded = withInventoryFold(address, new Set(['incoming', 'published']));

    expect(folded.get('fold')).toBe('incoming,published');
    expect([...readInventoryFold(folded)]).toEqual(['incoming', 'published']);
    expect(folded.get('vendor')).toBe('Mountain Source');
    expect(folded.get('panel')).toBe('tea-1');
    expect(address.has('fold')).toBe(false);
  });

  it('removes the folded-section address when every lifecycle section is open', () => {
    const address = new URLSearchParams('fold=published&batch=batch-1');
    const unfolded = withInventoryFold(address, new Set());

    expect(unfolded.has('fold')).toBe(false);
    expect(unfolded.get('batch')).toBe('batch-1');
  });

  it('uses the exact archived, published, incoming, ready, preparation precedence', () => {
    const incoming = { hasOpenIncoming: true, remainingQuantity: 200 };

    expect(deriveInventoryStage(product({ status: 'Archived', isPublic: true, shownInShop: true }), incoming)).toBe('archived');
    expect(deriveInventoryStage(product({ status: 'Sold Out', isPublic: true, shownInShop: true }), incoming)).toBe('archived');
    expect(deriveInventoryStage(product({ stockGrams: 0, isPublic: true, shownInShop: true }), incoming)).toBe('published');
    expect(deriveInventoryStage(product({ stockGrams: 0 }), incoming)).toBe('incoming');
    expect(deriveInventoryStage(product({ stockGrams: 200 }), incoming)).toBe('ready_private');
    expect(deriveInventoryStage(product({ stockGrams: 200, description: '' }), incoming)).toBe('needs_preparation');
  });

  it('keeps replenishment in its operational stage instead of moving it to incoming', () => {
    const incoming = { hasOpenIncoming: true, remainingQuantity: 200 };
    expect(deriveInventoryStage(product({ stockGrams: 50, isPublic: true, shownInShop: true }), incoming)).toBe('published');
    expect(deriveInventoryStage(product({ stockGrams: 50 }), incoming)).toBe('ready_private');
  });

  it('normalizes legacy in-transit fields when no batched summary is available', () => {
    expect(deriveInventoryStage(product({ stockGrams: 0, inTransit: true, inTransitGrams: 100 }))).toBe('incoming');
    expect(deriveInventoryStage(product({ stockGrams: 100, inTransit: true, inTransitGrams: 100 }))).toBe('ready_private');
  });

  it('keeps operational non-working holdings in ready private', () => {
    expect(deriveInventoryStage(product({ inventoryPurpose: 'personal', stockGrams: 20 }))).toBe('ready_private');
    expect(deriveInventoryStage(product({ inventoryPurpose: 'sample', stockGrams: 20 }))).toBe('ready_private');
    expect(deriveInventoryStage(product({ type: 'Teaware', quantityUnits: 2 }))).toBe('ready_private');
  });

  it('derives independent personal, product-profile, writing, and incoming facets', () => {
    const facets = deriveInventoryFacets(
      product({ stockGrams: 90, lowStockThreshold: 100, tastingSource: 'owner', tasting: { flavor: ['floral'] }, inTransit: true, inTransitGrams: 50 }),
      { count: 2, latestEntryId: 'journal-2' },
      { description: true, draftArticleCount: 1, publishedArticleCount: 1 },
    );

    expect(facets).toMatchObject({
      personallyTasted: true,
      personalTastingCount: 2,
      personalTastingEntryId: 'journal-2',
      productTastingProfilePresent: true,
      writingState: 'published_article',
      incomingReplenishment: true,
      lowStock: true,
      soldOut: false,
    });
  });

  it('does not mistake an owner product profile for a personal tasting', () => {
    const facets = deriveInventoryFacets(
      product({ tastingSource: 'owner', tasting: { flavor: ['floral'] } }),
      { count: 0 },
      { description: true, draftArticleCount: 0, publishedArticleCount: 0 },
    );
    expect(facets.personallyTasted).toBe(false);
    expect(facets.productTastingProfilePresent).toBe(true);
    expect(facets.writingState).toBe('description');
  });

  it('does not count common or community tasting data as the owner product profile', () => {
    const writing = { description: true, draftArticleCount: 0, publishedArticleCount: 0 };
    expect(deriveInventoryFacets(
      product({ tastingSource: 'common', tasting: { flavor: ['floral'] } }),
      { count: 0 },
      writing,
    ).productTastingProfilePresent).toBe(false);
    expect(deriveInventoryFacets(
      product({ tastingSource: 'community', tasting: { flavor: ['floral'] } }),
      { count: 0 },
      writing,
    ).productTastingProfilePresent).toBe(false);
  });

  it('labels the personal tasting doorway from journal state only', () => {
    expect(getPersonalTastingAction({ count: 0 })).toBe('Record tasting');
    expect(getPersonalTastingAction({ count: 1, latestEntryId: 'journal-1' })).toBe('Continue tasting');
    expect(getPersonalTastingAction({ count: 4, latestEntryId: 'journal-1' })).toBe('Continue tasting');
  });

  it('builds an exact personal journal address when the latest entry is known', () => {
    expect(buildPersonalJournalHref('tea one', { count: 2, latestEntryId: 'journal/2' }))
      .toBe('/account/journal?tea=tea%20one&entry=journal%2F2');
    expect(buildPersonalJournalHref('tea one', { count: 0 })).toBe('/account/journal?tea=tea%20one');
  });

  it('explains loading, stale, and failed inventory summaries truthfully', () => {
    expect(inventorySummaryStatusMessage('loading')).toContain('Refreshing');
    expect(inventorySummaryStatusMessage('stale')).toContain('last available');
    expect(inventorySummaryStatusMessage('error')).toContain('unavailable');
  });

  it('does not turn unavailable summary data into an empty filtered view', () => {
    expect(shouldApplyInventoryFacetFilter('Tasted', 'loading')).toBe(false);
    expect(shouldApplyInventoryFacetFilter('Tasted', 'error')).toBe(false);
    expect(shouldApplyInventoryFacetFilter('HasWriting', 'stale')).toBe(true);
    expect(shouldApplyInventoryFacetFilter('Tasted', 'ready')).toBe(true);
  });

  it('filters personal tasting, product profile, and writing as separate facets', () => {
    const personallyTasted = { count: 2, latestEntryId: 'journal-1' };
    const untasted = { count: 0 };
    const publishedWriting = { description: true, draftArticleCount: 0, publishedArticleCount: 1 };
    const noWriting = { description: false, draftArticleCount: 0, publishedArticleCount: 0 };
    const withProfile = product({ tastingSource: 'owner', tasting: { flavor: ['floral'] } });

    expect(inventoryMatchesFacetFilter(withProfile, 'Tasted', personallyTasted, publishedWriting)).toBe(true);
    expect(inventoryMatchesFacetFilter(withProfile, 'Untasted', untasted, publishedWriting)).toBe(true);
    expect(inventoryMatchesFacetFilter(withProfile, 'HasWriting', untasted, publishedWriting)).toBe(true);
    expect(inventoryMatchesFacetFilter(withProfile, 'NeedsWriting', untasted, noWriting)).toBe(true);
    expect(inventoryMatchesFacetFilter(withProfile, 'HasProductTasting', untasted, noWriting)).toBe(true);
    expect(inventoryMatchesFacetFilter(withProfile, 'NeedsProductTasting', untasted, noWriting)).toBe(false);
  });

  it('groups each row exactly once in display order and retains empty sections', () => {
    const grouped = groupInventoryByLifecycle([
      product({ id: 'ready', stockGrams: 10 }),
      product({ id: 'published', stockGrams: 10, isPublic: true, shownInShop: true }),
      product({ id: 'incoming', stockGrams: 0, inTransit: true, inTransitGrams: 20 }),
      product({ id: 'archived', status: 'Archived' }),
    ]);

    expect(grouped.map(group => group.stage)).toEqual([
      'published', 'ready_private', 'incoming', 'needs_preparation', 'archived',
    ]);
    expect(grouped.map(group => group.items.map(item => item.id))).toEqual([
      ['published'], ['ready'], ['incoming'], [], ['archived'],
    ]);
  });

  it('adapts the batched summary response into the lifecycle seams', () => {
    const adapted = adaptInventorySummaryRows([
      {
        product_id: 'tea-1',
        incoming_quantity: 120,
        has_open_incoming: true,
        writing_count: 2,
        published_writing_count: 1,
        has_writing: true,
        personal_tasting_count: 3,
        personally_tasted: true,
        latest_tasting_entry_id: 'journal-3',
      },
    ], [product({ id: 'tea-1', description: '' })]);

    expect(adapted.incomingByProductId['tea-1']).toEqual({ hasOpenIncoming: true, remainingQuantity: 120 });
    expect(adapted.personalTastingByProductId['tea-1']).toEqual({ count: 3, latestEntryId: 'journal-3' });
    expect(adapted.writingByProductId['tea-1']).toEqual({
      description: false,
      draftArticleCount: 1,
      publishedArticleCount: 1,
    });
  });
});

describe('movement reasons', () => {
  it('provides concise labels for every supported physical movement', () => {
    expect(MOVEMENT_REASON_LABELS).toEqual({
      receipt: 'Receipt', sale: 'Sale', sample_use: 'Sample use', gift: 'Gift',
      waste: 'Waste', transfer: 'Transfer', recount: 'Recount / correction', return: 'Return',
    });
  });

  it('validates the balance direction implied by each reason', () => {
    expect(isMovementDirectionValid('receipt', 'increase')).toBe(true);
    expect(isMovementDirectionValid('return', 'increase')).toBe(true);
    expect(isMovementDirectionValid('sale', 'decrease')).toBe(true);
    expect(isMovementDirectionValid('sample_use', 'increase')).toBe(false);
    expect(isMovementDirectionValid('recount', 'set')).toBe(true);
    expect(isMovementDirectionValid('transfer', 'increase')).toBe(true);
    expect(isMovementDirectionValid('transfer', 'decrease')).toBe(true);
    expect(isMovementDirectionValid('receipt', 'decrease')).toBe(false);
  });
});

// The inventory address is not one filter. It carries the vendor, the intake
// batch, a wisdom entry, the open product panel, the incoming view and the
// receipt being read, and any of them can be true at once.
describe('one key of the address', () => {
  const address = (query: string) => new URLSearchParams(query);
  const read = (params: URLSearchParams) => Object.fromEntries(params.entries());

  it('sets one filter without touching the rest of the screen', () => {
    // The vendor menu used to write a brand new address holding one key, so
    // choosing a source closed the open panel, dropped the receipt behind it,
    // and silently cleared the wisdom entry the operator had crossed from.
    const before = address('panel=tea-1&receipt=r-9&wisdom=cultivars%3Arou-gui&vendor=Old');
    expect(read(withParam(before, 'vendor', 'Yunnan Sourcing'))).toEqual({
      panel: 'tea-1',
      receipt: 'r-9',
      wisdom: 'cultivars:rou-gui',
      vendor: 'Yunnan Sourcing',
    });
  });

  it('clears one filter without touching the rest of the screen', () => {
    const before = address('panel=tea-1&vendor=Old&batch=b-2');
    expect(read(withParam(before, 'vendor', null))).toEqual({ panel: 'tea-1', batch: 'b-2' });
  });

  it('never edits the address it was handed', () => {
    const before = address('vendor=Old');
    withParam(before, 'vendor', 'New');
    withParam(before, 'vendor', null);
    expect(before.get('vendor')).toBe('Old');
  });
});
