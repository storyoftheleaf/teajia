import { describe, it, expect } from 'vitest';
import { labelScanNotes } from './labelScanNotes';

describe('the package scanner notes', () => {
  it('keeps every descriptive word the scanner read, and anything it adds unasked', () => {
    const notes = labelScanNotes({
      givenName: 'Lao Ban Zhang', type: 'Sheng', year: 2019,
      descriptors: ['ancient tree (古树)', 'honey aroma (蜜香)'],
      vendor: 'Chen Sheng Hao (陈升号)',
      productionDate: '2019年4月 = 2019-04',
      brewing: '8 g, 100°C, 10 s',
      labelTranslation: '古树 = ancient tree | 生茶 = raw tea',
      treeAge: '300 years',
      imageUrl: 'https://media.teajia.co/x.jpg',
    });
    expect(notes).toContain('Described as: ancient tree (古树), honey aroma (蜜香)');
    expect(notes).toContain('Producer: Chen Sheng Hao (陈升号)');
    expect(notes).toContain('Production date: 2019年4月 = 2019-04');
    expect(notes).toContain('Brewing: 8 g, 100°C, 10 s');
    expect(notes).toContain('Label: 古树 = ancient tree | 生茶 = raw tea');
    expect(notes).toContain('Tree age: 300 years');
    // Fields the form fills directly are not repeated in the notes.
    expect(notes).not.toContain('Lao Ban Zhang');
    expect(notes).not.toContain('media.teajia.co');
  });

  it('is empty when the scanner read nothing beyond the form fields', () => {
    expect(labelScanNotes({ givenName: 'Y562', type: 'Shou' })).toBe('');
  });
});
