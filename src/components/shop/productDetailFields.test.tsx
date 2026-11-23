import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../types';
import { AlcoveAboutSection } from './alcove/AlcoveAboutSection';
import { productGallery, teaReading, teawareFacts, teawareReading } from './productDetailFields';

const item: InventoryItem = {
  id: 'test', category: 'tea', type: 'Shou', name: 'Test', variant: '', year: '', origin: '',
  stock_g: 0, cost_price: '0', description: 'Introduction text', tags: [], image: '/one.jpg',
  additionalImages: ['/two.jpg', '/three.jpg', '/four.jpg'],
};

describe('product fields on the page and quick view', () => {
  it('preserves the quick view chapters and gallery while the page separates the style reference', () => {
    const tea = { ...item, lore: 'Origin story', terroir: 'From this place', processingNotes: 'Process\n## Style aroma reference\nCited style detail' };
    const card = renderToStaticMarkup(<AlcoveAboutSection reading={teaReading(tea, 'card')} />);
    const page = renderToStaticMarkup(<AlcoveAboutSection reading={teaReading(tea, 'page')} variant="page" />);
    for (const text of ['Introduction text', 'Origin story', 'From this place', 'Cited style detail']) {
      expect(card).toContain(text);
      expect(page).toContain(text);
    }
    expect(card).toContain('Style aroma reference');
    expect(page).toContain('Flavor &amp; Aroma Profile');
    expect(productGallery(tea, 'card').allImages).toHaveLength(3);
    expect(productGallery(tea, 'page').allImages).toHaveLength(4);
  });

  it('maps vessel data into the same reading component and carries the originating shop into suggested teas', () => {
    const ware: InventoryItem = { ...item, category: 'ware', form: 'Hexagonal', material: 'Unknown',
      teawareDetails: { mark: 'Incised characters', recommended_tea_type: 'Oolong', clay_history: 'Clay history text' } };
    expect(teawareFacts(ware).filter(fact => fact.value).map(fact => fact.label)).toEqual(['Form', 'Mark']);
    const page = renderToStaticMarkup(<MemoryRouter><AlcoveAboutSection reading={teawareReading(ware, 'fixture-shop')} variant="page" /></MemoryRouter>);
    expect(page).toContain('Clay history text');
    expect(page).toContain('/shop?type=Oolong&amp;store=fixture-shop');
    expect(page).not.toContain('Flavor &amp; Aroma Profile');
  });
});
