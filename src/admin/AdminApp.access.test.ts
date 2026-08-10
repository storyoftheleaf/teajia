import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AdminApp Wisdom access', () => {
  it('protects the Wisdom route with the same Publish bundle gate as other publishing tools', () => {
    const source = readFileSync(new URL('./AdminApp.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/path="wisdom" element=\{<ProtectedRoute hasAccess=\{hasPublishBundle\}/);
  });
});
