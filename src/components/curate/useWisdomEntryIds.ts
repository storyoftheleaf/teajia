import { useEffect, useState } from 'react';

// Which Stock teas already have an approved Tea Wisdom entry, keyed by product
// id (GENERATED_ENTRIES, built from data/tea-reference/entries/). The entries
// are large, so they load once, late, and only where a tea's path is shown.
// Until they arrive the answer is null and the entry step is left out, never
// shown as missing.

let loaded: Promise<ReadonlySet<string>> | null = null;

export function loadWisdomEntryIds(): Promise<ReadonlySet<string>> {
  loaded ??= import('../../wisdom/reference/generatedEntries')
    .then(module => new Set(Object.keys(module.GENERATED_ENTRIES)) as ReadonlySet<string>)
    .catch(error => { loaded = null; throw error; });
  return loaded;
}

export function useWisdomEntryIds(enabled = true): ReadonlySet<string> | null {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    loadWisdomEntryIds().then(set => { if (current) setIds(set); }).catch(() => { if (current) setIds(null); });
    return () => { current = false; };
  }, [enabled]);
  return enabled ? ids : null;
}
