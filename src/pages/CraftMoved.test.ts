import { describe, expect, it } from 'vitest';
import { craftMovedTo } from './CraftMoved';

describe('old Craft addresses', () => {
  it('send the glossary to the Wisdom Base', () => {
    expect(craftMovedTo('?v=glossary')).toBe('/wisdom/glossary');
  });
  it('send the landing to Lessons', () => {
    expect(craftMovedTo('')).toBe('/read/lessons');
  });
  it('send every lesson to the same view on Lessons', () => {
    for (const view of ['journeys', 'course', 'reading', 'spaces', 'wisdom']) {
      expect(craftMovedTo(`?v=${view}`)).toBe(`/read/lessons?v=${view}`);
    }
  });
});
