import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const apiSource = readFileSync(new URL('../../src/lib/api.ts', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const productsApiSource = apiSource.slice(apiSource.indexOf('products: {'), apiSource.indexOf('\n  rates: {'));

describe('product command route contract', () => {
  it('has no frontend or Worker fallback to the generic product update route', () => {
    expect(productsApiSource).not.toMatch(/\bupdate:\s*async\s*\(id:\s*string,\s*data:/);
    expect(apiSource).not.toContain('groups.legacy');
    expect(apiSource).not.toContain("putProductUpdate(id, '',");
    expect(workerSource).not.toContain('const handleUpdateProduct: Handler');
    expect(workerSource).not.toContain("['PUT', '/api/products/:id', handleUpdateProduct]");
  });
});
