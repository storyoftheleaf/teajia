import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { canonicalCurrency, knownCurrency } from '../../lib/currency';
import { refreshCommerceQueries } from '../../lib/refreshCommerce';
import { useAppStore } from '../../lib/store';
import { buildProductUpdatePayload } from '../../admin/productUpdatePayload';
import { Button } from '../shared/Button';
import type { Product } from '../../admin/types';
import type { TeaCompassEntry } from '../TeaCompass/types';

/** Add to Stock brings the amount and cost along (intake plan step 4, Adrian
 *  2026-11-27). A new Stock tea starts empty on purpose: a quote is not a count
 *  and not a paid cost. So the quote is offered here, filled in, and nothing
 *  is written until he presses Save; whatever he leaves or types is what goes
 *  in, a typed zero included. The amount goes in as a recount, the cost with
 *  its currency. */
export function StockFromQuote({ entry, stock, needsAmount, needsCost }: {
  entry: TeaCompassEntry; stock: Product; needsAmount: boolean; needsCost: boolean;
}) {
  const accountId = useAppStore(s => s.activeAccountId);
  const queryClient = useQueryClient();
  const pieces = stock.type === 'Teaware';
  const quoteGrams = entry.pricePerUnitGrams != null && entry.pricePerUnitGrams > 0 ? entry.pricePerUnitGrams : null;
  const quoteCurrency = canonicalCurrency(entry.priceCurrency);
  const [amount, setAmount] = useState(needsAmount && !pieces && quoteGrams != null ? String(quoteGrams) : '');
  const [cost, setCost] = useState(needsCost && entry.priceAmount != null ? String(entry.priceAmount) : '');
  const [currency, setCurrency] = useState(quoteCurrency ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const key = useRef(crypto.randomUUID());
  if (!needsAmount && !needsCost) return null;

  const save = async () => {
    const amountText = amount.trim();
    const costText = cost.trim();
    const counted = amountText === '' ? null : Number(amountText);
    const paid = costText === '' ? null : Number(costText);
    if (counted != null && (!Number.isFinite(counted) || counted < 0 || (pieces && !Number.isInteger(counted)))) { setMessage(pieces ? 'Count the pieces as a whole number.' : 'Type the grams as a number, zero or more.'); return; }
    if (paid != null && (!Number.isFinite(paid) || paid < 0)) { setMessage('Type what it cost as a number. Zero means it was free.'); return; }
    if (paid != null && !knownCurrency(currency)) { setMessage('Say which currency the cost is in.'); return; }
    if (counted == null && paid == null) { setMessage('Fill in the amount or the cost first.'); return; }
    setBusy(true); setMessage('');
    try {
      if (needsAmount && counted != null) {
        const books = Number((pieces ? stock.quantityUnits : stock.stockGrams) ?? 0);
        await api.stockMovements.create(stock.id, {
          movement_type: 'recount', unit: pieces ? 'unit' : 'g', expected_balance: Number.isFinite(books) ? books : 0,
          idempotency_key: key.current, balance: counted, source_compass_entry_id: entry.id,
        }, { callerRefreshesCommerce: true });
      }
      if (needsCost && paid != null) {
        await api.products.updateByDomain(stock.id, {
          ...buildProductUpdatePayload('costAmount', paid),
          ...buildProductUpdatePayload('costCurrency', canonicalCurrency(currency)),
          ...(!pieces && quoteGrams != null && stock.quantityPurchased == null ? buildProductUpdatePayload('quantityPurchased', counted ?? quoteGrams) : {}),
        });
      }
      key.current = crypto.randomUUID();
      setMessage('Saved to Stock.');
      await refreshCommerceQueries(queryClient, accountId);
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'Not saved. Try again.');
    } finally { setBusy(false); }
  };

  return <section aria-label="Amount and cost for Stock" className="space-y-2 py-2" data-testid="stock-from-quote">
    <p className="text-ui-12 text-tea-text-sec">{quoteGrams != null || entry.priceAmount != null ? 'From the supplier quote. Change anything before you save.' : 'Stock has no amount or cost for this tea yet.'}</p>
    <div className="flex flex-wrap items-end gap-3">
      {needsAmount && <label className="flex flex-col gap-1 text-ui-12 text-tea-text-sec">{pieces ? 'Pieces here' : 'Grams here'}
        <input inputMode="decimal" className="input-field w-28 px-3 py-2 text-ui-16" value={amount} onChange={event => setAmount(event.target.value)} aria-label={pieces ? 'Pieces here' : 'Grams here'} /></label>}
      {needsCost && <label className="flex flex-col gap-1 text-ui-12 text-tea-text-sec">What it cost
        <span className="flex items-center gap-2">
          <input className="input-field w-20 px-3 py-2 text-ui-16" value={currency} onChange={event => setCurrency(event.target.value)} aria-label="Cost currency" placeholder="CNY" />
          <input inputMode="decimal" className="input-field w-28 px-3 py-2 text-ui-16" value={cost} onChange={event => setCost(event.target.value)} aria-label="What it cost" />
        </span></label>}
      <Button variant="secondary" type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save to Stock'}</Button>
    </div>
    {message && <p role="status" className="text-ui-12 text-tea-text-sec">{message}</p>}
  </section>;
}
