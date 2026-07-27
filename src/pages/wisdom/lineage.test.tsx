/**
 * Guards the two ways a lineage can lie.
 *
 * Run with: npx vitest run src/pages/wisdom/lineage.test.tsx
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import CultivarIndexPage from './CultivarIndexPage';
import CultivarPage from './CultivarPage';
import { CULTIVARS } from '../../wisdom';
import { readLineage } from './LineageTree';

const render = (path: string) =>
  renderToString(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/wisdom" element={<CultivarIndexPage />} />
          <Route path="/wisdom/cultivar/:id" element={<CultivarPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('the public tea reference', () => {
  it('lists the plants', () => {
    const html = render('/wisdom');
    expect(html).toContain('The Tea Plants');
    expect(html).toContain('/wisdom/cultivar/jin-xuan');
  });

  it('answers for a name it does not hold', () => {
    expect(render('/wisdom/cultivar/nope')).toContain('Not a plant we hold');
  });

  it('does not break a name at the letter x', () => {
    // "(Jin Xuan x Qing Xin) x Cui Yu" once read as Jin / uan / Qing / in / Cui Yu,
    // because the cross separator also matched the x inside a name.
    const html = render('/wisdom/cultivar/chin-hsin');
    expect(html).toContain('/wisdom/cultivar/jin-xuan');
    expect(html).toContain('/wisdom/cultivar/qing-xin');
    expect(html).toContain('/wisdom/cultivar/cui-yu');
    expect(html).not.toContain('"name":"uan"');
  });

  it('does not link a breeding code to a plant that only shares its digits', () => {
    // TRES-2022 contains TRES #20, which is Ying Xiang. It is a different plant.
    const html = render('/wisdom/cultivar/cui-yu');
    expect(html).toContain('TRES-2022');
    expect(html).not.toMatch(/TRES-2022[\s\S]{0,400}wisdom\/cultivar\/ying-xiang/);
  });

  it('reads a lineage for every plant without inventing a parent', () => {
    for (const cultivar of CULTIVARS) {
      const lineage = readLineage(cultivar);
      if (lineage.kind === 'cross') expect(lineage.parents.length).toBeGreaterThan(0);
      else expect(lineage.parents).toHaveLength(0);
    }
  });
});
