/**
 * The one rule for joining two copies of a tea's journal entry: the device's
 * copy and the shop's. The client uses it when it pulls
 * (`tastingJournalSync.ts`) and the worker when a device pushes
 * (`worker/src/tastingJournalPush.ts`), so both ends agree.
 *
 * - Sittings (`tastings`) are united by record id; nothing either side holds
 *   is dropped.
 * - A sitting records no edit time of its own. Editing one always bumps its
 *   entry's `note.updatedAt`, so the side whose note was edited later keeps
 *   both its note and its copy of any sitting the two sides share. On a tie
 *   the first side given wins.
 * - A group session sitting (no fresh-tasting reason) is one sitting per
 *   session, even when the device and the worker's session bridge each gave it
 *   their own id.
 *
 * There is no way to delete one sitting, so there is nothing to resurrect.
 */

export interface MergeableSitting {
  id: string;
  createdAt: string;
  sourceType?: string;
  eventId?: string;
  reason?: string;
}

export interface MergeableNote {
  updatedAt: string;
}

/** When a note was last edited, or minus infinity when it does not say. */
export function noteEditedAt(note: { updatedAt?: unknown } | null | undefined): number {
  const at = typeof note?.updatedAt === 'string' ? Date.parse(note.updatedAt) : NaN;
  return Number.isFinite(at) ? at : -Infinity;
}

function sittingKey(sitting: MergeableSitting): string {
  if (sitting.sourceType === 'session' && sitting.eventId && !sitting.reason) return `session:${sitting.eventId}`;
  return `id:${sitting.id}`;
}

function sittingTime(sitting: MergeableSitting): number {
  return new Date(sitting.createdAt).getTime();
}

/** Both sides' sittings, oldest first; `winner`'s copy of a shared one. */
export function mergeSittings<S extends MergeableSitting>(winner: readonly S[], loser: readonly S[]): S[] {
  const byKey = new Map<string, S>();
  for (const sitting of [...loser, ...winner]) {
    if (sitting && typeof sitting.id === 'string') byKey.set(sittingKey(sitting), sitting);
  }
  return [...byKey.values()].sort((x, y) => sittingTime(x) - sittingTime(y));
}

/** Joins two copies of one tea's note and sittings. */
export function mergeJournalSides<N extends MergeableNote, S extends MergeableSitting>(
  first: { note: N; tastings: readonly S[] },
  second: { note: N; tastings: readonly S[] },
): { note: N; tastings: S[]; firstIsNewer: boolean } {
  const firstIsNewer = noteEditedAt(first.note) >= noteEditedAt(second.note);
  const [winner, loser] = firstIsNewer ? [first, second] : [second, first];
  return { note: winner.note, tastings: mergeSittings(winner.tastings, loser.tastings), firstIsNewer };
}
