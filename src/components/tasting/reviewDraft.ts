/**
 * The admin tasting keeps a live `tea_reviews` draft while it is open. Two
 * ways it went wrong: a save made while the draft's create was still in flight
 * skipped the submit (the id was not known yet), leaving a draft nobody
 * submits; and a submit that failed was swallowed, so the save reported
 * success over a review still marked draft. Closing during the create also
 * left the draft behind, because the clean-up ran before the id arrived.
 *
 * One draft per opened tasting, held by the component in a ref.
 */
export interface ReviewDraft {
  id: string | null;
  creating: Promise<string | null> | null;
}

export function emptyReviewDraft(): ReviewDraft {
  return { id: null, creating: null };
}

/** Starts the create once; a failed create leaves no draft. */
export function startReviewDraft(draft: ReviewDraft, create: () => Promise<{ id?: string } | null | undefined>): void {
  if (draft.id || draft.creating) return;
  const creating: Promise<string | null> = create()
    .then(review => {
      draft.id = typeof review?.id === 'string' ? review.id : null;
      return draft.id;
    })
    .catch(() => null)
    .finally(() => { if (draft.creating === creating) draft.creating = null; });
  draft.creating = creating;
}

/**
 * Submits the draft, first waiting for a create still in flight. A failed
 * submit throws and keeps the id, so the caller's Retry submits it again.
 * Returns whether there was a draft to submit.
 */
export async function submitReviewDraft(draft: ReviewDraft, submit: (id: string) => Promise<unknown>): Promise<boolean> {
  const id = draft.id ?? (draft.creating ? await draft.creating : null);
  if (!id) return false;
  await submit(id);
  draft.id = null;
  return true;
}

/** Removes an abandoned draft, waiting for its create if that has not finished. */
export function discardReviewDraft(draft: ReviewDraft, remove: (id: string) => Promise<unknown>): void {
  const drop = (id: string | null) => {
    if (id) remove(id).catch(() => {});
  };
  if (draft.id) {
    drop(draft.id);
    draft.id = null;
  } else if (draft.creating) {
    draft.creating.then(id => { draft.id = null; drop(id); });
  }
}
