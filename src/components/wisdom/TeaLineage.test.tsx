import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  TeaLineage,
  cultivarPath,
  lineageFacts,
  openingLine,
  resolveLineage,
  type TeaLineageProduct,
} from './TeaLineage';
import { findCultivarById, findRegion, type Cultivar } from '../../wisdom';

const product = (overrides: Partial<TeaLineageProduct> = {}): TeaLineageProduct => ({
  name: '',
  ...overrides,
});

const cultivar = (overrides: Partial<Cultivar> = {}): Cultivar => ({
  id: 'test',
  name: 'Test',
  altNames: [],
  ...overrides,
});

describe('resolveLineage', () => {
  it('resolves a directly recorded cultivar id first', () => {
    const { cultivar } = resolveLineage(product({ name: 'House blend', cultivar: 'rou-gui' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('falls back to matching the stored cultivar string when it is not a known id', () => {
    const { cultivar } = resolveLineage(product({ name: 'House blend', cultivar: 'Rou Gui' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('matches the cultivar from the product name when none is recorded directly', () => {
    const { cultivar } = resolveLineage(product({ name: '2019 Rou Gui Yancha' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('matches the cultivar from the Chinese name when the English name is unfamiliar', () => {
    const { cultivar } = resolveLineage(product({ name: 'House oolong', chineseName: '肉桂' }));
    expect(cultivar?.name).toBe('Rou Gui');
  });

  it('never guesses: returns a null cultivar rather than an approximate one', () => {
    const { cultivar } = resolveLineage(product({ name: 'Unlabelled bag from the market' }));
    expect(cultivar).toBeNull();
  });

  it('resolves the growing region from the product origin independently of the cultivar', () => {
    const { region } = resolveLineage(product({ name: 'Some tea', origin: 'Wuyi Mountains' }));
    expect(region?.altitude).toBe('200-800m');
  });

  it('leaves the region null when the recorded origin is not a known place', () => {
    const { region } = resolveLineage(product({ name: 'Some tea', origin: 'Nowhere in particular' }));
    expect(region).toBeNull();
  });
});

describe('openingLine', () => {
  it('is blank when there is no story', () => {
    expect(openingLine(undefined)).toBe('');
    expect(openingLine('   ')).toBe('');
  });

  it('keeps a short description whole rather than cutting it to a fragment', () => {
    const short = "'Cassia/Cinnamon'. A top-tier Wuyi Rock Oolong prized for its pronounced spicy aroma.";
    expect(openingLine(short)).toBe(short);
  });

  it('reads past the opening name gloss instead of stopping at it', () => {
    const line = openingLine(`'Jade'. ${'A cultivar bred in Taiwan. '.repeat(12)}`);
    expect(line.startsWith("'Jade'. A cultivar")).toBe(true);
    expect(line.length).toBeGreaterThan(60);
  });

  it('stops on a sentence boundary and never runs to an essay', () => {
    const line = openingLine(`${'Nine words of prose that carry the reader along. '.repeat(20)}`);
    expect(line.endsWith('.')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(190);
  });

  it('gives every cultivar story an opening worth the space it takes', async () => {
    const stories = (await import('../../wisdom/stories/cultivars.json')).default as Record<
      string,
      { description: string }
    >;
    const thin = Object.entries(stories)
      .map(([id, story]) => [id, openingLine(story.description)] as const)
      .filter(([, line]) => line.length < 40);
    expect(thin).toEqual([]);
  });
});

describe('lineageFacts', () => {
  it('has nothing to say without a plant', () => {
    expect(lineageFacts(null, null)).toEqual([]);
  });

  it('is empty for a plant the base knows only by name, so the block will not offer to expand', () => {
    expect(lineageFacts(cultivar(), null)).toEqual([]);
  });

  it('reads the plant and the place independently', () => {
    const facts = lineageFacts(findCultivarById('rou-gui'), findRegion('Wuyi Mountains'));
    expect(facts.map(fact => fact.label)).toContain('Altitude');
    expect(facts.find(fact => fact.label === 'Altitude')?.value).toBe('200-800m');
  });

  it('lists short values first so the two-column grid pairs without a hole', () => {
    const facts = lineageFacts(
      cultivar({
        parentage: 'A long recorded breeding lineage that will not fit in a single narrow column.',
        developedYear: 1981,
        altNames: ['Short name'],
      }),
      null,
    );
    expect(facts.map(fact => fact.label)).toEqual(['Developed', 'Also called', 'Bred from']);
  });

  it('omits every field the record does not carry', () => {
    const facts = lineageFacts(cultivar({ developedYear: 1981 }), null);
    expect(facts).toEqual([{ label: 'Developed', value: '1981' }]);
  });
});

const render = (input: TeaLineageProduct) =>
  renderToString(
    <MemoryRouter>
      <TeaLineage product={input} />
    </MemoryRouter>,
  );

describe('the lineage block on a product page', () => {
  it('sends the plant name to the plant s own public page', () => {
    const html = render(product({ name: '2019 Rou Gui Yancha' }));
    expect(html).toContain(`href="${cultivarPath('rou-gui')}"`);
    expect(html).toContain('Rou Gui');
  });

  it('names the plant in both scripts, each unbreakable, so 390px wraps between them', () => {
    const html = render(product({ name: 'House oolong', chineseName: '肉桂' }));
    expect(html).toContain('肉桂');
    // Two nowrap spans, not one: the Chinese name can never break against the
    // Latin name, and neither is wide enough on its own to overflow 358px.
    expect((html.match(/whitespace-nowrap/g) ?? []).length).toBe(2);
  });

  it('renders nothing at all when the plant cannot be resolved', () => {
    expect(render(product({ name: 'Unlabelled bag from the market' }))).toBe('');
  });

  it('never nests the link inside a control, so both stay operable', () => {
    const html = render(product({ name: '2019 Rou Gui Yancha' }));
    expect(/<button[^>]*>[\s\S]*<a\s/.test(html)).toBe(false);
  });
});
