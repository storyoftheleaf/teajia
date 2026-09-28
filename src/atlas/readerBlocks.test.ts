import { describe, expect, it } from 'vitest';
import { pagesLabel, readingMinutes, tidyBlocks } from './readerBlocks';
import type { AtlasBlock } from './types';

describe('tidyBlocks', () => {
  it('drops the printed title when it only repeats the page title, and joins its Chinese fragments', () => {
    const blocks: AtlasBlock[] = [
      { t: 'page', n: 20 },
      { t: 'aside', v: '工' },
      { t: 'h', v: 'Gongfu &' },
      { t: 'aside', v: '夫' },
      { t: 'h', v: 'Wuyi Cliff Tea 岩 茶' },
      { t: 'p', v: 'We often hear…' },
    ];
    expect(tidyBlocks(blocks, 'Gongfu & Wuyi Cliff Tea')).toEqual([
      { t: 'page', n: 20 },
      { t: 'aside', v: '工夫' },
      { t: 'p', v: 'We often hear…' },
    ]);
  });

  it('keeps lead headings that say something the title does not', () => {
    const blocks: AtlasBlock[] = [{ t: 'h', v: 'A Letter' }, { t: 'p', v: 'Dear reader' }];
    expect(tidyBlocks(blocks, 'From the Editor')).toEqual(blocks);
  });

  it('joins a heading that wrapped in print into one', () => {
    const blocks: AtlasBlock[] = [
      { t: 'p', v: 'Text' },
      { t: 'h', v: 'Era One: “Gongfu tea” Refers' },
      { t: 'h', v: 'Specifically to Wuyi Cliff Teas' },
      { t: 'p', v: 'More' },
    ];
    expect(tidyBlocks(blocks, 'Anything')[1]).toEqual({ t: 'h', v: 'Era One: “Gongfu tea” Refers Specifically to Wuyi Cliff Teas' });
  });

  it('keeps only the later of two page markers in a row, and never loses text', () => {
    const blocks: AtlasBlock[] = [{ t: 'page', n: 3 }, { t: 'page', n: 4 }, { t: 'p', v: 'x' }, { t: 'img', src: 'a/b.jpg' }];
    expect(tidyBlocks(blocks, 'T')).toEqual([{ t: 'page', n: 4 }, { t: 'p', v: 'x' }, { t: 'img', src: 'a/b.jpg' }]);
  });
});

describe('labels', () => {
  it('reads minutes and pages plainly', () => {
    expect(readingMinutes(5057)).toBe(22);
    expect(readingMinutes(40)).toBe(1);
    expect(pagesLabel('19–28')).toBe('pages 19–28');
    expect(pagesLabel('5')).toBe('page 5');
    expect(pagesLabel('0')).toBe('');
  });
});
