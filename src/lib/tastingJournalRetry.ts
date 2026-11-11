/**
 * A failed journal push used to wait until the journal changed again, so a
 * tasting saved offline could sit unsent for as long as nothing else was
 * touched. The retry runs when the browser comes back online and when the tab
 * regains focus, through this gate:
 *
 * - a signed-out guest never reaches the server (their journal stays local);
 * - nothing is sent when no entry is waiting, so a retry that succeeded is
 *   not repeated;
 * - while one retry is running, another trigger joins it instead of starting
 *   a second.
 */
export interface JournalRetryDeps {
  isSignedIn: () => boolean;
  hasPending: () => boolean;
  push: () => Promise<unknown>;
}

export function createJournalRetry(deps: JournalRetryDeps): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    if (running) return running;
    if (!deps.isSignedIn() || !deps.hasPending()) return Promise.resolve();
    running = (async () => {
      try {
        await deps.push();
      } catch {
        // The entries stay unsynced; the next trigger tries again.
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
