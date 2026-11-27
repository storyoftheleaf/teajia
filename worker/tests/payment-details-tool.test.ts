import { describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { maskDigits, paymentDetailsTools } from '../src/mcpTools/paymentDetails';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';

/** The profile's paste box as an agent tool: own profile only, numbers kept out of previews and tickets. */
const A = 'acct-a';
const auth = (userId = 'u1'): ToolAuth => ({ accountId: A, userId, userEmail: `${userId}@example.invalid`, tokenId: 't1', creatorTier: 'account_owner' });
const PASTE = [
  'Send money to:',
  'Name: Example Person',
  '',
  'From the US (domestic):',
  'Account type: Checking',
  'Routing number (for wire and ACH): 111000025',
  'Account number: 123456789012',
].join('\n');

function setup() {
  const db = new SqliteD1('migrations');
  db.exec(`INSERT INTO accounts (id, slug, name) VALUES ('${A}', 'shop-a', 'Shop A')`);
  db.exec("INSERT INTO users (id, name, email, password_hash) VALUES ('u1', 'Owner', 'u1@example.invalid', 'x'), ('u2', 'Other', 'u2@example.invalid', 'x')");
  db.exec("INSERT INTO contributors (id, account_id, user_id, display_name, is_published) VALUES ('c1', 'acct-a', 'u1', 'Owner Page', 1)");
  return { db, env: { DB: db as unknown as D1Database } as ToolEnv };
}
const call = (env: ToolEnv, args: Record<string, unknown>, who = auth()) =>
  paymentDetailsTools.handlers.set_my_payment_details(env, who, args) as Promise<Record<string, any>>;

describe('set_my_payment_details', () => {
  it('previews with numbers hidden, then saves the paste on the caller\'s own profile', async () => {
    const { db, env } = setup();
    const preview = await call(env, { details: PASTE, label: 'Wise' });
    expect(preview.preview.method).toEqual({ label: 'Wise', recipient_name: 'Example Person', replaces_existing: false });
    expect(preview.preview.details_masked).not.toContain('123456789012');
    expect(preview.preview.details_masked).toContain('••••9012');
    const ticket = await db.prepare('SELECT payload_json FROM mcp_confirmation_tickets').first<{ payload_json: string }>();
    expect(ticket!.payload_json).not.toContain('123456789012');
    expect(await db.prepare('SELECT count(*) AS n FROM payment_methods').first()).toEqual({ n: 0 });

    const done = await call(env, { details: PASTE, label: 'Wise', confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, label: 'Wise', replaced_existing: false });
    expect(await db.prepare('SELECT contributor_id, method_type, label, recipient_name, instructions, is_published, account_id FROM payment_methods').first())
      .toEqual({ contributor_id: 'c1', method_type: 'bank_transfer', label: 'Wise', recipient_name: 'Example Person', instructions: PASTE, is_published: 1, account_id: null });
    const audit = await db.prepare('SELECT action, redacted_snapshot FROM payment_method_audit_events').first<{ action: string; redacted_snapshot: string }>();
    expect(audit!.action).toBe('created');
    expect(audit!.redacted_snapshot).not.toContain('123456789012');
  });

  it('replaces the row with the same label instead of adding a second one', async () => {
    const { db, env } = setup();
    const first = await call(env, { details: PASTE, label: 'Wise' });
    await call(env, { details: PASTE, label: 'Wise', confirm: first.confirmation_token });
    const changed = PASTE.replace('123456789012', '999988887777');
    const again = await call(env, { details: changed, label: 'Wise' });
    expect(again.preview.method.replaces_existing).toBe(true);
    await call(env, { details: changed, label: 'Wise', confirm: again.confirmation_token });
    const rows = await db.prepare('SELECT instructions FROM payment_methods').all();
    expect(rows.results).toEqual([{ instructions: changed }]);
  });

  it('refuses a confirm whose details differ from the preview', async () => {
    const { env } = setup();
    const preview = await call(env, { details: PASTE, label: 'Wise' });
    expect(await call(env, { details: `${PASTE}\nSwift/BIC: OTHERXX1`, label: 'Wise', confirm: preview.confirmation_token }))
      .toEqual({ error: 'invalid_or_expired_confirmation_token' });
  });

  it('needs the caller\'s own profile', async () => {
    const { env } = setup();
    expect(await call(env, { details: PASTE }, auth('u2'))).toMatchObject({ error: 'profile_required' });
  });

  it('masks long digit runs only', () => {
    expect(maskDigits('Account number: 1234 5678 9012\nSwift: ABCDUS33')).toBe('Account number: ••••9012\nSwift: ABCDUS33');
  });
});
