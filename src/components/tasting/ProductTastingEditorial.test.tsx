import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProductTastingEditorial } from './ProductTastingEditorial';
import { HIT_AREA, NUMERAL, LABEL, BODY } from '../shared/typeRoles';

const html = (ui: React.ReactNode) =>
  renderToStaticMarkup(<MemoryRouter>{ui}</MemoryRouter>);

describe('the product page sensory slot', () => {
  it('freeform terms render in the same slot, lowercase, unlinked, with an attribution', () => {
    const out = html(<ProductTastingEditorial freeform={['Stone Fruit', ' Honeyed ']} source="record" />);
    expect(out).toContain('stone fruit');
    expect(out).toContain('honeyed');
    expect(out).toContain('Written on the record');
    expect(out).not.toContain('<a ');
  });

  it('a resolved tasting still links out and signs itself', () => {
    const out = html(<ProductTastingEditorial tasting={{ feeling: ['calm'] }} source="owner" />);
    expect(out).toContain('Tasted by Adrian');
  });

  it('labels common terms as potential rather than owner tasting', () => {
    const out = html(<ProductTastingEditorial tasting={{ flavor: ['honey'] }} source="common" />);
    expect(out).toContain('Potential profile');
    expect(out).not.toContain('Adrian');
  });

  it('labels exact-lot terms as source-described rather than potential or owner', () => {
    const out = html(<ProductTastingEditorial tasting={{ flavor: ['honey'] }} source="source" />);
    expect(out).toContain('Source-described profile');
    expect(out).not.toContain('Potential profile');
    expect(out).not.toContain('Adrian');
  });

  it('renders nothing when it has neither', () => {
    expect(html(<ProductTastingEditorial source="record" />)).toBe('');
  });

  it('the numeral role carries no size of its own', () => {
    expect(NUMERAL).not.toMatch(/text-/);
    expect(HIT_AREA).toContain('after:-top-6');
    expect(LABEL).toContain('text-ui-11');
    expect(BODY).toContain('text-ui-15');
  });
});
