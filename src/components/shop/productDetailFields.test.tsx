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

  it('replaces the reviewed lot’s disputed prose on both surfaces while retaining independently recorded fields', () => {
    const tea = { ...item, name: 'Y562', id: 'cb7efd7b-9da6-4dc8-be76-3c7e69bdb02e',
      lore: "The Y562 is a named export recipe from Yunnan's state tea trade house, not an anonymous cake. In old puerh coding the Y prefix marks it as the Yunnan Tea Import and Export Company, and Jixing, meaning fortune, was their export brand. The number itself is shorthand for leaf grade and factory. Grade 5 to 6 points to fine tender leaf, in contrast to the coarse ripe bricks of the same period.",
      terroir: "The leaf comes from Menghai, a warm humid county in southern Yunnan near the Burma and Laos borders. This is the historic home of large-leaf puerh, where old tea plants grow in red iron-rich soil. The climate is hot in summer and mild in winter, which suits the thick fleshy leaves that puerh needs.",
      processingNotes: "Ripe puerh is made by wo dui, a wet piling step developed in the early 1970s where damp leaves are heaped and turned so microbes speed up the ageing. Rather than pressed into a cake, this lot was kept loose in a 100 gram box, then aged in Hong Kong dry storage from around 1993, a steady climate that lets the tea settle cleanly. Ripe puerh of this age drinks dark, smooth, and thick in the mouth.",
      experience: 'Separately recorded experience' };
    for (const surface of ['card', 'page'] as const) {
      const text = teaReading(tea, surface).sections.flatMap(section => section.paragraphs);
      expect(text).toEqual([item.description, tea.experience]);
      expect(teaReading({ ...tea, lore: '  ' + tea.lore.replace(/ /g, '\n') + '  ',
        terroir: 'Newly confirmed origin' }, surface).sections.flatMap(section => section.paragraphs))
        .toEqual([item.description, 'Newly confirmed origin', tea.experience]);
      expect(teaReading({ ...tea, id: 'different-lot' }, surface).sections.flatMap(section => section.paragraphs))
        .toEqual([item.description, tea.lore, tea.terroir, tea.processingNotes, tea.experience]);
    }
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
