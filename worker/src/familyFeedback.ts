/**
 * Teajia family, stage 6: what the shop reads of its members' notes, and the
 * day sheet it downloads. Plan: todo/plans/teajia-family.md.
 *
 * Two shop-only reads (the `publish` bundle, scoped to the caller's account):
 *
 * - the feedback list: every note a member wrote about one of this shop's
 *   teas, with the impression and the score the member gave. Those two are
 *   the member's own and are shown to the shop only; the public reads in
 *   familyPersonTastings.ts and familyRoutes.ts never select them.
 * - the day sheet: the same notes for one day as a CSV download. It is a
 *   download, never a scheduled job.
 *
 * Tenancy is the tea's, not the journal's: a member's journal row can have no
 * account at all, so notes are found through the shop's own products.
 *
 * Reports are described here too, so the shop can read what was reported
 * without a second lookup.
 */
import { journalRowToNotes } from './tastingNoteCuration';
import { wordsFromSittings } from './familyPersonTastings';
import type { FamilyDeps, FamilyEnv, FamilyHandler } from './familyRoutes';
import type { FamilyFeedbackNote, FamilyImpression, FamilyReport } from '../../src/lib/familyContract';

const MEDIA_PREFIX = 'https://media.teajia.co/';
const MAX_JOURNALS = 500;

