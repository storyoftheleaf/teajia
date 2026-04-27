import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Search, FileDown, Loader2, Phone, Mail, MessageCircle, AtSign, Send, Lock, Hash, MessagesSquare } from 'lucide-react';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { Currency, InvoiceDisplayItem, Product, ContactChannel, ContactEntry } from '../types';
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

const CONTACT_ICONS: Record<ContactChannel, React.ElementType> = {
  phone: Phone, email: Mail, whatsapp: MessageCircle,
  wechat: MessagesSquare, line: Hash, instagram: AtSign,
  telegram: Send, signal: Lock, other: Hash,
};

const CONTACT_LABELS: Record<ContactChannel, string> = {
  phone: 'Phone', email: 'Email', whatsapp: 'WA',
  wechat: 'WeChat', line: 'Line', instagram: 'IG',
  telegram: 'TG', signal: 'Signal', other: 'Other',
};

interface QuickInvoiceModalPrefill {
  vendorName?: string;
  items?: Array<{ name: string; quantity?: number; unit?: 'g' | 'pcs'; productId?: string; price?: number }>;
}

interface QuickInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  showToast: (msg: string, type?: string) => void;
  prefill?: QuickInvoiceModalPrefill;
}

const CURRENCIES: Currency[] = ['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD', 'AUD'];

const newItem = (): QuickLineItem => ({
  localId: crypto.randomUUID(),
  name: '',
  quantity: 1,
  unit: 'g',
  price: 0,
});

const ordinal = (n: number) => String(n).padStart(2, '0');

