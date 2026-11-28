import React, { useState, useEffect, useMemo } from 'react';
import { X, Pencil, Loader2, Plus, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useProducts } from '../hooks/useAdminData';
import Fuse from 'fuse.js';
import { OrderPayLink } from './OrderPayLink';
import { enteredNumber } from '../productUpdatePayload';
import { updateInvoiceDetails } from '../../lib/invoiceEditApi';

/**
 * The invoice editor (Adrian, 2026-11-28: "It's not very easy for me to edit
 * mistakes"). One sheet for any invoice that is not void, for every account
 * that sells: the name, date and notes can be corrected at any time; the
 * lines, prices, discount and shipping while nothing has been paid or sent.
 * Every save goes on the invoice's timeline with what it was before, and the
 * share link stays the same link.
 */
interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any;
  showToast: (msg: string, type?: string) => void;
}

interface LineItem {
  id?: string;
  product_id: string;
  product_name: string;
  given_name: string;
  /** What is typed, kept as typed: a blank is not a zero. */
  quantity: string;
  price_at_sale: string;
  // A line item with no catalogue product carries its name here and nowhere
  // else. Loading and saving must both carry it, or editing an order silently
  // erases the name of every custom line on it.
  custom_name?: string | null;
}

/** The one discount line the shop's discount writes (worker/src/invoiceDiscount.ts). */
const DISCOUNT_NAME = /^Discount (\d+(?:\.\d+)?)%$/;
const discountLinePercent = (item: { product_id?: string | null; custom_name?: string | null; price_at_sale?: unknown }): number | null => {
  if (item.product_id || typeof item.custom_name !== 'string' || !(Number(item.price_at_sale) < 0)) return null;
  const match = item.custom_name.match(DISCOUNT_NAME);
  return match ? Number(match[1]) : null;
};

