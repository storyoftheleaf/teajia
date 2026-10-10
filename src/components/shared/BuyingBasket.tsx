import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Currency } from '../../admin/types';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { useLedgerStore, type LedgerLineItem, type LedgerTransaction } from '../../lib/ledgerStore';
import { canonicalCurrency } from '../../lib/currency';
import { ledgerItemAmount } from '../CurateV2/curatePricing';
import { estimateOrderFreight, type RouteMode } from './routeFreight';
import { useShippingRoutes } from './useShippingRoutes';
import { releaseTeaFromOrder } from '../CurateV2/orderBuy';
import { confirmPurchase, purchaseNeedsVendor, recordPurchase } from '../CurateV2/placeOrder';
import { Button } from './Button';
import { Icons } from '../Icons';

// The owner's basket: the shop's own "Your order" turned around, so buying from
// a supplier looks like a customer buying from us (locked 2026-10-10, canvas
// Flow 2, plan todo/plans/samples-to-orders.md build 2). It is Curate's draft
// orders, read and written through the ledger, one group per supplier. Place
// order runs the same code as Curate's order screen (placeOrder.ts).
// Freight is estimated silently from the shipping routes in Settings (build 3),
// packing and the carrier's rounding included; with no route, air follows the
// shop rate. The routes' addresses show as the Receiving tiles.

