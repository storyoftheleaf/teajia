import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TeaReferencePreview from './TeaReferencePreview';
import type { PublicReferencePreview } from '../../wisdom/receiving/previewImporter';

const data: PublicReferencePreview = {
  title: 'Pu’er reference',
  deck: 'A cited guide to tea families, styles, and growing places.',
  sourceCount: 2,
  entryCount: 1,
  sections: [
    {
      id: 'tea_area',
      label: 'Tea areas',
      description: 'Producing areas kept distinct from mountains and villages.',
      entries: [
        {
          id: 'RESOLUTION-YIWU',
          label: 'Greater Yiwu',
          entityKind: 'tea_area',
          kindLabel: 'Tea area',
          statements: [
            {
              id: 'CLAIM-COMMON',
              label: 'Common characteristics',
              text: 'One cited source describes characteristics associated with Greater Yiwu. These are broad reference notes, not a description of any particular lot.',
              excerpt: 'Yiwu is often described as having a softer base.',
              citation: {
                label: 'TeaDB, Pu’erh Regions: Greater Yiwu (2014)',
                url: 'https://teadb.org/mengla-county-yiwu/',
              },
            },
          ],
          reportUrl: 'mailto:hello@teajia.com?subject=Report%20an%20inaccuracy%3A%20Greater%20Yiwu',
        },
      ],
    },
  ],
  geographicScale: [
    { id: 'major_region', label: 'Major regions', count: 0 },
    { id: 'tea_area', label: 'Tea areas', count: 1 },
    { id: 'mountain', label: 'Mountains', count: 0 },
    { id: 'village', label: 'Villages', count: 0 },
  ],
  sources: [
    {
      sourceId: 'teadb',
      publisher: 'TeaDB',
      publisherRoleLabel: 'Specialist editorial',
      title: 'Pu’erh Regions: Greater Yiwu',
      author: 'James',
      publishedDate: '2014-09-13T07:00:00.000Z',
      url: 'https://teadb.org/mengla-county-yiwu/',
    },
  ],
  reportUrl: 'mailto:hello@teajia.com?subject=Report%20an%20inaccuracy%3A%20Tea%20Reference',
};

describe('local public reference preview', () => {
  it('renders ordinary cited language, geographic scale, and an inaccuracy action', () => {
    const html = renderToString(<TeaReferencePreview data={data} />);

    expect(html).toContain('Pu’er reference');
    expect(html).toContain('Common characteristics');
    expect(html).toContain('Major regions');
    expect(html).toContain('Tea areas');
    expect(html).toContain('Mountains');
    expect(html).toContain('Villages');
    expect(html).toContain('Report an inaccuracy');
    expect(html).toContain('TeaDB');
    expect(html).toContain('13 September 2014');
    expect(html).not.toContain('T07:00:00');
  });

  it('does not render private workflow language', () => {
    const html = renderToString(<TeaReferencePreview data={data} />);
    expect(html).not.toMatch(/held|private verification|candidate|assimilat|approval/i);
  });
});
