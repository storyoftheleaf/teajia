import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMissingCost, COST_REQUIRED_ON_CREATE } from '../src/costCurrency';

/**
 * A tea is not added without saying what it cost.
 *
 * `cost_amount` is `REAL DEFAULT 0`. So a create that simply does not mention
 * the column does not fail: it stores ZERO, and zero is not "unknown", it is a
 * free tea. The shelf then prices it at zero times three and prints $0.00. A
 * missing cost looks exactly like a cheap tea, which is why the identical shape
 * ran unnoticed on freight until it had cost real money.
 *
 * Four separate doors were doing it, each in a different way, which is the tell
 * that the schema was answering a question nobody asked:
 *
 *   - the Add Product form sent `parseFloat(formData.costAmount) || 0`,
 *   - `create_tea` computed `Number(args?.cost_amount ?? 0) || 0` BEFORE the
 *     currency guard ran, so the guard saw a zero amount, correctly decided a
 *     zero needs no currency, and waved it through,
 *   - the listing mirror wrote `body.cost_amount ?? 0` and `?? 'USD'`,
 *   - three intake doors named no cost column at all and let the default speak.
 *
 * Adrian's rule: the price is not optional when a tea is added, and the agent
 * door does not get a lesser requirement than the one with a form and somebody
 * watching.
 *
 * WHAT IS REFUSED IS ABSENCE, NOT ZERO. A tea that cost nothing is a real
 * thing: a gift, a vendor's sample. Typing 0 says so and is kept. That is the
 * same rule `enteredNumber()` enforces on every edit, applied at the one moment
 * a row comes into being.
 */

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');
/* Comments are stripped before any scan below. A guard that reads its own
   explanation is a guard that can only be satisfied by deleting the reason the
   rule exists, and the comment quoting `Number(args?.cost_amount ?? 0)` is
   exactly the note a future reader needs most. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const worker = stripComments(read('../src/index.ts'));
const mcp = stripComments(read('../src/mcp.ts'));

describe('the rule itself', () => {
  it('refuses a cost nobody entered', () => {
    for (const amount of [undefined, null, '', '   ', 'abc', NaN]) {
      expect(createMissingCost({ amount, currency: 'Yuan' }), `${String(amount)} passed`).toBe('amount');
    }
  });

  it('keeps a deliberate zero, because a gift is a real tea', () => {
    expect(createMissingCost({ amount: 0, currency: 'Yuan' })).toBeNull();
    expect(createMissingCost({ amount: '0', currency: 'Yuan' })).toBeNull();
  });

  it('refuses a cost with no currency, since a number without its unit is not a cost', () => {
    expect(createMissingCost({ amount: 120, currency: undefined })).toBe('currency');
    expect(createMissingCost({ amount: 120, currency: '' })).toBe('currency');
    // 'UNK' is this shop's sentinel for a currency nobody recorded.
    expect(createMissingCost({ amount: 120, currency: 'UNK' })).toBe('currency');
  });

  it('names which half is missing, so the caller is not left guessing', () => {
    expect(createMissingCost({ amount: undefined, currency: undefined })).toBe('amount');
    expect(COST_REQUIRED_ON_CREATE).toMatch(/cost_amount/);
    expect(COST_REQUIRED_ON_CREATE).toMatch(/cost_currency/);
  });
});

describe('every door that adds a tea is held to it', () => {
  it('the REST create path asks before it inserts', () => {
    expect(worker).toMatch(/createMissingCost\(\{\s*amount: body\.cost_amount/);
  });

  it('the agent door asks the RAW argument, before any conversion', () => {
    /* The ordering is the bug. `Number(args?.cost_amount ?? 0) || 0` first
       means the guard is handed a zero and cannot tell it from an answer. */
    const call = mcp.match(/createMissingCost\(\{ amount: args\?\.cost_amount[^)]*\)/);
    expect(call, 'create_tea no longer checks the raw argument').toBeTruthy();
    const guardAt = mcp.indexOf('createMissingCost({ amount: args?.cost_amount');
    const coerceAt = mcp.indexOf('const costAmount = ');
    expect(guardAt).toBeGreaterThan(-1);
    expect(coerceAt, 'the coercion runs before the guard again').toBeGreaterThan(guardAt);
  });

  it('the agent door does not coerce absence into zero any more', () => {
    expect(mcp).not.toMatch(/Number\(args\?\.cost_amount \?\? 0\)/);
  });

  it('the tool schema says the cost is required and offers no default currency', () => {
    const def = mcp.slice(mcp.indexOf("name: 'create_tea'"));
    const schema = def.slice(0, def.indexOf('\n  },'));
    expect(schema).toMatch(/required: \[[^\]]*'cost_amount'[^\]]*\]/);
    expect(schema).toMatch(/required: \[[^\]]*'cost_currency'[^\]]*\]/);
    /* A schema that advertises `default: 'USD'` on the currency is the model
       being TOLD to assume dollars, which is worse than it guessing. */
    expect(schema).not.toMatch(/cost_currency:\s*\{[^}]*default:/);
  });
});

describe('a door that cannot know the cost says so, rather than letting the default say free', () => {
  /*
   * These three land teas whose cost this shop genuinely does not have: a
   * receipt proposal, someone else's tea stored at Adrian's location, and a
   * tea imported from another shop's catalogue (whose cost is theirs, not his,
   * and is protected besides). Requiring them to invent a cost would be worse
   * than the bug. What they must not do is stay silent, because silence is
   * answered by `DEFAULT 0`, and 0 reads as free.
   */
  it('the receipt proposal names the column as NULL', () => {
    const door = worker.slice(worker.indexOf('handleAcceptReceiptProposal'));
    const insert = door.slice(door.indexOf('INSERT INTO products'), door.indexOf('INSERT INTO products') + 700);
    expect(insert, 'the insert stopped naming cost_amount, so the default answers again')
      .toMatch(/cost_amount/);
  });

  it('the cellar placement states a null cost in its body', () => {
    const door = worker.slice(worker.indexOf('handleApproveCellarPlacement'));
    expect(door.slice(0, 3000)).toMatch(/cost_amount: null/);
  });

  it('the inbound import states a null cost rather than omitting the column', () => {
    const door = worker.slice(worker.indexOf('const COPY_COLS'));
    expect(door.slice(0, 2000)).toMatch(/'cost_amount'/);
  });

  it('the listing mirror copies what it was given instead of inventing a cost or a currency', () => {
    expect(worker).not.toMatch(/body\.cost_amount \?\? 0/);
    expect(worker).not.toMatch(/body\.cost_currency \?\? 'USD'/);
  });
});

describe('the form Adrian actually types into', () => {
  const form = stripComments(read('../../src/admin/components/AddProductModal.tsx'));

  it('does not turn a blank cost into zero on its way to the wire', () => {
    // `parseFloat('')` is NaN and `NaN || 0` is 0, which is the whole bug.
    expect(form).not.toMatch(/cost_amount: parseFloat\([^)]*\) \|\| 0/);
    expect(form).toMatch(/cost_amount: enteredNumber\(formData\.costAmount\)/);
  });

  it('refuses a blank cost at submit, not only at the server', () => {
    expect(form).toMatch(/formData\.costAmount\.trim\(\) === ''/);
  });

  it('does not show 0.00 sitting in an empty required field', () => {
    const input = form.slice(form.indexOf('id="product-cost-input"'));
    expect(input.slice(0, 900)).not.toMatch(/placeholder="0\.00"/);
  });
});