export const QuickInvoiceModal: React.FC<QuickInvoiceModalProps> = ({
  isOpen, onClose, onSuccess, products, showToast, prefill,
}) => {
  const { data: rates = [] } = useRates();

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const [lineItems, setLineItems] = useState<QuickLineItem[]>([newItem()]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState('');

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const latestAddedItemId = useRef<string | null>(null);

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
    if (!productQuery.trim()) return products.filter(p => p.status === 'Active').slice(0, 6);
    return productFuse.search(productQuery).map(r => r.item).slice(0, 6);
  }, [productQuery, productFuse, products]);

  const customerSuggestions = useMemo(() => {
    if (!customerQuery.trim()) return customers.slice(0, 8);
    return customerFuse.search(customerQuery).map(r => r.item).slice(0, 8);
  }, [customerQuery, customerFuse, customers]);

  useEffect(() => {
    if (!isOpen) return;
    // Apply prefill if provided, otherwise reset to defaults
    if (prefill) {
      if (prefill.vendorName) setCustomerQuery(prefill.vendorName);
      if (prefill.items && prefill.items.length > 0) {
        setLineItems(prefill.items.map((item) => {
          const product = item.productId ? products.find(p => p.id === item.productId) : undefined;
          const isTeaware = product?.type === 'Teaware';
          return {
            localId: crypto.randomUUID(),
            name: item.name,
            productId: item.productId,
            quantity: item.quantity ?? (isTeaware ? 1 : 10),
            unit: item.unit ?? (isTeaware ? 'pcs' : 'g'),
            price: item.price ?? product?.pricePerGramUSD ?? 0,
          };
        }));
      } else {
        setLineItems([newItem()]);
      }
    } else {
      setLineItems([newItem()]);
      setCustomerQuery('');
    }
    setCustomerId(undefined);
    setCustomerInfo(null);
    setCurrency('USD');
    setShipping(0);
    setNotes('');
    setActiveItemId(null);
    api.customers.list('customer').then(setCustomers).catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setCustomerPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus newly added item name field
  useEffect(() => {
    if (latestAddedItemId.current) {
      const ref = nameInputRefs.current[latestAddedItemId.current];
      if (ref) ref.focus();
      latestAddedItemId.current = null;
    }
  });

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

  const addItem = () => {
    const item = newItem();
    latestAddedItemId.current = item.localId;
    setLineItems(prev => [...prev, item]);
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
    setCustomerInfo({
      ...customer,
      contacts: typeof customer.contacts === 'string'
        ? (() => { try { return JSON.parse(customer.contacts || '[]'); } catch { return []; } })()
        : (customer.contacts || []),
    });
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

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-tea-bg w-full max-w-xl shadow-2xl relative flex flex-col max-h-[96vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-300">

        {/* Header */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim">{today}</p>
          </div>

          <div className="mt-4 mb-5">
            <h2 className="font-serif text-ui-26 leading-tight text-tea-text">New Invoice</h2>
            <p className="text-xs text-tea-text-sec mt-1 tracking-wide">Teajia · Draft</p>
          </div>

          {/* Gold hairline */}
          <div className="h-px bg-tea-gold/20" />
        </div>

        {/* Body */}
        <div className="overflow-y-auto overscroll-contain custom-scrollbar flex-1">
          <div className="px-6 py-5 space-y-7">

            {/* Customer — labeled "For" */}
            <div ref={customerRef} className="relative">
              <label className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2 block">For</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={e => {
                    setCustomerQuery(e.target.value);
                    setCustomerId(undefined);
                    setCustomerInfo(null);
                    setCustomerPickerOpen(true);
                  }}
                  onFocus={() => setCustomerPickerOpen(true)}
                  placeholder="Name or search existing customer…"
                  className="w-full bg-tea-surface border border-tea-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/40 focus:border-tea-gold/50 transition-colors placeholder:text-tea-text-dim"
                />
              </div>

              {/* Linked customer confirmation */}
              {customerInfo && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-sm text-tea-text">{customerInfo.name}</span>
                    {customerInfo.company && (
                      <span className="text-xs text-tea-text-sec">· {customerInfo.company}</span>
                    )}
                    {customerInfo.preferredCurrency && customerInfo.preferredCurrency !== 'UNK' && (
                      <span className="text-ui-10 text-tea-gold bg-tea-gold/10 px-2 py-0.5 rounded-full">
                        prefers {customerInfo.preferredCurrency}
                      </span>
                    )}
                  </div>
                  {/* Contact chips */}
                  {(() => {
                    const contacts: ContactEntry[] = customerInfo.contacts?.length > 0
                      ? customerInfo.contacts
                      : [
                          ...(customerInfo.phone    ? [{ channel: 'phone'    as ContactChannel, handle: customerInfo.phone    }] : []),
                          ...(customerInfo.whatsapp ? [{ channel: 'whatsapp' as ContactChannel, handle: customerInfo.whatsapp }] : []),
                          ...(customerInfo.email    ? [{ channel: 'email'    as ContactChannel, handle: customerInfo.email    }] : []),
                        ];
                    if (contacts.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {contacts.map((c, i) => {
                          const Icon = CONTACT_ICONS[c.channel] ?? Hash;
                          const label = CONTACT_LABELS[c.channel] ?? 'Other';
                          return (
                            <span key={i} className="flex items-center gap-1 text-ui-10 text-tea-text-sec bg-tea-surface border border-tea-border rounded-full px-2 py-0.5">
                              <Icon size={10} className="shrink-0" />
                              <span className="text-tea-text-dim">{label}</span>
                              <span className="text-tea-text">{c.handle}</span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {customerPickerOpen && customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-tea-elevated border border-tea-border rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto custom-scrollbar">
                  {customerSuggestions.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => pickCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-tea-surface transition-colors flex justify-between items-center gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-tea-text">{c.name}</span>
                        {c.company && (
                          <span className="text-xs text-tea-text-sec ml-2">{c.company}</span>
                        )}
                      </div>
                      {c.preferredCurrency && c.preferredCurrency !== 'UNK' && (
                        <span className="text-ui-10 text-tea-text-dim shrink-0">{c.preferredCurrency}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Currency — pill tabs, no dropdown */}
            <div>
              <label className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2.5 block">Currency</label>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                      currency === c
                        ? 'bg-tea-gold text-tea-bg'
                        : 'bg-tea-surface text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated border border-tea-border'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items — numbered like a tea menu */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">Items</label>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold/70 transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Add
                </button>
              </div>

              <div className="space-y-0">
                {lineItems.map((item, index) => (
                  <div
                    key={item.localId}
                    className="relative group"
                  >
                    <div className="flex items-start gap-3 py-4">

                      {/* Ordinal number — editorial gold numeral */}
                      <span
                        className="font-serif text-ui-26 leading-none text-tea-gold/25 shrink-0 select-none tabular-nums"
                        style={{ minWidth: '2rem', textAlign: 'right' }}
                      >
                        {ordinal(index + 1)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">

                        {/* Name — serif, underline style */}
                        <div className="relative">
                          <input
                            ref={el => { nameInputRefs.current[item.localId] = el; }}
                            type="text"
                            value={item.name}
                            onChange={e => {
                              updateItem(item.localId, { name: e.target.value, productId: undefined });
                              setProductQuery(e.target.value);
                              setActiveItemId(item.localId);
                            }}
                            onFocus={() => { setActiveItemId(item.localId); setProductQuery(item.name); }}
                            onBlur={() => setTimeout(() => setActiveItemId(null), 200)}
                            placeholder="Name this item…"
                            className={`w-full bg-transparent border-0 border-b pb-1 text-sm font-serif text-tea-text outline-none transition-colors placeholder:italic placeholder:text-tea-text-dim/50 ${
                              item.productId
                                ? 'border-tea-gold/40'
                                : 'border-tea-border focus:border-tea-gold/50'
                            }`}
                          />
                          {/* Gold dot = linked to inventory */}
                          {item.productId && (
                            <span
                              className="absolute right-0 bottom-2 w-1.5 h-1.5 rounded-full bg-tea-gold/70"
                              aria-label="Linked to inventory"
                            />
                          )}

                          {/* Product suggestions */}
                          {activeItemId === item.localId && productSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-tea-elevated border border-tea-border rounded-xl shadow-xl z-20 overflow-hidden">
                              {productSuggestions.map(p => (
                                <button
                                  key={p.id}
                                  onMouseDown={() => pickProduct(item, p)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-tea-surface transition-colors flex justify-between items-center gap-2"
                                >
                                  <span className="text-tea-text font-serif truncate">{p.givenName || p.productName}</span>
                                  <span className="text-tea-text-dim shrink-0 tabular-nums">
                                    {p.stockGrams}g · ${p.pricePerGramUSD}/g
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Qty / Unit / Price — compact row below name */}
                        <div className="flex items-center gap-2 mt-2.5">
                          <input
                            type="number" min={0} step={1}
                            value={item.quantity}
                            onChange={e => updateItem(item.localId, { quantity: Number(e.target.value) || 0 })}
                            className="w-14 bg-tea-surface border border-tea-border rounded-lg px-2 py-1 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors num text-center"
                          />
                          <select
                            value={item.unit}
                            onChange={e => updateItem(item.localId, { unit: e.target.value as 'g' | 'pcs' })}
                            className="bg-tea-surface border border-tea-border rounded-lg px-2 py-1 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors"
                          >
                            <option value="g">g</option>
                            <option value="pcs">pcs</option>
                          </select>
                          <span className="text-tea-text-dim text-xs select-none">×</span>
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tea-text-dim text-xs pointer-events-none">$</span>
                            <input
                              type="number" min={0} step={0.01}
                              value={item.price}
                              onChange={e => updateItem(item.localId, { price: Number(e.target.value) || 0 })}
                              className="w-full bg-tea-surface border border-tea-border rounded-lg pl-5 pr-2 py-1 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors num"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: line total + remove */}
                      <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                        <span className="text-sm text-tea-text tabular-nums">
                          {formatCurrency(item.quantity * item.price, 'USD', rates)}
                        </span>
                        <button
                          onClick={() => removeItem(item.localId)}
                          className="text-tea-text-sec hover:text-tea-text transition-all p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Item separator */}
                    {index < lineItems.length - 1 && (
                      <div className="h-px bg-tea-border/50 ml-11" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes — minimal underline style */}
            <div>
              <label className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for this invoice…"
                className="w-full bg-transparent border-0 border-b border-tea-border pb-2 text-sm text-tea-text outline-none focus:border-tea-gold/50 transition-colors resize-none placeholder:italic placeholder:text-tea-text-dim/50"
              />
            </div>

            <div className="h-1" />
          </div>
        </div>

        {/* Footer — sticky, with large total display */}
        <div className="px-6 pt-4 pb-5 border-t border-tea-border shrink-0">

          {/* Shipping */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-tea-text-sec">Shipping (USD)</span>
            <div className="relative w-24">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim text-xs pointer-events-none">$</span>
              <input
                type="number" min={0} step={0.01}
                value={shipping}
                onChange={e => setShipping(Number(e.target.value) || 0)}
                className="w-full bg-tea-surface border border-tea-border rounded-lg pl-6 pr-2 py-1.5 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors num text-right"
              />
            </div>
          </div>

          {/* Subtotal row — only shown when shipping > 0 */}
          {shipping > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-tea-text-dim">Subtotal</span>
              <span className="text-xs text-tea-text-sec tabular-nums">{formatCurrency(subtotal, 'USD', rates)}</span>
            </div>
          )}

          {/* Total — large editorial display */}
          <div className="flex items-baseline justify-between py-3.5 border-t border-tea-border">
            <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">Total</span>
            <div className="text-right">
              <span className="font-serif text-[22px] leading-none text-tea-text tabular-nums">
                {formatCurrency(total, currency, rates)}
              </span>
              <span className="text-xs text-tea-text-sec ml-1.5">{currency}</span>
              {currency !== 'USD' && (
                <p className="text-ui-10 text-tea-text-dim tabular-nums mt-1">${total.toFixed(2)} USD</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="text-xs text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40 shrink-0"
            >
              Save draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-tea-bg bg-tea-gold hover:bg-tea-gold/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <FileDown size={14} />
                  Save + Share
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
