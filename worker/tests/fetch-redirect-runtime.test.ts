import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Workers runtime refuses fetch(..., { redirect: 'error' }) before the request
// leaves: "Invalid redirect value, must be one of follow or manual". Node accepts it,
// so every route test passed while, on the live server, the WhatsApp approval check,
// both WhatsApp senders, the shipping email sender and PayPal threw in about 2 ms.
// Found 2026-11-25 from the hourly log (transport_error, 0 ms) and reproduced in workerd.
// Use 'manual': a redirect then comes back as a 3xx, which every caller treats as a failure,
// so credentials are still never sent on to another address.
const root = join(__dirname, '..', 'src');
const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? sources(join(dir, entry.name)) : /\.(ts|mjs|js)$/.test(entry.name) ? [join(dir, entry.name)] : []);

describe('fetch redirect mode', () => {
  it("never asks the Workers runtime for redirect 'error', which it rejects before the network", () => {
    const offenders = sources(root).filter(file => /redirect\s*:\s*['"]error['"]/.test(readFileSync(file, 'utf8')))
      .map(file => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
