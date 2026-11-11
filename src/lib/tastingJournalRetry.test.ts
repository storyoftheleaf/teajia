import { describe, expect, it, vi } from 'vitest';
import { createJournalRetry } from './tastingJournalRetry';

describe('retrying a failed journal push', () => {
  it('two triggers while a retry is running start only one push', async () => {
    let finish!: () => void;
    const push = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const retry = createJournalRetry({ isSignedIn: () => true, hasPending: () => true, push });

    const first = retry();
    const second = retry();
    expect(push).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);

    retry();
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('a signed-out guest never calls the server', async () => {
    const push = vi.fn(async () => {});
    const retry = createJournalRetry({ isSignedIn: () => false, hasPending: () => true, push });

    await retry();

    expect(push).not.toHaveBeenCalled();
  });

  it('a failed push is tried again on the next trigger and stops once it succeeds', async () => {
    let pending = true;
    const push = vi.fn()
      .mockImplementationOnce(async () => { throw new Error('offline'); })
      .mockImplementationOnce(async () => { pending = false; });
    const retry = createJournalRetry({ isSignedIn: () => true, hasPending: () => pending, push });

    await retry();
    expect(pending).toBe(true);
    await retry();
    expect(pending).toBe(false);
    await retry();

    expect(push).toHaveBeenCalledTimes(2);
  });
});