const IMPRESSIONS: readonly FamilyImpression[] = ['love', 'like', 'neutral', 'pass'];
/** What the sheet calls each stored impression. `pass` is how a dislike is stored. */
export const IMPRESSION_WORDS: Record<FamilyImpression, string> = { love: 'Love', like: 'Like', neutral: 'Neutral', pass: 'Dislike' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function parseObject(value: unknown): Record<string, any> | null {
  if (value == null) return null;
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const validDate = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value !== '' && !Number.isNaN(new Date(value).getTime());

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The impression and score a member gave, wherever the journal row keeps them. */
export function memberScore(row: Record<string, any>): { impression: FamilyImpression | null; rating: number | null } {
  const note = parseObject(row.note);
  const tasting = parseObject(note?.tasting) ?? parseObject(row.tasting);
  const verdict = String(note?.verdict ?? '');
  const impression = (IMPRESSIONS as readonly string[]).includes(verdict) ? verdict as FamilyImpression : null;
  const rating = numberOrNull(row.rating) ?? numberOrNull(note?.rating) ?? numberOrNull(tasting?.quality) ?? numberOrNull(tasting?.rating);
  return { impression, rating };
}

/** The day each note in a journal row's current tasting was written, by its key. */
function capturedDates(row: Record<string, any>): Map<string, string> {
  const note = parseObject(row.note);
  const tasting = parseObject(note?.tasting) ?? parseObject(row.tasting);
  const out = new Map<string, string>();
  const entries = Array.isArray(tasting?.notes) ? tasting.notes : [];
  entries.forEach((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object') return;
    const captured = (raw as any).capturedAt;
    if (!validDate(captured)) return;
    out.set(String((raw as any).id || `index-${index}`), captured);
  });
  return out;
}

/**
 * Every note in one journal row, dated as exactly as the row allows. Notes
 * the shop can decide on keep the key the Guest notes list gives them; notes
 * that exist only as an earlier dated sitting are listed and cannot be
 * decided here.
 */
export function feedbackFromRow(
  row: Record<string, any>,
  resolved: Map<string, 'promoted' | 'dismissed'>,
): FamilyFeedbackNote[] {
  const score = memberScore(row);
  const dates = capturedDates(row);
  const base = {
    journal_entry_id: String(row.id),
    product_id: String(row.product_id),
    product_name: row.product_name ? String(row.product_name) : null,
    author_name: String(row.author_name || 'A member'),
    page_id: row.page_id ? String(row.page_id) : null,
    impression: score.impression,
    rating: score.rating,
    shared: Number(row.shared) === 1,
    tasting_hidden: Number(row.tasting_hidden) === 1,
    page_hidden: Number(row.page_hidden) === 1,
  };
  const out: FamilyFeedbackNote[] = [];
  const seen = new Map<string, number>();
  for (const note of journalRowToNotes(row, resolved)) {
    const entry: FamilyFeedbackNote = {
      ...base,
      note_key: note.noteKey,
      text: note.text,
      written_at: dates.get(note.noteKey) ?? (validDate(note.writtenAt) ? note.writtenAt : null),
      status: note.status,
    };
    // The tasting screen keeps one piece of writing as both the personal note and a dated note.
    // It is one note to read: keep the copy the shop has already decided on, else the first.
    const text = note.text.trim();
    const earlier = seen.get(text);
    if (earlier === undefined) {
      seen.set(text, out.length);
      out.push(entry);
    } else if (out[earlier].status === 'open' && entry.status !== 'open') {
      out[earlier] = entry;
    }
  }
  wordsFromSittings(row.tastings).forEach((word, index) => {
    if (seen.has(word.text)) return;
    seen.set(word.text, out.length);
    out.push({ ...base, note_key: `sitting-${index}`, text: word.text, written_at: word.date, status: 'open' });
  });
  return out;
}

/** All notes written about this shop's teas, newest first, optionally only those written in [from, to). */
export async function feedbackNotes(
  db: D1Database,
  accountId: string,
  range?: { from: string; to: string },
): Promise<FamilyFeedbackNote[]> {
  const [journals, decided] = await Promise.all([
    db.prepare(
      `SELECT j.id, j.product_id, j.user_id, j.note, j.tasting, j.tastings, j.personal_note, j.rating, j.created_at,
              COALESCE(NULLIF(p.given_name, ''), p.product_name) AS product_name,
              u.id AS author_user_id,
              COALESCE((SELECT NULLIF(c.display_name, '') FROM contributors c WHERE c.user_id = u.id AND c.is_published = 1 ORDER BY c.created_at LIMIT 1),
                       NULLIF(u.name, ''), u.username, j.user_id) AS author_name,
              (SELECT c.id FROM contributors c WHERE c.user_id = u.id AND c.is_published = 1 ORDER BY c.created_at LIMIT 1) AS page_id,
              EXISTS (SELECT 1 FROM member_tasting_shares s WHERE s.journal_entry_id = j.id AND s.share_state IN ('page', 'offered')) AS shared,
              EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'tasting' AND h.target_id = j.id) AS tasting_hidden,
              EXISTS (SELECT 1 FROM family_hides h JOIN contributors hc ON hc.id = h.target_id
                       WHERE h.target_kind = 'page' AND hc.user_id = u.id) AS page_hidden
         FROM customer_tasting_journal j
         JOIN products p ON p.id = j.product_id AND p.account_id = ?1
         LEFT JOIN users u ON u.email = j.user_id
        WHERE COALESCE(j.archived, 0) = 0
        ORDER BY j.created_at DESC
        LIMIT ${MAX_JOURNALS}`,
    ).bind(accountId).all<Record<string, any>>(),
    db.prepare(
      `SELECT journal_entry_id, note_key, status FROM tasting_note_candidates
        WHERE account_id = ?1 AND status IN ('promoted', 'dismissed')`,
    ).bind(accountId).all<Record<string, any>>(),
  ]);
  const resolved = new Map<string, 'promoted' | 'dismissed'>();
  for (const row of decided.results ?? []) resolved.set(`${row.journal_entry_id}::${row.note_key}`, row.status);

  const from = range ? new Date(range.from).getTime() : null;
  const to = range ? new Date(range.to).getTime() : null;
  const notes = (journals.results ?? []).flatMap(row => feedbackFromRow(row, resolved)).filter(note => {
    if (from === null || to === null) return true;
    if (!note.written_at) return false;
    const at = new Date(note.written_at).getTime();
    return at >= from && at < to;
  });
  notes.sort((a, b) => (b.written_at ?? '').localeCompare(a.written_at ?? ''));
  return notes;
}

/**
 * One CSV cell. A leading =, +, - or @ would be read as a formula by a
 * spreadsheet, so those are fenced with an apostrophe; then quotes and line
 * breaks are escaped as CSV requires.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const SHEET_HEADER = ['Written', 'Tea', 'Person', 'Note', 'Impression', 'Rating out of ten'];

/** The day sheet as CSV text, with a byte order mark so a spreadsheet reads it as UTF-8. */
export function sheetCsv(notes: FamilyFeedbackNote[]): string {
  const lines = [SHEET_HEADER.map(csvCell).join(',')];
  for (const note of notes) {
    lines.push([
      note.written_at ?? '',
      note.product_name ?? '',
      note.author_name,
      note.text,
      note.impression ? IMPRESSION_WORDS[note.impression] : '',
      note.rating ?? '',
    ].map(csvCell).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** The range a request asks for: explicit instants, else the UTC day named (or today). */
export function sheetRange(params: URLSearchParams, now = new Date()): { day: string; from: string; to: string } | null {
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const dayParam = params.get('day');
  if (fromParam || toParam) {
    if (!validDate(fromParam) || !validDate(toParam) || new Date(toParam) <= new Date(fromParam)) return null;
    const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : new Date(fromParam).toISOString().slice(0, 10);
    return { day, from: new Date(fromParam).toISOString(), to: new Date(toParam).toISOString() };
  }
  const day = dayParam ?? now.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime())) return null;
  const start = new Date(`${day}T00:00:00Z`);
  return { day, from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
}

type ReportRow = Pick<FamilyReport, 'id' | 'target_kind' | 'target_id' | 'reason' | 'status' | 'created_at'>;

/** Reports with a readable label, the small copy of a photograph, and whether the target is already hidden. */
export async function describeReports(db: D1Database, accountId: string, rows: ReportRow[]): Promise<FamilyReport[]> {
  const out: FamilyReport[] = [];
  for (const row of rows) {
    let label: string | null = null;
    let smallKey: string | null = null;
    if (row.target_kind === 'page') {
      const page = await db.prepare(`SELECT display_name FROM contributors WHERE id = ?`).bind(row.target_id).first<{ display_name: string | null }>();
      label = page?.display_name ? `${page.display_name}'s page` : null;
    } else if (row.target_kind === 'photograph') {
      const photo = await db.prepare(
        `SELECT p.small_key, COALESCE(NULLIF(pr.given_name, ''), pr.product_name) AS tea, COALESCE(NULLIF(u.name, ''), u.username) AS who
           FROM member_photographs p
           LEFT JOIN products pr ON pr.id = p.product_id AND pr.account_id = p.account_id
           LEFT JOIN users u ON u.id = p.author_user_id
          WHERE p.id = ? AND p.account_id = ?`,
      ).bind(row.target_id, accountId).first<{ small_key: string; tea: string | null; who: string | null }>();
      if (photo) {
        label = `Photograph of ${photo.tea ?? 'a tea'}${photo.who ? ` by ${photo.who}` : ''}`;
        smallKey = photo.small_key;
      }
    } else {
      const tasting = await db.prepare(
        `SELECT COALESCE(NULLIF(pr.given_name, ''), pr.product_name) AS tea, COALESCE(NULLIF(u.name, ''), u.username) AS who
           FROM member_tasting_shares s
           LEFT JOIN products pr ON pr.id = s.product_id AND pr.account_id = s.account_id
           LEFT JOIN users u ON u.id = s.author_user_id
          WHERE s.journal_entry_id = ? AND s.account_id = ?`,
      ).bind(row.target_id, accountId).first<{ tea: string | null; who: string | null }>();
      if (tasting) label = `Tasting of ${tasting.tea ?? 'a tea'}${tasting.who ? ` by ${tasting.who}` : ''}`;
    }
    const hidden = await db.prepare(
      `SELECT 1 AS x FROM family_hides WHERE target_kind = ? AND target_id = ? AND (account_id = ? OR target_kind = 'page')`,
    ).bind(row.target_kind, row.target_id, accountId).first();
    out.push({ ...row, label, small_url: smallKey ? `${MEDIA_PREFIX}${smallKey}` : null, hidden: Boolean(hidden) });
  }
  return out;
}

export function familyFeedbackRoutes<E extends FamilyEnv>(deps: FamilyDeps<E>): [string, string, FamilyHandler<E>][] {
  // GET /api/admin/family/feedback?from=&to=: every note, with the member's impression and score.
  const feedback: FamilyHandler<E> = async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const params = new URL(request.url).searchParams;
    const ranged = params.has('from') || params.has('to') || params.has('day');
    const range = ranged ? sheetRange(params) : null;
    if (ranged && !range) return json({ error: 'Choose a valid day.', code: 'validation_failed' }, 400);
    return json({ notes: await feedbackNotes(env.DB, shop.accountId, range ?? undefined) });
  };

  // GET /api/admin/family/sheet?day=YYYY-MM-DD&from=&to=: the day's notes and ratings as a CSV download.
  const sheet: FamilyHandler<E> = async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const range = sheetRange(new URL(request.url).searchParams);
    if (!range) return json({ error: 'Choose a valid day.', code: 'validation_failed' }, 400);
    const notes = await feedbackNotes(env.DB, shop.accountId, range);
    return new Response(sheetCsv(notes), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="teajia-notes-${range.day}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  };

  return [
    ['GET', '/api/admin/family/feedback', feedback],
    ['GET', '/api/admin/family/sheet', sheet],
  ];
}
