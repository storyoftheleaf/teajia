import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../components/shared/Button';
import { ApiError, api } from '../../../../lib/api';
import { refreshCommerceQueries } from '../../../../lib/refreshCommerce';
import { useAppStore } from '../../../../lib/store';
import type { Product } from '../../../types';

// Count mode (Adrian, 2026-11-26): stand at the shelf, type what is there, press
// Enter, and the next tea is ready. Each Enter writes one recount to the stock
// ledger, the same entry the Recount sheet writes. A blank Enter writes nothing
// and moves on; a typed 0 is a real count of zero.

type Unit = 'g' | 'unit';
const unitOf = (tea: Product): Unit => (tea.type === 'Teaware' ? 'unit' : 'g');
// A tea with no balance yet stands at nothing on the books, the same as on the Recount sheet.
const held = (value: unknown): number => { const amount = Number(value ?? NaN); return Number.isFinite(amount) ? amount : 0; };
const booksOf = (tea: Product): number => held(unitOf(tea) === 'unit' ? tea.quantityUnits : tea.stockGrams);
const say = (amount: number, unit: Unit) => (unit === 'unit' ? `${amount} ${amount === 1 ? 'unit' : 'units'}` : `${amount} g`);

/** The teas on screen, top to bottom, so the count walks the list as it reads. */
export function teasOnScreen(): string[] {
  return [...document.querySelectorAll('.stock-rooms tr[data-product-id]')]
    .map(line => line.getAttribute('data-product-id') || '').filter(Boolean);
}

export function StockCountBar({ ids, from, find, onCounted, onClose }: {
  ids: readonly string[]; from: number; find: (id: string) => Product | undefined;
  onCounted: (id: string, after: number, unit: Unit) => void; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accountId = useAppStore(state => state.activeAccountId);
  const [at, setAt] = useState(from);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  // One key per tea, kept across a failed try, so a retry can never count twice.
  const keys = useRef(new Map<string, string>());
  // What the shop said the balance is, when it disagreed with this page.
  const latest = useRef(new Map<string, number>());
  const savedRef = useRef(0); savedRef.current = saved;

  const id = ids[at];
  const tea = id ? find(id) : undefined;
  const unit = tea ? unitOf(tea) : 'g';
  const books = tea ? latest.current.get(tea.id) ?? booksOf(tea) : 0;

  useEffect(() => {
    setValue(''); setError('');
    const line = id ? document.querySelector<HTMLElement>(`.stock-rooms tr[data-product-id="${CSS.escape(id)}"]`) : null;
    line?.setAttribute('data-counting', '');
    line?.scrollIntoView({ block: 'center' }); // centred, so the bar below never covers the tea being counted
    (id ? input.current : done.current)?.focus();
    return () => line?.removeAttribute('data-counting');
  }, [id]);

  // The shelf rows are already corrected one by one; what depends on them is read once, at the end.
  useEffect(() => () => {
    if (savedRef.current > 0) void refreshCommerceQueries(queryClient, accountId, { shelfRowsReconciled: true });
  }, [queryClient, accountId]);

  const move = (step: number) => setAt(now => Math.max(0, Math.min(ids.length, now + step)));

  const save = async () => {
    if (!tea || saving) return;
    const text = value.trim();
    if (!text) { move(1); return; }
    const next = Number(text);
    if (!Number.isFinite(next) || next < 0) { setError('Type the amount as a number, zero or more.'); return; }
    if (unit === 'unit' && !Number.isInteger(next)) { setError('Pieces are counted in whole numbers.'); return; }
    const key = keys.current.get(tea.id) ?? crypto.randomUUID();
    keys.current.set(tea.id, key);
    setSaving(true); setError('');
    try {
      const result = await api.stockMovements.create(tea.id, {
        movement_type: 'recount', unit, expected_balance: books, idempotency_key: key, balance: next,
      }, { callerRefreshesCommerce: true });
      keys.current.delete(tea.id); latest.current.delete(tea.id);
      onCounted(tea.id, Number(result.after_balance), unit);
      setSaved(count => count + 1);
      move(1);
    } catch (caught) {
      const shopBalance = caught instanceof ApiError && caught.status === 409 ? Number(caught.data?.current_balance) : NaN;
      if (Number.isFinite(shopBalance)) {
        latest.current.set(tea.id, shopBalance); keys.current.delete(tea.id);
        setError(`The shop now has ${say(shopBalance, unit)} on the books. Press Enter again to save your count.`);
      } else {
        setError(`${caught instanceof Error && caught.message ? caught.message : 'The count was not saved.'} Press Enter to try again.`);
      }
    } finally { setSaving(false); }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === 'Enter') { event.preventDefault(); if (tea) void save(); else if (id) move(1); else onClose(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); if (!saving) move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (!saving) move(-1); }
  };

  return <div role="group" aria-label="Count mode" data-testid="stock-count-bar" onKeyDown={onKey}
    className="stock-count-bar fixed bottom-6 left-1/2 z-modal flex max-w-full -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-tea-elevated px-5 py-3 shadow-lg">
    {id ? <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-ui-17 leading-tight text-tea-text" data-testid="stock-count-name">{tea?.productName || 'This tea has left the list'}</span>
        <span className="text-ui-12 text-tea-text-sec">On the books: <span className="font-mono tabular-nums lining-nums">{say(books, unit)}</span></span>
      </span>
      <label className="flex items-center gap-2 text-ui-13 text-tea-text-sec">
        <input ref={input} type="text" inputMode="decimal" autoComplete="off" value={value} disabled={saving || !tea}
          onChange={event => setValue(event.target.value)} aria-label={`Counted amount for ${tea?.productName || 'this tea'}`}
          placeholder="count" className="w-24 rounded-md bg-tea-surface px-3 py-2 text-right font-mono text-ui-15 tabular-nums lining-nums text-tea-text outline-none focus:ring-1 focus:ring-tea-gold" />
        {unit === 'unit' ? 'units' : 'g'}
      </label>
      <span className="font-mono text-ui-12 tabular-nums lining-nums text-tea-text-sec">{at + 1} of {ids.length}</span>
      <span className="text-ui-12 text-tea-text-sec">Enter saves, blank skips</span>
    </> : <span className="text-ui-15 text-tea-text" data-testid="stock-count-summary">
      {saved === 0 ? 'Nothing counted.' : `Counted ${saved} of ${ids.length}.`}
    </span>}
    <Button ref={done} variant="plain" type="button" onClick={onClose} className="rounded-md px-3 py-2 text-ui-13 text-tea-text-sec hover:bg-tea-surface hover:text-tea-text">Done</Button>
    {error ? <span role="alert" className="basis-full text-ui-12 text-tea-error">{error}</span> : null}
  </div>;
}
