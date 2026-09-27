import { describe, expect, it, vi } from 'vitest';
import type { DbArticle } from '../types';
import { createArticlePersistence } from './articlePersistence';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('article editor write ordering', () => {
  it('creates once when manual and timed saves overlap, then writes the latest draft', async () => {
    const createResponse = deferred<DbArticle>();
    const calls: string[] = [];
    const writes = {
      create: vi.fn(async (draft: Partial<DbArticle>) => {
        calls.push(`create:${draft.title}`);
        return createResponse.promise;
      }),
      update: vi.fn(async (_id: string, draft: Partial<DbArticle>) => {
        calls.push(`update:${draft.title}`);
        return {} as DbArticle;
      }),
      publish: vi.fn(async () => ({})),
      unpublish: vi.fn(async () => ({})),
    };
    const editor = createArticlePersistence(null, writes);
    const first = editor.save({ title: 'First draft', status: 'draft' });
    const second = editor.save({ title: 'Latest draft', status: 'draft' });
    await Promise.resolve();
    expect(writes.create).toHaveBeenCalledTimes(1);
    expect(writes.update).not.toHaveBeenCalled();

    createResponse.resolve({ id: 'article-1' } as DbArticle);
    expect(await Promise.all([first, second])).toEqual(['article-1', 'article-1']);
    expect(calls).toEqual(['create:First draft', 'update:Latest draft']);
    expect(writes.update).toHaveBeenCalledWith('article-1', { title: 'Latest draft' });
  });

  it('waits for an older save, writes the latest content, then publishes without a status-bearing autosave', async () => {
    const olderSave = deferred<DbArticle>();
    const calls: string[] = [];
    const writes = {
      create: vi.fn(async () => ({ id: 'article-1' } as DbArticle)),
      update: vi.fn(async (_id: string, draft: Partial<DbArticle>) => {
        calls.push(`update:${draft.title}:${String(draft.status)}`);
        if (draft.title === 'Older content') return olderSave.promise;
        return {} as DbArticle;
      }),
      publish: vi.fn(async () => { calls.push('publish'); }),
      unpublish: vi.fn(async () => { calls.push('unpublish'); }),
    };
    const editor = createArticlePersistence('article-1', writes);
    const save = editor.save({ title: 'Older content', status: 'draft' });
    const publish = editor.setPublished({ title: 'Latest content', status: 'draft' }, true);
    await Promise.resolve();
    expect(calls).toEqual(['update:Older content:undefined']);
    expect(writes.publish).not.toHaveBeenCalled();

    olderSave.resolve({ id: 'article-1' } as DbArticle);
    await Promise.all([save, publish]);
    expect(calls).toEqual([
      'update:Older content:undefined',
      'update:Latest content:undefined',
      'publish',
    ]);
    await editor.save({ title: 'Edit after publish', status: 'published' });
    expect(writes.update).toHaveBeenLastCalledWith('article-1', { title: 'Edit after publish' });
    expect(calls.at(-1)).toBe('update:Edit after publish:undefined');
  });
});
