import { tastingJsonWithoutScores, tastingScoresOnly, tastingWithoutScores } from './publicScores';

/**
 * A Curate tea's tasting is its writer's (`user_id`). A Curate manager reads
 * every tea in the shop, but the score on someone else's tea is that person's
 * own: the manager reads the words (Adrian, 2026-11-26).
 */
const COMPASS_TASTING_COLUMNS = ['tasting', 'tasting_history'] as const;

function scrubColumn(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return tastingJsonWithoutScores(value) ?? null;
  return tastingWithoutScores(value);
}

/** A Curate tea as one person reads it: whole when they wrote it, without scores when they did not. */
export function compassEntryForViewer<T extends Record<string, unknown> | null | undefined>(row: T, viewerUserId: string | null | undefined): T {
  if (!row || (viewerUserId && row.user_id === viewerUserId)) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const column of COMPASS_TASTING_COLUMNS) {
    if (column in copy) copy[column] = scrubColumn(copy[column]);
  }
  // The post-tasting verdict is the writer's judgement too. `decision`, the
  // shop's sourcing choice, is not a score and stays.
  if ('verdict' in copy) copy.verdict = null;
  return copy as T;
}


/**
 * A Curate history or preview snapshot as one person reads it. A tea is its
 * writer's, a note its author's, a sample tasting its taster's, and a shop
 * product's score its owner's: anyone else reads the row without the score.
 */
export function curateSnapshotForViewer(
  entityType: string,
  row: unknown,
  viewer: { userId: string; userEmail?: string | null; isOwner: boolean },
): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const r = row as Record<string, unknown>;
  if (entityType === 'tea') return compassEntryForViewer(r, viewer.userId);
  if (entityType === 'note' && r.author_id !== viewer.userId && 'tasting_snapshot' in r) {
    return { ...r, tasting_snapshot: scrubColumn(r.tasting_snapshot), text: typeof r.text === 'string' && r.source_type === 'tasting' ? r.text.replace(/^\s*\d+(?:\.\d+)?\/10(?:\s*·\s*)?/, '') : r.text };
  }
  if (entityType === 'product' && !viewer.isOwner && 'tasting' in r) return { ...r, tasting: scrubColumn(r.tasting) };
  if ('rating' in r || 'verdict' in r || 'would_buy' in r) {
    if (viewer.userEmail && r.taster_id === viewer.userEmail) return r;
    const { rating: _rating, verdict: _verdict, would_buy: _wouldBuy, ...rest } = r;
    return 'tasting' in rest ? { ...rest, tasting: scrubColumn(rest.tasting) } : rest;
  }
  return row;
}

/** The same, for a stored JSON snapshot text. */
export function curateSnapshotJsonForViewer(
  entityType: string,
  text: unknown,
  viewer: { userId: string; userEmail?: string | null; isOwner: boolean },
): unknown {
  if (typeof text !== 'string' || !text) return text;
  try { return JSON.stringify(curateSnapshotForViewer(entityType, JSON.parse(text), viewer)); } catch { return text; }
}

/**
 * A write to someone else's Curate tea. They saw the words without the score,
 * so what they send keeps the writer's score as stored, and cannot rewrite the
 * writer's tasting history.
 */
export function keepGiverCompassScores(
  values: Record<string, unknown>,
  existing: Record<string, unknown> | null | undefined,
  writerUserId: string,
): void {
  if (!existing || existing.user_id === writerUserId) return;
  if (values.tasting !== undefined) {
    let incoming: unknown = values.tasting;
    if (typeof incoming === 'string') { try { incoming = JSON.parse(incoming); } catch { incoming = {}; } }
    let stored: unknown = existing.tasting;
    if (typeof stored === 'string') { try { stored = JSON.parse(stored); } catch { stored = null; } }
    const words = tastingWithoutScores(incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {}) as Record<string, unknown>;
    const merged = { ...words, ...tastingScoresOnly(stored) };
    values.tasting = typeof values.tasting === 'string' || values.tasting === null ? JSON.stringify(merged) : merged;
  }
  if (values.tasting_history !== undefined) delete values.tasting_history;
  if (values.verdict !== undefined) delete values.verdict;
}
