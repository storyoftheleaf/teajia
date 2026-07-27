import { describe, expect, it } from 'vitest';
import { AUTHORSHIP } from '../../../wisdom/authorship';
import { compareWisdom } from './config';
import { WISDOM_HOLDINGS } from './holdings';
import { rungSummary } from './Rung';

const wordCount = (label: string) => label.trim().split(/\s+/).length;

describe('wisdom holdings', () => {
  it('covers every holding the base actually has', () => {
    expect(WISDOM_HOLDINGS.map(holding => holding.id)).toEqual([
      'cultivars', 'regions', 'varieties', 'producers', 'marks', 'styles', 'named-teas',
    ]);
    for (const holding of WISDOM_HOLDINGS) {
      expect(holding.rows.length, `${holding.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('gives every row a unique id so a detail panel can resolve it', () => {
    for (const holding of WISDOM_HOLDINGS) {
      const ids = holding.rows.map(row => holding.idOf(row));
      expect(new Set(ids).size, `${holding.id} has duplicate ids`).toBe(ids.length);
    }
  });

  // Micro-caps are a LABEL treatment: three words or fewer, never a sentence.
  it('keeps every micro-caps label to three words or fewer', () => {
    for (const holding of WISDOM_HOLDINGS) {
      for (const column of holding.columns) {
        expect(wordCount(column.label), `${holding.id}.${column.key}`).toBeLessThanOrEqual(3);
      }
      for (const row of holding.rows) {
        const detail = holding.detail(row);
        expect(wordCount(detail.kind), `${holding.id} panel eyebrow`).toBeLessThanOrEqual(3);
        for (const fact of detail.facts) {
          expect(wordCount(fact.label), `${holding.id} fact ${fact.label}`).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('sorts by every sortable column without losing a row', () => {
    for (const holding of WISDOM_HOLDINGS) {
      for (const column of holding.columns.filter(entry => entry.sortable !== false)) {
        const sorted = [...holding.rows].sort((left, right) =>
          compareWisdom(column.value(left), column.value(right), 'asc'));
        expect(sorted.length, `${holding.id}.${column.key}`).toBe(holding.rows.length);
      }
    }
  });

  it('searches names, Chinese names and aliases', () => {
    const cultivars = WISDOM_HOLDINGS[0];
    const withChinese = cultivars.rows.find((row: { chineseName?: string }) => row.chineseName);
    expect(withChinese).toBeDefined();
    const haystack = cultivars.searchText(withChinese);
    expect(haystack).toContain(withChinese.chineseName);
    expect(haystack).toBe(haystack.toLowerCase());
  });
});

describe('compareWisdom', () => {
  it('sinks missing values to the end in both directions', () => {
    expect(compareWisdom(null, 'Anhui', 'asc')).toBeGreaterThan(0);
    expect(compareWisdom(null, 'Anhui', 'desc')).toBeGreaterThan(0);
    expect(compareWisdom('Anhui', undefined, 'desc')).toBeLessThan(0);
    expect(compareWisdom('', 'Anhui', 'asc')).toBeGreaterThan(0);
  });

  it('compares numbers numerically, not as strings', () => {
    expect(compareWisdom(9, 100, 'asc')).toBeLessThan(0);
  });
});

describe('rungSummary', () => {
  it('says the shape once instead of repeating a word on every row', () => {
    expect(rungSummary(['a', 'b', 'c'])).toBe('all 3 drafted, none reviewed');
  });

  it('counts the rungs once a record is actually reviewed', () => {
    AUTHORSHIP['test-reviewed'] = { rung: 'reviewed' };
    try {
      expect(rungSummary(['a', 'b', 'test-reviewed'])).toBe('2 drafted, 1 reviewed');
    } finally {
      delete AUTHORSHIP['test-reviewed'];
    }
  });
});
