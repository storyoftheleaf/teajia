/**
 * VendorProfileView — /admin/vendors/:vendorId
 *
 * A read-rich story page for a single vendor: their identity, the teas they
 * sourced, the value of that stock, and every purchase invoice tied to their
 * products.  Not a form — this is an intelligence document.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';
import type { Customer, Product } from '../types';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  status: string;
  created_at: string;
  total?: number;
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function stockVariant(g: number): { label: string; variant: StatusPillVariant } {
  if (g <= 0) return { label: 'Out', variant: 'draft' };
  if (g < 100) return { label: 'Low', variant: 'active' };
  return { label: 'In stock', variant: 'success' };
}

const VENDOR_GRADIENT =
  'radial-gradient(circle at 30% 30%, #c6a473, #8e6d2e 55%, #3a3126)';

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

const StatusPill: React.FC<{ variant?: StatusPillVariant; children: React.ReactNode }> = ({
  variant = 'draft',
  children,
}) => (
  <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>{children}</span>
);

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

export const VendorProfileView: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  useAppStore(); // preserve store subscription parity with prior implementation

  // ── Vendor data ──────────────────────────────────────
  const { data: vendor, isLoading: vendorLoading } = useQuery<Customer>({
    queryKey: ['vendor', vendorId],
    queryFn: () => api.customers.get(vendorId!),
    enabled: !!vendorId,
    staleTime: 60_000,
  });

  // ── Products linked to this vendor ───────────────────
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['vendor-products', vendorId],
    queryFn: () => api.customers.getSuppliedProducts(vendorId!),
    enabled: !!vendorId,
    staleTime: 60_000,
  });

  // ── All invoices (we filter client-side by vendor name) ──
  const { data: invoicesRaw = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => api.invoices.list(200, 0),
    staleTime: 60_000,
  });
  const invoices: InvoiceRow[] = Array.isArray(invoicesRaw)
    ? invoicesRaw
    : (invoicesRaw as any)?.invoices ?? [];

  // ── Summary statistics ───────────────────────────────
  const stats = useMemo(() => {
    const activeProducts = products.filter(p => p.status !== 'Archived');
    const avgCost =
      activeProducts.length > 0
        ? activeProducts.reduce((s, p) => s + (p.costPerGramUSD ?? 0), 0) /
          activeProducts.length
        : 0;
    const activeStockValue = activeProducts.reduce(
      (s, p) => s + (p.stockGrams ?? 0) * (p.costPerGramUSD ?? 0),
      0,
    );
    const totalPurchased = products.reduce((s, p) => s + (p.costAmount ?? 0), 0);

    return { count: activeProducts.length, avgCost, activeStockValue, totalPurchased };
  }, [products]);

  // ── Filter invoices by vendor name (presentation-only) ─
  const vendorName = vendor?.name ?? '';
  const relatedInvoices = useMemo(() => {
    if (!vendorName) return [];
    return invoices.filter(inv =>
      inv.customer_name?.toLowerCase().includes(vendorName.toLowerCase()),
    );
  }, [invoices, vendorName]);

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  if (vendorLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-tea-bg">
        <Loader2 className="animate-spin text-tea-text-sec" size={20} />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 md:px-6 pb-12">
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 text-center">
            <h3 className="h3 mb-1">Vendor not found</h3>
            <p className="text-ui-13 text-tea-text-sec">
              This vendor may have been removed or the link is invalid.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const location = [vendor.city, vendor.country].filter(Boolean).join(', ');
  const primaryContact =
    vendor.email ||
    vendor.contacts?.find(c => c.channel === 'whatsapp')?.handle ||
    vendor.whatsapp ||
    vendor.phone ||
    '';
  const verified = vendor.tags?.some(t => t.toLowerCase().includes('verified'));
  const extraTags = vendor.tags?.filter(t => !t.toLowerCase().includes('verified')) ?? [];

  return (
    <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
      {/* Narrow chrome */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-12 space-y-6">
        {/* Identity card */}
        <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-full flex-shrink-0"
              style={{ background: VENDOR_GRADIENT }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h3 className="h3">{vendor.name}</h3>
              {primaryContact && (
                <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{primaryContact}</p>
              )}
              {(location || vendor.company) && (
                <p className="text-ui-12 text-tea-text-dim mt-0.5">
                  {[vendor.company, location].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusPill variant={verified ? 'success' : 'draft'}>
                  {verified ? 'Source verified' : 'Source unverified'}
                </StatusPill>
                {extraTags.map(tag => (
                  <StatusPill key={tag} variant="draft">{tag}</StatusPill>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats row */}
        <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-4">At a glance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: String(stats.count), label: 'Products' },
              { value: `$${fmt(stats.totalPurchased, 0)}`, label: 'Total cost' },
              { value: `$${fmt(stats.avgCost, 3)}`, label: 'Avg cost/g' },
              { value: `$${fmt(stats.activeStockValue, 0)}`, label: 'Stock value' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-tea-bg border border-tea-border rounded-xl p-4">
                <div className="font-mono text-ui-28 text-tea-text tabular-nums leading-none">
                  {value}
                </div>
                <div className="label-caps text-tea-text-dim mt-2">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Products supplied */}
        <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="h3">Products supplied</h3>
            <span className="label-caps text-tea-text-dim">{products.length}</span>
          </div>

          {products.length === 0 ? (
            <p className="text-ui-13 text-tea-text-sec italic">
              No products linked to this vendor yet.
            </p>
          ) : (
            <div className="border-t border-tea-border">
              {products.map(p => {
                const stock = stockVariant(p.stockGrams ?? 0);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 py-3 border-b border-tea-border last:border-0"
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="w-9 h-9 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-tea-elevated shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-ui-13 text-tea-text truncate">
                        {p.givenName || p.productName}
                      </p>
                      <p className="label-caps text-tea-text-dim mt-0.5 truncate">
                        {[p.type, p.year].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="font-mono text-ui-13 text-tea-text-sec tabular-nums">
                      {(p.stockGrams ?? 0).toLocaleString()}g
                    </span>
                    <span className="font-mono text-ui-13 text-tea-text-sec tabular-nums">
                      ${fmt(p.costPerGramUSD ?? 0, 3)}
                    </span>
                    <StatusPill variant={stock.variant}>{stock.label}</StatusPill>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Purchase history */}
        <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="h3">Purchase history</h3>
            <span className="label-caps text-tea-text-dim">{relatedInvoices.length}</span>
          </div>

          {relatedInvoices.length === 0 ? (
            <p className="text-ui-13 text-tea-text-sec italic">
              No purchase invoices linked to this vendor.
            </p>
          ) : (
            <div className="border-t border-tea-border">
              {relatedInvoices.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 py-3 border-b border-tea-border last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-ui-13 text-tea-text tabular-nums truncate">
                      #{inv.invoice_number}
                    </p>
                    <p className="label-caps text-tea-text-dim mt-0.5">
                      {formatDate(inv.created_at)}
                    </p>
                  </div>
                  {inv.total != null && (
                    <span className="font-mono text-ui-13 text-tea-text tabular-nums">
                      ${Number(inv.total).toFixed(2)}
                    </span>
                  )}
                  <StatusPill variant={inv.status === 'Filled' ? 'success' : 'draft'}>
                    {inv.status}
                  </StatusPill>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notes */}
        {vendor.notes && (
          <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <h3 className="h3 mb-1">Notes</h3>
            <p className="label-caps text-tea-text-dim mb-4">Staff-facing</p>
            <p className="text-ui-13 text-tea-text-sec leading-relaxed">{vendor.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
};

export default VendorProfileView;
