import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT, render, scanStoryPeople } from '../../../scripts/read-story-people.mjs';

describe('Read stories on the people they feature', () => {
  it('the committed list matches the stories, so a person linked in a story appears on their page', () => {
    // Stale means someone linked a person in a story without the list catching up; the build regenerates it, this says so first.
    expect(fs.readFileSync(OUTPUT, 'utf8')).toBe(render(scanStoryPeople()));
  });

  it('finds Porcelain and Tea on both Yan Jinwen and Adrian Rasmussen from the story\'s own links', () => {
    const porcelain = scanStoryPeople().find(story => story.href === '/read/porcelain-and-tea');
    expect(porcelain?.people).toEqual(['adrian-rasmussen', 'yan-jinwen']);
    expect(porcelain?.title).toBe('Porcelain and Tea');
  });
});
