import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeLines } from './PracticeLines';
import {
  PRACTICE_DOINGS, PRACTICE_LINES_OPEN, PRACTICE_WORDS, parseStoredDoings, practiceLinesOpen,
  readPracticePatch, storedDoings,
} from '../../lib/practiceLines';

// A person's page says their practice, not a title. Closed (the default), the
// page shows, edits and asks for nothing new; the wording and the fixed list
// live in src/lib/practiceLines.ts alone.

afterEach(() => vi.unstubAllEnvs());

describe('the practice lines switch', () => {
  it('is off by default, and the setting wins either way', () => {
    expect(PRACTICE_LINES_OPEN).toBe(false);
    expect(practiceLinesOpen({ PRACTICE_LINES_OPEN: 'true' })).toBe(true);
    expect(practiceLinesOpen({ PRACTICE_LINES_OPEN: 'false' })).toBe(false);
  });

  it('closed, the page renders nothing and asks the worker nothing', () => {
    vi.stubEnv('VITE_PRACTICE_LINES_OPEN', 'false');
    const fetch = vi.spyOn(globalThis, 'fetch');
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><PracticeLines slug="mei-lin" /><PracticeLines slug="mei-lin" tone="profile" /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});

describe('the practice lines contract', () => {
  it('takes a year, one short line and keys from the list; nothing entered is null', () => {
    const now = new Date('2026-11-26T00:00:00Z');
    expect(readPracticePatch({ since: 2009 }, now)).toEqual({ patch: { since: 2009 } });
    expect(readPracticePatch({ since: '2009' }, now)).toEqual({ patch: { since: 2009 } });
    expect(readPracticePatch({ since: '' }, now)).toEqual({ patch: { since: null } });
    expect(readPracticePatch({ since: 2027 }, now)).toHaveProperty('error');
    expect(readPracticePatch({ drawn: '   ' }, now)).toEqual({ patch: { drawn: null } });
    expect(readPracticePatch({ doings: ['teaches', 'pours', 'teaches'] }, now)).toEqual({ patch: { doings: ['pours', 'teaches'] } });
    expect(readPracticePatch({ doings: ['master'] }, now)).toHaveProperty('error');
    expect(readPracticePatch({ lineage: 'x' }, now)).toHaveProperty('error');
  });

  it('stores the doings as keys and reads back only known ones', () => {
    expect(storedDoings(['teaches', 'pours'])).toBe('pours,teaches');
    expect(storedDoings([])).toBeNull();
    expect(parseStoredDoings('pours,old-key,teaches')).toEqual(['pours', 'teaches']);
  });

  it('has a short list and no title, level or lineage in any of its words', () => {
    expect(PRACTICE_DOINGS.length).toBeGreaterThanOrEqual(5);
    expect(PRACTICE_DOINGS.length).toBeLessThanOrEqual(7);
    const words = JSON.stringify([PRACTICE_DOINGS, PRACTICE_WORDS]);
    // No title, level or lineage, and no long dash (written as its code, so this file holds none).
    expect(words).not.toMatch(/master|studied|lineage|level|\u2014/i);
  });
});