const money = (value: number) => `$${value.toFixed(2)}`;
const dayOf = (stamp: unknown) => (typeof stamp === 'string' ? stamp.slice(0, 10) : '');
const field = 'w-full min-h-tap bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors disabled:text-tea-text-sec';

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen, onClose, onSuccess, invoice, showToast,
}) => {
  const { data: products = [] } = useProducts();
  const [items, setItems] = useState<LineItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [loadedDiscount, setLoadedDiscount] = useState(0);
  const [shippingCost, setShippingCost] = useState('');
  const [shippingDestination, setShippingDestination] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedInvoiceId, setLoadedInvoiceId] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [addingProduct, setAddingProduct] = useState(false); // history: in-page
  const [productSearch, setProductSearch] = useState('');
  const status = String(invoice?.status ?? '');
  const itemsLocked = (status !== '' && !['Draft', 'Pending'].includes(status))
    || (invoice?.payment_status && invoice.payment_status !== 'unpaid') || !!invoice?.inventory_deducted;

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['givenName', 'productName', 'type'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [products]);

  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    return fuse.search(productSearch).map(r => r.item).slice(0, 10);
  }, [productSearch, fuse, products]);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    let current = true;
    setItems([]);
    setLoadedInvoiceId(null);
    setLoadError(false);
    setFetching(true);
    setAddingProduct(false);
    setProductSearch('');
    setCustomerName(invoice.customer_name || '');
    setInvoiceDate(dayOf(invoice.created_at));
    setShippingCost(invoice.shipping_cost_usd == null ? '0' : String(invoice.shipping_cost_usd));
    setShippingDestination(invoice.shipping_destination || '');
    setTrackingNumber(invoice.tracking_number || '');
    setNotes(invoice.notes || '');

    api.invoices.getItems(invoice.id).then(data => {
      if (!current) return;
      const rows = (data || []) as any[];
      const kept = rows.map(discountLinePercent).find(percent => percent !== null) ?? 0;
      setLoadedDiscount(kept);
      setDiscount(kept ? String(kept) : '');
      setItems(rows.filter(item => discountLinePercent(item) === null).map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name || '',
        given_name: item.given_name || '',
        quantity: item.quantity == null ? '' : String(item.quantity),
        price_at_sale: item.price_at_sale == null ? '' : String(item.price_at_sale),
        custom_name: item.custom_name ?? null,
      })));
      setLoadedInvoiceId(invoice.id);
      setFetching(false);
    }).catch(() => {
      if (!current) return;
      setLoadError(true);
      showToast('Could not load invoice items. Refresh and try again.', 'error');
      setFetching(false);
    });
    return () => { current = false; };
  }, [isOpen, invoice?.id, loadAttempt]);

  if (!isOpen) return null;

  const updateItem = (index: number, key: 'quantity' | 'price_at_sale', value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      showToast('An invoice needs at least one line', 'error');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product: any) => {
    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.productName,
      given_name: product.givenName || product.productName,
      quantity: '10',
      price_at_sale: String(product.pricePerGramUSD),
    }]);
    setAddingProduct(false);
    setProductSearch('');
  };

  const lineTotal = (item: LineItem) => (enteredNumber(item.quantity) ?? 0) * (enteredNumber(item.price_at_sale) ?? 0);
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discountValue = discount.trim() === '' ? 0 : enteredNumber(discount);
  const discountOk = discountValue !== null && discountValue >= 0 && discountValue < 100 && Math.round(discountValue * 10) / 10 === discountValue;
  const discountUsd = discountOk && discountValue ? Math.round(Math.round(subtotal * 100) * discountValue / 100) / 100 : 0;
  const shippingValue = enteredNumber(shippingCost);
  const total = subtotal - discountUsd + (shippingValue ?? 0);
  const blankLine = items.find(item => enteredNumber(item.quantity) === null || enteredNumber(item.price_at_sale) === null);

  const handleSave = async () => {
    if (fetching || loadError || loadedInvoiceId !== invoice?.id) return;
    if (!customerName.trim()) { showToast('Give the invoice a name', 'error'); return; }
    if (!itemsLocked) {
      if (items.length === 0) { showToast('An invoice needs at least one line', 'error'); return; }
      if (blankLine) { showToast(`Give ${blankLine.given_name || blankLine.product_name || blankLine.custom_name || 'each line'} an amount and a price`, 'error'); return; }
      if (!discountOk) { showToast('The discount is a percent from 0 to 99.9', 'error'); return; }
    }
    if (shippingValue === null || shippingValue < 0) { showToast('Shipping is a number, 0 for none', 'error'); return; }
    setLoading(true);
    try {
      const details: { customer_name?: string; notes?: string | null; invoice_date?: string } = {};
      if (customerName.trim() !== (invoice.customer_name || '')) details.customer_name = customerName.trim();
      if (notes.trim() !== (invoice.notes || '').trim()) details.notes = notes.trim() || null;
      if (invoiceDate && invoiceDate !== dayOf(invoice.created_at)) details.invoice_date = invoiceDate;
      if (Object.keys(details).length > 0) await updateInvoiceDetails(invoice.id, details);

      if (!itemsLocked) await api.invoices.updateItems(invoice.id, {
        lineItems: items.map(item => ({
          product_id: item.product_id,
          quantity: enteredNumber(item.quantity) as number,
          price_at_sale: enteredNumber(item.price_at_sale) as number,
          // Saving replaces every line, so a custom line's name has to go back
          // with it. Omitting this wrote NULL over the name of any line that
          // was not a catalogue product.
          ...(item.product_id ? {} : { custom_name: item.custom_name ?? undefined }),
        })),
        shipping_cost_usd: shippingValue,
        // The discount is written again from the new lines, so it always matches them.
        discount_percent: discountValue as number,
      });
      const shippingChanges: Record<string, unknown> = {};
      if (itemsLocked && shippingValue !== Number(invoice.shipping_cost_usd ?? 0)) shippingChanges.shipping_cost_usd = shippingValue;
      if ((shippingDestination.trim() || null) !== (invoice.shipping_destination || null)) shippingChanges.shipping_destination = shippingDestination.trim() || null;
      if ((trackingNumber.trim() || null) !== (invoice.tracking_number || null)) shippingChanges.tracking_number = trackingNumber.trim() || null;
      if (Object.keys(shippingChanges).length > 0) await api.invoices.update(invoice.id, shippingChanges);
      showToast('Invoice saved. Its link shows the change.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`Could not save the invoice: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit invoice"
        className="relative bg-tea-surface border border-tea-border rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-4 sm:px-6 pt-5 pb-3 flex-shrink-0 pr-14">
          <div className="flex items-center gap-2">
            <Pencil size={14} className="text-tea-gold" />
            <h3 className="h3 text-tea-text">Edit invoice {invoice?.invoice_number}</h3>
          </div>
          {itemsLocked && (
            <p className="text-ui-12 text-tea-text-sec mt-1">Money has been received or the tea has gone, so the lines stay as they are. The name, date, notes and delivery can still be fixed.</p>
          )}
        </div>

        <div className="px-4 sm:px-6 pb-4 flex-1 overflow-y-auto custom-scrollbar">
          {fetching || (!loadError && loadedInvoiceId !== invoice?.id) ? (
            <div className="py-8 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" size={20} /></div>
          ) : loadError ? (
            <div role="alert" className="py-8 text-center text-tea-text-sec">
              <p>Could not load this invoice’s lines. No changes can be saved until they load.</p>
              <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="mt-3 min-h-tap px-4 text-tea-gold hover:text-tea-gold-lt">Retry loading items</button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
                <div>
                  <label htmlFor="invoice-edit-name" className="block label-caps text-tea-text-sec mb-1.5">Name</label>
                  <input id="invoice-edit-name" type="text" autoComplete="off" value={customerName} onChange={e => setCustomerName(e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="invoice-edit-date" className="block label-caps text-tea-text-sec mb-1.5">Date</label>
                  <input id="invoice-edit-date" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={`${field} num`} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label-caps text-tea-text-sec">Lines</span>
                  {!itemsLocked && <button
                    type="button"
                    onClick={() => setAddingProduct(!addingProduct)}
                    className="inline-flex items-center gap-1.5 min-h-tap px-2 text-ui-13 text-tea-gold hover:text-tea-gold-lt transition-colors"
                  >
                    <Plus size={14} /> Add tea
                  </button>}
                </div>

                {!itemsLocked && addingProduct && (
                  <div className="bg-tea-bg border border-tea-border rounded-md p-3 mb-3">
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Find a tea"
                        aria-label="Find a tea"
                        className={`${field} pl-9`}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                      {searchResults.map(product => (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="w-full min-h-tap text-left px-2 rounded-md text-ui-13 hover:bg-tea-accent-sub transition-colors flex justify-between items-center gap-2"
                        >
                          <span className="text-tea-text truncate">{product.givenName || product.productName}</span>
                          <span className="text-tea-text-sec text-ui-12 shrink-0 num">${product.pricePerGramUSD.toFixed(2)}/g</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {items.map((item, index) => {
                    const name = item.given_name || item.product_name || item.custom_name || 'Tea';
                    return (
                      <div key={index} className="bg-tea-bg border border-tea-border rounded-md p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-ui-14 text-tea-text min-w-0 break-words">{name}</span>
                          {!itemsLocked && <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="tap-target shrink-0 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"
                            aria-label={`Remove ${name}`}
                          >
                            <Trash2 size={14} />
                          </button>}
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                          <div>
                            <label htmlFor={`invoice-line-qty-${index}`} className="block text-ui-12 text-tea-text-sec mb-1">Grams</label>
                            <input
                              id={`invoice-line-qty-${index}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={item.quantity}
                              disabled={itemsLocked}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className={`${field} num`}
                            />
                          </div>
                          <div>
                            <label htmlFor={`invoice-line-price-${index}`} className="block text-ui-12 text-tea-text-sec mb-1">$ per gram</label>
                            <input
                              id={`invoice-line-price-${index}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.01}
                              value={item.price_at_sale}
                              disabled={itemsLocked}
                              onChange={(e) => updateItem(index, 'price_at_sale', e.target.value)}
                              className={`${field} num`}
                            />
                          </div>
                          <div className="text-right pb-2 min-w-[4.5rem]">
                            <div className="text-ui-14 text-tea-text num">{money(lineTotal(item))}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="invoice-edit-discount" className="block label-caps text-tea-text-sec mb-1.5">Discount %</label>
                  <input id="invoice-edit-discount" type="number" inputMode="decimal" min={0} max={99.9} step={0.1} placeholder="0" value={discount} disabled={itemsLocked} onChange={e => setDiscount(e.target.value)} className={`${field} num`} />
                </div>
                <div>
                  <label htmlFor="invoice-edit-shipping" className="block label-caps text-tea-text-sec mb-1.5">Shipping (USD)</label>
                  <input id="invoice-edit-shipping" type="number" inputMode="decimal" min={0} step={0.01} value={shippingCost} onChange={e => setShippingCost(e.target.value)} className={`${field} num`} />
                </div>
              </div>

              <div className="border-t border-tea-border pt-3 space-y-1 text-ui-14">
                <div className="flex justify-between text-tea-text-sec"><span>Teas</span><span className="num">{money(subtotal)}</span></div>
                {(discountUsd > 0 || loadedDiscount > 0) && (
                  <div className="flex justify-between text-tea-text-sec"><span>Discount {discountOk ? discountValue : '?'}%</span><span className="num">-{money(discountUsd)}</span></div>
                )}
                {(shippingValue ?? 0) > 0 && <div className="flex justify-between text-tea-text-sec"><span>Shipping</span><span className="num">{money(shippingValue ?? 0)}</span></div>}
                <div className="flex justify-between items-center pt-1">
                  <span className="label-caps text-tea-text-sec">Total</span>
                  <span className="text-ui-20 font-serif text-tea-text num">{money(total)}</span>
                </div>
              </div>

              <div>
                <label htmlFor="invoice-edit-notes" className="block label-caps text-tea-text-sec mb-1.5">Notes</label>
                <textarea
                  id="invoice-edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${field} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="order-shipping-destination" className="block label-caps text-tea-text-sec mb-1.5">Delivery destination</label>
                  <input id="order-shipping-destination" type="text" value={shippingDestination} onChange={event => setShippingDestination(event.target.value)} placeholder="Address or pickup arrangement" className={field} />
                </div>
                <div>
                  <label htmlFor="order-tracking-number" className="block label-caps text-tea-text-sec mb-1.5">Tracking number</label>
                  <input id="order-tracking-number" type="text" value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} className={field} />
                </div>
              </div>

              <OrderPayLink
                payment={invoice?.payment}
                invoiceNumber={invoice?.invoice_number}
                layout="block"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 px-4 sm:px-6 py-3 border-t border-tea-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap px-2 text-ui-14 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || fetching || loadError || loadedInvoiceId !== invoice?.id || (!itemsLocked && items.length === 0)}
            className="btn-primary"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
