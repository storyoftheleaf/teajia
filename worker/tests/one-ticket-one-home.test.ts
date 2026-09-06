import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PENDING_TTL_MS, consumeTicket, issueTicket } from '../src/mcpTools/tickets';
import { SqliteD1 } from './helpers/sqliteD1';

/**
 * The confirmation ticket has one home, and the reason is not tidiness.
 *
 * Four tool modules were written at once. `mcp.ts` imports them, so none of
 * them could import its ticket helpers back without a cycle, and all four wrote
 * their own. All four reasoned carefully. All four reasoned differently:
 *
 *   - Two put `kind` and `account_id` inside the UPDATE's WHERE. Two checked
 *     them after the row came back, which marks a wrong-kind ticket consumed on
 *     its way to being rejected. A model that hands an `add_stock` ticket to
 *     `publish_collection` then SPENDS a confirmation Adrian gave for something
 *     else, and the tool he actually confirmed fails next.
 *   - Three awaited the housekeeping reap inside a try. One left it on a
 *     floating `.catch()`, which throws against the D1 shim these tests run on.
 *   - Three redefined a `sha256Hex` that `inquiryDomain` already exports.
 *   - Five places held the five-minute TTL: one real, four comments promising
 *     to mirror it.
 *
 * That is the four-freight-rates shape with a different number in it. There the
 * drift was money; here it is a security property, which is worse, because a
 * ticket spent wrongly leaves no trace that reads as a fault.
 */

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');

const moduleFiles = readdirSync(here('../src/mcpTools'))
  .filter(f => f.endsWith('.ts') && f !== 'tickets.ts' && f !== 'registry.ts');

describe('no module re-implements the ticket', () => {
  it('finds tool modules to check, so this suite cannot pass by looking at nothing', () => {
    expect(moduleFiles.length).toBeGreaterThan(0);
  });

  for (const file of moduleFiles) {
    it(`${file} imports the shared helper instead of writing its own`, () => {
      const src = read(`../src/mcpTools/${file}`);
      expect(src, `${file} defines its own issueTicket`).not.toMatch(/^(export )?async function issueTicket/m);
      expect(src, `${file} defines its own consumeTicket`).not.toMatch(/^(export )?async function consumeTicket/m);
      expect(src, `${file} redefines sha256Hex, which inquiryDomain exports`)
        .not.toMatch(/^(export )?async function sha256Hex/m);
      expect(src, `${file} holds its own copy of the ticket TTL`)
        .not.toMatch(/^const \w*TTL_MS\s*=\s*\d/m);
      if (/confirmation_token|consumeShared|consumeTicket\(/.test(src)) {
        expect(src, `${file} uses tickets but does not import them`).toMatch(/from '\.\/tickets'/);
      }
    });
  }
});

describe('the TTL has one home', () => {
  it('is five minutes', () => {
    expect(PENDING_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('is the same five minutes the built-in tools give, by import and not by comment', () => {
    const mcp = read('../src/mcp.ts');
    expect(mcp).toMatch(/from '\.\/mcpTools\/tickets'/);
    // The literal is what a comment-mirrored copy looks like. It must be gone.
    expect(mcp).not.toMatch(/const PENDING_TTL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  });
});

/**
 * The behaviour the shared helper is chosen FOR. If someone reverts to the
 * check-after-consume shape these two tests are what fails.
 */
describe('consuming is guarded before it is destructive', () => {
  const auth = {
    accountId: 'acc_a', userId: 'u1', userEmail: 'a@b.c',
    tokenId: 'tok_1', creatorTier: 'account_owner',
  };
  // The real schema, not a hand-written table: the point of the helper is the
  // exact columns and constraints the live ticket row has.
  const fresh = () => ({ DB: new SqliteD1() as any });

  it('does not spend a ticket that belongs to another tool', async () => {
    const env = fresh();
    const token = await issueTicket(env, { kind: 'add_stock', accountId: 'acc_a' }, 'tok_1');

    const wrongTool = await consumeTicket(env, token, 'publish_collection', auth);
    expect(wrongTool).toBeNull();

    // Still live: the tool Adrian actually confirmed can still commit.
    const rightTool = await consumeTicket(env, token, 'add_stock', auth);
    expect(rightTool).not.toBeNull();
  });

  it('does not spend a ticket that belongs to another shop', async () => {
    const env = fresh();
    const token = await issueTicket(env, { kind: 'add_stock', accountId: 'acc_b' }, 'tok_1');
    expect(await consumeTicket(env, token, 'add_stock', auth)).toBeNull();
    const owner = { ...auth, accountId: 'acc_b' };
    expect(await consumeTicket(env, token, 'add_stock', owner)).not.toBeNull();
  });

  it('is single-use, so a confirm cannot be replayed', async () => {
    const env = fresh();
    const token = await issueTicket(env, { kind: 'add_stock', accountId: 'acc_a' }, 'tok_1');
    expect(await consumeTicket(env, token, 'add_stock', auth)).not.toBeNull();
    expect(await consumeTicket(env, token, 'add_stock', auth)).toBeNull();
  });

  it('will not let a sibling token confirm what it never previewed', async () => {
    const env = fresh();
    const token = await issueTicket(env, { kind: 'add_stock', accountId: 'acc_a' }, 'tok_1');
    expect(await consumeTicket(env, token, 'add_stock', { ...auth, tokenId: 'tok_2' })).toBeNull();
  });
});
