// A person's page says their practice, not a title (Adrian, 2026-11-26;
// todo/plans/guests-and-tea-masters-launch-4-run.md, part of K6 and K8).
//
// Three optional lines on a person's page, each answered in one tap or one
// line, asked in place on their own page and never as a form:
//   - "With tea since": a year, with no named levels;
//   - what draws them to tea: one short line, typed or spoken;
//   - what they do: tapped from the short fixed list below.
//
// THIS IS THE ONE PLACE for the wording and the list. Adrian will refine both,
// so no page writes any of it by hand: pages read PRACTICE_WORDS and
// PRACTICE_DOINGS, and the worker checks answers with the same list
// (worker/src/practiceLines.ts imports this file).
//
// Never built from these: a "studied with" line, a lineage, a title, a level,
// or anything computed, ranked or counted. A year is shown as the year, never
// as a number of years.
//
// One switch for all of it. Off until Adrian says "ship". Closed, the routes
// answer 404, the page shows nothing new and asks nothing. An explicit
// setting wins over the constant, either way: the site reads
// VITE_PRACTICE_LINES_OPEN ('true' or 'false'), the worker reads the
// PRACTICE_LINES_OPEN variable.
export const PRACTICE_LINES_OPEN = false;

type Env = { PRACTICE_LINES_OPEN?: string } | null | undefined;

/** Whether the practice lines are open, on the site or in the worker. */
export function practiceLinesOpen(env?: Env): boolean {
  if (env?.PRACTICE_LINES_OPEN === 'true') return true;
  if (env?.PRACTICE_LINES_OPEN === 'false') return false;
  let site: string | undefined;
  try {
    site = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PRACTICE_LINES_OPEN;
  } catch {
    site = undefined;
  }
  if (site === 'true') return true;
  if (site === 'false') return false;
  return PRACTICE_LINES_OPEN;
}

// ── The fixed list of things a person does (DRAFT for Adrian) ────────────────
//
// The key is what is stored; the words are what the page says, in the
// person's own voice (the person page speaks in the first person). Change the
// words freely; keep a key once people have stored it, since a key that leaves
// this list is dropped from their page when it is read back.
export const PRACTICE_DOINGS = [
  { key: 'pours', words: 'I pour for others' },
  { key: 'hosts', words: 'I host a table' },
  { key: 'sources', words: 'I source tea' },
  { key: 'teaware', words: 'I make teaware' },
  { key: 'grows', words: 'I grow or make tea' },
  { key: 'teaches', words: 'I teach' },
  { key: 'daily', words: 'I drink tea every day' },
] as const satisfies ReadonlyArray<{ key: string; words: string }>;

export type PracticeDoing = typeof PRACTICE_DOINGS[number]['key'];

export const PRACTICE_DOING_KEYS: readonly PracticeDoing[] = PRACTICE_DOINGS.map(item => item.key);

export function isPracticeDoing(value: unknown): value is PracticeDoing {
  return typeof value === 'string' && (PRACTICE_DOING_KEYS as readonly string[]).includes(value);
}

export function practiceDoingWords(key: PracticeDoing): string {
  return PRACTICE_DOINGS.find(item => item.key === key)?.words ?? key;
}

// ── The three prompts ────────────────────────────────────────────────────────
//
// `heading` is the small label over a line on the page, in the person's own
// voice; `ask` is what the owner alone sees in place of a line they have not
// answered; `hint` sits under the field while they answer; `field` names the
// field for a screen reader.
export const PRACTICE_WORDS = {
  since: {
    heading: 'With tea since',
    ask: 'Add the year you came to tea',
    hint: 'Just the year.',
    field: 'The year you came to tea',
  },
  drawn: {
    heading: 'What draws me to tea',
    ask: 'Say what draws you to tea',
    hint: 'One line, in your own words. Type it or say it.',
    field: 'What draws you to tea',
  },
  doings: {
    heading: 'What I do',
    ask: 'Tap what you do with tea',
    hint: 'Tap any that are true. Tap again to take one off.',
    field: 'What you do with tea',
    shown: (keys: readonly PracticeDoing[]) => keys.map(practiceDoingWords).join('. ') + '.',
  },
  // The three lines together, named for a screen reader on the person's page.
  sectionLabel: 'My practice',
  // On the person's own profile in Your Table, over the three lines.
  profileHeading: 'On your page',
  profileIntro: 'Three short lines about you and tea. Each is yours to leave out.',
  // Shared words for the controls.
  change: 'Change',
  save: 'Save',
  done: 'Done',
  cancel: 'Cancel',
  takeOff: 'Take it off',
  speak: 'Say it',
  stop: 'Stop',
  writing: 'Writing it down',
  spokenFailed: 'That did not come through. Try again, or type it.',
  failed: 'That did not save. Try again.',
  ownNote: 'Only you see the lines you have not answered.',
} as const;

