import { describe, expect, it } from 'vitest';
import { AUTHORSHIP, authorshipLine, getAuthorship } from './authorship';

describe('authorship rungs', () => {
  it('defaults an unlisted entity to drafted', () => {
    expect(getAuthorship('some-cultivar-nobody-touched')).toEqual({ rung: 'drafted' });
  });

  it('defaults a missing id to drafted', () => {
    expect(getAuthorship(null)).toEqual({ rung: 'drafted' });
    expect(getAuthorship(undefined)).toEqual({ rung: 'drafted' });
  });

  it('writes the drafted line for an entry nobody has read yet', () => {
    expect(authorshipLine('unreviewed-cultivar')).toBe('Drafted from research. Not yet read by a human.');
  });

  it('writes the reviewed line with reviewer and date when set', () => {
    AUTHORSHIP['test-reviewed-entry'] = { rung: 'reviewed', reviewer: 'Adrian', date: '2026-07-27' };
    expect(authorshipLine('test-reviewed-entry')).toBe('Reviewed and corrected by Adrian, 2026-07-27.');
    delete AUTHORSHIP['test-reviewed-entry'];
  });

  it('writes the reviewed line without a date when none is set', () => {
    AUTHORSHIP['test-reviewed-no-date'] = { rung: 'reviewed', reviewer: 'Adrian' };
    expect(authorshipLine('test-reviewed-no-date')).toBe('Reviewed and corrected by Adrian.');
    delete AUTHORSHIP['test-reviewed-no-date'];
  });

  it('writes the authored line for Adrian\'s own words', () => {
    AUTHORSHIP['test-authored-entry'] = { rung: 'authored', reviewer: 'Adrian', date: '2026-07-27' };
    expect(authorshipLine('test-authored-entry')).toBe('Written by Adrian, 2026-07-27.');
    delete AUTHORSHIP['test-authored-entry'];
  });

  it('falls back to Adrian when a reviewed or authored entry names no reviewer', () => {
    AUTHORSHIP['test-no-reviewer'] = { rung: 'authored', date: '2026-07-27' };
    expect(authorshipLine('test-no-reviewer')).toBe('Written by Adrian, 2026-07-27.');
    delete AUTHORSHIP['test-no-reviewer'];
  });

  it('returns the same drafted line for an unknown id as for a known drafted one', () => {
    expect(authorshipLine('totally-unknown-id-xyz')).toBe(authorshipLine('another-unlisted-one'));
  });
});
