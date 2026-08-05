/**
 * Pins the catalogue numbers.
 *
 * A catalogue number is only worth printing if it never moves. A reader who
 * cites PL 028 and finds a different plant there a month later has been given a
 * reason to distrust everything else on the page, which is the opposite of what
 * the device is for. So the numbers are frozen in `catalogue.ts`, and these
 * assertions are what makes a silent renumbering fail loudly instead.
 *
 * If one of these fails, do not update the expectation. Work out what moved.
 *
 * Run with: npx vitest run src/pages/wisdom/catalogue.test.ts
 */
import { describe, expect, it } from 'vitest';
import { CULTIVARS, MARKS, NAMED_TEAS, PRODUCERS, REGIONS, STYLES } from '../../wisdom';
import { catalogueNumber, catalogueNumberFor, type Holding } from './catalogue';

/** Known numbers, one per holding, taken the day the ledgers were frozen. */
const PINNED: Array<[Holding, string, string]> = [
  ['plants', 'anji-bai-cha', 'PL 001'],
  ['plants', 'jin-xuan', 'PL 028'],
  ['plants', 'zi-juan', 'PL 079'],
  ['places', 'aichi-prefecture', 'RG 001'],
  ['places', 'wuyi-mountains-fujian', 'RG 159'],
  ['makers', 'menghai-tea-factory', 'PD 005'],
  ['marks', '7572', 'MK 001'],
  ['styles', 'xiao-qing-gan', 'SY 010'],
  ['named', 'courage', 'NT 001'],
];

describe('a number that cannot move', () => {
  it.each(PINNED)('%s %s is %s', (holding, id, expected) => {
    expect(catalogueNumber(holding, id)).toBe(expected);
  });

  it('reads a number off a reference path, which is how a row and a hit get theirs', () => {
    expect(catalogueNumberFor('/wisdom/cultivar/jin-xuan')).toBe('PL 028');
    expect(catalogueNumberFor('/wisdom/mark/7572')).toBe('MK 001');
    // A holding is not a record and takes no number.
    expect(catalogueNumberFor('/wisdom/cultivars')).toBeNull();
    expect(catalogueNumberFor('/shop')).toBeNull();
  });
});

describe('every record the base holds is numbered', () => {
  const holdings: Array<[Holding, string[]]> = [
    ['plants', CULTIVARS.map(entry => entry.id)],
    ['places', REGIONS.map(entry => entry.id)],
    ['makers', PRODUCERS.map(entry => entry.id)],
    ['marks', MARKS.map(entry => entry.id)],
    ['styles', STYLES.map(entry => entry.id)],
    ['named', NAMED_TEAS.map(entry => entry.id)],
  ];

  it.each(holdings)('%s', (holding, ids) => {
    const numbers = ids.map(id => catalogueNumber(holding, id));
    expect(numbers.every(Boolean)).toBe(true);
    // No two records share one. A collision means the ledger repeated an id.
    expect(new Set(numbers).size).toBe(ids.length);
  });

  it('answers nothing for a name the base cannot place', () => {
    expect(catalogueNumber('plants', 'not-a-plant')).toBeNull();
    expect(catalogueNumber('plants', undefined)).toBeNull();
  });
});
