import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The worker entry exports a handler and nothing else that carries a value.
 *
 * The Workers runtime reads every named export of the entry module as an
 * entrypoint, so a plain constant there is offered to it as a request handler
 * and it refuses to start: "Incorrect type for map entry 'X': the provided
 * value is not of type 'function or ExportedHandler'".
 *
 * This is nastier than it sounds, because it does not fail where you would look
 * for it. `wrangler deploy` and its dry run only BUILD the bundle, so a
 * production deploy goes green and the live API keeps answering; what breaks is
 * `wrangler dev`, which actually boots the runtime. That is the local sandbox,
 * the one tool the project has so an agent can click an admin change instead of
 * handing it to Adrian. On 2026-09-06 exporting one number here took the
 * sandbox down for every session while CI stayed green all day, so nothing
 * announced it and the only symptom was verification quietly becoming
 * impossible.
 *
 * What is allowed follows the runtime's own sentence. A FUNCTION is a valid
 * entrypoint, so `export function` stays permitted and `deriveOrderJourney`
 * keeps the export its tests import. A CLASS is how a Durable Object is
 * declared, so classes are permitted too. Types are erased before the runtime
 * sees them, so `export type` and `export interface` never reach it. A bare
 * `const`, `let` or `var` is the one shape that cannot be an entrypoint, and it
 * is the one this test refuses.
 */

const entry = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

describe('the worker entry module', () => {
  it('exports no bare constant, which the runtime cannot treat as an entrypoint', () => {
    const offenders = [...entry.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm)]
      .map(match => match[1]);

    expect(offenders).toEqual([]);
  });

  it('still exports the default handler the runtime needs', () => {
    expect(entry).toMatch(/^export default\b/m);
  });
});
