import { describe, expect, it } from 'vitest';
import { buildManageItems, TODAY_PATH, type ManageListFlags } from '../../components/manageNav';
import { adminRoutes, resolveAddress, type AdminRoute } from './routeTable.testkit';

// GUARD: one address per Manage room.
//
// src/components/manageNav.ts lists the rooms (and the screens under each);
// src/admin/AdminApp.tsx holds the routes. This test reads both and holds two
// things: every room opens a real screen (directly, or through a <Navigate>
// redirect), and no two rooms open the same screen. Both a room and a screen
// listed under it must also be a real route, and no two rows share an address.

const routes = adminRoutes();

/** Who is looking: an owner sees every room; a member who holds only the members bundle sees Settings as Members. */
const AS: Record<string, ManageListFlags> = {
  owner: { hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: false, isOwnerTier: true, platformRole: null, hasStock: true },
  admin: { hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: true, isOwnerTier: false, platformRole: null, hasStock: true },
  'members-only': { hasCatalog: false, hasSell: false, hasPublish: false, isAdmin: false, isOwnerTier: false, platformRole: null },
  platform: { hasCatalog: true, hasSell: true, hasPublish: true, isAdmin: false, isOwnerTier: true, platformRole: 'owner', hasStock: true },
};

/** The screens a Manage path finally draws: the routes after redirects, by pattern. */
function screensOf(path: string): { screens: string[]; leaves: AdminRoute[]; unmatched: boolean } {
  const resolved = resolveAddress(routes, path);
  return { screens: [...new Set(resolved.leaves.map(l => l.pattern))].sort(), leaves: resolved.leaves, unmatched: resolved.unmatched };
}

describe('every Manage room opens a real route', () => {
  for (const [who, flags] of Object.entries(AS)) {
    const rooms = buildManageItems(flags);
    it(`${who}: the rooms and their screens each resolve to a route with a screen`, () => {
      const broken: string[] = [];
      for (const room of rooms) {
        for (const row of [{ id: room.id, path: room.path }, ...(room.children ?? [])]) {
          const { leaves, unmatched } = screensOf(row.path);
          const draws = leaves.some(l => l.screens.length > 0);
          if (unmatched || !draws) broken.push(`${row.id} (${row.path})${unmatched ? ' matches no route and falls to the catch-all redirect' : ' reaches no screen'}`);
        }
      }
      expect(
        broken,
        'These Manage rows lead nowhere real. Point the row at a route that exists in src/admin/AdminApp.tsx, or add the route; do not leave a dead door in the nav.',
      ).toEqual([]);
    });
  }

  it('Today opens a real route too', () => {
    const { leaves, unmatched } = screensOf(TODAY_PATH);
    expect(unmatched).toBe(false);
    expect(leaves.some(l => l.screens.length > 0)).toBe(true);
  });
});

describe('no two Manage rooms open the same screen', () => {
  for (const [who, flags] of Object.entries(AS)) {
    it(`${who}: each room resolves to a screen of its own`, () => {
      const owners = new Map<string, string[]>();
      for (const room of buildManageItems(flags)) {
        const key = screensOf(room.path).screens.join(' + ');
        owners.set(key, [...(owners.get(key) ?? []), `${room.id} (${room.path})`]);
      }
      const shared = [...owners.entries()].filter(([, rooms]) => rooms.length > 1).map(([screen, rooms]) => `${rooms.join(' and ')} both open ${screen}`);
      expect(
        shared,
        'Two rooms lead to one screen. One word per place: give each room its own address, or fold one room into the other (navigation labels and routes change only with Adrian\'s yes).',
      ).toEqual([]);
    });

    it(`${who}: no two rows, rooms or screens under them, share one address`, () => {
      const seen = new Map<string, string[]>();
      for (const room of buildManageItems(flags)) {
        for (const row of [{ id: room.id, path: room.path }, ...(room.children ?? [])]) {
          seen.set(row.path, [...(seen.get(row.path) ?? []), row.id]);
        }
      }
      const twice = [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([path, ids]) => `${path}: ${ids.join(', ')}`);
      expect(twice, 'These rows share an address, so two words open one place.').toEqual([]);
    });
  }

  it('sees the seven rooms for an owner (the check is not running on an empty list)', () => {
    expect(buildManageItems(AS.owner).length).toBe(7);
    expect(routes.length).toBeGreaterThan(40);
  });
});
