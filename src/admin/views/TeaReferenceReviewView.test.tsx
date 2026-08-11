import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { normalizeProduct } from '../../lib/storefrontApi';
import type { WebsiteReceivingPrivateReview } from '../../wisdom/receiving/previewImporter';
import {
  TeaReferenceReviewView,
  decideTeaReferenceReview,
} from './TeaReferenceReviewView';

const packet: WebsiteReceivingPrivateReview = {
  manifest: { schemaVersion: 1, mode: 'private-review' },
  summary: { entities: 1, facts: 1 },
  items: [{
    resourceType: 'fact',
    resourceId: 'CLAIM-YIWU',
    status: 'held',
    subject: 'Greater Yiwu',
    entityKind: 'tea_area',
    websiteHolding: 'regions',
    reviewReason: 'No verified parent geography.',
    field: 'commonCharacteristics',
    scope: 'common_characteristics',
    candidateValue: 'Often soft, fragrant, and sweet.',
    proposedPublicWording: 'One cited source describes broad characteristics associated with Greater Yiwu.',
    hierarchy: {
      level: 'tea_area',
      parent: { resourceId: 'RESOLUTION-YUNNAN', label: 'Yunnan', entityKind: 'major_region' },
      children: [{ resourceId: 'RESOLUTION-YIWU-VILLAGE', label: 'Yiwu village', entityKind: 'village' }],
    },
    evidence: [{
      evidenceId: 'EVIDENCE-YIWU',
      exact: 'The area is fragrant, soft, and carries a lasting sweet aftertaste.',
      heading: 'Greater Yiwu',
      section: 'Regional profile',
      page: null,
      prefix: 'Compared with nearby areas, ',
      suffix: ' Individual lots vary.',
      citation: {
        citationId: 'CITATION-YIWU',
        sourceId: 'source-yiwu',
        publisher: 'Example Specialist',
        publisherRole: 'specialist_editorial',
        title: 'A guide to Greater Yiwu',
        author: 'Researcher',
        publishedDate: '2024-04-10',
        url: 'https://example.test/yiwu',
      },
    }],
    productReview: {
      matchTerms: ['Greater Yiwu'],
      candidates: [{
        productId: 'tea-yiwu',
        label: 'Spring Yiwu',
        type: 'Sheng',
        year: 2024,
        originCountry: 'China',
        originRegion: 'Greater Yiwu',
        status: 'Active',
        matchBasis: ['originRegion'],
      }],
    },
  }, {
    resourceType: 'entity',
    resourceId: 'RESOLUTION-YIWU',
    status: 'held',
    subject: 'Greater Yiwu',
    entityKind: 'tea_area',
    websiteHolding: 'regions',
    reviewReason: 'Entity mapping needs private review.',
    candidateValue: {
      entityId: 'RESOLUTION-YIWU',
      canonicalEntityId: '',
      label: 'Greater Yiwu',
      entityKind: 'tea_area',
    },
    hierarchy: { level: 'tea_area', children: [] },
    evidence: [],
    productReview: { matchTerms: ['Greater Yiwu'], candidates: [] },
  }],
};

const currentProducts = [
  normalizeProduct({
    id: 'tea-yiwu', given_name: 'Spring Yiwu', product_name: 'Raw Pu’er cake', type: 'Sheng', year: 2024,
    origin_country: 'China', origin_region: 'Greater Yiwu', status: 'Active', stock_grams: 100,
    retail_price_per_gram_usd: 0.5,
  }),
  normalizeProduct({
    id: 'oolong-2023', given_name: 'House Oolong', product_name: 'Oolong', type: 'Oolong', year: 2023,
    origin_country: 'Taiwan', origin_region: 'Nantou', status: 'Active', stock_grams: 100,
    retail_price_per_gram_usd: 0.5,
  }),
  normalizeProduct({
    id: 'white-empty', given_name: 'Empty White', product_name: 'White', type: 'White', year: 2022,
    origin_country: 'China', origin_region: 'Fuding', status: 'Active', stock_grams: 0,
    retail_price_per_gram_usd: 0.5,
  }),
];

describe('TeaReferenceReviewView', () => {
  it('shows held state, exact evidence, proposed wording, hierarchy, and product review context', () => {
    const html = renderToStaticMarkup(<TeaReferenceReviewView initialPacket={packet} initialProducts={currentProducts} />);

    expect(html).toContain('Tea Reference review');
    expect(html).toContain('Held entities');
    expect(html).toContain('Held facts');
    expect(html).toContain('The area is fragrant, soft, and carries a lasting sweet aftertaste.');
    expect(html).toContain('One cited source describes broad characteristics associated with Greater Yiwu.');
    expect(html).toContain('Yunnan');
    expect(html).toContain('Yiwu village');
    expect(html).toContain('Spring Yiwu');
    expect(html).toContain('Matched by originRegion');
    expect(html).toContain('Inventory-backed reference gaps');
    expect(html).toContain('House Oolong');
    expect(html).not.toContain('Empty White');
    expect(html).toContain('Live preview context only');
    expect(html).not.toContain('RESOLUTION-YIWU');
    expect(html).not.toContain('canonicalEntityId');
    expect(html).toContain('Ready');
    expect(html).toContain('Needs edit');
    expect(html).toContain('Keep held');
    expect(html).toMatch(/not saved/i);
    expect(html).not.toMatch(/Save|Publish|Approve/);
  });

  it('keeps triage decisions in an immutable session-only map', () => {
    const original = { OTHER: 'keep-held' as const };
    const decided = decideTeaReferenceReview(original, 'CLAIM-YIWU', 'ready');
    const revised = decideTeaReferenceReview(decided, 'CLAIM-YIWU', 'needs-edit');

    expect(original).toEqual({ OTHER: 'keep-held' });
    expect(decided).toEqual({ OTHER: 'keep-held', 'CLAIM-YIWU': 'ready' });
    expect(revised).toEqual({ OTHER: 'keep-held', 'CLAIM-YIWU': 'needs-edit' });
  });

  it('adds a local-preview-only review surface inside Wisdom without adding a route', async () => {
    const wisdomModule = await import('./WisdomView');
    expect(wisdomModule.TeaReferenceWisdomSwitch).toBeTypeOf('function');

    const html = renderToStaticMarkup(
      <wisdomModule.TeaReferenceWisdomSwitch
        previewEnabled
        browse={<div>Existing Wisdom base</div>}
        review={<div>Private review packet</div>}
      />,
    );
    expect(html).toContain('Browse base');
    expect(html).toContain('Review incoming');
    expect(html).toContain('Existing Wisdom base');
    expect(html).not.toContain('Private review packet');

    const productionHtml = renderToStaticMarkup(
      <wisdomModule.TeaReferenceWisdomSwitch
        previewEnabled={false}
        browse={<div>Existing Wisdom base</div>}
        review={<div>Private review packet</div>}
      />,
    );
    expect(productionHtml).toBe('<div>Existing Wisdom base</div>');
  });
});