const SYMBOL: Record<string, string> = { Yuan: '¥', USD: '$', NT: 'NT$', HKD: 'HK$', IDR: 'Rp', JPY: 'JP¥', MYR: 'RM', AUD: 'A$' };
export function money(amount: number, currency: Currency | string): string {
  const key = canonicalCurrency(String(currency)) ?? String(currency);
  const sym = SYMBOL[key] ?? (key && key !== 'UNK' ? `${key} ` : '');
  const decimals = Math.abs(amount - Math.round(amount)) < 0.005 || amount >= 100 ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

const PIECE_WORD: Record<string, [string, string]> = { Cake: ['cake', 'cakes'], Brick: ['brick', 'bricks'], Tuo: ['tuo', 'tuos'] };
function pieceWords(item: LedgerLineItem): [string, string] {
  if (item.type === 'Teaware') return ['piece', 'pieces'];
  return PIECE_WORD[String(item.form)] ?? ['piece', 'pieces'];
}

/** The sizes a supplier usually sells in: a cake, two, a tong of seven; or 100 g, half a kilo, a kilo. */
export function sizeChoices(item: LedgerLineItem): { amount: number; label: string }[] {
  if (!item.priceIsPerGram) {
    const [one, many] = pieceWords(item);
    return [1, 2, 7].map((n) => ({ amount: n, label: `${n} ${n === 1 ? one : many}` }));
  }
  return [100, 500, 1000].map((g) => ({ amount: g, label: g >= 1000 ? `${g / 1000} kg` : `${g}g` }));
}

const amountOf = (item: LedgerLineItem) => (item.priceIsPerGram ? item.quantityGrams ?? 0 : item.quantityUnits ?? 1);
const tile = (on: boolean) => `relative flex flex-col items-center justify-center min-h-[40px] px-1 transition-colors ${
  on ? 'bg-tea-elevated text-tea-text shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))]' : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
}`;
const SHIP: { value: 'air' | 'boat' | 'both'; label: string }[] = [
  { value: 'air', label: 'Air' }, { value: 'boat', label: 'Boat' }, { value: 'both', label: 'Both' },
];

const BuyingLine: React.FC<{ tx: LedgerTransaction; item: LedgerLineItem }> = ({ tx, item }) => {
  const updateLineItem = useLedgerStore((s) => s.updateLineItem);
  const removeLineItem = useLedgerStore((s) => s.removeLineItem);
  const removeTransaction = useLedgerStore((s) => s.removeTransaction);
  const sizes = sizeChoices(item);
  const current = amountOf(item);
  const isOther = !sizes.some((s) => s.amount === current);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const currency = item.currency || tx.currency;
  const priced = !item.unpriced;
  const setAmount = (n: number) => {
    if (!(n > 0)) return;
    updateLineItem(tx.id, item.id, item.priceIsPerGram ? { quantityGrams: n } : { quantityUnits: n });
  };
  const remove = () => {
    removeLineItem(tx.id, item.id);
    if (tx.items.length === 1) removeTransaction(tx.id);
    if (item.compassEntryId) releaseTeaFromOrder(item.compassEntryId);
  };
  const shipBy = item.shipBy ?? 'air';
  const unitWord = item.priceIsPerGram ? 'g' : pieceWords(item)[current === 1 ? 0 : 1];
  return (
    <div data-testid="buying-line" className="py-3 border-b border-tea-border">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 truncate font-display text-[22px] leading-tight text-tea-text">{item.name}</span>
        <span className="ml-auto shrink-0 num text-ui-17 text-tea-text">{priced ? money(ledgerItemAmount(item), currency) : <span className="text-tea-text-sec text-ui-13">no price yet</span>}</span>
      </div>
      <p className="mt-0.5 font-body text-ui-12 text-tea-text-sec">
        {[item.year, item.type].filter(Boolean).join(' · ')}
        {priced && <>{item.year || item.type ? ' · ' : ''}<span className="num">{money(item.pricePerUnit, currency)}</span> {item.priceIsPerGram ? 'per gram' : `a ${pieceWords(item)[0]}`}</>}
      </p>
      <div role="radiogroup" aria-label={`How much ${item.name}`} className="grid grid-cols-4 gap-1 mt-2">
        {sizes.map((s) => (
          <button key={s.amount} type="button" role="radio" aria-checked={!isOther && current === s.amount} onClick={() => { setTyping(false); setAmount(s.amount); }} className={tile(!isOther && current === s.amount)}>
            <span className="num text-ui-13 leading-tight">{s.label}</span>
            {priced && <span className="num text-ui-11 leading-tight text-tea-text-sec">{money(item.pricePerUnit * s.amount, currency)}</span>}
          </button>
        ))}
        {typing ? (
          <label className={`${tile(true)} cursor-text`}>
            <span className="sr-only">{item.priceIsPerGram ? 'Grams' : 'How many'}</span>
            <input autoFocus inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { setAmount(Number(draft)); setTyping(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setTyping(false); }}
              className="w-full bg-transparent border-0 outline-none p-0 text-center num text-ui-13 text-tea-text" />
            <span className="text-ui-11 leading-tight text-tea-text-sec">{item.priceIsPerGram ? 'grams' : pieceWords(item)[1]}</span>
          </label>
        ) : (
          <button type="button" role="radio" aria-checked={isOther} onClick={() => { setDraft(String(current)); setTyping(true); }} className={tile(isOther)}>
            <span className="num text-ui-13 leading-tight">{isOther ? `${current.toLocaleString()} ${unitWord}` : 'Other'}</span>
            {isOther && priced && <span className="num text-ui-11 leading-tight text-tea-text-sec">{money(ledgerItemAmount(item), currency)}</span>}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div role="radiogroup" aria-label={`How ${item.name} ships`} className="grid grid-cols-3 w-[168px] bg-tea-surface">
          {SHIP.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={shipBy === m.value} onClick={() => updateLineItem(tx.id, item.id, { shipBy: m.value })}
              className={`h-[34px] text-ui-12 transition-colors ${shipBy === m.value ? 'bg-tea-elevated text-tea-text shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))]' : 'text-tea-text-sec hover:text-tea-text'}`}>{m.label}</button>
          ))}
        </div>
        <button type="button" onClick={remove} className="ml-auto checkout-text-action text-ui-12">Remove</button>
      </div>
    </div>
  );
};

export const BuyingBasket: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const transactions = useLedgerStore((s) => s.transactions);
  const updateTransaction = useLedgerStore((s) => s.updateTransaction);
  const drafts = useMemo(() => transactions.filter((tx) => tx.direction === 'purchase' && tx.status === 'draft' && tx.items.length > 0), [transactions]);
  const { data: rates = [] } = useRates();
  const shopFreight = useShopFreightDefault();
  const { data: routes = [] } = useShippingRoutes();
  const queryClient = useQueryClient();
  const [placing, setPlacing] = useState(false);
  const busy = useRef(false);
  const [placed, setPlaced] = useState<{ name: string; failed: boolean }[] | null>(null);
  const [error, setError] = useState('');

  // One figure per money: yuan and dollars are never added as if they were the same.
  const totals = useMemo(() => {
    const byMoney = new Map<string, { currency: Currency; teas: number; freight: number; freightKnown: boolean }>();
    let packing = false;
    const modes = new Set<RouteMode>();
    for (const tx of drafts) {
      const freight = estimateOrderFreight(tx, routes, rates, shopFreight.perKgUsd);
      if (freight.packing) packing = true;
      freight.modes.forEach((m) => modes.add(m));
      for (const item of tx.items) {
        if (item.unpriced) continue;
        const c = (item.currency || tx.currency) as Currency;
        const key = canonicalCurrency(c) ?? c;
        const row = byMoney.get(key) ?? { currency: c, teas: 0, freight: 0, freightKnown: true };
        row.teas += ledgerItemAmount(item);
        byMoney.set(key, row);
      }
      const key = canonicalCurrency(tx.currency) ?? tx.currency;
      const row = byMoney.get(key);
      if (row) { if (freight.amount != null) row.freight += freight.amount; else row.freightKnown = false; }
    }
    return { rows: [...byMoney.values()], packing, modes: [...modes] };
  }, [drafts, routes, rates, shopFreight.perKgUsd]);
  const unpriced = drafts.reduce((n, tx) => n + tx.items.filter((i) => i.unpriced).length, 0);
  const nameless = drafts.filter(purchaseNeedsVendor);

  const placeAll = async () => {
    if (busy.current) return;
    if (nameless.length) { setError(`Name the supplier for ${nameless.map((tx) => tx.items.map((i) => i.name).join(', ')).join('; ')} in Curate first.`); return; }
    busy.current = true;
    setPlacing(true);
    setError('');
    const done: { name: string; failed: boolean }[] = [];
    for (const tx of drafts) {
      confirmPurchase(tx);
      try { await recordPurchase(tx, rates, queryClient); done.push({ name: tx.counterpartyName, failed: false }); }
      catch { updateTransaction(tx.id, { recordFailed: true }); done.push({ name: tx.counterpartyName, failed: true }); }
    }
    setPlaced(done);
    busy.current = false;
    setPlacing(false);
  };

  return <>
    <div className="flex items-center gap-2 pl-2 pr-4 min-h-[52px] shrink-0">
      <button type="button" onClick={onClose} aria-label="Close buying" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors">
        <Icons.Close className="w-5 h-5" />
      </button>
      <h2 className="flex-1 min-w-0 font-display text-[22px] leading-none text-tea-text">{placed ? 'Ordered' : 'Buying'}</h2>
      {!placed && drafts.length > 0 && <span className="font-body text-ui-12 text-tea-text-sec">{drafts.length} {drafts.length === 1 ? 'supplier' : 'suppliers'}</span>}
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto tea-card-scroll px-4 pt-1 pb-6">
      {placed ? (
        <section role="status" aria-label="Orders placed" className="space-y-4 pt-2">
          {placed.map((p, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 py-2 border-b border-tea-border">
              <span className="font-display text-[22px] leading-tight text-tea-text">{p.name}</span>
              <span className={`font-body text-ui-13 ${p.failed ? 'text-tea-error' : 'text-tea-text-sec'}`}>{p.failed ? 'not recorded, retry in Curate' : 'placed'}</span>
            </div>
          ))}
          <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">Nothing has been sent to a supplier. The orders wait in Curate under Orders, where you message each supplier when you are ready.</p>
        </section>
      ) : drafts.length === 0 ? (
        <p className="py-10 font-body text-ui-15 text-tea-text">Nothing to buy yet. Press Want on a sample to add it.</p>
      ) : drafts.map((tx) => (
        <section key={tx.id} aria-label={tx.counterpartyName}>
          <h3 className="mt-3 font-sans text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">{tx.counterpartyName}</h3>
          {tx.items.map((item) => <BuyingLine key={item.id} tx={tx} item={item} />)}
        </section>
      ))}
      {!placed && drafts.length > 0 && (
        <section aria-label="Receiving" className="mt-5">
          <h3 className="font-display text-ui-20 text-tea-text">Receiving</h3>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {totals.modes.map((mode) => {
              const route = routes.find((r) => r.mode === mode);
              return (
                <div key={mode} data-testid="receiving-tile" className="min-h-[48px] px-3 py-2 bg-tea-surface shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))] flex flex-col justify-center">
                  <span className="block font-body text-ui-14 leading-tight text-tea-text truncate">{route?.destination || (mode === 'air' ? 'The shop' : 'No boat route yet')}</span>
                  <span className="font-body text-ui-11 leading-tight text-tea-text-sec">{route?.destination || mode === 'air' ? (mode === 'air' ? 'air arrives here' : 'boat leaves from here') : 'add one in Settings'}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
    {/* The admin keeps its bottom bar while this is open (the shop hides it for
        its own basket), so the footer sits above it. */}
    <div className="bg-tea-surface shrink-0 pb-nav-gap"><div className="px-4 pt-3 space-y-2">
      {error && <p role="alert" className="font-body text-ui-13 leading-snug text-tea-text bg-tea-elevated px-3 py-2">{error}</p>}
      {placed || drafts.length === 0 ? <Button variant="secondary" fullWidth onClick={onClose}>Close</Button> : (
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="num text-ui-26 leading-none text-tea-text">{totals.rows.length ? totals.rows.map((t) => money(t.teas, t.currency)).join(' + ') : '—'}</span>
            <span className="font-body text-ui-11 leading-none text-tea-text-sec">
              {totals.rows.length && totals.rows.every((t) => t.freightKnown) ? `freight ≈ ${totals.rows.map((t) => money(Math.round(t.freight), t.currency)).join(' + ')}${totals.packing ? ', packing included' : ''}` : 'freight not estimated'}
              {unpriced ? ` · ${unpriced} without a price` : ''}
            </span>
          </div>
          <Button type="button" fullWidth className="flex-1 min-w-0 whitespace-nowrap !px-4" loading={placing} onClick={placeAll}>{placing ? 'Placing…' : 'Place order'}</Button>
        </div>
      )}
    </div></div>
  </>;
};
