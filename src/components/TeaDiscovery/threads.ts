import type { Thread, TeaDiscoveryAnswers, TeaDiscoveryProfile } from './types';

/* ───────────────────────────────────────────────────────────────────────────
   Tea threads — the "mirror" handed back on the results screen, and the signal
   Adrian uses to know what to put in front of someone.

   These are not personality boxes. A thread is a *reason you come to tea*, and a
   person can hold several at once — a devoted host who loves a good cup has all
   three. Every thread had to pass one test to earn its place: it must name
   something the other two DON'T share. That test eliminated the impostors —
   "daily" (a frequency), "senses/learning" (the depth axis), "pleasure" (an
   outcome everyone shares). What's left is the three places the draw can point:
   toward yourself, toward others, toward the tea itself.

   Copy is easy to tune here without touching logic.
   ─────────────────────────────────────────────────────────────────────────── */

export const THREADS: Record<string, Thread> = {
  stillness: {
    id: 'stillness',
    name: 'Stillness',
    description:
      'You come to tea to go inward — a cup is a way to slow down and be present. ' +
      'The meditative pour, drunk for its quiet.',
  },
  connection: {
    id: 'connection',
    name: 'Connection',
    description:
      'Tea is something you share — a reason to gather, to host, to keep someone ' +
      'at the table. The cup is for the people around it.',
  },
  quality: {
    id: 'quality',
    name: 'Quality',
    description:
      'You come for the tea itself — the genuinely good cup, well-made and worth ' +
      'tasting. Not to study it; simply to drink something excellent.',
  },
};

/** Canonical display order, used as the tie-break when two threads score equally. */
const CANON = ['stillness', 'connection', 'quality'];

const asArray = (v: string | string[] | undefined): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

/**
 * Derive the threads that draw someone from their answers, strongest first.
 *
 * Each thread accrues a score from the signals that point at it; we return every
 * thread with any signal, ordered by strength. Note what is deliberately absent:
 *  - "energy/daily" is a frequency, not a thread — the everyday drinker's real
 *    draw is the grounding of the cup, so it folds into Stillness;
 *  - flavor *study* is the depth axis (level), not a thread — only the plain love
 *    of a good cup lands here, as Quality.
 *
 * Everyone leaves with at least one thread; the most universal, least-presuming
 * read for someone with no strong signal is simply "you want a good cup".
 */
export function deriveThreads(answers: TeaDiscoveryAnswers): string[] {
  const temperament = answers.temperament as string | undefined;
  const motivations = asArray(answers.motivation);
  const experience = answers.experience as string | undefined;

  const score: Record<string, number> = { stillness: 0, connection: 0, quality: 0 };

  // Stillness — the inward, self-regulating cup: meditation, calm, the daily grounding.
  if (motivations.includes('stillness')) score.stillness += 2;
  if (motivations.includes('calm')) score.stillness += 1.5;
  if (motivations.includes('energy')) score.stillness += 1; // the everyday grounding cup, honestly read
  if (temperament === 'solo') score.stillness += 1;

  // Connection — tea for the people around it.
  if (motivations.includes('connection')) score.connection += 2;
  if (temperament === 'group') score.connection += 1.5;
  if (temperament === 'pair') score.connection += 1;

  // Quality — the tea itself, the genuinely good cup (not the study of it).
  if (motivations.includes('flavor')) score.quality += 2;
  if (experience === 'loose' || experience === 'deep') score.quality += 1;

  const active = CANON.filter((id) => score[id] > 0).sort(
    (a, b) => score[b] - score[a] || CANON.indexOf(a) - CANON.indexOf(b),
  );

  return active.length > 0 ? active : ['quality'];
}

/* ── Persistence helpers ──────────────────────────────────────────────────────
   The profile is stored in the legacy single-disposition columns by serializing
   thread ids comma-joined into `disposition_id` and their joined names into
   `disposition_name` (the worker/MCP/admin treat both as opaque display strings,
   so "Stillness · Quality" flows through untouched — no schema migration). These
   helpers round-trip that, and translate the six pre-threads disposition ids that
   may still sit in older rows / localStorage. */

/** Old single-archetype ids → their thread equivalent, for rows saved before threads. */
const LEGACY_DISPOSITION_TO_THREADS: Record<string, string[]> = {
  quietSteeper: ['stillness'],
  host: ['connection'],
  flavorSeeker: ['quality'],
  dailyDrinker: ['stillness'],
  curiousBeginner: ['quality'],
  deepDiver: ['quality'],
};

/** Parse a stored `disposition_id` (new comma-joined threads, or a legacy id) into thread ids. */
export function threadsFromStored(stored: string | null | undefined): string[] {
  if (!stored) return [];
  const parts = stored.split(',').map((s) => s.trim()).filter(Boolean);
  const ids = parts.flatMap((p) =>
    THREADS[p] ? [p] : LEGACY_DISPOSITION_TO_THREADS[p] ?? [],
  );
  return [...new Set(ids)];
}

/** Human-readable, denormalized label for a set of threads, e.g. "Stillness · Quality". */
export function threadNames(ids: string[]): string {
  return ids.map((id) => THREADS[id]?.name).filter(Boolean).join(' · ');
}

/**
 * The threads to display for a profile — its stored `threadIds` when present, else
 * derived from answers. The fallback keeps legacy profiles (saved before threads,
 * with no `threadIds` on the object) rendering correctly without a migration.
 */
export function profileThreads(profile: TeaDiscoveryProfile): string[] {
  return profile.threadIds?.length ? profile.threadIds : deriveThreads(profile.answers);
}
