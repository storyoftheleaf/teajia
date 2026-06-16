// src/lib/articleRenderMode.test.ts
import { describe, it, expect } from 'vitest';
import { getArticleRenderMode } from './articleRenderMode';

describe('getArticleRenderMode', () => {
  it('returns immersive_scroll when layout_template is immersive_scroll', () => {
    expect(getArticleRenderMode({ layout_template: 'immersive_scroll' } as any)).toBe('immersive_scroll');
  });
  it('defaults to carousel_4x5 when layout_template is missing', () => {
    expect(getArticleRenderMode({} as any)).toBe('carousel_4x5');
  });
  it('defaults to carousel_4x5 for any legacy template value', () => {
    expect(getArticleRenderMode({ layout_template: 'magazine' } as any)).toBe('carousel_4x5');
  });
});
