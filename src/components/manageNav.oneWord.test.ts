import { describe, expect, it } from 'vitest';
import { buildManageItems, type ManageItem } from './manageNav';
import { ADMIN_BAR_TABS } from './adminBarTabs';

/**
 * One word per route. The Manage column once had "Business" and "Activity"
 * both opening the same screen, which the phone called "sales", and the same
 * room was "Quick Capture" on a laptop and "capture" on a phone. A person
 * learns a place by its word; two words for one place, or one word for two
 * places, is a map that disagrees with itself.
 *
 * This reads every row the Manage column and the phone's site panel can
 * render (the list with every capability switched on) plus every word on
 * the phone's admin bar, and refuses either kind of disagreement.
 */

type Row = { label: string; path: string; where: string };

function manageRows(items: ManageItem[]): Row[] {
  return items.flatMap(item => [
    { label: item.label, path: item.path, where: `Manage room ${item.label}` },
    ...(item.children ?? []).map(c => ({ label: c.label, path: c.path, where: `Manage child ${c.label}` })),
  ]);
}

function barRows(): Row[] {
  return Object.entries(ADMIN_BAR_TABS).flatMap(([role, [left, right]]) =>
    [...left, ...right].map(t => ({ label: t.label, path: t.path, where: `phone admin bar (${role}) ${t.label}` })),
  );
}

/** Every disagreement in a set of rows, as sentences a person can act on. */
function oneWordViolations(rows: Row[]): string[] {
  const byPath = new Map<string, Row[]>();
  const byWord = new Map<string, Row[]>();
  for (const row of rows) {
    const word = row.label.toLowerCase();
    byPath.set(row.path, [...(byPath.get(row.path) ?? []), row]);
    byWord.set(word, [...(byWord.get(word) ?? []), row]);
  }
  const problems: string[] = [];
  for (const [path, found] of byPath) {
    const words = new Set(found.map(r => r.label.toLowerCase()));
    if (words.size > 1) problems.push(`${path} is called ${[...words].join(' and ')} (${found.map(r => r.where).join('; ')})`);
  }
  for (const [word, found] of byWord) {
    const paths = new Set(found.map(r => r.path));
    if (paths.size > 1) problems.push(`"${word}" leads to ${[...paths].join(' and ')}`);
  }
  return problems;
}

const EVERYTHING = buildManageItems({
  hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: true, isOwnerTier: true, platformRole: 'owner',
});

describe('one word per route', () => {
  it('the Manage list and the phone admin bar agree on every word', () => {
    expect(oneWordViolations([...manageRows(EVERYTHING), ...barRows()])).toEqual([]);
  });

  // A parent and a child opening the same screen is two rows for one place,
  // even when they happen to share a word.
  it('no Manage row repeats a destination', () => {
    const paths = manageRows(EVERYTHING).map(r => r.path);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
  });

  it('catches both kinds of disagreement', () => {
    expect(oneWordViolations([
      { label: 'Business', path: '/admin/activity', where: 'a' },
      { label: 'sales', path: '/admin/activity', where: 'b' },
    ])).toHaveLength(1);
    expect(oneWordViolations([
      { label: 'People', path: '/admin/people', where: 'a' },
      { label: 'people', path: '/people', where: 'b' },
    ])).toHaveLength(1);
  });
});
