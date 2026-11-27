import {
  NO_PRACTICE_LINES, parseStoredDoings, practiceLinesOpen, readPracticePatch, storedDoings,
  type PracticeLines,
} from '../../src/lib/practiceLines';
import { CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL } from './sessionHost';

// A person's page says their practice, not a title (Adrian, 2026-11-26;
// src/lib/practiceLines.ts holds the wording, the fixed list and the checks).
//
// Two routes, both 404 while PRACTICE_LINES_OPEN is off:
//   GET /api/public/people/:slug/practice   the three lines on a published
//       page, for anyone; the owner also gets can_edit, and reads their own
//       lines while the page is still a draft.
//   PUT /api/public/people/:slug/practice   the owner answers, changes or
//       takes off one or more lines. Applied at once, like the gallery: three
//       short answers about oneself do not go through the profile review.
//
// The three columns (migration 0148) are never handed out by any other route:
// practiceColumnsRemoved strips them from every contributor row the worker
// spreads into an answer. Nothing here counts, ranks or computes anything.

export const PRACTICE_COLUMNS = ['practice_since', 'practice_drawn', 'practice_doings'] as const;

type PracticeEnv = { DB: D1Database; PRACTICE_LINES_OPEN?: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Deps<E> = {
  optionalUser: (request: Request, env: E) => Promise<{ userId: string } | null>;
  requireUser: (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;
};

type PracticeRow = {
  id: string;
  user_id: string | null;
  published: number;
  practice_since: number | null;
  practice_drawn: string | null;
  practice_doings: string | null;
};

/** A contributor row with the three practice columns taken out. */
export function practiceColumnsRemoved<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const column of PRACTICE_COLUMNS) delete out[column];
  return out;
}

function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' } });
}

const notFound = () => privateJson({ error: 'Not found' }, 404);

function linesOf(row: PracticeRow): PracticeLines {
  return {
    since: row.practice_since == null ? null : Number(row.practice_since),
    drawn: row.practice_drawn || null,
    doings: parseStoredDoings(row.practice_doings),
  };
}

function readRow(db: D1Database, slug: string) {
  return db.prepare(
    `SELECT c.id, c.user_id, c.practice_since, c.practice_drawn, c.practice_doings,
            CASE WHEN ${CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL} THEN 1 ELSE 0 END AS published
       FROM contributors c WHERE c.id = ?`,
  ).bind(slug).first<PracticeRow>();
}

export function practiceLinesRoutes<E extends PracticeEnv>(deps: Deps<E>): Array<[string, string, Handler<E>]> {
  const read: Handler<E> = async (request, env, { slug }) => {
    if (!practiceLinesOpen(env)) return notFound();
    const [row, user] = await Promise.all([readRow(env.DB, slug), deps.optionalUser(request, env)]);
    if (!row) return notFound();
    const canEdit = Boolean(user && row.user_id && user.userId === row.user_id);
    if (!canEdit && row.published !== 1) return notFound();
    return privateJson({ can_edit: canEdit, lines: linesOf(row) });
  };

  const write: Handler<E> = async (request, env, { slug }) => {
    if (!practiceLinesOpen(env)) return notFound();
    const user = await deps.requireUser(request, env);
    if ('error' in user) return user.error;
    const row = await readRow(env.DB, slug);
    if (!row || !row.user_id || row.user_id !== user.userId) return notFound();
    let body: unknown;
    try { body = await request.json(); } catch { return privateJson({ error: 'Expected an answer.' }, 400); }
    const read = readPracticePatch(body);
    if ('error' in read) return privateJson({ error: read.error }, 400);
    const { patch } = read;
    const sets: string[] = [];
    const values: unknown[] = [];
    if ('since' in patch) { sets.push('practice_since = ?'); values.push(patch.since ?? null); }
    if ('drawn' in patch) { sets.push('practice_drawn = ?'); values.push(patch.drawn ?? null); }
    if ('doings' in patch) { sets.push('practice_doings = ?'); values.push(storedDoings(patch.doings ?? [])); }
    await env.DB.prepare(
      `UPDATE contributors SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    ).bind(...values, row.id, user.userId).run();
    const saved = await readRow(env.DB, slug);
    return privateJson({ can_edit: true, lines: saved ? linesOf(saved) : NO_PRACTICE_LINES });
  };

  return [
    ['GET', '/api/public/people/:slug/practice', read],
    ['PUT', '/api/public/people/:slug/practice', write],
  ];
}
