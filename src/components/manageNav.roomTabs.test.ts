import { describe, expect, it } from 'vitest';
import { buildManageItems, roomTabs } from './manageNav';

const EVERYTHING = buildManageItems({
  hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: true, isOwnerTier: true, platformRole: 'owner',
});
const room = (id: string) => EVERYTHING.find(item => item.id === id)!;

describe('the tabs across the top of a Manage room', () => {
  it('opens with the room itself, under the word its drawer button uses', () => {
    const tabs = roomTabs(room('publish'));
    expect(tabs[0]).toEqual({ id: 'publish', path: room('publish').path, label: 'Publish' });
    expect(tabs.map(t => t.label)).toEqual(['Publish', 'Collections', 'Guest notes', 'Wisdom', 'Hosts']);
  });

  it("leaves out a child that is only a tab of the room's own page", () => {
    // Sales' Wholesale is /admin/activity?tab=wholesale, a tab the Sales screen draws itself.
    expect(roomTabs(room('orders')).map(t => t.id)).toEqual(['orders']);
  });

  it('keeps a child on the same page that is not one of its tabs', () => {
    expect(roomTabs(room('curate')).map(t => t.id)).toContain('samples');
  });

  it('gives a room with no screens a single tab, which draws no row', () => {
    expect(roomTabs(room('people'))).toHaveLength(1);
  });
});
