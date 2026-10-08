import { CurateRecordTools } from '../../components/curate/CurateRecordTools';
import { CurateQuotesPanel } from '../../components/curate/CurateQuotesPanel';
import { CurateVendorFields } from '../../components/curate/CurateVendorFields';
/**
 * VendorProfileView, /admin/vendors/:vendorId
 *
 * A read-rich story page for a single vendor: their identity, the teas they
 * sourced, the value of that stock, and every purchase invoice tied to their
 * products.  Not a form, this is an intelligence document.
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, type PurchaseOrder } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import { useRates } from '../hooks/useAdminData';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';
import type { Customer, InventoryReceipt } from '../types';
import { recordedCost, vendorEconomics, vendorPurchaseOrders, vendorReceipts, type PricedProductRow, type VendorProductRow } from './vendorProfileData';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
  const scope = usePrivateQueryScope();
  const { data: rates } = useRates();

  // ── Vendor data ──────────────────────────────────────
  const { data: vendorData, isLoading: vendorLoading } = useQuery<Customer>({
    queryKey: ['vendor', vendorId, ...scope.key],
    queryFn: () => api.customers.get(vendorId!),
    enabled: !!vendorId && scope.ready,
    staleTime: 60_000,
  });

  // ── Products linked to this vendor ───────────────────
  const { data: productsData, isLoading: productsLoading } = useQuery<VendorProductRow[]>({
    queryKey: ['vendor-products', vendorId, ...scope.key],
    queryFn: () => api.customers.getSuppliedProducts(vendorId!),
    enabled: !!vendorId && scope.ready,
    staleTime: 60_000,
  });
  const { data: pricedProductsData, isLoading: pricedProductsLoading } = useQuery<PricedProductRow[]>({
    queryKey: ['vendor-priced-products', ...scope.key],
    queryFn: () => api.products.list(),
    enabled: !!vendorId && scope.ready,
    staleTime: 60_000,
  });

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', ...scope.key],
    enabled: scope.ready,
    queryFn: () => api.purchaseOrders.list(),
    staleTime: 60_000,
  });
  const { data: receiptsData, isLoading: receiptsLoading, isError: receiptsError } = useQuery<InventoryReceipt[]>({
    queryKey: ['inventory-receipts-all', ...scope.key],
    enabled: scope.ready,
    queryFn: () => api.inventoryReceipts.list(true),
    staleTime: 60_000,
  });
  const vendor = scope.ready ? vendorData : undefined;
  const products = scope.ready ? productsData ?? [] : [];
  const orders = vendor ? vendorPurchaseOrders(ordersData ?? [], vendorId!, vendor.name) : [];
  const receipts = vendor ? vendorReceipts(receiptsData ?? [], vendor.name) : [];
  const historyLoading = ordersLoading || receiptsLoading;
  const historyError = ordersError || receiptsError;
  const economics = vendorEconomics(products, pricedProductsData, rates);
  const money = (value: number | null, decimals = 0) => value == null
    ? '—'
    : `$${fmt(value, decimals)}`;

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
              { value: String(products.filter(p => p.status !== 'Archived').length), label: 'Products' },
              { value: pricedProductsLoading ? '…' : money(economics.totalCostUsd), label: 'Total cost' },
              { value: pricedProductsLoading ? '…' : money(economics.avgCostPerGramUsd, 3), label: 'Avg cost/g' },
              { value: pricedProductsLoading ? '…' : money(economics.stockValueUsd), label: 'Stock value' },
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

        <CurateVendorFields vendorId={vendorId!} />
        <CurateQuotesPanel vendorId={vendorId!} />
        <CurateRecordTools entityType="vendor" entityId={vendorId!} />

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
                const stock = p.stock_grams == null ? null : stockVariant(Number(p.stock_grams));
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 py-3 border-b border-tea-border last:border-0"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-9 h-9 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-tea-elevated shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-ui-13 text-tea-text truncate">
                        {p.given_name || p.product_name}
                      </p>
                      <p className="label-caps text-tea-text-dim mt-0.5 truncate">
                        {[p.type, p.origin_region, p.origin_country].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="font-mono text-ui-13 text-tea-text-sec tabular-nums">
                      {p.stock_grams == null ? 'Stock unrecorded' : `${Number(p.stock_grams).toLocaleString()}g`}
                    </span>
                    <span className="font-mono text-ui-13 text-tea-text-sec tabular-nums">
                      {recordedCost(p) ?? 'Cost unrecorded'}
                    </span>
                    {stock && <StatusPill variant={stock.variant}>{stock.label}</StatusPill>}
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
            <span className="label-caps text-tea-text-dim">{historyError ? '—' : historyLoading ? '…' : orders.length + receipts.length}</span>
          </div>

          {historyError ? (
            <p className="text-ui-13 text-tea-text-sec italic">Purchase history unavailable.</p>
          ) : historyLoading ? (
            <p className="text-ui-13 text-tea-text-sec italic">Loading purchase history…</p>
          ) : orders.length === 0 && receipts.length === 0 ? (
            <p className="text-ui-13 text-tea-text-sec italic">
              No purchase orders or receipts linked to this vendor.
            </p>
          ) : (
            <div className="border-t border-tea-border">
              {orders.map(order => (
                <div
                  key={`order:${order.id}`}
                  className="flex items-center justify-between gap-3 py-3 border-b border-tea-border last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-ui-13 text-tea-text tabular-nums truncate">
                      Purchase order · {order.vendor_name}
                    </p>
                    <p className="label-caps text-tea-text-dim mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  {order.total_usd != null && Number.isFinite(Number(order.total_usd)) && (
                    <span className="font-mono text-ui-13 text-tea-text tabular-nums">
                      ${Number(order.total_usd).toFixed(2)} USD
                    </span>
                  )}
                  <StatusPill variant={order.status === 'received' ? 'success' : 'draft'}>
                    {order.status}
                  </StatusPill>
                </div>
              ))}
              {receipts.map(receipt => (
                <div key={`receipt:${receipt.id}`} className="flex items-center justify-between gap-3 py-3 border-b border-tea-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-ui-13 text-tea-text tabular-nums">Inventory receipt</p>
                    <p className="label-caps text-tea-text-dim mt-0.5">{receipt.lines?.length ?? 0} lines · {receipt.source_kind}</p>
                  </div>
                  <StatusPill variant={receipt.state === 'received' ? 'success' : 'draft'}>{receipt.state}</StatusPill>
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
