import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * No streak tracker, anywhere in the frontend.
 *
 * `CLAUDE.md`'s DO NOT build list names it plainly: "Streak trackers,
 * gamification, engagement notifications, algorithmic recommendations, social
 * feeds/likes/followers, auto-replenish subscriptions." `LearnCurriculum.tsx`
 * carried one anyway. It rendered a "3 day streak" computed as watched stories
 * divided by two, a number nobody chose and nothing measured, dressed up as
 * fact next to a real count (the completed lesson total beside it). Removed
 * 2026-09-09, along with the day-count math that invented it.
 *
 * This guard reads every `.ts` and `.tsx` file under `src/`, strips comments
 * first (the word survives in prose describing what NOT to build, such as
 * `TeaDiscovery/evolution.ts`'s own "No streaks, no scores"), and fails if the
 * word `streak` still appears in code. Comments are stripped so this test
 * cannot be satisfied by writing the word into an explanation instead of
 * deleting it.
 */

const srcRoot = fileURLToPath(new URL('../../src', import.meta.url));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('no streak tracker in the frontend', () => {
  it('never computes or renders a streak, anywhere in src', () => {
    const offences: string[] = [];
    for (const file of collectSourceFiles(srcRoot)) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (/streak/i.test(code)) {
        offences.push(file.slice(srcRoot.length + 1));
      }
    }
    expect(
      offences,
      'a streak tracker returned; CLAUDE.md\'s DO NOT build list bans it (see the note in worker/tests/no-streak-tracker.test.ts)'
    ).toEqual([]);
  });
});
