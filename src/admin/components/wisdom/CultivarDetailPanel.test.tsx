import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CultivarStory } from '../../../wisdom';
import { CultivarStoryMonograph, EditorialRecord } from './CultivarDetailPanel';

const story: CultivarStory = {
  description: 'A balanced Wuyi cultivar with a refined floral character.',
  plantType: 'A traditional clonal cultivar selected in the Wuyi Mountains.',
  environment: 'Grown among the rocky slopes of the Wuyi reserve.',
  processing: 'Traditionally bruised, oxidized, rolled, and roasted.',
  oxidation: 'Moderate oxidation.',
  roasting: 'A measured charcoal roast.',
  versatility: 'Specialized for Wuyi rock oolong.',
  sensory: {
    aroma: 'Orchid and warm stone.',
    flavor: 'Floral sweetness with mineral depth.',
    mouthfeel_liquor: 'Silky and resonant.',
  },
  distribution: { china: ['Wuyi Mountains'] },
  expressions: {
    Oolong: { 'Ban Tian Yao Yancha': 'A traditional rock oolong expression.' },
  },
};

describe('Cultivar editorial monograph', () => {
  it('groups research into reader-facing chapters rather than an equal card grid', () => {
    const html = renderToStaticMarkup(<CultivarStoryMonograph story={story} />);

    const chapters = ['The plant', 'Where it grows', 'In the cup', 'Grown and made', 'The teas'];
    for (const chapter of chapters) expect(html).toContain(chapter);
    for (let index = 1; index < chapters.length; index += 1) {
      expect(html.indexOf(chapters[index - 1])).toBeLessThan(html.indexOf(chapters[index]));
    }
    expect(html).toContain('Aroma');
    expect(html).toContain('Ban Tian Yao Yancha');
    expect(html).not.toContain('lg:grid-cols-3');
  });

  it('renders the record as a quiet definition list with linked values left unboxed', () => {
    const html = renderToStaticMarkup(
      <EditorialRecord
        facts={[
          { label: 'Type', value: 'Oolong' },
          { label: 'Place', value: <button type="button">Wuyi Mountains</button> },
          { label: 'Country', value: 'China' },
        ]}
      />,
    );

    expect(html).toContain('data-testid="wisdom-editorial-record"');
    expect(html).toContain('<dt');
    expect(html).toContain('<dd');
    expect(html).toContain('<button type="button">Wuyi Mountains</button>');
    expect(html).not.toContain('rounded-md bg-tea-accent-sub');
  });
});
