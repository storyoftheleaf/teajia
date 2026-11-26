// The review of launches 3 to 5 with every switch off
// (guests-build/launches-3-5-flags-off-audit.md): the site's part of the
// Launch 3 items fixed on build/l3-a3-privacy.
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ReportsAndRequests } from '../../admin/components/guestNotes/ReportsAndRequests';
import type { FamilyReport } from '../../lib/familyContract';

const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('item 6: the reports count is back for every member of staff', () => {
  it('says how many reports are waiting to staff who are not the platform owner', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const report: FamilyReport = { id: 'r1', target_kind: 'photograph', target_id: 'p1', reason: null, status: 'open', created_at: '2026-11-26T00:00:00Z' };
    client.setQueryData(['family-reports', 'open'], { reports: [report, { ...report, id: 'r2' }] });
    client.setQueryData(['family-restock-requests', 'open'], { requests: [] });
    const html = renderToStaticMarkup(<QueryClientProvider client={client}><ReportsAndRequests /></QueryClientProvider>);
    expect(html).toContain('2 reports waiting. Hiding takes it off every page at once.');
  });
});

describe('item 6: the RSVP sheet’s submit button holds only its words', () => {
  it('shows the waiting-list answer once, in the answer view, never inside the button', () => {
    const sheet = source('src/components/events/RSVPFormSheet.tsx');
    expect(sheet.match(/data-testid="seat-request-waiting"/g)).toHaveLength(1);
    const button = sheet.slice(sheet.indexOf('type="submit"'), sheet.indexOf('</button>', sheet.indexOf('type="submit"')));
    expect(button).not.toContain('<h3');
    expect(button).not.toContain('<div');
  });
});

describe('item 5: the gallery and a session’s tasting wait for Launch 3 on the site too', () => {
  it('mounts the photographs from the table and the paper notes offer only with the switch on', () => {
    const page = source('src/pages/AfterSitPage.tsx');
    expect(page).toMatch(/anyoneHostsOpen\(\) && <SessionGallery /);
    expect(page).toMatch(/anyoneHostsOpen\(\) && recap\.is_tasting && <PaperNotesLine /);
  });

  it('shows the tasting door and the "This is a tasting" choice only with the switch on', () => {
    expect(source('src/components/events/GuestManagement/ConfirmedView.tsx'))
      .toMatch(/data\.tasting && anyoneHostsOpen\(\) && \(\s*<TastingDoor/);
    const form = source('src/admin/components/EventForm/EditForm.tsx');
    expect(form).toMatch(/const contributionOpen = anyoneHostsOpen\(\);/);
    expect(form).toMatch(/onIsTastingChange=\{contributionOpen \?/);
    expect(form).toMatch(/\.\.\.\(contributionOpen && tastingKnownRef\.current \? \{ is_tasting: isTasting \} : \{\}\)/);
  });
});
