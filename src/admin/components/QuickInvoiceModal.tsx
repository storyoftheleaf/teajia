import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Search, Link, FileDown, Loader2, Receipt } from 'lucide-react';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { Currency, InvoiceDisplayItem, Product } from '../types';
import { useRates } from '../hooks/useAdminData';
import { formatCurrency } from '../utils';

interface QuickLineItem {
  localId: string;
  name: string;
  productId?: string;
  quantity: number;
  unit: 'g' | 'pcs';
  price: number;
}

interface QuickInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  showToast: (msg: string, type?: string) => void;
}

const CURRENCIES: Currency[] = ['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD', 'AUD'];

const newItem = (): QuickLineItem => ({
  localId: crypto.randomUUID(),
  name: '',
  quantity: 1,
  unit: 'g',
  price: 0,
});

export const QuickInvoiceModal: React.FC<QuickInvoiceModalProps> = ({
  isOpen, onClose, onSuccess, products, showToast,
}) => {
  const { data: rates = [] } = useRates();

  // Customer
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  // Invoice
  const [lineItems, setLineItems] = useState<QuickLineItem[]>([newItem()]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState('');

  // Per-item product autocomplete
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');

  const [saving, setSaving] = useState(false);

  const productFuse = useMemo(() => new Fuse(products, {
    keys: ['givenName', 'productName'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [products]);

  const customerFuse = useMemo(() => new Fuse(customers, {
    keys: ['name', 'company'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [customers]);

  const productSuggestions = useMemo(() => {
    if (!productQuery.trim()) return products.filter(p => p.status === 'Active').slice(0, 8);
    return productFuse.search(productQuery).map(r => r.item).slice(0, 8);
  }, [productQuery, productFuse, products]);

  const customerSuggestions = useMemo(() => {
    if (!customerQuery.trim()) return customers.slice(0, 8);
    return customerFuse.search(customerQuery).map(r => r.item).slice(0, 8);
  }, [customerQuery, customerFuse, customers]);

  useEffect(() => {
    if (!isOpen) return;
    setLineItems([newItem()]);
    setCustomerQuery('');
    setCustomerId(undefined);
    setCurrency('USD');
    setShipping(0);
    setNotes('');
    setActiveItemId(null);
    api.customers.list('customer').then(setCustomers).catch(() => {});
  }, [isOpen]);

  // Close customer picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setCustomerPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isOpen) return null;

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const total = subtotal + shipping;

  const updateItem = (localId: string, patch: Partial<QuickLineItem>) => {
    setLineItems(prev => prev.map(i => i.localId === localId ? { ...i, ...patch } : i));
  };

  const removeItem = (localId: string) => {
    if (lineItems.length <= 1) {
      showToast('Invoice must have at least one item', 'error');
      return;
    }
    setLineItems(prev => prev.filter(i => i.localId !== localId));
  };

  const pickProduct = (item: QuickLineItem, product: Product) => {
    updateItem(item.localId, {
      name: product.givenName || product.productName,
      productId: product.id,
      unit: product.type === 'Teaware' ? 'pcs' : 'g',
      price: product.pricePerGramUSD ?? 0,
      quantity: product.type === 'Teaware' ? 1 : 10,
    });
    setActiveItemId(null);
    setProductQuery('');
  };

  const pickCustomer = (customer: any) => {
    setCustomerQuery(customer.name);
    setCustomerId(customer.id);
    if (customer.preferredCurrency && customer.preferredCurrency !== 'UNK') {
      setCurrency(customer.preferredCurrency as Currency);
    }
    setCustomerPickerOpen(false);
  };

  const buildPayload = () => ({
    invoice: {
      customer_name: customerQuery.trim() || 'Unknown',
      customer_id: customerId ?? null,
      display_currency: currency,
      shipping_cost_usd: shipping,
      status: 'Draft',
      notes: notes || null,
    },
    lineItems: lineItems.map(i => ({
      product_id: i.productId ?? null,
      custom_name: i.productId ? null : (i.name.trim() || 'Item'),
      quantity: i.quantity,
      price_at_sale: i.price,
    })),
  });

  const handleSave = async (withPdf = false) => {
    if (!customerQuery.trim()) {
      showToast('Add a customer name', 'error');
      return;
    }
    if (lineItems.some(i => !i.name.trim())) {
      showToast('All items need a name', 'error');
      return;
    }
    setSaving(true);
    try {
      const { invoice, lineItems: items } = buildPayload();
      const created = await api.invoices.create(invoice, items);

      if (withPdf) {
        const pdfItems: InvoiceDisplayItem[] = lineItems.map(li => ({
          productId: li.productId,
          customName: li.productId ? undefined : (li.name.trim() || 'Item'),
          quantity: li.quantity,
          unit: li.unit,
          priceAtSale: li.price,
          product: li.productId ? products.find(p => p.id === li.productId) : undefined,
        }));
        await generatePdf(created.invoice_number, customerQuery.trim(), pdfItems);
      }

      showToast('Invoice created.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Failed: ' + err.message, 'error');
    }
    setSaving(false);
  };

  const generatePdf = async (invoiceNumber: string, customerName: string, items: InvoiceDisplayItem[]) => {
    const { pdf } = await import('@react-pdf/renderer');
    const { InvoicePdfDocument } = await import('./InvoicePdf');
    const doc = React.createElement(InvoicePdfDocument, {
      invoiceNumber,
      customerName,
      cart: items,
      rates,
      currency,
      shipping,
      notes: notes || undefined,
    });
    const blob = await pdf(doc as any).toBlob();
    const fileName = `teajia-invoice-${invoiceNumber}.pdf`.replace(/\s+/g, '-');
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      await navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title: 'Teajia Invoice' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-tea-border shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-tea-gold" />
            <h3 className="text-base font-serif text-tea-text">Quick Invoice</h3>
          </div>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto custom-scrollbar px-6 py-5 space-y-5 flex-1">

          {/* Customer */}
          <div ref={customerRef} className="relative">
            <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Customer</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
              <input
                type="text"
                value={customerQuery}
                onChange={e => { setCustomerQuery(e.target.value); setCustomerId(undefined); setCustomerPickerOpen(true); }}
                onFocus={() => setCustomerPickerOpen(true)}
                placeholder="Name or search existing customer…"
                className="w-full bg-tea-surface border border-tea-border rounded-lg pl-8 pr-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
              />
              {customerId && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-tea-gold">linked</span>}
            </div>
            {customerPickerOpen && customerSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-tea-elevated border border-tea-border rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto custom-scrollbar">
                {customerSuggestions.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => pickCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-tea-surface transition-colors flex justify-between items-center"
                  >
                    <span className="text-tea-text truncate">{c.name}</span>
                    {c.company && <span className="text-tea-text-dim text-xs ml-2 shrink-0">{c.company}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency + Shipping */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Currency)}
                className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Shipping (USD)</label>
              <input
                type="number" min={0} step={0.01}
                value={shipping}
                onChange={e => setShipping(Number(e.target.value) || 0)}
                className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors num"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">Items</label>
              <button
                onClick={() => setLineItems(prev => [...prev, newItem()])}
                className="text-xs text-tea-gold hover:text-tea-gold/80 flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add item
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map(item => (
                <div key={item.localId} className="bg-tea-surface border border-tea-border rounded-xl p-3">

                  {/* Name with autocomplete */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => {
                        updateItem(item.localId, { name: e.target.value, productId: undefined });
                        setProductQuery(e.target.value);
                        setActiveItemId(item.localId);
                      }}
                      onFocus={() => { setActiveItemId(item.localId); setProductQuery(item.name); }}
                      onBlur={() => setTimeout(() => setActiveItemId(null), 150)}
                      placeholder="Item name (or search inventory…)"
                      className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-1.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                    />
                    {item.productId && (
                      <Link size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-gold" aria-label="Linked to inventory" />
                    )}
                    {activeItemId === item.localId && productSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-tea-elevated border border-tea-border rounded-xl shadow-lg z-10 max-h-36 overflow-y-auto custom-scrollbar">
                        {productSuggestions.map(p => (
                          <button
                            key={p.id}
                            onMouseDown={() => pickProduct(item, p)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-tea-surface transition-colors flex justify-between items-center"
                          >
                            <span className="text-tea-text truncate">{p.givenName || p.productName}</span>
                            <span className="text-tea-text-dim shrink-0 ml-2">{p.stockGrams}g · ${p.pricePerGramUSD}/g</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Qty / Unit / Price / Remove */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] text-tea-text-dim mb-0.5 block">Qty</label>
                      <input
                        type="number" min={0} step={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.localId, { quantity: Number(e.target.value) || 0 })}
                        className="w-full bg-tea-bg border border-tea-border rounded-lg px-2 py-1 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors num"
                      />
                    </div>
                    <div className="w-16">
                      <label className="text-[9px] text-tea-text-dim mb-0.5 block">Unit</label>
                      <select
                        value={item.unit}
                        onChange={e => updateItem(item.localId, { unit: e.target.value as 'g' | 'pcs' })}
                        className="w-full bg-tea-bg border border-tea-border rounded-lg px-2 py-1 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                      >
                        <option value="g">g</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-tea-text-dim mb-0.5 block">Price / unit (USD)</label>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.price}
                        onChange={e => updateItem(item.localId, { price: Number(e.target.value) || 0 })}
                        className="w-full bg-tea-bg border border-tea-border rounded-lg px-2 py-1 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors num"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <label className="text-[9px] text-tea-text-dim mb-0.5 block">Total</label>
                      <span className="text-sm text-tea-text-sec">{formatCurrency(item.quantity * item.price, 'USD', rates)}</span>
                    </div>
                    <button
                      onClick={() => removeItem(item.localId)}
                      className="mt-3 text-tea-text-dim hover:text-tea-text transition-colors p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-tea-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-tea-text-sec">Total</span>
            <span className="text-sm font-medium text-tea-text">
              {formatCurrency(total, currency, rates)} {currency !== 'USD' && <span className="text-tea-text-dim text-xs">(${total.toFixed(2)} USD)</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm text-tea-text-sec border border-tea-border hover:border-tea-text-sec transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm text-tea-text bg-tea-surface border border-tea-border hover:border-tea-gold/50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin inline" /> : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm text-tea-bg bg-tea-gold hover:bg-tea-gold/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <><FileDown size={14} /> Save + PDF</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
