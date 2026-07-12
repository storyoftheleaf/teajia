import { describe, expect, it } from 'vitest';
import { buildEventArticleDraft } from '../src/eventArticleDraft';

describe('event article draft builder', () => {
  it('builds a private draft only from supplied event and post-session material', () => {
    const draft = buildEventArticleDraft(
      { id: 'e1', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain' },
      {
        session_notes: 'A quiet table that opened slowly.',
        energy: 'contemplative',
        gallery_images: JSON.stringify(['https://media.teajia.co/a.jpg']),
        shared_tasting_notes: 'Warm rock and longan',
        tea_ledger: JSON.stringify([{ name: 'Rou Gui', notes: 'Charcoal and cassia.' }]),
      },
    );

    expect(draft).toMatchObject({
      title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain', status: 'draft',
      category: 'Field Notes', layout_template: 'immersive_scroll',
      cover_image_url: 'https://media.teajia.co/a.jpg',
    });
    expect(draft.blocks).toEqual([
      { type: 'cover', title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain', image: 'https://media.teajia.co/a.jpg', kicker: 'contemplative' },
      { type: 'intro', text: 'A quiet table that opened slowly.' },
      { type: 'section_heading', text: 'Rou Gui' },
      { type: 'paragraph', text: 'Charcoal and cassia.' },
      { type: 'image', url: 'https://media.teajia.co/a.jpg', description: '' },
      { type: 'quote', text: 'Warm rock and longan' },
    ]);
  });

  it('defensively ignores malformed galleries and does not invent missing prose', () => {
    const draft = buildEventArticleDraft(
      { id: 'e2', title: 'Silent Table', subtitle: null },
      { gallery_images: '{bad', tea_ledger: '[{"name":"Tea without notes"}]', shared_tasting_notes: '[]' },
    );
    expect(draft.cover_image_url).toBeNull();
    expect(draft.blocks).toEqual([{ type: 'cover', title: 'Silent Table' }]);
  });

  it('preserves supplied media URLs without validating them against a third-party host', () => {
    const draft = buildEventArticleDraft(
      { id: 'e3', title: 'Local Archive' },
      { gallery_images: ['https://uploads.example.test/owned/event.jpg'] },
    );
    expect(draft.cover_image_url).toBe('https://uploads.example.test/owned/event.jpg');
  });
});
