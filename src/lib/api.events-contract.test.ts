import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, EmailDeliveryUnavailableError } from './api';

const emptyStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

describe('event API request contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', emptyStorage);
    vi.stubGlobal('sessionStorage', emptyStorage);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      location: { origin: 'https://www.teajia.com' },
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends duplicate slug and canonical event_date together', async () => {
    await api.events.duplicate('event-a', { slug: 'cliff-tea-copy', eventDate: '2032-05-06T10:00:00Z' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/events/event-a/duplicate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ slug: 'cliff-tea-copy', event_date: '2032-05-06T10:00:00Z' }),
      }),
    );
  });

  it('uses canonical tea-menu and tasting-note envelopes', async () => {
    await api.events.upsertTeaMenu('event-a', [{ custom_name: 'Rou Gui' }]);
    await api.rsvp.submitTastingNotes('guest-token', [{ rating: 5 }]);

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/api/admin/events/event-a/tea-menu'), expect.objectContaining({
      body: JSON.stringify({ items: [{ custom_name: 'Rou Gui' }] }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/rsvp/guest-token/tasting-notes'), expect.objectContaining({
      body: JSON.stringify({ notes: [{ rating: 5 }] }),
    }));
  });

  it.each(['sendEmailInvites', 'sendInvites', 'sendEventInvites'] as const)(
    '%s reports unavailable delivery without making a request',
    async helper => {
      const call = helper === 'sendEmailInvites'
        ? api.events[helper]('event-a', {})
        : api.events[helper]('event-a');

      await expect(call).rejects.toBeInstanceOf(EmailDeliveryUnavailableError);
      await expect(call).rejects.toThrow('Email delivery is not configured');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
