import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { enteredNumber } from '../../src/admin/productUpdatePayload';

/**
 * Nothing entered is null. Anything entered is the number, zero included.
 *
 * This is the single rule behind a run of bugs that all looked unrelated and
 * were the same one. JavaScript makes the wrong thing easy at the boundary
 * where a form becomes a database row: `Number('')` is 0, `Number(null)` is 0,
 * and an empty input is falsy in the same way a typed zero is. So the natural
 * way to write the conversion silently turns "I cleared this" into "the value
 * is zero", and money does not survive that.
 *
 * What it cost, three times over. Products defaulted their freight to 0, so
 * every hand-entered tea sold with no freight in its price and a missing cost
 * looked exactly like a cheap tea. Clearing the freight field saved 0, so the
 * only way to unpin a tea made it ship free. And the retail override ran it
 * backwards with `value ? Number(value) : null`: a deliberate 0 is falsy, so
 * setting a price of zero became no price at all.
 *
 * The behaviour tests pin the rule. The source scan after them is what makes it
 * permanent, and it is scoped deliberately: this is not a ban on `Number()`
 * across a codebase that uses it 300 times, most of them harmlessly on a total
 * that is about to be displayed. It is a ban at ONE boundary, the switch every
 * admin edit passes through on its way to a column that is nullable in the
 * schema. That is where absence and zero are different facts, and it is the
 * only place they can be confused permanently.
 */

describe('a number the operator entered, or null because they did not', () => {
  it('reads an empty field as nothing said', () => {
    expect(enteredNumber('')).toBeNull();
    expect(enteredNumber('   ')).toBeNull();
    expect(enteredNumber(null)).toBeNull();
    expect(enteredNumber(undefined)).toBeNull();
  });

  it('reads a typed zero as zero, which is a thing a person can mean', () => {
    // Free freight, a free tea, a price of nothing. All real instructions.
    expect(enteredNumber(0)).toBe(0);
    expect(enteredNumber('0')).toBe(0);
    expect(enteredNumber('0.0')).toBe(0);
  });

  it('keeps ordinary numbers, typed or numeric', () => {
    expect(enteredNumber(85)).toBe(85);
    expect(enteredNumber('85')).toBe(85);
    expect(enteredNumber('12.5')).toBe(12.5);
    expect(enteredNumber(-3)).toBe(-3);
  });

  it('refuses a typo rather than writing it to a money column', () => {
    // NaN is not a number anybody entered. Leaving the field alone beats
    // storing nonsense where a price is computed from it.
    expect(enteredNumber('abc')).toBeNull();
    expect(enteredNumber(NaN)).toBeNull();
    expect(enteredNumber(Infinity)).toBeNull();
  });
});

describe('every numeric field crosses that boundary the same way', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../src/admin/productUpdatePayload.ts', import.meta.url)),
    'utf8',
  );
  /** Just the switch, so the helper's own `Number()` is not the thing scanned. */
  const cases = source.slice(source.indexOf('switch (field)'));

  it('never converts a value with a bare Number()', () => {
    // `Number(value)` was the majority convention here and it is the bug: it
    // turns a cleared field into 0 on seven money and measure columns.
    const offences = [...cases.matchAll(/case '[^']+':[^\n]*Number\(value\)[^\n]*/g)]
      .map(m => m[0].trim())
      .filter(line => !line.includes('enteredNumber('));
    expect(offences, 'a field converts its own value; use enteredNumber').toEqual([]);
  });

  it('never gates a conversion on truthiness, which eats a deliberate zero', () => {
    // The retail override did exactly this, and a price of 0 became no price.
    const offences = [...cases.matchAll(/case '[^']+':[^\n]*value\s*\?\s*Number\([^\n]*/g)]
      .map(m => m[0].trim());
    expect(offences, 'a truthy gate drops a typed zero; use enteredNumber').toEqual([]);
  });

  it('sends one rule to a column, however many doors reach it', () => {
    // fixed_retail_price_usd is written by two cases from two places in the
    // editor, and they used to disagree: one turned a cleared field into 0, the
    // other turned a typed 0 into null. Two doors to one column with opposite
    // rules is the shape that gave this shop four freight rates at once.
    const byColumn = new Map<string, Set<string>>();
    for (const match of cases.matchAll(/case '([^']+)':[^\n]*\{\s*([a-z_]+):\s*([^\n]*?)\s*\}/g)) {
      const [, , column, expression] = match;
      if (!expression.includes('enteredNumber') && !/Number\(/.test(expression)) continue;
      if (!byColumn.has(column)) byColumn.set(column, new Set());
      byColumn.get(column)!.add(expression.replace(/\s+/g, ' '));
    }
    const disagreeing = [...byColumn.entries()]
      .filter(([, expressions]) => expressions.size > 1)
      .map(([column, expressions]) => `${column}: ${[...expressions].join('  vs  ')}`);
    expect(disagreeing, 'two fields write one column by different rules').toEqual([]);
  });
});
