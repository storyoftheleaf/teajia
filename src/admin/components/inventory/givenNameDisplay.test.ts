import { describe, expect, it } from 'vitest';
import { distinctGivenName } from './helpers';

describe('spreadsheet chosen names', () => {
  it('does not repeat copied source names, including their recorded vintage', () => {
    expect(distinctGivenName('Aged Liu Bao Tea', 'Aged Liu Bao Tea', 1990)).toBe('');
    expect(distinctGivenName('Aged Liu Bao Tea', '1990 Aged Liu Bao Tea', 1990)).toBe('');
    expect(distinctGivenName('1990s Aged Liu Bao', 'Aged Liu Bao', '1990s')).toBe('');
    expect(distinctGivenName('Aged Liu Bao', '  AGED  LIU BAO  ', 1990)).toBe('');
  });
  it('keeps distinct names and does not discard a different vintage', () => {
    expect(distinctGivenName('Aged Liu Bao', 'Warm Stone', 1990)).toBe('Warm Stone');
    expect(distinctGivenName('Aged Liu Bao', '1980 Aged Liu Bao', 1990)).toBe('1980 Aged Liu Bao');
    expect(distinctGivenName('Aged Liu Bao', null, 1990)).toBe('');
  });
});
