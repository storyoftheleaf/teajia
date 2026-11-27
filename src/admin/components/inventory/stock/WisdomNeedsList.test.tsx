import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import WisdomNeedsList from './WisdomNeedsList';
import type { Product } from '../../../types';

const tea = (overrides: Partial<Product>) => ({
  id: 'bull', type: 'Shou Puer', productName: 'Golden Bull Hengfengyuan Shou Cha', givenName: 'Golden Bull Hengfengyuan Shou Cha',
  originRegion: 'Yunnan', originCountry: 'China', ...overrides,
}) as Product;

describe('the tea’s Wisdom Base list', () => {
  it('names what is written and what is a record only, in plain words', () => {
    const html = renderToStaticMarkup(<WisdomNeedsList product={tea({})} />);
    expect(html).toContain('2 still to write before its entry is composed.');
    expect(html).toContain('Hengfengyuan');
    expect(html).toContain('Producer');
    expect(html).toContain('Record only');
    expect(html).toContain('Written');
  });

  it('shows nothing for teaware', () => {
    expect(renderToStaticMarkup(<WisdomNeedsList product={tea({ type: 'Teaware' as Product['type'] })} />)).toBe('');
  });
});
