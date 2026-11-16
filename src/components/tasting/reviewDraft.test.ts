import { describe, expect, it, vi } from 'vitest';
import { discardReviewDraft, emptyReviewDraft, startReviewDraft, submitReviewDraft } from './reviewDraft';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('the admin review draft', () => {
  it('a save made while the create is still in flight waits for it and then submits that draft', async () => {
    const draft = emptyReviewDraft();
    const created = deferred<{ id: string }>();
    const order: string[] = [];
    startReviewDraft(draft, () => created.promise);
    const submit = vi.fn(async (id: string) => { order.push(`submit ${id}`); });

    const saving = submitReviewDraft(draft, submit);
    await Promise.resolve();
    expect(submit).not.toHaveBeenCalled();
    order.push('created');
    created.resolve({ id: 'review-1' });

    await expect(saving).resolves.toBe(true);
    expect(order).toEqual(['created', 'submit review-1']);
    expect(draft.id).toBeNull();
  });

  it('a failed submit reaches the caller and keeps the draft so Retry submits it again', async () => {
    const draft = emptyReviewDraft();
    startReviewDraft(draft, async () => ({ id: 'review-1' }));
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});

    await expect(submitReviewDraft(draft, submit)).rejects.toThrow('offline');
    expect(draft.id).toBe('review-1');
    await expect(submitReviewDraft(draft, submit)).resolves.toBe(true);
    expect(submit).toHaveBeenNthCalledWith(2, 'review-1');
  });

  it('with no draft and no create there is nothing to submit', async () => {
    const submit = vi.fn();
    await expect(submitReviewDraft(emptyReviewDraft(), submit)).resolves.toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('a failed create leaves no draft and the save goes on without a submit', async () => {
    const draft = emptyReviewDraft();
    startReviewDraft(draft, async () => { throw new Error('offline'); });
    const submit = vi.fn();
    await expect(submitReviewDraft(draft, submit)).resolves.toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('a second change while the create is in flight does not start another create', () => {
    const draft = emptyReviewDraft();
    const create = vi.fn(() => new Promise<{ id: string }>(() => {}));
    startReviewDraft(draft, create);
    startReviewDraft(draft, create);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('closing before the create finishes still removes the draft once its id arrives', async () => {
    const draft = emptyReviewDraft();
    const created = deferred<{ id: string }>();
    startReviewDraft(draft, () => created.promise);
    const remove = vi.fn(async () => {});

    discardReviewDraft(draft, remove);
    expect(remove).not.toHaveBeenCalled();
    created.resolve({ id: 'review-1' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(remove).toHaveBeenCalledWith('review-1');
  });
});
