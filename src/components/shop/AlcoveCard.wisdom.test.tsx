import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IsRestoringProvider, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StoryProvider } from '../../context/StoryContext';
import { PILOT_FIXTURE_CLAIMS } from '../../pages/preview/wisdomPilot/fixtureClaims';
import { PILOT_FIXTURES } from '../../pages/preview/wisdomPilot/fixtureProducts';
import type { InventoryItem } from '../../types';
import { listingFactsFromInventoryItem } from '../../wisdom/reference/listingFacts';
import { resolveListingPassages } from '../../wisdom/reference/listingPassages';
import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../wisdom/reference/generatedPages';
import { GENERATED_CLAIMS } from '../../wisdom/reference/generatedClaims';
import { teaFacts, teaRegionFields } from './productDetailFields';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import { ProductDetailPageContext } from './ProductDetailLayout';
import { ProductDetailContent } from './AlcoveCard';
import { WisdomListingProvider, useWisdomListing } from './alcove/AlcoveWisdomPassages';

function renderPage(
  item: InventoryItem,
  context?: ReturnType<typeof useWisdomListing>,
  withSelection = false,
  client = new QueryClient(),
) {
  const content = <ProductDetailPageContext.Provider value={{ shopHref: '/shop', cartItemCount: 0,
    selectedBy: withSelection ? [{ slug: 'selector', display_name: 'Shop selector', business_name: null, why: null }] : [] }}>
    <ProductDetailContent item={item} />
  </ProductDetailPageContext.Provider>;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/shop/product/naka-gushu?store=bali']}>
      <QueryClientProvider client={client}>
        <IsRestoringProvider value={true}>
          <StoryProvider>
            {context ? <WisdomListingProvider value={context}>{content}</WisdomListingProvider> : content}
          </StoryProvider>
        </IsRestoringProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const nakaWithoutApprovedEntry = { ...PILOT_FIXTURES.naka.item, id: 'naka-listing-without-approved-entry' };

describe('Wisdom in the shared product page', () => {
  it('uses only the public registry by default and keeps the empty-gallery action', () => {
    const markup = renderPage(nakaWithoutApprovedEntry);
    expect(markup).toContain('Add your own picture');
    const expected = resolveListingPassages(listingFactsFromInventoryItem(nakaWithoutApprovedEntry),
      GENERATED_CLAIMS, GENERATED_TEA_REFERENCE_REGISTRY.pages);
    const ids = [...markup.matchAll(/data-claim-id="([^"]+)"/g)].map(match => match[1]);
    expect(ids).toEqual([...expected.passages.map(passage => passage.claim.claimId),
      ...expected.styleReferences.map(claim => claim.claimId)]);
    expect(GENERATED_CLAIMS.every(claim => claim.reviewState === 'approved' && !claim.withdrawn)).toBe(true);
  });

  it('shows the approved Naka wording and keeps the link to Menghai', () => {
    const markup = renderPage(PILOT_FIXTURES.naka.item);
    expect(markup).toContain('data-composed-entry="' + PILOT_FIXTURES.naka.item.id + '"');
    expect(markup).toContain('one of Menghai County’s tea-growing areas. This tea is a ripe pu’er pressed into a cake.');
    expect(markup).toContain('href="/wisdom/region/menghai-county"');
    expect(markup).not.toMatch(/Huazhu Liangzi|Liusha River/);
  });

  it('keeps the 1993 vintage on the linked Y562 lot and withholds history until public visibility is known', () => {
    const item: InventoryItem = { ...PILOT_FIXTURES['type-only'].item, id: 'cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e',
      name: 'Y562', variant: 'Y562 (Jixing) Black Box', year: '1993', type: 'Shou', origin: 'Yunnan, China' };
    const markup = renderPage(item);
    expect(markup).toMatch(/>Vintage<[^]*?>1993</);
    expect(markup).toContain('data-claim-id="shou:wet-piling"');
    expect(markup).not.toContain('/wisdom/named/y562');
    const facts = listingFactsFromInventoryItem(item);
    const history = resolveListingPassages(facts, GENERATED_CLAIMS, GENERATED_TEA_REFERENCE_REGISTRY.pages).passages;
    expect(history.map(p => p.claim.sectionKey)).toEqual(['little-black-box', 'export-trade', 'designers', 'original-blend', 'definition', 'wet-piling']);
    expect(history.slice(0, -1).every(p => p.claim.text && !p.claim.text.includes('1993'))).toBe(true);

    const client = new QueryClient();
    client.setQueryData(['wisdom-public-state', 'named_tea', 'y562'], { is_public: true });
    const publicMarkup = renderPage(item, undefined, false, client);
    expect(publicMarkup).toContain('data-composed-entry="' + item.id + '"');
    expect(publicMarkup).toContain('after its export carton. A tiger coming down a hillside appears on the Jixing mark. This lot is dated 1993.');
    expect(publicMarkup).toContain('/wisdom/named/y562');
  });

  it.each(['Shou Puer', 'Shou'])('matches a process from the Stock type %s and a place from corroborated origin', type => {
    const markup = renderPage({ ...nakaWithoutApprovedEntry, type }, { claims: PILOT_FIXTURE_CLAIMS });
    expect(markup).toContain('data-claim-id="menghai-county:mengsong-naka"');
    expect(markup).toContain('data-claim-id="shou:wet-piling"');
    expect(markup).toContain('?store=bali#wisdom-passage-shou-wet-piling');
    expect(markup).not.toContain('data-claim-id="gong-ting:definition"');
    expect(markup).not.toContain('data-wisdom-style-references');
  });

  it('orders a sparse page from its recorded introduction to its sourced story without presenting legacy tags as taste', () => {
    const markup = renderPage({ ...nakaWithoutApprovedEntry, tags: ['Unsupported legacy taste'], form: 'Cake',
      description: 'A tea cake from Mengsong.', tasting: { flavor: ['unverified-descriptor'] } }, { claims: PILOT_FIXTURE_CLAIMS });
    const locators = ['data-testid="tea-facts"', 'A tea cake from Mengsong.', 'Your tea actions', 'data-page-order', 'data-wisdom-passages'];
    const positions = locators.map(text => markup.indexOf(text));
    expect(positions.every(position => position !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).not.toMatch(/Unsupported legacy taste|unverified-descriptor|aria-label="Taste"/i);
  });

  it('links the registered tea family independently of the verified region', () => {
    const item = PILOT_FIXTURES.naka.item;
    const catalogue: TeaReferenceCatalogue = {
      families: [{ id: 'puer', name: 'Pu’er', facts: [], productIds: [item.id] }],
      types: [{ id: 'shou', name: 'Ripe pu’er', familyId: 'puer', facts: [], productIds: [item.id] }],
      origins: [{ id: 'menghai-county', name: 'Menghai County', level: 'major_region', facts: [], productIds: [item.id] }],
      sources: [], pages: [],
    };
    const facts = teaFacts(item, catalogue, teaRegionFields(item), 'bali');
    expect(facts.find(fact => fact.label === 'Tea family')).toMatchObject({ value: 'Pu’er', to: '/wisdom/family/puer' });
    expect(facts.find(fact => fact.label === 'Region')?.to).toBe('/wisdom/region/menghai-county');
    const unknown = { ...item, type: 'Unknown', name: 'Pu’er' };
    expect(teaFacts(unknown, catalogue, teaRegionFields(unknown), null).find(fact => fact.label === 'Tea family')).toBeUndefined();
    expect(teaFacts(item, { ...catalogue, families: [] }, teaRegionFields(item), null).find(fact => fact.label === 'Tea family')).toBeUndefined();
  });

  it('keeps an explicitly graded external example free of shopping and account controls', () => {
    const fixture = PILOT_FIXTURES['gong-ting-external'];
    const markup = renderPage(fixture.item, {
      claims: PILOT_FIXTURE_CLAIMS, facts: fixture.facts, pilot: { externalReference: true },
    }, true);
    expect(markup).toContain('data-claim-id="gong-ting:definition"');
    expect(markup).not.toMatch(/data-page-order|Add your own picture|View order|Your tea actions/i);
    expect(markup.indexOf('product-selected-by')).toBeGreaterThan(markup.indexOf('Follow the thread'));
    expect(markup.indexOf('data-wisdom-style-references')).toBeGreaterThan(markup.indexOf('product-selected-by'));
  });
});
