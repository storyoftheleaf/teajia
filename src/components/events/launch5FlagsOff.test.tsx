// The launch-5 flags-off audit (todo/reviews/launch-5-flags-off-audit.md on
// build/l5-flags-off-audit): the site's part. With every switch off, a guest
// and the shop read what main (13143c89) showed them.
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WaitlistView from './GuestManagement/WaitlistView';
import type { EventAttendee, TeaEvent } from '../../types/events';

const flags = vi.hoisted(() => ({ anyone: false }));
vi.mock('../../lib/anyoneHosts', () => ({ anyoneHostsOpen: () => flags.anyone, ANYONE_HOSTS_OPEN: false }));

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
afterEach(() => { flags.anyone = false; });

function waiting(open: boolean) {
  flags.anyone = open;
  const event = { title: 'A person’s table', eventDate: '2026-12-20T18:00', privateHost: true } as unknown as TeaEvent;
  const attendee = { waitlistPosition: 2, claimExpiresAt: null } as unknown as EventAttendee;
  const noop = () => undefined;
  return renderToStaticMarkup(
    <WaitlistView attendee={attendee} event={event} onClaimSeat={noop} claimPending={false} claimIsError={false} claimError={null}
      showCancelConfirm={false} onOpenCancelConfirm={noop} onCloseCancelConfirm={noop} onConfirmCancel={noop} cancelPending={false} />,
  );
}

describe('a waiting guest at a person’s table', () => {
  it('sees their place in line while Launch 3 is closed, as on main', () => {
    const html = waiting(false);
    expect(html).toContain('#2 in line.');
    expect(html).not.toContain('the host will answer you');
  });

  it('is told the host answers once Launch 3 is open', () => {
    expect(waiting(true)).toContain('If a seat opens, the host will answer you.');
  });
});

describe('the words that belong to a closed launch wait for its switch', () => {
  it('keeps main’s cancel words for a confirmed guest while Launch 3 is closed', () => {
    const view = source('src/components/events/GuestManagement/ConfirmedView.tsx');
    expect(view).toMatch(/const personsTableWords = event\.privateHost === true && anyoneHostsOpen\(\);/);
    expect(view).toMatch(/\{personsTableWords \? "I can't come" : 'Cancel my reservation'\}/);
    expect(view).toMatch(/personsTable=\{personsTableWords\}/);
  });

  it('shows the waiting-list answer on the RSVP sheet only with Launch 3 open', () => {
    const sheet = source('src/components/events/RSVPFormSheet.tsx');
    expect(sheet.match(/answer\?\.status === 'waitlist' && anyoneHostsOpen\(\)/g)).toHaveLength(2);
  });

  it('names Brewing experiences in recap photo review until the Tea Table opens', () => {
    const review = source('src/admin/components/RecapPhotoReview.tsx');
    expect(review).toMatch(/teaTableOpen\(\)\s*\? ' · Also offered for the Tea Table and the photo essay'\s*: ' · Also offered for Brewing experiences and the photo essay'/);
  });

  it('adds no seat notices block to Manage notifications while Launch 3 is closed', () => {
    const panel = source('src/admin/components/NotificationPanel.tsx');
    expect(panel).toMatch(/\{anyoneHostsOpen\(\) && \(\s*<div className="mb-6">\s*<SeatNoticeList/);
  });
});
