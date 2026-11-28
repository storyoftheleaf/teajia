import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailConsentRoutes, mayEmailAboutTea } from '../src/emailConsent';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { EMAIL_CONSENT_WORDING_VERSION, emailConsentTickedFor } from '../../src/lib/emailConsent';

// Email about tea: each answer is the person's own, kept with its time and the
// words shown; a host may be allowed only after a table of theirs was shared.

let database: SqliteD1;
beforeEach(() => {
  database = new SqliteD1('migrations');
  seedIdentity(database, { userId: 'guest', accountId: 'shop' });
  seedIdentity(database, { userId: 'host-a', accountId: 'shop' });
  seedIdentity(database, { userId: 'host-b', accountId: 'shop' });
  database.exec(`
    UPDATE users SET name = 'Mei' WHERE id = 'host-a';
    UPDATE users SET name = 'Tomas' WHERE id = 'host-b';
    INSERT INTO events (id, account_id, slug, title, event_date, host_user_id) VALUES
      ('sat', 'shop', 'sat', 'Evening', '2026-11-01', 'host-a'),
      ('own', 'shop', 'own', 'Mine', '2026-11-02', 'guest');
    INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, user_id) VALUES
      ('seat-1', 'shop', 'sat', 'Guest', 'confirmed', 'token-1', 'guest'),
      ('seat-2', 'shop', 'own', 'Guest', 'confirmed', 'token-2', 'guest');
  `);
});
afterEach(() => database.close());

const env = () => ({ DB: database as unknown as D1Database });

function call(method: string, path: string, user: string | null, body?: unknown, country?: string) {
  const routes = emailConsentRoutes({
    requireUser: async request => {
      const id = request.headers.get('x-user');
      return id ? { userId: id } : { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
    },
  });
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const want = pattern.split('/');
    const have = path.split('/');
    if (want.length !== have.length) continue;
    const params: Record<string, string> = {};
    if (!want.every((part, i) => part.startsWith(':') ? (params[part.slice(1)] = have[i], true) : part === have[i])) continue;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (user) headers['x-user'] = user;
    const request = new Request('https://worker.test' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (country) Object.defineProperty(request, 'cf', { value: { country } });
    return handler(request, env(), params);
  }
  throw new Error('no route ' + method + ' ' + path);
}

describe('email about tea', () => {
  it('opens the sign-up box ticked outside the EU, UK and Switzerland', async () => {
    expect(emailConsentTickedFor('ID')).toBe(true);
    expect(emailConsentTickedFor('US')).toBe(true);
    for (const code of ['DE', 'FR', 'GB', 'CH', 'NO', 'XX', '', null]) expect(emailConsentTickedFor(code)).toBe(false);
    expect(await (await call('GET', '/api/public/email-consent/default', null, undefined, 'TW')).json()).toEqual({ ticked: true });
    expect(await (await call('GET', '/api/public/email-consent/default', null, undefined, 'NL')).json()).toEqual({ ticked: false });
  });

  it('keeps the answer from Google sign-up once, with its time and words, and never over an answer given', async () => {
    const first = await (await call('POST', '/api/me/email-consent/signup', 'guest', { consent: true })).json() as any;
    expect(first.teajia.consent).toBe(true);
    expect(first.teajia.decided_at).toBeTruthy();
    await call('PUT', '/api/me/email-consent', 'guest', { consent: false });
    const again = await (await call('POST', '/api/me/email-consent/signup', 'guest', { consent: true })).json() as any;
    expect(again.teajia.consent).toBe(false);
    expect(await mayEmailAboutTea(env().DB, 'guest')).toBe(false);
    const log = database.sqlite.prepare('SELECT consent, source, wording_version FROM email_consent_log WHERE user_id = ? ORDER BY created_at, rowid').all('guest');
    expect(log).toEqual([
      { consent: 1, source: 'signup-google', wording_version: EMAIL_CONSENT_WORDING_VERSION },
      { consent: 0, source: 'account', wording_version: EMAIL_CONSENT_WORDING_VERSION },
    ]);
  });

  it('offers the hosts a person sat with, never themselves, and lets only them say yes', async () => {
    const before = await (await call('GET', '/api/me/email-consent', 'guest')).json() as any;
    expect(before.teajia).toEqual({ consent: false, decided_at: null });
    expect(before.hosts).toEqual([{ host_user_id: 'host-a', name: 'Mei', allowed: false, decided_at: null }]);

    expect((await call('PUT', '/api/me/email-consent/hosts/host-b', 'guest', { allowed: true })).status).toBe(404);
    const after = await (await call('PUT', '/api/me/email-consent/hosts/host-a', 'guest', { allowed: true })).json() as any;
    expect(after.hosts[0].allowed).toBe(true);
    expect(await mayEmailAboutTea(env().DB, 'guest', 'host-a')).toBe(true);
    expect(await mayEmailAboutTea(env().DB, 'guest', 'host-b')).toBe(false);
    // Another person's choices are not theirs to read.
    const other = await (await call('GET', '/api/me/email-consent', 'host-b')).json() as any;
    expect(other.hosts).toEqual([]);
    expect((await call('GET', '/api/me/email-consent', null)).status).toBe(401);
  });
});
