interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const RECOVERY_KEY_PREFIX = 'teajia:chunk-recovery-attempted:';

function recoveryKey(scope: string): string {
  return `${RECOVERY_KEY_PREFIX}${scope}`;
}

/** Atomically claim the one automatic reload allowed for this chunk scope. */
export function claimChunkRecoveryAttempt(storage: RecoveryStorage, scope = 'app'): boolean {
  const key = recoveryKey(scope);
  if (storage.getItem(key) === '1') return false;
  storage.setItem(key, '1');
  return true;
}

/** A successful import proves the deployed shell and chunk are synchronized. */
export function clearChunkRecoveryAttempt(storage: RecoveryStorage, scope = 'app'): void {
  storage.removeItem(recoveryKey(scope));
}
