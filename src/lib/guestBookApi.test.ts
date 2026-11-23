import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guestBookApi } from './guestBookApi';

const { authedFetch } = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock('./api', () => ({ API_URL: '', authedFetch }));

describe('Guest Book API client', () => {
  beforeEach(() => authedFetch.mockReset());

  it('sends one text note for the signed-in attendee without requiring a shop account', async () => {
    await guestBookApi.send('rsvp/token', 'Thank you for the tea.');
    expect(authedFetch).toHaveBeenCalledWith('/api/rsvp/rsvp%2Ftoken/guest-book', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ note: 'Thank you for the tea.' }),
      cache: 'no-store',
      reportIncident: false,
    }));
  });

  it('sends the revision the host reviewed with the bound account identity', async () => {
    const identity = { accountId: 'host-shop', userId: 'host' };
    await guestBookApi.review('event', {
      id: 'note', display_name: 'Lin', note: 'Thank you.', revision: 4, status: 'pending',
    }, 'include', identity);

    expect(authedFetch).toHaveBeenCalledWith('/api/admin/events/event/guest-book/note/review', {
      method: 'POST',
      expectedAuth: identity,
      body: JSON.stringify({ action: 'include', revision: 4 }),
    });
  });
});
