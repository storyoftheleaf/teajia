import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LaunchpadView } from './LaunchpadView';

// The Tea Atlas is private (docs/TEA_ATLAS.md): its door in Your Table exists
// only once the server has said this person may read it, and for nobody else.

const props = {
  user: { name: 'Rayi', email: 'rayi@example.test' },
  avatarDataUrl: null,
  onAvatarClick: () => undefined,
  roleBadgeLabel: null,
  accountName: null,
  locationLabel: null,
  hasManageRoom: false,
  manageEntryPath: '/admin/dashboard',
  isPlatformOwner: false,
  membershipsCount: 1,
  pendingInvoiceCount: 0,
  todayEventCount: 0,
  inboundUnreadCount: 0,
  journalLastAt: null,
  journalLastTea: null,
  collectionCount: 0,
  dispositionName: null,
  nextEvent: null,
  onClose: () => undefined,
  onOpenJournal: () => undefined,
  onOpenEvents: () => undefined,
  onOpenCellar: () => undefined,
  onOpenLocationSwitcher: () => undefined,
  onSignOut: () => undefined,
};

const render = (canReadAtlas?: boolean) => renderToStaticMarkup(
  <MemoryRouter>
    {React.createElement(LaunchpadView, { ...props, ...(canReadAtlas === undefined ? {} : { canReadAtlas }) } as never)}
  </MemoryRouter>,
);

describe('Your Table: the Tea Atlas door', () => {
  it('is there for someone the server lets read the Atlas', () => {
    expect(render(true)).toContain('>tea atlas<');
  });

  it('is not there for anyone else, including when nobody has asked yet', () => {
    expect(render(false)).not.toContain('tea atlas');
    expect(render()).not.toContain('tea atlas');
  });
});
