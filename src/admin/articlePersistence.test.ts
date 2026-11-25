import { describe, expect, it, vi } from 'vitest';
import type { ArticleDraftInput, ReviewedDbArticle } from '../types';
import { createArticlePersistence } from './articlePersistence';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const reviewed = (id: string, review_digest: string) => ({ id, review_digest } as ReviewedDbArticle);

describe('article editor write ordering', () => {
  it('creates once when manual and timed saves overlap, then writes the latest draft', async () => {
    const createResponse = deferred<ReviewedDbArticle>();
    const calls: string[] = [];
    const writes = {
      create: vi.fn(async (draft: ArticleDraftInput) => {
        calls.push(`create:${draft.title}`);
        return createResponse.promise;
      }),
      update: vi.fn(async (_id: string, draft: ArticleDraftInput) => {
        calls.push(`update:${draft.title}`);
        return reviewed('article-1', `saved:${draft.title}`);
      }),
      publish: vi.fn(async () => reviewed('article-1', 'published')),
      unpublish: vi.fn(async () => reviewed('article-1', 'published')),
    };
    const editor = createArticlePersistence(null, writes);
    const first = editor.save({ title: 'First draft', status: 'draft' });
    const second = editor.save({ title: 'Latest draft', status: 'draft' });
    await Promise.resolve();
    expect(writes.create).toHaveBeenCalledTimes(1);
    expect(writes.update).not.toHaveBeenCalled();

    createResponse.resolve(reviewed('article-1', 'created'));
    expect(await Promise.all([first, second])).toEqual(['article-1', 'article-1']);
    expect(calls).toEqual(['create:First draft', 'update:Latest draft']);
    expect(writes.update).toHaveBeenCalledWith('article-1', { title: 'Latest draft' }, 'created');
  });

  it('waits for an older save, writes the latest content, then publishes without a status-bearing autosave', async () => {
    const olderSave = deferred<ReviewedDbArticle>();
    const calls: string[] = [];
    const writes = {
      create: vi.fn(async () => reviewed('article-1', 'created')),
      update: vi.fn(async (_id: string, draft: ArticleDraftInput) => {
        calls.push(`update:${draft.title}:${String(draft.status)}`);
        if (draft.title === 'Older content') return olderSave.promise;
        return reviewed('article-1', `saved:${draft.title}`);
      }),
      publish: vi.fn(async () => { calls.push('publish'); return reviewed('article-1', 'published'); }),
      unpublish: vi.fn(async () => { calls.push('unpublish'); return reviewed('article-1', 'withdrawn'); }),
    };
    const editor = createArticlePersistence(reviewed('article-1', 'opened'), writes);
    const save = editor.save({ title: 'Older content', status: 'draft' });
    const publish = editor.setPublished({ title: 'Latest content', status: 'draft' }, true);
    await Promise.resolve();
    expect(calls).toEqual(['update:Older content:undefined']);
    expect(writes.publish).not.toHaveBeenCalled();

    olderSave.resolve(reviewed('article-1', 'saved:Older content'));
    await Promise.all([save, publish]);
    expect(calls).toEqual([
      'update:Older content:undefined',
      'update:Latest content:undefined',
      'publish',
    ]);
    expect(writes.publish).toHaveBeenCalledWith('article-1', 'saved:Latest content');
    await editor.save({ title: 'Edit after publish', status: 'published' });
    expect(writes.update).toHaveBeenLastCalledWith('article-1', { title: 'Edit after publish' }, 'published');
    expect(calls.at(-1)).toBe('update:Edit after publish:undefined');
  });
});
