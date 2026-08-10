import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profile connection API clients', () => {
  it('loads article references for a public tea product', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      articles: [{ id: 'a1', slug: 'wuyi-fire', title: 'Wuyi Fire', subtitle: null, author_name: 'Rayi' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);

    await expect(api.publicXref.productArticles('tea/rou-gui')).resolves.toEqual({
      articles: [{ id: 'a1', slug: 'wuyi-fire', title: 'Wuyi Fire', subtitle: null, author_name: 'Rayi' }],
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/public/xref/products/tea%2Frou-gui/articles'), expect.anything());
  });

  it('saves canonical contributor account associations', async () => {
    vi.stubGlobal('localStorage', emptyStorage);
    vi.stubGlobal('sessionStorage', emptyStorage);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await api.people.updateContributorAccounts('rayi', [{ account_id: 'rayi-master', public_role: 'Tea Master', is_host: true, display_order: 0 }]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/contributors/rayi/accounts'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ accounts: [{ account_id: 'rayi-master', public_role: 'Tea Master', is_host: true, display_order: 0 }] }) }),
    );
  });

  it('sends a reviewer note when requesting profile changes', async () => {
    vi.stubGlobal('localStorage', emptyStorage);
    vi.stubGlobal('sessionStorage', emptyStorage);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ contributor: { id: 'barry' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    await api.people.requestContributorChanges('barry', 'Please add your location.');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/contributors/barry/request-changes'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ note: 'Please add your location.' }) }),
    );
  });

  it('normalizes the public payment contract including resolved store and associations', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      contributor: { id: 'rayi', display_name: 'Rayi' },
      store: { slug: 'rayi-master', name: 'Rayi Tea' },
      has_any_method: true,
      available_accounts: [{ slug: 'rayi-master', name: 'Rayi Tea' }],
      payment_methods: [{ id: 'pay-1', method_type: 'payment_link', label: 'Transfer', recipient_name: 'Rayi', is_published: 1, position: 0 }],
      context: { display_only: true },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);

    const result = await api.profile.getPublicPaymentMethods('rayi', 'rayi-master');

    expect(result.account).toEqual({ slug: 'rayi-master', name: 'Rayi Tea' });
    expect(result.contributor.associations).toEqual([expect.objectContaining({ account_id: 'rayi-master', account_slug: 'rayi-master', account_name: 'Rayi Tea' })]);
    expect(result.hasAnyMethod).toBe(true);
    expect(result.methods).toHaveLength(1);
  });
});
