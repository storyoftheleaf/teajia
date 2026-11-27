/** A tea card's mic opens the tea and starts its recorder there (intake plan
 *  step 3, Adrian 2026-11-27: "you can't talk to a tea already in the
 *  Library"). The card asks; the opened tea's recorder takes the ask once. */
let requested: { entryId: string; at: number } | null = null;

export function requestRecordOnOpen(entryId: string) {
  requested = { entryId, at: Date.now() };
}

/** True once, for the tea that was asked for within the last few seconds. */
export function takeRecordRequest(entryId: string): boolean {
  const ask = requested;
  if (!ask || ask.entryId !== entryId || Date.now() - ask.at > 5000) return false;
  requested = null;
  return true;
}

/** Whether the opened tea was asked to record, without taking the ask (so the
 *  tea can open on the tab that holds its recorder). */
export function recordRequested(entryId: string): boolean {
  return requested?.entryId === entryId && Date.now() - requested.at <= 5000;
}
