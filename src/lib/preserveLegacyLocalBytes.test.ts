import { afterEach, expect, it, vi } from 'vitest';
import { preserveLegacyLocalBytes } from './preserveLegacyLocalBytes';

afterEach(() => vi.unstubAllGlobals());

it('keeps the exact old envelope bytes once without touching the original', () => {
  const values = new Map<string, string>([['teajia-compass', ' { "state": {"entries": []}, "version": 8 } ']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
  preserveLegacyLocalBytes('teajia-compass', 'teajia-compass-legacy-recovery', 9);
  expect(values.get('teajia-compass-legacy-recovery')).toBe(values.get('teajia-compass'));
  values.set('teajia-compass', '{"state":{},"version":9}');
  preserveLegacyLocalBytes('teajia-compass', 'teajia-compass-legacy-recovery', 9);
  expect(values.get('teajia-compass-legacy-recovery')).toBe(' { "state": {"entries": []}, "version": 8 } ');
});

it('retains malformed pre-upgrade bytes for explicit recovery', () => {
  const values = new Map<string, string>([['teajia-notes', '{unfinished-old-envelope']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  });
  preserveLegacyLocalBytes('teajia-notes', 'teajia-notes-legacy-recovery', 1);
  expect(values.get('teajia-notes-legacy-recovery')).toBe('{unfinished-old-envelope');
  expect(values.get('teajia-notes')).toBe('{unfinished-old-envelope');
});
