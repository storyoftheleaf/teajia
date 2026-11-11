import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('guest page: closed is not completed', () => {
  it("does not treat status 'closed' (registration closed) as the session being over", () => {
    const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
    const line = source.split('\n').find((l) => l.includes('const isCompleted')) ?? '';
    expect(line).not.toContain("'closed'");
    expect(line).toContain('eventPast');
  });
});
