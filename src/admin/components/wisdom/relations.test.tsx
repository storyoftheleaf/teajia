import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  WisdomRelationsPanelView,
  holdingIdForNodeType,
  nodeTypeForHolding,
  relationDisplayState,
  legalRelationshipKinds,
  filterRelationTargetOptions,
  findingResolution,
  findingAdminHref,
  relationTargetGuidance,
  type WisdomRelation,
} from './relations';
import { WisdomHiddenEntryNotice, WisdomRelatedMaterialError, WisdomRelatedMaterialView, WisdomStateUnavailableNotice } from '../../../pages/wisdom/WisdomRelatedMaterial';
import { createWisdomRelationsApi } from './relationsApi';

const relation = (patch: Partial<WisdomRelation> = {}): WisdomRelation => ({
  id: 'rel-1',
  node_type: 'cultivar',
  node_id: 'rou-gui',
  target_type: 'article',
  target_id: 'article-1',
  target_subtype: null,
  relationship_kind: 'supports',
  source: 'editorial',
  review_status: 'approved',
  target_state: 'public',
  target_label: 'Rou Gui in Wuyi',
  target_href: '/read/rou-gui-in-wuyi',
  account_id: null,
  created_at: '2026-08-10T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
  ...patch,
});

describe('Wisdom relation domain', () => {
  it('normalizes the compact findings contract into a linkable review queue', async () => {
    const client = createWisdomRelationsApi(async () => ({ findings: [
      { kind: 'missing_target', node_type: 'cultivar', node_id: 'rou-gui', target_type: 'article', target_id: 'gone' },
    ] }));
    expect(await client.findings()).toEqual([expect.objectContaining({
      code: 'missing_target',
      node_type: 'cultivar',
      node_id: 'rou-gui',
      severity: 'broken',
      title: 'Relation target is missing',
    })]);
  });

  it('normalizes live D1 related rows into public article links and safe tea display', async () => {
    const client = createWisdomRelationsApi(async () => ({
      writings: [{ slug: 'rou-gui', title: 'Rou Gui', subtitle: 'A field note' }],
      teas: [{ id: 'tea-1', slug: '2024-rou-gui', name: '2024 Rou Gui', type: 'oolong', origin_region: 'Wuyi' }],
    }));
    expect(await client.publicRelated({ nodeType: 'cultivar', nodeId: 'rou-gui' })).toEqual({
      writings: [{ id: 'rou-gui', title: 'Rou Gui', href: '/article/rou-gui', excerpt: 'A field note', author_name: null }],
      teas: [{ id: 'tea-1', name: '2024 Rou Gui', href: null, image_url: null, detail: 'oolong · Wuyi' }],
    });
  });

  it('keeps every node identity type-scoped', () => {
    expect(nodeTypeForHolding('cultivars')).toBe('cultivar');
    expect(nodeTypeForHolding('varieties')).toBe('tea_type');
    expect(holdingIdForNodeType('named_tea')).toBe('named-teas');
  });

  it('distinguishes approved, proposed, and broken relations', () => {
    expect(relationDisplayState(relation())).toBe('approved');
    expect(relationDisplayState(relation({ review_status: 'proposed' }))).toBe('proposed');
    expect(relationDisplayState(relation({ target_state: 'missing' }))).toBe('broken');
  });

  it('offers only relationship kinds accepted for each target type', () => {
    expect(legalRelationshipKinds('article')).toEqual(['supports', 'mentions']);
    expect(legalRelationshipKinds('tea_profile')).toEqual(['illustrates', 'mentions', 'is_example_of']);
    expect(legalRelationshipKinds('product_tasting')).toEqual(['supports', 'illustrates']);
  });

  it('finds relation targets by human name before exposing their stable id', () => {
    const options = [
      { id: 'article-1', label: 'Rou Gui in Wuyi' },
      { id: 'article-2', label: 'A guide to Shui Xian' },
    ];
    expect(filterRelationTargetOptions(options, 'rou gui')).toEqual([options[0]]);
    expect(filterRelationTargetOptions(options, 'article-2')).toEqual([options[1]]);
  });

  it('keeps same-slug Wisdom targets scoped to the selected node type', () => {
    const options = [
      { id: 'wuyi', label: 'Wuyi cultivar', subtype: 'cultivar' as const },
      { id: 'wuyi', label: 'Wuyi region', subtype: 'region' as const },
    ];
    expect(filterRelationTargetOptions(options, 'wuyi', 'region')).toEqual([options[1]]);
  });

  it('explains the repair path when a name-first target source is unavailable', () => {
    expect(relationTargetGuidance('tea_profile')).toContain('Catalog');
    expect(relationTargetGuidance('promoted_tasting_note')).toContain('review queue');
  });

  it('shows complete admin relation state without treating private journals as targets', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WisdomRelationsPanelView
          identity={{ nodeType: 'cultivar', nodeId: 'rou-gui' }}
          relations={[
            relation(),
            relation({ id: 'rel-2', review_status: 'proposed', target_label: 'A proposed essay' }),
            relation({ id: 'rel-3', target_state: 'missing', target_label: null, target_href: null }),
          ]}
          override={null}
          canEdit={false}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Supporting material');
    expect(html).toContain('Approved');
    expect(html).toContain('Proposed');
    expect(html).toContain('Broken');
    expect(html).not.toMatch(/journal/i);
  });

  it('states who receives a proposal and why it is not public yet', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WisdomRelationsPanelView
          identity={{ nodeType: 'cultivar', nodeId: 'rou-gui' }}
          relations={[relation({ review_status: 'proposed' })]}
          override={null}
          canEdit
          canApprove={false}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('platform editorial review');
    expect(html).toContain('not public until approved');
  });

  it('gives every integrity finding a concrete destination or an explicit manual next step', () => {
    expect(findingResolution({ node_type: 'cultivar', node_id: 'rou-gui', href: null })).toEqual({ kind: 'node' });
    expect(findingResolution({ node_type: null, node_id: null, href: '/admin/articles/article-1' })).toEqual({ kind: 'link', href: '/admin/articles/article-1' });
    expect(findingResolution({ node_type: null, node_id: null, href: null })).toEqual({ kind: 'manual' });
  });

  it('routes finding repairs to admin tools instead of public content', () => {
    expect(findingAdminHref({ target_type: 'article', target_id: 'article-1', href: '/article/public-slug' })).toBe('/admin/magazine');
    expect(findingAdminHref({ target_type: 'tea_profile', target_id: 'profile-1', href: null })).toBe('/admin/catalog');
    expect(findingAdminHref({ target_type: 'product_tasting', target_id: 'tea-1', href: null })).toBe('/admin/stock?panel=tea-1');
  });
});

