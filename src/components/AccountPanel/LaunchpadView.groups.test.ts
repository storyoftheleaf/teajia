import { describe, expect, it } from 'vitest';
import { TILE_GROUPS, groupTiles } from './LaunchpadView';
import { isYourTablePath, yourTablePageOpen } from '../../lib/yourTablePage';

// Your Table as a page (todo/plans/your-table.md, decision 3): the same tiles
// under quiet headings, each keeping its word.

describe('the page groups', () => {
  it('keeps every tile once, in the plan\'s order, and drops an empty group', () => {
    const tiles = ['steep', 'sessions', 'remember', 'cellar', 'discover', 'profile', 'orders', 'journey', 'manage'].map(id => ({ id }));
    const groups = groupTiles(tiles);
    expect(groups.map(group => [group.heading, group.tiles.map(tile => tile.id)])).toEqual([
      ['On your table', ['steep']],
      ['Your tea', ['cellar', 'remember', 'orders']],
      ['Your path', ['sessions', 'journey', 'discover']],
      ['Your page', ['profile']],
      ['Your tea houses', ['manage']],
    ]);
    expect(groups.flatMap(group => group.tiles)).toHaveLength(tiles.length);
  });

  it('puts the few-people tiles, and any tile no group names, in the last group without a heading', () => {
    const groups = groupTiles([{ id: 'steep' }, { id: 'atlas' }, { id: 'fixes' }, { id: 'something-new' }]);
    expect(groups.at(-1)).toEqual({ id: 'more', heading: null, tiles: [{ id: 'atlas' }, { id: 'fixes' }, { id: 'something-new' }] });
    const named = TILE_GROUPS.flatMap(group => group.tiles);
    expect(new Set(named).size).toBe(named.length);
  });
});

describe('the switch', () => {
  it('follows the site setting by default and an explicit setting wins either way', () => {
    expect(yourTablePageOpen({})).toBe(process.env.VITE_YOUR_TABLE_PAGE_OPEN === 'true');
    expect(yourTablePageOpen({ YOUR_TABLE_PAGE_OPEN: 'true' })).toBe(true);
    expect(yourTablePageOpen({ YOUR_TABLE_PAGE_OPEN: 'false' })).toBe(false);
  });

  it('knows its own three addresses and not the pages its tiles open', () => {
    expect(['/account', '/account/', '/account/sessions', '/account/tea-houses'].every(isYourTablePath)).toBe(true);
    expect(['/account/journal', '/account/cellar', '/shop', '/'].some(isYourTablePath)).toBe(false);
  });
});
