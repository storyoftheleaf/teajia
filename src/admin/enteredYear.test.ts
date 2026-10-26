import { describe, expect, it } from 'vitest';
import { enteredYear } from './enteredYear';
describe('entered tea year', () => {
  it('preserves uncertainty instead of silently erasing a decade', () => {
    expect(enteredYear('1980s')).toBe('1980s');
    expect(enteredYear(' 1990S ')).toBe('1990s');
    expect(enteredYear('1970s')).toBe('1970s');
  });
  it('keeps exact years numeric and absence unset', () => {
    expect(enteredYear('1998')).toBe(1998);
    expect(enteredYear(2020)).toBe(2020);
    expect(enteredYear('')).toBeNull();
    expect(enteredYear(null)).toBeNull();
  });
  it('refuses malformed years instead of writing null', () => {
    expect(()=>enteredYear('1995s')).toThrow();
    expect(()=>enteredYear('later')).toThrow();
    expect(()=>enteredYear('0')).toThrow();
  });
});
