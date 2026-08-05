import { describe, expect, it } from 'vitest';
import { NAMED_TEAS, NAMING_TRADITIONS, findNamedTeaById, matchNamedTea, namedTeasInTradition } from './namedTeas';

describe('matchNamedTea', () => {
  it('knows a tea that arrived already named', () => {
    expect(matchNamedTea('Courage', '勇气')).toMatchObject({ name: 'Courage', provenance: 'undisclosed' });
    expect(matchNamedTea('Yun Shen Chu')).toBeTruthy();
  });

  it('matches the Chinese name on its own', () => {
    expect(matchNamedTea(null, '智慧')).toMatchObject({ name: 'Wisdom' });
  });

  it('matches the whole name only, never inside a sentence', () => {
    // These are ordinary words. "Universe" would otherwise swallow any tea
    // whose description happens to mention one.
    expect(matchNamedTea('a tea that takes real courage to drink')).toBeNull();
    expect(matchNamedTea('Universe of flavour in every cup')).toBeNull();
  });

  it('says nothing about a tea it does not hold', () => {
    expect(matchNamedTea('Some other tea')).toBeNull();
    expect(matchNamedTea('')).toBeNull();
  });
});

describe('the holding itself', () => {
  it('is honest about what is not known', () => {
    const courage = findNamedTeaById('courage');
    expect(courage?.provenance).toBe('undisclosed');
    // The province is stated, the mountain is not. Neither is invented.
    expect(courage?.country).toBe('China');
    expect(courage?.description).toMatch(/unrecorded/i);
  });

  it('records the naming practice, not just the names', () => {
    expect(NAMING_TRADITIONS.length).toBeGreaterThan(0);
    expect(namedTeasInTradition(NAMING_TRADITIONS[0]).length).toBeGreaterThan(0);
  });

  it('never claims a provenance it was not given', () => {
    expect(NAMED_TEAS.every(tea => ['undisclosed', 'partial', 'stated'].includes(tea.provenance))).toBe(true);
  });
});
