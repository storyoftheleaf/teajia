/** Preserve the exact pre-identity localStorage value before Zustand rewrites its envelope. */
export function preserveLegacyLocalBytes(sourceKey: string, backupKey: string, currentVersion: number) {
  try {
    if (localStorage.getItem(backupKey) !== null) return;
    const raw = localStorage.getItem(sourceKey);
    if (raw === null) return;
    let version: number | undefined;
    try { version = (JSON.parse(raw) as { version?: number })?.version; } catch { /* Retain malformed old bytes too. */ }
    if (typeof version === 'number' && version >= currentVersion) return;
    localStorage.setItem(backupKey, raw);
  } catch { /* Private browsing must not block capture. */ }
}
