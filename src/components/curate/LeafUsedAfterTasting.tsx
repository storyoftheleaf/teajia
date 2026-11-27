import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { refreshCommerceQueries } from '../../lib/refreshCommerce';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import type { Product } from '../../admin/types';

/** The Taste door takes the grams (intake plan step 4, Adrian 2026-11-27).
 *  Shown once a tasting of a tea in Stock is saved, never during the session:
 *  the leaf used comes off Stock as a tasting use. Leaving it empty takes
 *  nothing. A sample in the Library is never weighed, so it gets no line. */
export function LeafUsedAfterTasting({ stock, entryId, onDone }: { stock: Product; entryId: string; onDone: () => void }) {
  const accountId = useAppStore(s => s.activeAccountId);
  const queryClient = useQueryClient();
  const [grams, setGrams] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const key = useRef(crypto.randomUUID());
  const onBooks = Number(stock.stockGrams ?? 0);
  const save = async () => {
    const text = grams.trim();
    if (!text) { onDone(); return; }
    const used = Number(text);
    if (!Number.isFinite(used) || used <= 0) { setMessage('Type the grams used as a number above zero.'); return; }
    setBusy(true); setMessage('');
    try {
      await api.stockMovements.create(stock.id, {
        movement_type: 'sample_use', unit: 'g', expected_balance: Number.isFinite(onBooks) ? onBooks : 0,
        idempotency_key: key.current, quantity: used, source_compass_entry_id: entryId, note: 'Used in a tasting',
      }, { callerRefreshesCommerce: true });
      await refreshCommerceQueries(queryClient, accountId);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'Not saved. Try again.');
    } finally { setBusy(false); }
  };
  return <section aria-label="Leaf used in the tasting" className="flex flex-wrap items-end gap-3 py-2" data-testid="leaf-used">
    <label className="flex flex-col gap-1 text-ui-12 text-tea-text-sec">Leaf used in that tasting, to take off Stock
      <input inputMode="decimal" className="input-field w-28 px-3 py-2 text-ui-16" value={grams} onChange={event => setGrams(event.target.value)} aria-label="Grams used" placeholder="g" /></label>
    <Button variant="secondary" type="button" disabled={busy} onClick={() => void save()}>{grams.trim() ? (busy ? 'Saving…' : 'Take off Stock') : 'None'}</Button>
    {message && <p role="status" className="basis-full text-ui-12 text-tea-text-sec">{message}</p>}
  </section>;
}