describe('public Wisdom related material', () => {
  it('renders only the public-safe writings and teas supplied by the public contract', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WisdomRelatedMaterialView
          writings={[{ id: 'a1', title: 'Rou Gui in Wuyi', href: '/read/rou-gui', excerpt: 'A field note.' }]}
          teas={[{ id: 't1', name: '2024 Rou Gui', href: '/tea/2024-rou-gui', image_url: null, detail: 'Wuyi oolong' }]}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Related reading');
    expect(html).toContain('Teas that illustrate this');
    expect(html).toContain('/read/rou-gui');
    expect(html).toContain('/tea/2024-rou-gui');
  });

  it('renders nothing when no approved public-safe material exists', () => {
    expect(renderToStaticMarkup(<WisdomRelatedMaterialView writings={[]} teas={[]} />)).toBe('');
  });

  it('preserves an additive public-state response for the page gate', async () => {
    const client = createWisdomRelationsApi(async () => ({ public_state: 'hidden', writings: [], teas: [] }));
    expect(await client.publicRelated({ nodeType: 'cultivar', nodeId: 'rou-gui' })).toEqual({
      public_state: 'hidden',
      writings: [],
      teas: [],
    });
  });

  it('loads page visibility from the dedicated fail-closed state contract', async () => {
    const calls: string[] = [];
    const client = createWisdomRelationsApi(async path => { calls.push(path); return { public_state: 'hidden', is_public: false }; });
    expect(await client.publicState({ nodeType: 'cultivar', nodeId: 'rou-gui' })).toEqual({ public_state: 'hidden', is_public: false });
    expect(calls).toEqual(['/api/public/wisdom/cultivar/rou-gui/state']);
  });

  it('normalizes every current finding code into an explained queue item', async () => {
    const client = createWisdomRelationsApi(async () => ({ findings: [
      { kind: 'missing_visible_tea', node_type: 'cultivar', node_id: 'rou-gui' },
      { kind: 'ambiguous_product', target_id: 'tea-1' },
      { kind: 'unmappable_article_product', target_type: 'article', target_id: 'article-1' },
    ] }));
    const findings = await client.findings();
    expect(findings.map(item => item.title)).toEqual([
      'Node lacks a visible tea example',
      'Product maps to more than one canonical tea',
      'Article product link cannot reach a canonical tea',
    ]);
    expect(findings.every(item => item.detail.length > 0)).toBe(true);
  });

  it('shows a retryable public error instead of making failure look empty', () => {
    const html = renderToStaticMarkup(<WisdomRelatedMaterialError onRetry={() => {}} />);
    expect(html).toContain('Related material could not be loaded');
    expect(html).toContain('Try again');
  });

  it('fails closed with a neutral retry screen when node visibility cannot be checked', () => {
    const html = renderToStaticMarkup(<WisdomStateUnavailableNotice onRetry={() => {}} />);
    expect(html).toContain('Wisdom entry cannot be checked');
    expect(html).toContain('Try again');
    expect(html).not.toContain('Related reading');
  });

  it('withholds a hidden Wisdom entry rather than only hiding its relations', () => {
    const html = renderToStaticMarkup(<MemoryRouter><WisdomHiddenEntryNotice /></MemoryRouter>);
    expect(html).toContain('This Wisdom entry is not public');
    expect(html).toContain('/wisdom');
  });
});
