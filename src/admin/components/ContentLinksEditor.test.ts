import { describe, expect, it } from 'vitest';
import { articleEntityOptions } from './ContentLinksEditor';
import type { DbArticle } from '../../types';

const article = (id: string, status: DbArticle['status']): DbArticle => ({
  id,
  title: `Article ${id}`,
  slug: id,
  status,
  tags: [],
  blocks: [],
  created_at: '2026-08-10',
  updated_at: '2026-08-10',
});

describe('ContentLinksEditor live article options', () => {
  it('uses current D1 drafts and publications and excludes archived records', () => {
    expect(articleEntityOptions([article('draft', 'draft'), article('live', 'published'), article('old', 'archived')])).toEqual([
      { id: 'draft', label: 'Article draft' },
      { id: 'live', label: 'Article live' },
    ]);
  });
});
