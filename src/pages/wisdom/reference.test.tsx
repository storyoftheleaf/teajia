/**
 * Guards the shape of the public reference, not its prose.
 *
 * Every assertion here stands for a specific way the pages have already gone
 * wrong once: a second back link, a footnote repeated on 300 entries, a group
 * head that was a sentence, a filtered list that vanished without saying why.
 *
 * Run with: npx vitest run src/pages/wisdom/reference.test.tsx
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CultivarIndexPage from './CultivarIndexPage';
import CultivarPage from './CultivarPage';
import MarkIndexPage from './MarkIndexPage';
import MarkPage from './MarkPage';
import NamedTeaIndexPage, { traditionLabel } from './NamedTeaIndexPage';
import NamedTeaPage from './NamedTeaPage';
import StylePage from './StylePage';
import ProducerIndexPage from './ProducerIndexPage';
import ProducerPage from './ProducerPage';
import RegionIndexPage from './RegionIndexPage';
import RegionPage from './RegionPage';
import StyleIndexPage from './StyleIndexPage';
import WisdomHomePage, { TOTAL_ENTRIES, readableDate } from './WisdomHomePage';
import PreviewWisdomHomePage, {
  previewWisdomHomeHoldings,
  searchPreviewWisdomHome,
} from './PreviewWisdomHomePage';
import TeaFamilyPage from './TeaFamilyPage';
import TeaTypeIndexPage from './TeaTypeIndexPage';
import TeaTypePage from './TeaTypePage';
import {
  PAGE,
  WISDOM_SECTIONS,
  isMicroCapsLabel,
  searchHoldings,
  sectionForPath,
  wisdomSections,
} from './wisdomShared';
import { DATASET_BUILT, DATASET_PAGES, DATASET_RECORDS, DATASET_VERSION } from './datasetStamp';
import { tidyName } from './LineageTree';
import { AUTHORSHIP } from '../../wisdom/authorship';
import { NAMING_TRADITIONS, REGIONS } from '../../wisdom';
import type { PublicResearchBundle } from '../../wisdom/research';
import type { WisdomEntryKind } from '../../wisdom/types';
import { EntryResearchSection } from './EntryResearchSection';
import { useAppStore } from '../../lib/store';

const setVerificationAccess = (platformRole: 'platform_owner' | 'platform_admin' | null, activeAccountId: string | null) => {
  useAppStore.setState({ platformRole, activeAccountId });
  Object.assign(useAppStore.getInitialState(), { platformRole, activeAccountId });
};
import type { PublicProduct } from '../../types';
import type { WebsiteReceivingPublicTransport } from '../../wisdom/receiving/previewImporter';
import {
  TEA_REFERENCE_PREVIEW_QUERY_KEY,
} from '../../wisdom/reference/client';
import {
  TEA_REFERENCE_PREVIEW_ENABLED,
  teaReferenceRoutePaths,
} from '../../wisdom/reference/previewMode';
import { buildTeaReferenceCatalogue } from '../../wisdom/reference/catalogue';
import { PREVIEW_PLACE_LEVELS } from './previewOriginMetadata';

const render = (path: string) => {
  const client = createReferenceQueryClient();
  return renderToString(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/wisdom"
              element={TEA_REFERENCE_PREVIEW_ENABLED ? <PreviewWisdomHomePage /> : <WisdomHomePage />}
            />
            <Route path="/wisdom/cultivars" element={<CultivarIndexPage />} />
            <Route path="/wisdom/regions" element={<RegionIndexPage />} />
            <Route path="/wisdom/region/:id" element={<RegionPage />} />
            <Route path="/wisdom/cultivar/:id" element={<CultivarPage />} />
            <Route path="/wisdom/producers" element={<ProducerIndexPage />} />
            <Route path="/wisdom/marks" element={<MarkIndexPage />} />
            <Route path="/wisdom/mark/:id" element={<MarkPage />} />
            <Route path="/wisdom/producer/:id" element={<ProducerPage />} />
            <Route path="/wisdom/styles" element={<StyleIndexPage />} />
            <Route path="/wisdom/named" element={<NamedTeaIndexPage />} />
            <Route path="/wisdom/named/:id" element={<NamedTeaPage />} />
            <Route path="/wisdom/style/:id" element={<StylePage />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

const previewTransport: WebsiteReceivingPublicTransport = {
  manifest: { schemaVersion: 1, mode: 'preview-only' },
  publicPreview: {
    title: 'Pu’er reference',
    deck: 'Cited public tea knowledge.',
    sourceCount: 3,
    entryCount: 10,
    sections: [{
      id: 'types',
      label: 'Tea types',
      description: 'Public tea identities.',
      entries: [
        {
          id: 'reference-puer',
          label: 'Pu’er',
          entityKind: 'tea_family',
          kindLabel: 'Tea family',
          reportUrl: 'mailto:hello@teajia.com?subject=Pu%E2%80%99er',
          statements: [{
            id: 'puer-reference',
            label: 'Identity',
            text: 'Pu’er is a broad tea family with both naturally aged and deliberately fermented forms.',
            excerpt: 'A concise public source excerpt about the family.',
            citation: { label: 'Tea Institute, Pu’er reference (2026)', url: 'https://example.com/puer' },
          }],
        },
        {
          id: 'reference-sheng',
          label: 'Sheng',
          entityKind: 'tea_style',
          kindLabel: 'Tea type',
          reportUrl: 'mailto:hello@teajia.com?subject=Sheng',
          statements: [
            {
              id: 'sheng-common',
              label: 'Common characteristics',
              text: 'One cited source describes broad characteristics associated with Sheng.',
              excerpt: 'A concise public source excerpt about common characteristics.',
              citation: { label: 'Tea Institute, Sheng reference (2026)', url: 'https://example.com/sheng' },
            },
            {
              id: 'sheng-potential',
              label: 'Potential characteristics',
              text: 'Cultivar expression still depends on growing and making conditions.',
              citation: { label: 'Tea Institute, Cultivar guide (2025)', url: 'https://example.com/cultivar' },
            },
          ],
        },
        {
          id: 'reference-shou',
          label: 'Shou',
          entityKind: 'tea_style',
          kindLabel: 'Tea type',
          reportUrl: 'mailto:hello@teajia.com?subject=Shou',
          statements: [],
        },
      ],
    }, {
      id: 'origins',
      label: 'Tea origins',
      description: 'Publicly cited tea places at their declared geographic levels.',
      entries: [
        {
          id: 'reference-yunnan',
          label: 'Yunnan',
          entityKind: 'major_region',
          kindLabel: 'Major region',
          reportUrl: 'mailto:hello@teajia.com?subject=Yunnan',
          statements: [],
        },
        {
          id: 'reference-yiwu',
          label: 'Yiwu Tea Area',
          entityKind: 'tea_area',
          kindLabel: 'Tea area',
          parentId: 'reference-yunnan',
          reportUrl: 'mailto:hello@teajia.com?subject=Yiwu',
          statements: [],
        },
        {
          id: 'reference-gedeng',
          label: 'Gedeng Mountain',
          entityKind: 'mountain',
          kindLabel: 'Mountain',
          parentId: 'reference-yiwu',
          reportUrl: 'mailto:hello@teajia.com?subject=Gedeng',
          statements: [],
        },
        {
          id: 'reference-mansa',
          label: 'Mansa Village',
          entityKind: 'village',
          kindLabel: 'Village',
          parentId: 'reference-gedeng',
          reportUrl: 'mailto:hello@teajia.com?subject=Mansa',
          statements: [],
        },
        {
          id: 'reference-manxiu',
          label: 'Manxiu',
          entityKind: 'locality',
          kindLabel: 'Locality',
          parentId: 'reference-mansa',
          reportUrl: 'mailto:hello@teajia.com?subject=Manxiu',
          statements: [{
            id: 'manxiu-origin-reference',
            label: 'Identity',
            text: 'Manxiu is cited here at the locality level within the verified public origin chain.',
            excerpt: 'A concise public source excerpt about Manxiu.',
            citation: { label: 'Tea Geography Institute, Manxiu reference (2026)', url: 'https://example.com/manxiu' },
          }],
        },
        {
          id: 'reference-orphan-village',
          label: 'Orphan Village',
          entityKind: 'village',
          kindLabel: 'Village',
          parentId: 'reference-missing-parent',
          reportUrl: 'mailto:hello@teajia.com?subject=Orphan',
          statements: [],
        },
        {
          id: 'reference-inverted-area',
          label: 'Inverted Area',
          entityKind: 'tea_area',
          kindLabel: 'Tea area',
          parentId: 'reference-manxiu',
          reportUrl: 'mailto:hello@teajia.com?subject=Inverted',
          statements: [],
        },
      ],
    }],
    geographicScale: [],
    sources: [
      {
        sourceId: 'tea-institute',
        publisher: 'Tea Institute',
        publisherRoleLabel: 'Institute',
        title: 'Pu’er reference',
        author: 'Research Desk',
        publishedDate: '2026-01-01',
        url: 'https://example.com/puer',
      },
      {
        sourceId: 'sheng-field-guide',
        publisher: 'Tea Institute',
        publisherRoleLabel: 'Retailer or reseller',
        title: 'Sheng Field Guide',
        author: 'Mei Lin',
        publishedDate: '2026-02-03',
        url: 'https://example.com/sheng/',
      },
      {
        sourceId: 'tea-geography-institute',
        publisher: 'Tea Geography Institute',
        publisherRoleLabel: 'Institute',
        title: 'Manxiu reference',
        author: 'Field Research Desk',
        publishedDate: '2026-03-04',
        url: 'https://example.com/manxiu',
      },
    ],
    reportUrl: 'mailto:hello@teajia.com?subject=Tea%20Reference',
  },
};

const previewProducts: PublicProduct[] = [{
  id: 'sheng-spring-cake',
  type: 'Sheng',
  givenName: 'Spring Cake',
  productName: 'Yiwu old-tree tea',
  originCountry: 'China',
  originRegion: 'Yiwu',
  pricePerGramUSD: 0.5,
  stockGrams: 100,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}, {
  id: 'sheng-sold-out-cake',
  type: 'Sheng',
  givenName: 'Aged Sheng Cake',
  productName: 'Aged Sheng Cake',
  originCountry: 'China',
  originRegion: 'Menghai',
  pricePerGramUSD: 0.8,
  stockGrams: 0,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Sold Out',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}, {
  id: 'manxiu-spring-cake',
  type: 'Sheng',
  givenName: 'Manxiu Spring Cake',
  productName: 'Manxiu old-tree tea',
  originCountry: 'China',
  originRegion: 'Manxiu',
  pricePerGramUSD: 0.9,
  stockGrams: 80,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}, {
  id: 'manxiu-archive-cake',
  type: 'Sheng',
  givenName: 'Manxiu Archive Cake',
  productName: 'Manxiu archive tea',
  originCountry: 'China',
  originRegion: 'Manxiu',
  pricePerGramUSD: 1.1,
  stockGrams: 0,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Sold Out',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}, {
  id: 'orphan-village-cake',
  type: 'Sheng',
  givenName: 'Orphan Village Cake',
  productName: 'Orphan Village tea',
  originCountry: 'China',
  originRegion: 'Orphan Village',
  pricePerGramUSD: 0.6,
  stockGrams: 40,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}, {
  id: 'inverted-area-cake',
  type: 'Sheng',
  givenName: 'Inverted Area Cake',
  productName: 'Inverted Area tea',
  originCountry: 'China',
  originRegion: 'Inverted Area',
  pricePerGramUSD: 0.7,
  stockGrams: 35,
  description: '',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  isPersonal: false,
  canReorder: false,
  isOneOfAKind: false,
}];

const previewCatalogue = buildTeaReferenceCatalogue(previewTransport.publicPreview, previewProducts);

function createReferenceQueryClient(products: PublicProduct[] = previewProducts): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(TEA_REFERENCE_PREVIEW_QUERY_KEY, previewTransport);
  client.setQueryData(['products', 'public'], products);
  return client;
}

const renderPreview = (path: string, products: PublicProduct[] = previewProducts) => {
  const client = createReferenceQueryClient(products);
  return renderToString(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/wisdom/types" element={<TeaTypeIndexPage />} />
            <Route path="/wisdom/family/:id" element={<TeaFamilyPage />} />
            <Route path="/wisdom/type/:id" element={<TeaTypePage />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

const renderRegionAsync = (path: string, client: QueryClient): Promise<string> => {
  return new Promise((resolve, reject) => {
    let html = '';
    const destination = new PassThrough();
    destination.setEncoding('utf8');
    destination.on('data', chunk => { html += chunk; });
    destination.on('end', () => resolve(html));
    destination.on('error', reject);
    const stream = renderToPipeableStream(
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/wisdom/regions" element={<RegionIndexPage />} />
              <Route path="/wisdom/region/:id" element={<RegionPage />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
      {
        onAllReady() { stream.pipe(destination); },
        onShellError: reject,
        onError: reject,
      },
    );
  });
};

const renderAsync = (path: string, products: PublicProduct[] = previewProducts): Promise<string> =>
  renderRegionAsync(path, createReferenceQueryClient(products));

const INDEX_PAGES = [
  '/wisdom/cultivars',
  '/wisdom/regions',
  '/wisdom/producers',
  '/wisdom/marks',
  '/wisdom/styles',
  '/wisdom/named',
];

const DETAIL_PAGES = [
  '/wisdom/cultivar/jin-xuan',
  '/wisdom/mark/7572',
  '/wisdom/producer/menghai-tea-factory',
  '/wisdom/region/wuyi-mountains-fujian',
  '/wisdom/named/courage',
];

const ALL_DETAIL_PAGES = [
  '/wisdom/cultivar/jin-xuan',
  '/wisdom/region/wuyi-mountains-fujian',
  '/wisdom/producer/menghai-tea-factory',
  '/wisdom/style/xiao-qing-gan',
  '/wisdom/mark/7572',
  '/wisdom/named/courage',
];

const researchKinds: WisdomEntryKind[] = ['cultivar', 'region', 'producer', 'style', 'mark', 'namedTea'];
const sharedResearchBundle: PublicResearchBundle = {
  sources: [{
    id: 'shared-source',
    publisher: 'Tea Research Institute',
    title: 'A scoped tea character study',
    url: 'https://example.com/tea-study',
    kind: 'institutional',
    accessedAt: '2026-08-08',
  }],
  citations: researchKinds.map(entryKind => ({
    id: `${entryKind}-citation`,
    entryKind,
    entryId: `${entryKind}-fixture`,
    fields: ['description'],
    sourceIds: ['shared-source'],
    usage: 'qualified' as const,
    qualification: `Limited to this ${entryKind} entry.`,
  })),
  potentialProfiles: researchKinds.map(entryKind => ({
    entryKind,
    entryId: `${entryKind}-fixture`,
    tasting: { flavor: ['honey'], body: ['full'] },
    citationIds: [`${entryKind}-citation`],
  })),
};

describe('entry research', () => {
  it('shows the qualified Yi Bang source without turning it into a commercial relationship', () => {
    const html = render('/wisdom/region/yi-bang-village-yunnan');

    expect(html).toContain('data-wisdom-region-page="true"');
    expect(html).toContain('Research sources');
    expect(html).toContain('Yunnan Sourcing');
    expect(html).toContain('2025 Yunnan Sourcing Yi Bang Wild Arbor Raw Pu-erh Tea Cake');
    expect(html).toContain('href="https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake"');
    expect(html).toContain('Accessed 8 August 2026');
    expect(html).toContain('Supports Yi Bang&#x27;s place and specialist-retail trade context only. It does not support a village-wide sensory profile.');
    expect(html).not.toMatch(/\b(?:our vendor|vendor|producer)\b/i);
    expect(html).not.toContain('Potential profile');
  });

  it('uses the same cited research section for every Wisdom detail kind', () => {
    for (const entryKind of researchKinds) {
      const html = renderToString(
        <MemoryRouter>
          <EntryResearchSection
            entryKind={entryKind}
            entryId={`${entryKind}-fixture`}
            bundle={sharedResearchBundle}
          />
        </MemoryRouter>,
      );

      expect(html).toContain('Potential profile');
      expect(html).toContain('Honey');
      expect(html).toContain('Research sources');
      expect(html).toContain(`Limited to this ${entryKind} entry.`);
    }
  });

  it('renders no research section when an entry has neither citations nor a cited profile', () => {
    const html = renderToString(
      <EntryResearchSection entryKind="region" entryId="no-research" bundle={sharedResearchBundle} />,
    );

    expect(html).toBe('');
  });
});

describe('private reference verification', () => {
  it('leaves no control markup for public readers and platform admins', () => {
    for (const role of [null, 'platform_admin'] as const) {
      setVerificationAccess(role, 'account-a');
      for (const path of ALL_DETAIL_PAGES) expect(render(path)).not.toContain('data-wisdom-verification');
    }
    setVerificationAccess(null, null);
  });

  it('places the owner control on all six detail kinds, including an entry without research', () => {
    setVerificationAccess('platform_owner', 'account-a');
    try {
      for (const path of ALL_DETAIL_PAGES) expect(render(path)).toContain('data-wisdom-verification');
      expect(render('/wisdom/mark/aaa-grade')).toContain('data-wisdom-verification');
    } finally {
      setVerificationAccess(null, null);
    }
  });
});

describe('wayfinding', () => {
  it('reserves the live approved-relations seam on every public detail page', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path), path).toContain('aria-label="Related material loading"');
    }
  });

  it('adds Types and renames Regions to Origins only for the local preview', () => {
    expect(wisdomSections(true)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'types', label: 'Types', path: '/wisdom/types' }),
      expect.objectContaining({ id: 'regions', label: 'Origins', path: '/wisdom/regions' }),
    ]));
    expect(wisdomSections(false).map(section => section.label)).toEqual([
      'Overview', 'Plants', 'Regions', 'Producers', 'Marks', 'Styles', 'Named',
    ]);
    expect(WISDOM_SECTIONS).toEqual(wisdomSections(TEA_REFERENCE_PREVIEW_ENABLED));
    expect(sectionForPath('/wisdom/types')).toBe('types');
    expect(sectionForPath('/wisdom/type/sheng')).toBe('types');
    expect(sectionForPath('/wisdom/family/puer')).toBe('types');

    const previewHoldings = previewWisdomHomeHoldings(null);
    expect(previewHoldings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Origins', to: '/wisdom/regions', count: REGIONS.length }),
    ]));
    expect(previewHoldings.some(holding => holding.to === '/wisdom/types')).toBe(false);

    expect(teaReferenceRoutePaths(false)).toEqual([]);
    expect(teaReferenceRoutePaths(true)).toEqual([
      '/wisdom/types',
      '/wisdom/family/:id',
      '/wisdom/type/:id',
    ]);
    expect(teaReferenceRoutePaths(TEA_REFERENCE_PREVIEW_ENABLED)).toEqual(
      TEA_REFERENCE_PREVIEW_ENABLED
        ? ['/wisdom/types', '/wisdom/family/:id', '/wisdom/type/:id']
        : [],
    );
  });

  it('carries one control, not a back link above a lit nav item', () => {
    for (const path of DETAIL_PAGES) {
      const html = render(path);
      expect(html).toContain('aria-label="The wisdom base"');
      expect(html).toContain('aria-current="page"');
      // The back link said "All tea plants" directly above a strip already
      // marking Plants as current. 44px of chrome saying the same thing twice.
      expect(html).not.toMatch(/All (tea plants|marks|producers|growing regions)</);
    }
  });

  it('lights the holding a detail page belongs to', () => {
    const regionLabel = WISDOM_SECTIONS.find(section => section.id === 'regions')?.label;
    expect(render('/wisdom/region/wuyi-mountains-fujian')).toMatch(
      new RegExp(`aria-current="page"[^>]*>${regionLabel}|${regionLabel}<\\/a>`),
    );
  });

  it('collapses to one line on a phone and keeps every active holding reachable', () => {
    const html = render('/wisdom/regions');
    // The serif items need multiple rows at 390px. Below sm the strip is
    // the holding you are in, and it opens in place.
    expect(html).toContain('aria-controls="wisdom-holdings"');
    expect(html).toContain(`${WISDOM_SECTIONS.length} holdings`);
    // Both shapes are in the DOM, but `hidden` is display:none, so exactly one
    // of them is in the accessibility tree at any width.
    expect(html).toContain('class="sm:hidden"');
    expect(html).toContain('class="hidden sm:block"');
    for (const section of WISDOM_SECTIONS) {
      expect(html).toContain(`href="${section.path}"`);
    }
    expect(html.includes('href="/wisdom/types"')).toBe(TEA_REFERENCE_PREVIEW_ENABLED);
    expect(html).toContain(TEA_REFERENCE_PREVIEW_ENABLED ? '>Origins<' : '>Regions<');
  });

  it('uses the mandatory mobile navigation gap on every Wisdom page', () => {
    expect(PAGE.split(/\s+/)).toContain('pb-nav-gap');
    expect(PAGE.split(/\s+/)).not.toContain('pb-nav');
  });
});

describe('Tea Reference type preview', () => {
  it('renders the family-to-type path in the Wisdom frame and omits an unmatched type', () => {
    const index = renderPreview('/wisdom/types');
    expect(index).toContain('aria-label="The wisdom base"');
    expect(index).toContain('Tea families');
    expect(index).toContain('href="/wisdom/family/puer"');
    expect(index).toContain('href="/wisdom/type/sheng"');
    expect(index).not.toContain('href="/wisdom/type/shou"');
    if (TEA_REFERENCE_PREVIEW_ENABLED) {
      expect(index).toContain('>Types<');
      expect(index).toContain('>Origins<');
      expect(index).toContain('8 holdings');
    } else {
      expect(index).not.toContain('href="/wisdom/types"');
      expect(index).toContain('>Regions<');
    }

    const family = renderPreview('/wisdom/family/puer');
    expect(family).toContain('Pu’er');
    expect(family).toContain('href="/wisdom/type/sheng"');
  });

  it('renders grouped citations, matching teas, and a page-specific correction action', () => {
    const html = renderPreview('/wisdom/type/sheng').replace(/&amp;/g, '&');
    expect(html).toContain('Common characteristics');
    expect(html).toContain('Cultivar potential');
    expect(html).toContain('Tea Institute');
    expect(html).toContain('Sheng Field Guide');
    expect(html).toContain('Mei Lin');
    expect(html).toContain('2026-02-03');
    expect(html).toContain('href="https://example.com/sheng/"');
    expect(html).toContain('Tea Institute, Cultivar guide (2025)');
    expect(html).not.toContain('Retailer or reseller');
    expect(html).toContain('Available teas');
    expect(html).toContain('href="/shop/product/sheng-spring-cake"');
    expect(html).toContain('Spring Cake');
    expect(html).toContain('href="/shop/product/sheng-sold-out-cake"');
    expect(html).toContain('Aged Sheng Cake');
    expect(html).toContain('Previously offered');
    expect(html).toContain('Sold out');
    expect(html.indexOf('Available teas')).toBeLessThan(html.indexOf('href="/shop/product/sheng-spring-cake"'));
    expect(html.indexOf('href="/shop/product/sheng-spring-cake"')).toBeLessThan(html.indexOf('Previously offered'));
    expect(html.indexOf('Previously offered')).toBeLessThan(html.indexOf('href="/shop/product/sheng-sold-out-cake"'));
    expect(html).toContain('Report an inaccuracy');
    expect(html).toContain('subject=Report%20an%20inaccuracy%3A%20Tea%20type%3A%20Sheng');
    expect(html).not.toMatch(/held|conflict|review|evidence|private/i);
  });

  it('uses the established not-found page for a type absent from the product-connected catalogue', () => {
    const html = renderPreview('/wisdom/type/shou');
    expect(html).toContain('Not a tea type we hold');
    expect(html).not.toContain('Available teas');
  });

  it('does not label previously offered teas as available when every match is sold out', () => {
    const soldOutProduct = previewProducts.find(product => product.status === 'Sold Out');
    if (!soldOutProduct) throw new Error('sold-out fixture is required');
    const html = renderPreview('/wisdom/type/sheng', [soldOutProduct]);
    expect(html).not.toContain('Available teas');
    expect(html).toContain('Previously offered');
    expect(html).toContain('href="/shop/product/sheng-sold-out-cake"');
    expect(html).toContain('Sold out');
  });

  it('explains a valid catalogue with no product-connected tea types', () => {
    const html = renderPreview('/wisdom/types', []);
    expect(html).toContain('No tea family or type is connected to the public catalogue in this preview.');
  });
});

describe('Tea Reference preview home', () => {
  it.each(['白', 'Orchid Dan Cong'])('preserves the established static ranking for %s', query => {
    expect(searchPreviewWisdomHome(query, previewCatalogue, 10)).toEqual(searchHoldings(query, 10));
  });

  it('merges product-connected family and type hits into the cross-holding search', () => {
    expect(searchPreviewWisdomHome('Sheng', previewCatalogue, 1)[0]?.to).toBe('/wisdom/type/sheng');
    expect(searchPreviewWisdomHome('Pu’er', previewCatalogue, 1)[0]?.to).toBe('/wisdom/family/puer');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('states that local cited entries are additional to the published dataset', () => {
    const html = render('/wisdom');
    expect(html).toContain('Local cited preview entries are additional to the published open dataset');
    expect(html).toContain('not included in its static page count');
    expect(html).toContain('carrying every published holding');
    expect(html).not.toContain('Everything above is also exported');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('withholds a zero-entry Types holding while its client queries are pending', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    const html = renderToString(
      <QueryClientProvider client={client}>
        <HelmetProvider><MemoryRouter><PreviewWisdomHomePage /></MemoryRouter></HelmetProvider>
      </QueryClientProvider>,
    );
    expect(html).not.toContain('>Tea Types<');
    expect(html).not.toContain('>0 entries<');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('keeps normal holdings usable and shows a quiet diagnostic after a client query error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    await client.prefetchQuery({
      queryKey: TEA_REFERENCE_PREVIEW_QUERY_KEY,
      queryFn: async () => { throw new Error('unavailable'); },
    });
    const previewQuery = client.getQueryCache().find({ queryKey: TEA_REFERENCE_PREVIEW_QUERY_KEY });
    if (!previewQuery) throw new Error('preview query was not created');
    previewQuery.setState({
      ...previewQuery.state,
      status: 'error',
      error: new Error('unavailable'),
      fetchStatus: 'idle',
    });
    client.setQueryData(['products', 'public'], previewProducts);
    const html = renderToString(
      <QueryClientProvider client={client}>
        <HelmetProvider><MemoryRouter><PreviewWisdomHomePage /></MemoryRouter></HelmetProvider>
      </QueryClientProvider>,
    );
    expect(html).toContain('The local cited preview is unavailable');
    expect(html).toContain('href="/wisdom/cultivars"');
    expect(html).not.toContain('>Tea Types<');
    expect(html).not.toContain('>0 entries<');
  });
});

describe('the foot of a page', () => {
  it('does not repeat the scope footnote on every entry', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path)).not.toContain('account scoped');
    }
  });

  it('says the scope once, on the front door', () => {
    expect(render('/wisdom')).toContain('Nothing in the reference is account scoped');
  });
});

describe('where the authorship line lives', () => {
  it('states the rung once per holding while every entry sits on the same one', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toContain('was drafted from research');
    }
  });

  it('does not repeat that sentence on all three hundred entries', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path)).not.toContain('Drafted from research.');
    }
  });

  it('returns to the entry the moment a second rung exists', () => {
    AUTHORSHIP['jin-xuan'] = { rung: 'reviewed', reviewer: 'Adrian', date: '2026-07-27' };
    try {
      // The reviewed entry credits the person who read it...
      expect(render('/wisdom/cultivar/jin-xuan')).toContain('Reviewed and corrected by Adrian');
      // ...and every other entry starts saying it is not that, because from
      // here on the sentence tells one entry from the next.
      expect(render('/wisdom/mark/7572')).toContain('Drafted from research.');
      expect(render('/wisdom/cultivars')).toContain('states its own authorship');
    } finally {
      delete AUTHORSHIP['jin-xuan'];
    }
  });
});

describe('what the base is, as of when', () => {
  it('states the version, the build date and a citation on the front door', () => {
    // React writes comment separators between adjacent text nodes, so the
    // rendered sentence is matched by its parts rather than as one string.
    const html = render('/wisdom').replace(/<!-- -->/g, '');
    expect(html).toContain(`Version ${DATASET_VERSION}`);
    expect(html).toContain(`built ${readableDate(DATASET_BUILT)}`);
    expect(html).toContain('Cite it as');
  });

  it('reads an ISO date as a date a person would write', () => {
    expect(readableDate('2026-07-27')).toBe('27 July 2026');
    expect(readableDate('2026-01-01')).toBe('1 January 2026');
  });
});

describe('reaching the cross-holding search from inside a holding', () => {
  it('offers the way across on every index', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toContain('Search every holding at once');
    }
  });

  it('prints it once, at the foot, and never stacked under a second dim line', () => {
    // Two 11px lines used to run between the toolbar and the first record on
    // the places and named-teas indexes. A reader met both before they met a
    // single entry.
    for (const path of INDEX_PAGES) {
      const html = render(path);
      const before = html.slice(0, html.indexOf('Search every holding at once'));
      expect(before).toContain('aria-label="Browse the');
      // The escape line now sits after the list, with the holding's own notes.
      expect(before).toContain('was drafted from research');
    }
  });

  it('is not offered on the search itself', () => {
    expect(render('/wisdom')).not.toContain('Search every holding at once');
  });

  it('opens the front door with the words already typed', () => {
    expect(render('/wisdom?q=rou%20gui')).toContain('/wisdom/cultivar/rou-gui');
  });
});

describe('a toolbar with nothing on it', () => {
  it('gives every holding a way to order its own list', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).toMatch(/aria-label="Browse the [a-z ]+"/);
    }
  });
});

describe('an empty cell', () => {
  it('says a mark has no producer rather than leaving the column blank', () => {
    const html = render('/wisdom/marks');
    expect(html).toContain('No producer recorded');
    expect(html).toContain('Not recorded');
  });
});

describe('growing regions', () => {
  it('uses one exact geographic level order with singular and plural public labels', () => {
    expect(PREVIEW_PLACE_LEVELS).toEqual([
      { level: 'major_region', singular: 'Major region', plural: 'Major regions' },
      { level: 'tea_area', singular: 'Tea area', plural: 'Tea areas' },
      { level: 'mountain', singular: 'Mountain', plural: 'Mountains' },
      { level: 'village', singular: 'Village', plural: 'Villages' },
      { level: 'locality', singular: 'Locality', plural: 'Localities' },
    ]);
  });

  it('is a holding in the nav', () => {
    expect(WISDOM_SECTIONS.map(section => section.id)).toContain('regions');
    expect(WISDOM_SECTIONS.find(section => section.id === 'regions')?.path).toBe('/wisdom/regions');
  });

  it('lists every place the base holds', () => {
    const html = render('/wisdom/regions');
    expect(REGIONS.length).toBeGreaterThan(150);
    expect(html).toContain(`${REGIONS.length} places`);
    expect(html).toContain('/wisdom/region/wuyi-mountains-fujian');
  });

  it('breaks the 98 places under China into groups a reader can land in', () => {
    const html = render('/wisdom/regions');
    // The country head, then the provinces inside it, then somewhere to jump.
    expect(html).toContain('id="place-china"');
    expect(html).toContain('id="place-china-fujian"');
    expect(html).toContain('Province not recorded');
    expect(html).toMatch(/<select[^>]*aria-label="Jump to a group of places"/);
    // A heading that leaves with the first screenful is no heading at all, so
    // one thin running head carries the current group. See the block below.
    expect(html).toMatch(/class="sticky top-0 z-10 -mb-8 h-8 bg-tea-bg/);
  });

  it('names the plants recorded from a place, and says so when there are none', () => {
    const wuyi = render('/wisdom/region/wuyi-mountains-fujian');
    expect(wuyi).toContain('Plants from here');
    expect(wuyi).toContain('/wisdom/cultivar/');

    const bare = render('/wisdom/region/anji');
    expect(bare).toContain('No plant in the reference records this place as its origin yet');
  });

  it('answers for a place it does not hold', async () => {
    const html = TEA_REFERENCE_PREVIEW_ENABLED
      ? await renderAsync('/wisdom/region/nope')
      : render('/wisdom/region/nope');
    expect(html).toContain('Not a place we hold');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('prepends product-connected cited origins without flattening their declared levels', async () => {
    await renderAsync('/wisdom/regions');
    const html = render('/wisdom/regions');
    expect(html).toContain('Cited origins in this preview');
    for (const [label, id, count] of [
      ['Major regions', 'reference-yunnan', 1],
      ['Tea areas', 'reference-yiwu', 2],
      ['Mountains', 'reference-gedeng', 1],
      ['Villages', 'reference-mansa', 2],
      ['Localities', 'reference-manxiu', 1],
    ]) {
      expect(html).toContain(label);
      expect(html).toContain(`href="/wisdom/region/${id}"`);
      expect(html).toMatch(new RegExp(`${label}</span><span[^>]*>${count}</span>`));
    }
    expect(html.indexOf('Cited origins in this preview')).toBeLessThan(html.indexOf('id="place-china"'));
    expect(html).toContain(`${REGIONS.length} places`);
    expect(html).not.toContain('overflow-x-auto');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('keeps an existing Wuyi URL on the published region page before consulting cited origins', async () => {
    const html = await renderAsync('/wisdom/region/wuyi-mountains-fujian');
    expect(html).toContain('>Growing place<');
    expect(html).toContain('Plants from here');
    expect(html).toContain('Country');
    expect(html).not.toContain('Cited origin');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('renders a cited origin at the established region URL with verified hierarchy, citations, and teas', async () => {
    const html = (await renderAsync('/wisdom/region/reference-manxiu')).replace(/&amp;/g, '&');
    expect(html).not.toMatch(/<section(\s|>)/);
    expect(html).toContain('>Cited origin<');
    expect(html).toContain('>Locality<');
    expect(html).toContain('>Origin path<');
    expect(html).toContain('href="/wisdom/region/reference-yunnan"');
    expect(html).toContain('href="/wisdom/region/reference-yiwu"');
    expect(html).toContain('href="/wisdom/region/reference-gedeng"');
    expect(html).toContain('href="/wisdom/region/reference-mansa"');
    expect(html).toContain('Mansa Village');
    expect(html.indexOf('href="/wisdom/region/reference-yunnan"')).toBeLessThan(html.indexOf('href="/wisdom/region/reference-yiwu"'));
    expect(html.indexOf('href="/wisdom/region/reference-yiwu"')).toBeLessThan(html.indexOf('href="/wisdom/region/reference-gedeng"'));
    expect(html.indexOf('href="/wisdom/region/reference-gedeng"')).toBeLessThan(html.indexOf('href="/wisdom/region/reference-mansa"'));
    expect(html).toContain('General reference');
    expect(html).toContain('A concise public source excerpt about Manxiu.');
    expect(html).toContain('Tea Geography Institute · Manxiu reference');
    expect(html).toContain('Field Research Desk');
    expect(html).toContain('2026-03-04');
    expect(html).toContain('href="https://example.com/manxiu"');
    expect(html).toContain('Available teas');
    expect(html).toContain('href="/shop/product/manxiu-spring-cake"');
    expect(html).toContain('Previously offered');
    expect(html).toContain('href="/shop/product/manxiu-archive-cake"');
    expect(html).toContain('Report an inaccuracy');
    expect(html).not.toMatch(/Country|Province|Altitude|Climate/);
    expect(html).not.toMatch(/held|conflict|evidence|private/i);
    expect(html).not.toContain('overflow-x-auto');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('shows children only from verified reverse parent ids and omits missing or inverted parents', async () => {
    const parent = await renderAsync('/wisdom/region/reference-mansa');
    expect(parent).toContain('Places within this origin');
    expect(parent).toContain('href="/wisdom/region/reference-manxiu"');

    const missing = await renderAsync('/wisdom/region/reference-orphan-village');
    expect(missing).not.toContain('reference-missing-parent');
    expect(missing).not.toContain('Origin path');

    const inverted = await renderAsync('/wisdom/region/reference-inverted-area');
    expect(inverted).not.toContain('href="/wisdom/region/reference-manxiu"');
    expect(inverted).not.toContain('Origin path');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('withholds the cited index while loading and keeps the published list usable on a bounded error', async () => {
    const pendingClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    const pending = await renderRegionAsync('/wisdom/regions', pendingClient);
    expect(pending).not.toContain('Cited origins in this preview');
    expect(pending).toContain(`${REGIONS.length} places`);
    expect(pending).toContain('href="/wisdom/region/wuyi-mountains-fujian"');

    const errorClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    await errorClient.prefetchQuery({
      queryKey: TEA_REFERENCE_PREVIEW_QUERY_KEY,
      queryFn: async () => { throw new Error('private upstream detail'); },
    });
    errorClient.setQueryData(['products', 'public'], previewProducts);
    const error = await renderRegionAsync('/wisdom/regions', errorClient);
    expect(error).toContain('The local cited origins preview is unavailable');
    expect(error).toContain(`${REGIONS.length} places`);
    expect(error).not.toContain('private upstream detail');
  });

  it.skipIf(!TEA_REFERENCE_PREVIEW_ENABLED)('uses the Wisdom skeleton while an unknown origin loads and gives a bounded error route back', async () => {
    const pendingClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    const pending = await renderRegionAsync('/wisdom/region/reference-unknown', pendingClient);
    expect(pending).toContain('shimmer-warm');
    expect(pending).toContain('aria-label="The wisdom base"');

    const errorClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
    await errorClient.prefetchQuery({
      queryKey: TEA_REFERENCE_PREVIEW_QUERY_KEY,
      queryFn: async () => { throw new Error('private upstream detail'); },
    });
    errorClient.setQueryData(['products', 'public'], previewProducts);
    const error = await renderRegionAsync('/wisdom/region/reference-unknown', errorClient);
    expect(error).toContain('This cited origin could not be loaded');
    expect(error).toContain('href="/wisdom/regions"');
    expect(error).toContain('Return to Origins');
    expect(error).not.toContain('private upstream detail');
  });
});

describe('a mark and its producer', () => {
  it('reaches the producer from the row, not just the page', () => {
    const index = render('/wisdom/marks');
    expect(index).toContain('/wisdom/producer/menghai-tea-factory');
    // A mark with no producer in the base keeps a plain cell.
    expect(index).toContain('AAA');
  });

  it('says plainly when no producer is recorded', () => {
    expect(render('/wisdom/mark/aaa-grade')).toContain('Not recorded');
  });

  it('reaches the marks from the producer', () => {
    expect(render('/wisdom/producer/menghai-tea-factory')).toContain('/wisdom/mark/7572');
  });
});

describe('a cultivar is not a dead end', () => {
  it('says what the reference does not know about the shop, and points at it', () => {
    const html = render('/wisdom/cultivar/jin-xuan');
    expect(html).toContain('nothing on sale is currently attributed to this plant');
    expect(html).toContain('href="/shop"');
  });
});

describe('searching every holding at once', () => {
  it('finds a name without being told which holding it lives in', () => {
    const hits = searchHoldings('Rou Gui');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].holding).toBe('Plants');
    expect(hits[0].to).toMatch(/^\/wisdom\/cultivar\//);
  });

  it('reaches every holding', () => {
    expect(searchHoldings('7572')[0]?.holding).toBe('Marks');
    expect(searchHoldings('Menghai Tea Factory')[0]?.holding).toBe('Producers');
    expect(searchHoldings('Courage')[0]?.holding).toBe('Named');
    expect(searchHoldings('Wuyi')[0]?.holding).toBeTruthy();
  });

  it('sorts an exact name above a partial one', () => {
    const hits = searchHoldings('Wuyi');
    const exact = hits.findIndex(hit => hit.name.toLowerCase() === 'wuyi');
    expect(exact).toBe(0);
  });

  it('answers nothing for nothing', () => {
    expect(searchHoldings('   ')).toEqual([]);
    expect(searchHoldings('qqzzx')).toEqual([]);
  });

  it('says what it searched for when a search finds nothing', () => {
    // Rendered server-side the field is empty, so this checks the copy exists
    // in the component rather than driving the input.
    expect(render('/wisdom')).toContain('Search every holding');
  });
});

describe('group heads', () => {
  it('never uses a sentence as a label', () => {
    for (const tradition of NAMING_TRADITIONS) {
      const label = traditionLabel(tradition);
      expect(label).not.toContain('(');
      expect(label.split(/\s+/).length).toBeLessThanOrEqual(3);
      expect(isMicroCapsLabel(label)).toBe(true);
    }
  });

  it('keeps what makes each tradition different', () => {
    expect(traditionLabel('Chinese poetic tea-naming (named for the feeling of origin rather than a technical specification)')).toBe('Poetic');
    expect(traditionLabel('Chinese private-collection naming')).toBe('Private-collection');
    expect(traditionLabel('Chinese private-collection naming, paired naming')).toBe('Private-collection, paired');
    expect(traditionLabel('anonymous or packaging-only naming')).toBe('Anonymous or packaging-only');
    // Cut from the front: the export is what makes this one different.
    expect(traditionLabel('undocumented export or trade-route naming')).toBe('Export or trade-route');
  });

  it('explains the axis once, with the notes at the foot rather than above the list', () => {
    const html = render('/wisdom/named');
    expect(html).toContain('The groups above are how each tea came by its name');
    expect(html).not.toContain('named for the feeling of origin rather than a technical specification');
  });
});

describe('a cold arrival on one entry', () => {
  it('states the rung in the header, in one word, on every detail page', () => {
    for (const path of [...DETAIL_PAGES, '/wisdom/style/xiao-qing-gan']) {
      const html = render(path);
      // Somebody arriving from a search engine walks through no index, so the
      // holding's authorship sentence never reaches them. One micro-caps word
      // in the header is the whole repair.
      expect(html).toContain('Authorship: ');
      expect(html).toMatch(/>Drafted</);
      // Not the four-line footnote block that used to sit on all 300 entries.
      expect(html).not.toContain('Drafted from research. Not yet read by a human.<');
    }
  });

  it('leaves the word off an index, which says the sentence in full instead', () => {
    for (const path of INDEX_PAGES) {
      expect(render(path)).not.toContain('Authorship: ');
    }
  });
});

describe('two counts on the front door', () => {
  it('names what each one counts instead of printing them side by side', () => {
    const html = render('/wisdom').replace(/<!-- -->/g, '');
    expect(html).toContain(`${DATASET_RECORDS} published records in all`);
    expect(html).toContain(`${DATASET_PAGES} published entries with a page in the static Wisdom Base`);
    expect(html).toContain(`${DATASET_RECORDS - DATASET_PAGES} tea variety names carried as data only`);
  });

  it('keeps the page count and the holding totals from drifting apart', () => {
    // The table above the stamp sums to TOTAL_ENTRIES; the export counts the
    // same records as DATASET_PAGES. If a holding is added to one and not the
    // other, the front door starts contradicting itself again in public.
    expect(DATASET_PAGES).toBe(TOTAL_ENTRIES);
    expect(DATASET_RECORDS).toBeGreaterThan(DATASET_PAGES);
  });
});

describe('a column that is empty on half its rows', () => {
  it('says why once, above the list, rather than on every bare row', () => {
    const html = render('/wisdom/regions');
    expect(html).toContain('working-list names');
    expect(html).toContain('not researched rather than not applicable');
    // 94 of the 182 places carry no altitude. The absent-cell device is for a
    // scarce absence; at this density it would be the loudest thing on screen.
    const notRecorded = html.match(/Not recorded/g) ?? [];
    expect(notRecorded.length).toBeLessThan(5);
  });

  it('counts what is recorded rather than printing a number that rots', () => {
    const altitude = REGIONS.filter(region => region.altitude).length;
    const province = REGIONS.filter(region => region.province).length;
    expect(altitude).toBeLessThan(REGIONS.length);
    const html = render('/wisdom/regions').replace(/<!-- -->/g, '');
    expect(html).toContain(`An altitude is recorded for ${altitude} of these places and a province for ${province}`);
  });
});

describe('guide words at the top of a long list', () => {
  it('sticks one thin running head on the page background, not a second bar per group', () => {
    const html = render('/wisdom/regions');
    // The page's own tone, so rows pass behind it rather than through it, and
    // one full-measure rule under it. A fill of its own would make it a table
    // header, which is the one thing this is not.
    expect(html).toMatch(/class="sticky top-0 z-10 -mb-8 h-8 bg-tea-bg[^"]*border-b border-tea-border/);
    // Exactly one, however many groups the view has.
    expect((html.match(/class="sticky /g) ?? []).length).toBe(1);
  });

  it('marks each break with a guide mark that half-hangs into the label margin', () => {
    const html = render('/wisdom/regions');
    // Half of the 7.5rem label column, so the mark sits on neither axis and
    // cannot be read as a label or as a value.
    expect(html).toContain('sm:pl-[3.75rem]');
    // A province inside a country hangs a step further in, at body size.
    expect(html).toContain('sm:pl-[5.25rem]');
  });
});

describe('what carries the grouping', () => {
  it('lets an edge carry the plane, never a fill big enough to be a slab', () => {
    // A fill perceptible on its own has to clear about 1.4, and the only token
    // on the ramp that does is tea-elevated, which reads as a lighter rectangle
    // laid on a darker one. The house card solved this years ago: a whisper
    // fill, a 1px bronze rim light, a soft shadow, and the edges do the reading.
    // A rounded elevated block creeping back is the slab returning. The search
    // field keeps that fill and should: it is a control a reader has to find,
    // not a container, and a field nobody can see is worse than a flat page.
    for (const path of ['/wisdom', ...INDEX_PAGES, ...DETAIL_PAGES, '/wisdom/style/xiao-qing-gan']) {
      const html = render(path);
      expect(html).not.toMatch(/bg-tea-elevated[^"]*rounded-(lg|xl)/);
      expect(html).toContain('wisdom-ground');
    }
  });

  it('raises the record and leaves the apparatus on the page tone', () => {
    // An index lifts its list; the group mark above it does not lift, or the
    // band boundary stops meaning one thing.
    const named = render('/wisdom/named');
    expect(named).toMatch(/<ul class="list-none m-0 p-0 wisdom-ground[^"]*py-2">/);
    // A group head is a heading, so it stays down on the page's own tone.
    expect(named).not.toMatch(/scroll-mt-12[^"]*wisdom-ground/);
    // An entry lifts each section of the record, and the foot notes stay down.
    expect(render('/wisdom/cultivar/jin-xuan')).toMatch(/<section class="mt-12 wisdom-ground/);
  });

  it('holds the spacing grammar and both rules on every page', () => {
    for (const path of [...INDEX_PAGES, ...DETAIL_PAGES]) {
      const html = render(path);
      // 48px between sections, and a full-measure hairline at a major break.
      expect(html).toContain('mt-12');
      expect(html).toContain('border-t border-tea-border');
    }
    // The short bronze rule under a section head, 40px, stopping dead.
    expect(render('/wisdom/cultivar/jin-xuan')).toContain('block w-10 h-px bg-tea-gold/40');
  });

  it('holds the measure and the one left axis', () => {
    for (const path of [...INDEX_PAGES, ...DETAIL_PAGES]) {
      const html = render(path);
      expect(html).toContain('max-w-[66ch]');
      expect(html).toContain('sm:grid-cols-[7.5rem_minmax(0,1fr)]');
      // The shell takes the width now. What holds a paragraph to a readable
      // line is the measure, which is a property of the text, and it is
      // unchanged: widening the page must never widen the prose.
      expect(html).toContain(`class="${PAGE}"`);
      expect(html).not.toContain('max-w-[46rem]');
    }
  });
});

describe('one row from the next', () => {
  it('rules between rows, and never above the first row of a group', () => {
    for (const path of INDEX_PAGES) {
      const html = render(path);
      expect(html).toContain('wisdom-rule');
    }
  });

  it('never stripes', () => {
    // Alternating rows were built and taken out. The tone was right, the rhythm
    // was wrong: banding every second row of a 630-entry reference reads as a
    // spreadsheet, and it puts a second separator on a list the hairline had
    // already separated. One block of tone says it once.
    for (const path of INDEX_PAGES) {
      expect(render(path)).not.toMatch(/even:bg-|odd:bg-|nth-child/);
    }
  });

  it('draws the rule and the hover field at one width', () => {
    // The bleed lives on the li so the border spans it; the padding lives on
    // the row so the text still starts on the axis. A hover fill wider than
    // the rule above it reads as a misprint.
    const html = render('/wisdom/named');
    expect(html).toMatch(/<li class="wisdom-rule -mx-3">/);
    expect(html).toMatch(/hover:bg-tea-accent-sub min-h-\[44px\] py-2\.5 px-3/);
  });
});

describe('what the extra width is for', () => {
  it('gives an index row a metadata column of its own from lg', () => {
    // Up to lg the facts run in under the name, which is the only shape a
    // phone has room for. From lg they sit on the name's baseline, starting at
    // the same x on every row, which is the thing a reader can run an eye down.
    for (const path of INDEX_PAGES) {
      const html = render(path);
      expect(html).toContain('lg:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,24rem)]');
      expect(html).toContain('sm:col-start-2 lg:col-start-3 lg:row-start-1');
    }
  });

  it('keeps a front-door note under its name rather than in the fact column', () => {
    // A sentence in a column of two-word facts is not a fact.
    const html = render('/wisdom');
    expect(html).toMatch(/text-ui-17[^"]*text-tea-text-sec max-w-\[66ch\] block mt-1\.5/);
  });
});

describe('catalogue numbers', () => {
  it('gives every entry a number, in bronze beside its headword', () => {
    for (const path of DETAIL_PAGES) {
      expect(render(path)).toMatch(/figures-tab text-tea-readgold[^>]*>[A-Z]{2} \d{3}</);
    }
  });

  it('carries the number into the index, dim and right aligned', () => {
    const html = render('/wisdom/cultivars');
    expect(html).toMatch(/figures-tab text-tea-text-dim hidden sm:block text-right[^>]*>PL \d{3}</);
  });

  it('numbers a front-door search hit by the holding it came out of', () => {
    const html = render('/wisdom?q=rou%20gui');
    expect(html).toContain('/wisdom/cultivar/rou-gui');
    expect(html).toMatch(/>PL \d{3}</);
  });

  it('never numbers a holding row, which is not a record', () => {
    expect(render('/wisdom')).not.toMatch(/>(PL|RG|PD|MK|SY|NT) \d{3}</);
  });
});

describe('the jump control', () => {
  it('wears house chrome rather than the browser default', () => {
    const html = render('/wisdom/regions');
    expect(html).toMatch(/<select[^>]*class="[^"]*appearance-none/);
    // Its own chevron, drawn in the same glyph the compact nav uses.
    expect(html).toMatch(
      /<select[^>]*aria-label="Jump to a group of places"[\s\S]*?<\/select><svg[^>]*lucide-chevron-down/,
    );
  });
});

describe('the pair of holdings that describe one relation', () => {
  it('opens both grouped, each by its own axis', () => {
    // Marks fall into producer piles; producers fall into kind piles. Neither
    // opens flat while the other opens grouped.
    expect(render('/wisdom/marks')).toContain('Menghai Tea Factory');
    const producers = render('/wisdom/producers');
    expect(producers).toContain('Factory');
    expect(producers).toContain('mark');
  });

  it('counts one mark as one mark', () => {
    // Nine of the ten producers hold exactly one mark, so "1 marks held" was
    // the most repeated string on the page.
    const producers = render('/wisdom/producers');
    expect(producers).toContain('1 mark held');
    expect(producers).not.toContain('1 marks held');
  });
});

describe('the tradition of a named tea', () => {
  it('is set as prose, not at label size', () => {
    const html = render('/wisdom/named/courage');
    expect(html).toContain('Naming tradition');
    // The sentence used to run at 11px, the label size, which is the fine-print
    // defect this loop removed everywhere else.
    const sentence = 'Chinese private-collection naming';
    const at11px = new RegExp(`text-ui-11[^"]*"[^>]*>${sentence}`);
    expect(html).not.toMatch(at11px);
    // The body size, which is 17 now that 15 has been taken out of the scale.
    expect(html).toMatch(new RegExp(`text-ui-17[^"]*"[^>]*>${sentence}`));
  });
});

describe('three type sizes, and nothing else', () => {
  it('leaves no 15px step anywhere in the reference', () => {
    // Prose at 15 and a row name at 17 are two sizes a reader cannot tell
    // apart and can only feel as noise. They are one size now.
    for (const path of ['/wisdom', ...INDEX_PAGES, ...DETAIL_PAGES]) {
      expect(render(path)).not.toContain('text-ui-15');
    }
  });

  it('sets one headword per page and nothing else at that scale', () => {
    for (const path of [...INDEX_PAGES, ...DETAIL_PAGES]) {
      const html = render(path);
      const headwords = html.match(/text-\[32px\] sm:text-\[44px\]/g) ?? [];
      expect(headwords.length).toBe(1);
    }
  });

  it('names the kind of record above the headword, so a cold arrival knows what it is', () => {
    const kinds: Array<[string, string]> = [
      ['/wisdom/cultivar/jin-xuan', 'Tea plant'],
      ['/wisdom/region/wuyi-mountains-fujian', 'Growing place'],
      ['/wisdom/producer/menghai-tea-factory', 'Producer'],
      ['/wisdom/mark/7572', 'Mark'],
      ['/wisdom/style/xiao-qing-gan', 'Style'],
      ['/wisdom/named/courage', 'Named tea'],
    ];
    for (const [path, kind] of kinds) {
      expect(render(path)).toContain(`>${kind}<`);
    }
  });
});

describe('searching wider than a name', () => {
  it('answers a place name with the records that name it, not only the place', () => {
    const hits = searchHoldings('Fujian');
    const holdings = new Set(hits.map(hit => hit.holding));
    expect(hits.length).toBeGreaterThan(3);
    // A search that answered "Fujian" with region rows alone made the base look
    // smaller than it is at the one moment a reader asked it to be bigger.
    expect(holdings.size).toBeGreaterThan(1);
  });

  it('reaches the marks a factory made, not only the factory', () => {
    const hits = searchHoldings('Menghai');
    expect(hits.some(hit => hit.holding === 'Marks')).toBe(true);
  });

  it('never lets a context match outrank a name match', () => {
    // The place itself still opens the list. The records that merely name it
    // follow, rather than displacing the thing the reader typed.
    for (const place of ['Wuyi', 'Fujian', 'Yunnan']) {
      expect(searchHoldings(place)[0].name.toLowerCase()).toBe(place.toLowerCase());
    }
  });

  it('still searches no prose', () => {
    // A word that appears only inside a description or a climate paragraph must
    // not match, or one query returns a hundred paragraphs.
    expect(searchHoldings('benchmark')).toEqual([]);
    expect(searchHoldings('monsoon')).toEqual([]);
  });
});

describe('the lineage rail at a narrow width', () => {
  it('does not let the not-held tag break across two lines', () => {
    const html = render('/wisdom/cultivar/cui-yu');
    expect(html).toMatch(/whitespace-nowrap[^>]*>not held here</);
  });

  it('keeps two generations reachable without a second rail', () => {
    // Chin Hsin's parent Cui Yu is itself a cross, so its parents are still on
    // the page, folded onto Cui Yu's own line rather than opening a nested list
    // with a spine and an indent of its own.
    const html = render('/wisdom/cultivar/chin-hsin').replace(/<!-- -->/g, '');
    expect(html).toContain('/wisdom/cultivar/cui-yu');
    expect(html).toContain('TRES-2022');
    expect(html).toContain('Tainung #80');
    // Said for a screen reader, so the folded line is not a bare "from".
    expect(html).toContain('Parents of Cui Yu');
    // One spine. The nested list that carried the second one is gone.
    expect(html).not.toContain('m-0 mt-2 p-0');
  });

  it('closes a bracket a split left dangling instead of printing half a name', () => {
    expect(tidyName('(Jin Xuan')).toBe('Jin Xuan');
    expect(tidyName('Qing Xin)')).toBe('Qing Xin');
    expect(tidyName('C. sinensis var. assamica (Burma')).toBe('C. sinensis var. assamica (Burma)');
    expect(tidyName("a hybrid of 'Sofu' and 'Makura-Cd86'.")).toBe("a hybrid of 'Sofu' and 'Makura-Cd86'");
    expect(tidyName("'Saemidori'")).toBe('Saemidori');
  });
});
