import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { onRequestGet } from './i/[code]';

function call(code: string) {
  const next = vi.fn(async () => new Response('app', { status: 200 }));
  const response = onRequestGet({
    request: new Request(`https://teajia.com/i/${code}`),
    env: { WORKER_ORIGIN: 'https://api.teajia.com' },
    params: { code },
    next,
  } as unknown as Parameters<typeof onRequestGet>[0]);
  return { response, next };
}

describe('the short invoice link at the edge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redirects to the long pay link on its own origin', async () => {
    const fetchMock = vi.fn(async () => Response.json({ path: '/people/adrian-rasmussen/pay?account=teajia-bali&reference=TJB-00007&t=c6c1e92016bf417aa9a221275cf63268' }));
    vi.stubGlobal('fetch', fetchMock);
    const { response, next } = call('TJB-00007-c6c1e92016bf');
    const answer = await response;
    expect(answer.status).toBe(302);
    expect(answer.headers.get('Location')).toBe('https://teajia.com/people/adrian-rasmussen/pay?account=teajia-bali&reference=TJB-00007&t=c6c1e92016bf417aa9a221275cf63268');
    expect(String((fetchMock.mock.calls[0] as unknown[])[0] instanceof Request ? ((fetchMock.mock.calls[0] as unknown[])[0] as Request).url : (fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://api.teajia.com/api/public/invoice-links/TJB-00007-c6c1e92016bf');
    expect(next).not.toHaveBeenCalled();
  });

  it('hands an unknown code to the app', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Link not found' }, { status: 404 })));
    const { response, next } = call('TJB-00007-000000000000');
    expect((await response).status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('never redirects off the site', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ path: '//evil.example/people/x' })));
    const { response, next } = call('TJB-00007-c6c1e92016bf');
    expect((await response).status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('is routed to the function, not left to the static app', () => {
    const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8'));
    expect(routes.include).toContain('/i/*');
  });
});
