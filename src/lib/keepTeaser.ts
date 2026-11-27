/**
 * What a person is keeping when an invoice sends them to join, so the sign-up
 * page can show their teas in place of a bare form (Adrian, 2026-11-27: a
 * visual guide, not paragraphs). Held for the tab only, and only names and
 * amounts the link already showed them.
 */
export interface KeepTeaser {
  /** The address they come back to; the teaser shows only for this one. */
  path: string;
  from: string;
  teas: { name: string; amount?: string }[];
}

const KEY = 'teajia.keepTeaser';

export function holdKeepTeaser(teaser: KeepTeaser): void {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(teaser)); } catch { /* the plain sign-up page is fine */ }
}

export function keepTeaserFor(destination: string): KeepTeaser | null {
  try {
    const held = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as KeepTeaser | null;
    if (!held || !Array.isArray(held.teas) || held.teas.length === 0) return null;
    return destination.split('?')[0] === held.path ? held : null;
  } catch {
    return null;
  }
}

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** "four teas", "one tea", "14 teas". */
export function teaCountWords(count: number): string {
  return `${WORDS[count] ?? count} ${count === 1 ? 'tea' : 'teas'}`;
}
