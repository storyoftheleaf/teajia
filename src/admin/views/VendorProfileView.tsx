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
import { ArrowLeft, Package, TrendingUp, Layers, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useAppStore } from '../store';
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

interface InvoiceItemRow {
  product_id: string;
  quantity: number;
  price_at_sale: number;
  productName?: string;
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

function stockLabel(g: number): { label: string; cls: string } {
  if (g <= 0) return { label: 'Out', cls: 'text-red-400' };
  if (g < 100) return { label: 'Low', cls: 'text-amber-400' };
  return { label: 'In stock', cls: 'text-emerald-400' };
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  index: number;
}> = ({ icon, label, value, sub, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: index * 0.06 }}
    className="bg-tea-surface border border-tea-border rounded-sm p-5 flex flex-col gap-3"
  >
    <div className="flex items-center gap-2 text-tea-text-dim">
      {icon}
      <span className="text-ui-10 uppercase tracking-display">{label}</span>
    </div>
    <p className="font-serif text-2xl text-tea-text num leading-none">{value}</p>
    {sub && <p className="text-xs text-tea-text-dim">{sub}</p>}
  </motion.div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-serif text-lg text-tea-text mb-5">{children}</h2>
);

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

export const VendorProfileView: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { currency } = useAppStore();

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

  // ── All invoices (we filter client-side by product IDs) ──
  const { data: invoicesRaw = [] } = useQuery({
    queryKey: ['invoices-all'],
    queryFn: () => api.invoices.list(200, 0),
    staleTime: 60_000,
  });
  const invoices: InvoiceRow[] = Array.isArray(invoicesRaw) ? invoicesRaw : (invoicesRaw as any)?.invoices ?? [];

  // ── Derived vendor product ID set ────────────────────
  const vendorProductIds = useMemo(() => new Set(products.map(p => p.id)), [products]);

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
      0
    );
    // Total purchased value: sum all invoice items where product is in vendor set
    // (Approximation from available data — full accuracy would need line-item fetch)
    const totalPurchased = products.reduce(
      (s, p) => s + (p.costAmount ?? 0),
      0
    );

    return { count: activeProducts.length, avgCost, activeStockValue, totalPurchased };
  }, [products]);

  // ── Filter invoices that contain vendor products ──────
  // We can't cheaply fetch all line items, so we show invoices where
  // customer_name matches the vendor OR we have data from getOrders.
  // For a richer view we use products' vendor name match on invoices.
  const vendorName = vendor?.name ?? '';
  const relatedInvoices = useMemo(() => {
    if (!vendorName) return [];
    return invoices.filter(
      inv => inv.customer_name?.toLowerCase().includes(vendorName.toLowerCase())
    );
  }, [invoices, vendorName]);

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  if (vendorLoading || productsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-serif text-lg text-tea-text mb-2">Vendor not found</p>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-tea-text-sec hover:text-tea-gold transition-colors uppercase tracking-caps"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-tea-bg">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-tea-text-sec hover:text-tea-gold transition-colors uppercase tracking-caps mb-10"
        >
          <ArrowLeft size={13} />
          <span>People</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <p className="text-ui-10 uppercase tracking-[0.35em] text-tea-text-sec mb-3">
            Vendor profile
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-tea-text font-light mb-3">
            {vendor.name}
          </h1>
          <div className="w-8 h-[1px] bg-tea-gold mb-5" />

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-tea-text-sec">
            {(vendor.city || vendor.country) && (
              <span>
                {[vendor.city, vendor.country].filter(Boolean).join(', ')}
              </span>
            )}
            {vendor.email && <span>{vendor.email}</span>}
            {vendor.phone && <span>{vendor.phone}</span>}
            {vendor.whatsapp && <span>WhatsApp: {vendor.whatsapp}</span>}
          </div>

          {vendor.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {vendor.tags.map(tag => (
                <span
                  key={tag}
                  className="text-ui-10 uppercase tracking-caps px-2.5 py-1 bg-tea-surface text-tea-text-sec rounded-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {vendor.notes && (
            <p className="mt-5 text-sm text-tea-text-sec italic leading-relaxed max-w-xl">
              {vendor.notes}
            </p>
          )}
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          <StatCard
            icon={<Package size={14} />}
            label="Products"
            value={String(stats.count)}
            sub="active in inventory"
            index={0}
          />
          <StatCard
            icon={<DollarSign size={14} />}
            label="Total cost"
            value={`$${fmt(stats.totalPurchased, 0)}`}
            sub="USD, all batches"
            index={1}
          />
          <StatCard
            icon={<TrendingUp size={14} />}
            label="Avg cost/g"
            value={`$${fmt(stats.avgCost, 3)}`}
            sub="across their teas"
            index={2}
          />
          <StatCard
            icon={<Layers size={14} />}
            label="Stock value"
            value={`$${fmt(stats.activeStockValue, 0)}`}
            sub="current inventory cost"
            index={3}
          />
        </div>

        {/* Products section */}
        <section className="mb-14">
          <SectionTitle>Products</SectionTitle>

          {products.length === 0 ? (
            <p className="text-sm text-tea-text-sec italic">
              No products linked to this vendor yet.
            </p>
          ) : (
            <div className="border border-tea-border rounded-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3 bg-tea-surface border-b border-tea-border">
                <span className="text-ui-10 uppercase tracking-caps text-tea-text-dim">Tea</span>
                <span className="text-ui-10 uppercase tracking-caps text-tea-text-dim text-right">Stock</span>
                <span className="text-ui-10 uppercase tracking-caps text-tea-text-dim text-right">Cost/g</span>
                <span className="text-ui-10 uppercase tracking-caps text-tea-text-dim text-right">Status</span>
              </div>

              {products.map((p, i) => {
                const stock = stockLabel(p.stockGrams ?? 0);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-4 border-b border-tea-border last:border-0 hover:bg-tea-surface/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-serif text-tea-text truncate">
                        {p.givenName || p.productName}
                      </p>
                      <p className="text-ui-10 text-tea-text-dim mt-0.5">
                        {[p.type, p.year].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="text-sm text-tea-text-sec text-right num self-center">
                      {(p.stockGrams ?? 0).toLocaleString()}g
                    </p>
                    <p className="text-sm text-tea-text-sec text-right num self-center">
                      ${fmt(p.costPerGramUSD ?? 0, 3)}
                    </p>
                    <p className={`text-xs text-right self-center ${stock.cls}`}>
                      {stock.label}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Purchase history */}
        <section className="mb-14">
          <SectionTitle>Purchase history</SectionTitle>

          {relatedInvoices.length === 0 ? (
            <p className="text-sm text-tea-text-sec italic">
              No purchase invoices linked to this vendor.
            </p>
          ) : (
            <div className="space-y-2">
              {relatedInvoices.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-5 py-4 bg-tea-surface border border-tea-border rounded-sm"
                >
                  <div>
                    <p className="text-sm font-serif text-tea-text">
                      {inv.invoice_number}
                    </p>
                    <p className="text-xs text-tea-text-dim mt-0.5">
                      {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-ui-10 uppercase tracking-widest px-2 py-0.5 rounded-sm ${
                        inv.status === 'Filled'
                          ? 'bg-tea-gold/15 text-tea-gold'
                          : 'bg-tea-surface text-tea-text-sec border border-tea-border'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Footer mark */}
        <div className="border-t border-tea-border pt-8 text-center">
          <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-sec/30">
            Teajia · Vendor Intelligence
          </p>
        </div>

      </div>
    </div>
  );
};

export default VendorProfileView;
