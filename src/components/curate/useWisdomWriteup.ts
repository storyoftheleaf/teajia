import { useEffect, useState } from 'react';
import type { WisdomNeedsProduct } from '../../wisdom/reference/wisdomNeeds';

// The write-up step reads the one Wisdom Base check, wisdomNeeds(), the same
// rules as the "Wisdom Base" fold on the tea in Stock (WisdomNeedsList). The
// entry is composed by the Tea Wisdom chain from those pages, never by a
// separate writer (Adrian, 2026-11-27). The pages are large, so they load only
// when a tea actually reaches this step.

export type WisdomWriteup = { open: number } | null;

export function useWisdomWriteup(product: WisdomNeedsProduct, enabled: boolean): WisdomWriteup {
  const [state, setState] = useState<WisdomWriteup>(null);
  const key = JSON.stringify(product);
  useEffect(() => {
    if (!enabled) { setState(null); return; }
    let current = true;
    void Promise.all([
      import('../../wisdom/reference/wisdomNeeds'),
      import('../../wisdom/reference/generatedPages'),
      import('../../wisdom/reference/generatedClaims'),
    ]).then(([needs, pages, claims]) => {
      if (!current) return;
      const list = needs.wisdomNeeds(product, { published: { pages: pages.GENERATED_TEA_REFERENCE_PAGES, claims: claims.GENERATED_CLAIMS } });
      setState({ open: list.filter(need => !need.covered).length });
    }).catch(() => { if (current) setState(null); });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return state;
}

/** The words the write-up step shows for the Wisdom Base state. */
export function wisdomWriteupHint(state: WisdomWriteup): string | undefined {
  if (!state) return undefined;
  return state.open === 0 ? 'Entry ready to write' : `Wisdom pages needed: ${state.open}`;
}
