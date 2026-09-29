import { describe, expect, it } from 'vitest';
import { buildManageItems, isManagePathActive } from './manageNav';

// Seven rooms, named for the job (todo/plans/archive/manage-regroup.md). The order is
// the order of a working day: bring tea in, shelve it, sell it, the people,
// hosting, publishing, then running the shop.

const OWNER = { hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: false, isOwnerTier: true, platformRole: null };

describe('the Manage rooms', () => {
  it('are seven, in the order of a working day', () => {
    expect(buildManageItems(OWNER).map(r => r.label))
      .toEqual(['Curate', 'Stock', 'Sales', 'People', 'Sessions', 'Publish', 'Settings']);
  });

  it('have no Dashboard row: Today opens from the word Manage', () => {
    const paths = buildManageItems(OWNER).flatMap(r => [r.path, ...(r.children ?? []).map(c => c.path)]);
    expect(paths).not.toContain('/admin/dashboard');
  });

  it('give every screen that had no door in the column a place', () => {
    const paths = buildManageItems(OWNER).flatMap(r => (r.children ?? []).map(c => c.path));
    expect(paths).toEqual(expect.arrayContaining(['/admin/tasting-events', '/admin/venues', '/admin/access']));
  });

  it('open Settings on Members & Access for someone who holds only the members bundle', () => {
    const settings = buildManageItems({ ...OWNER, isOwnerTier: false }).find(r => r.id === 'settings')!;
    expect(settings.path).toBe('/admin/access');
    expect(settings.children).toBeUndefined();
  });

  it('show Tea Masters under Publish only to an owner', () => {
    const labels = (f: typeof OWNER) => buildManageItems(f).find(r => r.id === 'publish')!.children!.map(c => c.label);
    expect(labels(OWNER)).toContain('Tea Masters');
    expect(labels({ ...OWNER, isOwnerTier: false })).not.toContain('Tea Masters');
  });
});

describe('where the person is standing', () => {
  it('tells two tabs of one screen apart by their query', () => {
    expect(isManagePathActive('/admin/network?tab=wholesale', '/admin/network', '?tab=wholesale')).toBe(true);
    expect(isManagePathActive('/admin/network?tab=catalog', '/admin/network', '?tab=wholesale')).toBe(false);
    expect(isManagePathActive('/admin/network?tab=catalog', '/admin/network', '')).toBe(false);
  });

  it('counts a detail page as its room, and not a sibling that shares a prefix', () => {
    expect(isManagePathActive('/admin/events', '/admin/events/42')).toBe(true);
    expect(isManagePathActive('/admin/compass', '/admin/compass-playbook')).toBe(false);
  });
});
