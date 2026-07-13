import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const apiSource = readFileSync(new URL('../../src/lib/api.ts', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

describe('REST error contract', () => {
  it('dispatches account mismatch by stable code rather than prose', () => {
    expect(apiSource).toContain("data?.code === 'account_access_denied'");
    const proseMatches = [...apiSource.matchAll(/data\?\.error\s*===\s*['"]([^'"]+)['"]/g)]
      .map(match => match[1])
      .filter(value => value !== 'string');
    expect(proseMatches).toEqual([]);
  });

  it('keeps protocol-specific OAuth and JSON-RPC errors outside the REST helper', () => {
    expect(workerSource).toContain('function restError(');
    expect(readFileSync(new URL('../src/mcp.ts', import.meta.url), 'utf8')).toContain("jsonrpc: '2.0'");
  });
});
