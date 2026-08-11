import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('public Wisdom states API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the fail-closed index manifest without authentication', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      states: [
        { node_type: 'cultivar', node_id: 'jin-xuan', public_state: 'hidden', is_public: false },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);

    await expect(api.publicWisdom.states()).resolves.toEqual({
      states: [
        { node_type: 'cultivar', node_id: 'jin-xuan', public_state: 'hidden', is_public: false },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/wisdom/states'),
      expect.not.objectContaining({ headers: expect.anything() }),
    );
  });
});
