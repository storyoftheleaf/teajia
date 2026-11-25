import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useManageNav, isManagePathActive, roomTabs } from './manageNav';

// A Manage room's own screens, as tabs across the top of the page on a laptop.
// They used to be indented rows under the room in the column beside the rail;
// moving them here is what lets the staff drawer stay one button wide
// (LeftSidebar, 2026-11-25). The first tab is the room itself, under the same
// word as its drawer button, so one word still leads to one place.
//
// Phones keep their own site panel, so this is desktop only.
export const ManageRoomTabs: React.FC = () => {
  const { items } = useManageNav();
  const { pathname, search } = useLocation();
  const here = (path: string) => isManagePathActive(path, pathname, search);

  const room = items.find(item => here(item.path) || (item.children?.some(c => here(c.path)) ?? false));
  if (!room) return null;
  const tabs = roomTabs(room);
  if (tabs.length < 2) return null;

  // A child that matches wins over the room's own page, which shares its base.
  const activeChild = tabs.slice(1).find(t => here(t.path));
  const activeId = activeChild?.id ?? tabs[0].id;

  return (
    <nav
      aria-label={`${room.label} screens`}
      data-testid="manage-room-tabs"
      className="hidden lg:flex flex-wrap items-end gap-x-6 gap-y-1 px-8 pt-4 border-b border-tea-border shrink-0"
    >
      {tabs.map(tab => (
        <Link
          key={tab.id}
          to={tab.path}
          className="btn-tab"
          aria-current={tab.id === activeId ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};
