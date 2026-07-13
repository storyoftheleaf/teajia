import { describe, expect, it } from 'vitest';
import { claimChunkRecoveryAttempt, clearChunkRecoveryAttempt } from './chunkRecovery';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('chunk recovery circuit breaker', () => {
  it('allows only one automatic reload until the chunk loads successfully', () => {
    const storage = memoryStorage();

    expect(claimChunkRecoveryAttempt(storage)).toBe(true);
    expect(claimChunkRecoveryAttempt(storage)).toBe(false);

    clearChunkRecoveryAttempt(storage);
    expect(claimChunkRecoveryAttempt(storage)).toBe(true);
  });
});
