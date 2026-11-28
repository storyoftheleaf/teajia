import { describe, expect, it } from 'vitest';
import { pourPath, tableAtSpaceToday } from './PourLink';

describe('the way to the pour page', () => {
  it('opens the pour page of the table itself', () => {
    expect(pourPath({ tableId: 'table 1' })).toBe('/account/host/table%201?pour=1');
  });

  it('carries the tea space in the address of the shop\'s pour page', () => {
    expect(pourPath({ placeId: 'place 1' })).toBe('/admin/pour?place=place+1');
    expect(pourPath({})).toBe('/admin/pour');
  });

  it('finds the table that sits at a tea space today, on the table\'s own clock', () => {
    const table = (id: string, date: string, space: string, status = 'published') =>
      ({ id, event_date: date, timezone: 'Asia/Makassar', space_id: space, lifecycle_status: status }) as never;
    const now = new Date('2026-11-27T18:30:00Z'); // the 28th in Makassar
    const tables = [
      table('yesterday', '2026-11-27T02:00:00Z', 'studio'),
      table('elsewhere', '2026-11-28T02:00:00Z', 'garden'),
      table('off', '2026-11-28T02:00:00Z', 'studio', 'cancelled'),
      table('today', '2026-11-28T07:00:00Z', 'studio'),
    ];
    expect(tableAtSpaceToday(tables, 'studio', now)?.id).toBe('today');
    expect(tableAtSpaceToday(tables, 'kitchen', now)).toBeNull();
  });
});