// ── The contract ─────────────────────────────────────────────────────────────

/** One short line: what draws a person to tea. */
export const PRACTICE_DRAWN_LIMIT = 140;
/** The earliest year the page takes. */
export const PRACTICE_SINCE_EARLIEST = 1930;

export interface PracticeLines {
  since: number | null;
  drawn: string | null;
  doings: PracticeDoing[];
}

export interface PracticeLinesResponse {
  can_edit: boolean;
  lines: PracticeLines;
}

export const NO_PRACTICE_LINES: PracticeLines = { since: null, drawn: null, doings: [] };

export function hasPracticeLines(lines: PracticeLines): boolean {
  return lines.since != null || Boolean(lines.drawn) || lines.doings.length > 0;
}

/** The latest year the page takes: this year. */
export function practiceSinceLatest(now = new Date()): number {
  return now.getUTCFullYear();
}

export type PracticePatch = Partial<{ since: number | null; drawn: string | null; doings: PracticeDoing[] }>;

/**
 * Check one answer from the page. Nothing entered is null (the line is taken
 * off); anything entered must be a whole year in range, one short line, or
 * keys from the fixed list. Returns the patch to store, or the reason it was
 * refused. The worker and the page both use this, so they cannot disagree.
 */
export function readPracticePatch(input: unknown, now = new Date()): { patch: PracticePatch } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Expected an answer.' };
  const body = input as Record<string, unknown>;
  const patch: PracticePatch = {};
  if ('since' in body) {
    const raw = body.since;
    if (raw === null || raw === '') patch.since = null;
    else {
      const year = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
      if (!Number.isInteger(year) || year < PRACTICE_SINCE_EARLIEST || year > practiceSinceLatest(now)) {
        return { error: `A year from ${PRACTICE_SINCE_EARLIEST} to ${practiceSinceLatest(now)}.` };
      }
      patch.since = year;
    }
  }
  if ('drawn' in body) {
    const raw = body.drawn;
    if (raw === null) patch.drawn = null;
    else if (typeof raw !== 'string') return { error: 'One line of words.' };
    else {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (line.length > PRACTICE_DRAWN_LIMIT) return { error: `One short line: ${PRACTICE_DRAWN_LIMIT} letters at most.` };
      patch.drawn = line || null;
    }
  }
  if ('doings' in body) {
    const raw = body.doings;
    if (raw === null) patch.doings = [];
    else if (!Array.isArray(raw) || !raw.every(isPracticeDoing)) return { error: 'Choose from the list.' };
    else patch.doings = PRACTICE_DOING_KEYS.filter(key => raw.includes(key));
  }
  if (!Object.keys(patch).length) return { error: 'Nothing to save.' };
  return { patch };
}

/** The stored doings column ("pours,teaches") read back, unknown keys dropped. */
export function parseStoredDoings(value: unknown): PracticeDoing[] {
  if (typeof value !== 'string' || !value) return [];
  const stored = value.split(',').map(part => part.trim());
  return PRACTICE_DOING_KEYS.filter(key => stored.includes(key));
}

export function storedDoings(keys: readonly PracticeDoing[]): string | null {
  return keys.length ? PRACTICE_DOING_KEYS.filter(key => keys.includes(key)).join(',') : null;
}
