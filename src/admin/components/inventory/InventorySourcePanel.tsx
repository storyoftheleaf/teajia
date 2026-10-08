import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X as XIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { api } from '../../../lib/api';
import type { Customer, Product } from '../../types';
import type { IncomingInventorySummary } from './domain';
import { isLow, isUnchecked, onHand, sellingPricePerGram } from './phone/groupStock';

interface InventorySourcePanelProps {
  product: Product;
  products: Product[];
  onClose: () => void;
  /** Tap a tea in the list to open its full page. */
  onOpenTea?: (product: Product) => void;
  /** Tick every tea from this supplier in the Stock list. */
  onSelectAll?: (ids: string[]) => void;
  /** Open Incoming, where deliveries from this supplier are booked in. */
  onOpenIncoming?: () => void;
  incomingByProductId?: Readonly<Record<string, IncomingInventorySummary>>;
}

export function InventorySourcePanel({ product, products, onClose, onOpenTea, onSelectAll, onOpenIncoming, incomingByProductId }: InventorySourcePanelProps) {
  const navigate = useNavigate();
  const sourceName = product.vendor || 'Source';
  const { data: source, isLoading: sourceLoading } = useQuery<Customer | undefined>({
    queryKey: ['inventory-source', product.vendorId || sourceName],
    queryFn: async () => {
      if (product.vendorId) return api.customers.get(product.vendorId) as Promise<Customer>;
      const customers = await api.customers.list() as Customer[];
      const normalizedName = sourceName.trim().toLowerCase();
      return customers.find((customer) => customer.name.trim().toLowerCase() === normalizedName);
    },
    staleTime: 60_000,
  });
  const suppliedProducts = useMemo(() => {
    const normalizedName = sourceName.trim().toLowerCase();
    // Most stock first: the teas you can actually pour lead.
    return products.filter((candidate) =>
      (product.vendorId && candidate.vendorId === product.vendorId) ||
      candidate.vendor?.trim().toLowerCase() === normalizedName
    ).sort((a, b) => onHand(b) - onHand(a));
  }, [product.vendorId, products, sourceName]);

  // The supplier at a glance, the same sums as their group line in Stock.
  const totals = useMemo(() => {
    let grams = 0; let pieces = 0; let value = 0; let low = 0; let unchecked = 0; let coming = 0;
    for (const p of suppliedProducts) {
      const qty = onHand(p);
      if (p.type === 'Teaware') pieces += qty; else grams += qty;
      const price = sellingPricePerGram(p);
      if (price != null && qty > 0) value += qty * price;
      if (isLow(p)) low += 1;
      if (isUnchecked(p)) unchecked += 1;
      const c = incomingByProductId?.[p.id];
      if (c?.hasOpenIncoming) coming += c.remainingQuantity;
    }
    return { grams, pieces, value, low, unchecked, coming };
  }, [suppliedProducts, incomingByProductId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const contact = source?.email || source?.whatsapp || source?.phone;
  const location = [source?.city, source?.country].filter(Boolean).join(', ');

  return (
    <motion.aside
      role="dialog"
      aria-modal="true"
      aria-label={`Source: ${sourceName}`}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-modal w-full md:max-w-md bg-tea-surface border-l border-tea-border flex flex-col"
      style={{ boxShadow: '-12px 0 40px -8px var(--tea-accent-sub)' }}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-tea-border bg-tea-surface flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="tap-target p-1 text-tea-text-sec hover:text-tea-text transition-colors"
          aria-label="Close source panel"
        >
          <XIcon size={18} aria-hidden="true" />
        </button>
        <span className="text-ui-11 uppercase tracking-[0.12em] text-tea-text-sec">Source</span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-nav-gap">
        <section className="px-5 py-5 border-b border-tea-border">
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{sourceName}</h2>
          {source?.company && <p className="mt-1 text-ui-13 text-tea-text-sec">{source.company}</p>}
          {location && <p className="mt-1 text-ui-12 text-tea-text-dim">{location}</p>}
        </section>

        <section className="px-5 py-5 border-b border-tea-border space-y-4" aria-label="Source details">
          <div>
            <div className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">Contact</div>
            <p className="mt-1 text-ui-13 text-tea-text-sec">
              {sourceLoading
                ? <span className="inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading source…</span>
                : contact || 'No contact details recorded'}
            </p>
          </div>
          {source?.notes && (
            <div>
              <div className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">Notes</div>
              <p className="mt-1 text-ui-13 leading-relaxed text-tea-text-sec whitespace-pre-line">{source.notes}</p>
            </div>
          )}
        </section>

        <section className="px-5 py-4 border-b border-tea-border" aria-label="This supplier at a glance">
          <dl className="grid grid-cols-3 gap-x-4">
            {([
              ['Teas', String(suppliedProducts.length)],
              ['On the shelf', [totals.grams > 0 || totals.pieces === 0 ? `${totals.grams.toLocaleString('en-US')} g` : null, totals.pieces > 0 ? `${totals.pieces} pc` : null].filter(Boolean).join(' · ')],
              ['At retail', `$${Math.round(totals.value).toLocaleString('en-US')}`],
              ['Low', String(totals.low)],
              ['Not checked', String(totals.unchecked)],
              ['Coming', totals.coming > 0 ? `+${totals.coming.toLocaleString('en-US')}` : 'nothing'],
            ] as const).map(([label, value]) => (
              <div key={label} className="border-t border-tea-border py-2 min-w-0">
                <dt className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">{label}</dt>
                <dd className={`font-mono text-ui-15 ${label === 'Low' && totals.low > 0 ? 'text-tea-gold' : 'text-tea-text'}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {onSelectAll && <button type="button" onClick={() => { onSelectAll(suppliedProducts.map(p => p.id)); onClose(); }} disabled={suppliedProducts.length === 0} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text disabled:opacity-40">Select all {suppliedProducts.length}</button>}
            {onOpenIncoming && <button type="button" onClick={() => { onOpenIncoming(); onClose(); }} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text">Deliveries coming</button>}
            <button type="button" onClick={() => navigate(`/admin/people?tab=sources&search=${encodeURIComponent(sourceName)}`)} className="min-h-11 rounded-md border border-tea-border text-ui-13 text-tea-text">Edit supplier</button>
          </div>
        </section>

        <section className="px-5 py-5" aria-label="Products from this source">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="font-display text-ui-17 text-tea-text">Stock from this source</h3>
            <span className="text-ui-11 text-tea-text-sec">{suppliedProducts.length}</span>
          </div>
          <div className="divide-y divide-tea-border border-y border-tea-border">
            {suppliedProducts.map((suppliedProduct) => (
              <button
                type="button"
                key={suppliedProduct.id}
                onClick={() => onOpenTea?.(suppliedProduct)}
                disabled={!onOpenTea}
                aria-label={`Open ${suppliedProduct.productName || suppliedProduct.givenName}`}
                className="w-full min-h-11 py-3 flex items-baseline justify-between gap-3 text-left disabled:cursor-default"
              >
                <span className="min-w-0 truncate text-ui-13 text-tea-text">
                  {suppliedProduct.productName || suppliedProduct.givenName}
                  {suppliedProduct.year ? <span className="ml-1.5 font-mono text-ui-11 text-tea-text-dim">{suppliedProduct.year}</span> : null}
                </span>
                <span className="shrink-0 text-ui-12 text-tea-text-sec">
                  {suppliedProduct.type === 'Teaware'
                    ? `${suppliedProduct.quantityUnits ?? 0} units`
                    : `${Math.round(suppliedProduct.stockGrams)}g`}
                </span>
              </button>
            ))}
            {suppliedProducts.length === 0 && (
              <p className="py-4 text-ui-13 text-tea-text-sec">No linked stock found.</p>
            )}
          </div>
        </section>
      </div>
    </motion.aside>
  );
}
