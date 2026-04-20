
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2, Share2, Loader2, Printer, RefreshCcw, Clock, Package, X, ExternalLink, ArrowDownLeft, ArrowUpRight, FileDown } from 'lucide-react';
import { CartItem as AdminCartItem, ExchangeRate, Currency } from '../../admin/types';
import { api } from '../../lib/api';
import { formatCurrency } from '../../admin/utils';
import { buildOrderMessage, buildWhatsAppUrl } from '../../lib/whatsapp';
import { TeaIllustration } from '../../admin/components/TeaIllustration';
import { useCustomers } from '../../admin/hooks/useAdminData';
import { useEvents } from '../../admin/hooks/useEventData';
import { useAppStore } from '../../lib/store';

// ── String similarity (Levenshtein-based) ────────────────────────────────────

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  if (!al || !bl) return 0;
  const longer = al.length > bl.length ? al : bl;
  const shorter = al.length > bl.length ? bl : al;
  if (longer.length === 0) return 1;
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) { costs[j] = j; continue; }
      if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / longer.length;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TransactionDirection = 'sale' | 'purchase';

export interface AdminCartProps {
  cart: AdminCartItem[];
  setCart: (cart: AdminCartItem[]) => void;
  onClearCart: () => void;
  onSuccess: () => void;
  onClose: () => void;
  rates: ExchangeRate[];
  showToast: (message: string, type?: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const AdminCart: React.FC<AdminCartProps> = ({
  cart, setCart, onClearCart, onSuccess, onClose, rates, showToast,
}) => {
  // ── Direction (sale vs purchase) ──────────────────────────────────────
  const direction = useAppStore((s) => s.cartDirection);
  const storeVendorName = useAppStore((s) => s.cartVendorName);
  const setCartDirection = useAppStore((s) => s.setCartDirection);
  const isPurchase = direction === 'purchase';

  // ── State ──────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState(isPurchase ? storeVendorName : '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { data: customersData = [] } = useCustomers();
  const allCustomers = useMemo(() => customersData.map(c => ({
    id: c.id, name: c.name, company: c.company,
    whatsapp: c.whatsapp, email: c.email,
    preferredCurrency: c.preferredCurrency,
    tags: c.tags,
  })), [customersData]);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
  const [shippingCostUSD, setShippingCostUSD] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const [dedupSuggestion, setDedupSuggestion] = useState<{ name: string; id: string } | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const storeSourceEventId = useAppStore((s) => s.cartSourceEventId);
  const setStoreSourceEventId = useAppStore((s) => s.setCartSourceEventId);
  const [sourceEventId, setSourceEventId] = useState<string | null>(storeSourceEventId);
  const { data: allEvents = [] } = useEvents();

  // Clear store event context once consumed
  useEffect(() => {
    if (storeSourceEventId) {
      setSourceEventId(storeSourceEventId);
      setStoreSourceEventId(null);
    }
  }, [storeSourceEventId, setStoreSourceEventId]);

  // Undo state
  const [undoState, setUndoState] = useState<{ prevCart: AdminCartItem[]; label: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

  // Debounce timer ref for customer search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus vendor/customer name when drawer opens
  useEffect(() => {
    const timer = setTimeout(() => customerInputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  // ── Customer search with 300ms debounce ────────────────────────────────

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerName(value);
    setValidationError('');
    setSelectedCustomerId(null);
    setDedupSuggestion(null);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.trim().length > 0 && allCustomers.length > 0) {
      searchTimerRef.current = setTimeout(() => {
        const q = value.toLowerCase();
        const matches = allCustomers.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q)
        ).slice(0, 6);
        setCustomerSuggestions(matches);
        setShowSuggestions(true);
      }, 300);
    } else {
      setShowSuggestions(false);
    }
  }, [allCustomers]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.whatsapp || '');
    setSelectedCustomerId(customer.id);
    if (customer.preferredCurrency) setDisplayCurrency(customer.preferredCurrency);
    setShowSuggestions(false);
    setValidationError('');
  };

  // ── Cart actions ───────────────────────────────────────────────────────

  const updateQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    setCart(cart.map((item, i) => i === index ? { ...item, quantity: newQty } : item));
  };

  const removeItem = (index: number) => {
    const prevCart = [...cart];
    const removed = cart[index];
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
    if (undoState) clearTimeout(undoState.timeout);
    const timeout = setTimeout(() => setUndoState(null), 5000);
    setUndoState({ prevCart, label: removed.product.givenName, timeout });
  };

  // ── Purchase order message generation ─────────────────────────────────

  const generatePurchaseMessage = (): string => {
    const date = new Date().toLocaleDateString();
    let msg = `PURCHASE ORDER [TEAJIA]\nDate: ${date}\nVendor: ${customerName}\n\nITEMS:\n`;
    cart.forEach(item => {
      const unit = item.product.type === 'Teaware' ? 'units' : 'g';
      msg += `- ${item.product.givenName} (${item.product.productName}): ${item.quantity}${unit} @ ${formatCurrency(item.priceAtSale, displayCurrency, rates)}\n`;
    });
    msg += `\nSUBTOTAL: ${formatCurrency(subtotalUSD, displayCurrency, rates)}`;
    if (shippingCostUSD > 0) msg += `\nSHIPPING: ${formatCurrency(shippingCostUSD, displayCurrency, rates)}`;
    msg += `\nTOTAL: ${formatCurrency(totalUSD, displayCurrency, rates)}`;
    msg += `\n\nPlease confirm availability and pricing.`;
    return msg;
  };

  // ── Invoice creation / Purchase order ──────────────────────────────

  const handleCompleteSale = async () => {
    setValidationError('');
    if (!customerName.trim()) {
      setValidationError('Name required');
      showToast(isPurchase ? 'Vendor name is required' : 'Customer name is required', 'error');
      return;
    }
    if (cart.length === 0) return;

    // ── Purchase direction: generate message, no DB write ──────────
    if (isPurchase) {
      setIsProcessing(true);
      const message = generatePurchaseMessage();
      const phone = customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');

      // Build purchase receipt
      const purchaseRef = `PO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      // Link vendor to customers table if selected (optional)
      let vendorId = selectedCustomerId;
      if (!vendorId && customerName.trim() && allCustomers.length > 0) {
        // Check for existing vendor by exact name match — don't force creation
        const exactMatch = allCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (exactMatch) vendorId = exactMatch.id;
      }

      // Persist purchase order to database
      let poId: string | null = null;
      try {
        const po = await api.purchaseOrders.create({
          po_number: purchaseRef,
          vendor_name: customerName,
          vendor_contact: customerPhone || undefined,
          vendor_id: vendorId || undefined,
          items_json: JSON.stringify(cart.map(item => ({
            productId: item.productId,
            name: item.product.givenName,
            productName: item.product.productName,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            type: item.product.type,
          }))),
          total_usd: totalUSD,
          display_currency: displayCurrency,
          status: 'draft',
          message_text: message,
        });
        if (po?.id) poId = po.id;
      } catch {
        // Non-critical — PO text was already generated
      }

      setLastInvoice({
        id: poId,
        invoice_number: purchaseRef,
        customer_name: customerName,
        items: cart,
        _purchaseMessage: message,
        _vendorPhone: phone,
      });
      setTransactionComplete(true);
      showToast('Purchase order ready', 'success');
      setIsProcessing(false);
      return;
    }

    // ── Sale direction: create DB invoice (existing behavior) ─────
    setIsProcessing(true);

    let custId = selectedCustomerId;
    if (!custId && customerName.trim()) {
      // Check for fuzzy matches to prevent duplicates
      const fuzzyMatch = allCustomers.find(c =>
        similarity(c.name, customerName) > 0.75 && similarity(c.name, customerName) < 1
      );
      if (fuzzyMatch && !dedupSuggestion) {
        setDedupSuggestion({ name: fuzzyMatch.name, id: fuzzyMatch.id });
        setValidationError(`Similar customer exists: "${fuzzyMatch.name}". Click again to create new, or select the existing one.`);
        setIsProcessing(false);
        return;
      }
      // If user confirmed (clicked again after seeing warning), or no fuzzy match, proceed
      if (dedupSuggestion) setDedupSuggestion(null);
      try {
        const result = await api.customers.create({
          name: customerName.trim(),
          whatsapp: customerPhone || undefined,
          preferred_currency: displayCurrency,
        });
        custId = result.id;
        setSelectedCustomerId(custId);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } catch {
        // Non-critical
      }
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const invoiceData = await api.invoices.create(
        {
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_whatsapp: customerPhone || null,
          customer_id: custId || null,
          display_currency: displayCurrency,
          shipping_cost_usd: shippingCostUSD,
          source_event_id: sourceEventId || null,
          status: 'Pending',
        },
        cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price_at_sale: item.priceAtSale,
        }))
      );
      if (!invoiceData) {
        showToast('Transaction failed', 'error');
        setIsProcessing(false);
        return;
      }
      // Reserve stock immediately on order creation
      try {
        await api.rpc.reserveStock(invoiceData.id);
      } catch {
        showToast('Stock reservation pending — verify before fulfilling', 'info');
      }
      onSuccess();
      showToast('Order submitted successfully', 'success');
      setLastInvoice({ ...invoiceData, items: cart });
      setTransactionComplete(true);
      setSourceEventId(null);
    } catch (err: any) {
      showToast('Transaction failed: ' + (err.message || 'Unknown error'), 'error');
    }
    setIsProcessing(false);
  };

  const handleStartNewSale = () => {
    onClearCart();
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setShippingCostUSD(0);
    setSourceEventId(null);
    setLastInvoice(null);
    setTransactionComplete(false);
    setUndoState(null);
  };

  const generateWhatsAppLink = () => {
    if (!lastInvoice) return '#';
    const message = buildOrderMessage({
      type: 'invoice',
      ref: lastInvoice.invoice_number,
      customerName: lastInvoice.customer_name,
      items: cart.map(item => ({
        name: item.product.givenName,
        quantity: item.quantity,
        unit: item.product.type === 'Teaware' ? 'units' : 'g',
        price: formatCurrency(item.priceAtSale, displayCurrency, rates),
        total: formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates),
      })),
      subtotal: formatCurrency(subtotalUSD, displayCurrency, rates),
      shipping: shippingCostUSD > 0 ? formatCurrency(shippingCostUSD, displayCurrency, rates) : undefined,
      total: formatCurrency(totalUSD, displayCurrency, rates),
    });
    return buildWhatsAppUrl(customerPhone, message);
  };

  // ── PDF generation ─────────────────────────────────────────────────────

  const handleDownloadPdf = useCallback(async () => {
    if (!lastInvoice) return;
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      if (isPurchase) {
        const { PurchaseOrderPdfDocument } = await import('../../admin/components/PurchaseOrderPdf');
        const doc = React.createElement(PurchaseOrderPdfDocument, {
          poNumber: lastInvoice.invoice_number,
          vendorName: lastInvoice.customer_name,
          vendorContact: customerPhone || undefined,
          cart, rates, currency: displayCurrency, shipping: shippingCostUSD,
        });
        const blob = await pdf(doc as any).toBlob();
        const fileName = `teajia-po-${lastInvoice.customer_name}-${lastInvoice.invoice_number}.pdf`.replace(/\s+/g, '-');
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
          await navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title: `Teajia Purchase Order` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName; a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const { InvoicePdfDocument } = await import('../../admin/components/InvoicePdf');
        const doc = React.createElement(InvoicePdfDocument, {
          invoiceNumber: lastInvoice.invoice_number,
          customerName: lastInvoice.customer_name,
          cart, rates, currency: displayCurrency, shipping: shippingCostUSD,
        });
        const blob = await pdf(doc as any).toBlob();
        const fileName = `teajia-invoice-${lastInvoice.invoice_number}.pdf`.replace(/\s+/g, '-');
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
          await navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title: `Teajia Invoice` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = fileName; a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.debug('PDF generation failed:', err);
      showToast('PDF generation failed', 'error');
    } finally {
      setPdfLoading(false);
    }
  }, [lastInvoice, isPurchase, cart, rates, displayCurrency, shippingCostUSD, customerPhone, showToast]);

  // ── Derived ────────────────────────────────────────────────────────────

  const subtotalUSD = useMemo(() => cart.reduce((acc, item) => acc + item.quantity * item.priceAtSale, 0), [cart]);
  const totalUSD = subtotalUSD + shippingCostUSD;
  const isEmpty = cart.length === 0;

  // ── Auto-copy PO text when purchase receipt appears ─────────────────────
  useEffect(() => {
    if (transactionComplete && lastInvoice && isPurchase && lastInvoice._purchaseMessage) {
      navigator.clipboard.writeText(lastInvoice._purchaseMessage).then(() => {
        showToast('Order text copied to clipboard', 'success');
      }).catch(() => { /* clipboard not available */ });
    }
  }, [transactionComplete, lastInvoice, isPurchase, showToast]);

  // ── Receipt screen ─────────────────────────────────────────────────────

  if (transactionComplete && lastInvoice) {
    return (
      <div className="flex flex-col h-full bg-tea-bg overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-tea-border bg-tea-surface/50">
          <h2 className="text-xl font-serif text-tea-text tracking-wide">{isPurchase ? 'Purchase Order Ready' : 'Order Submitted'}</h2>
          <button onClick={onClose} className="nav-control p-1.5">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300 print:p-0 print:block">
          <div className="hidden print:block text-center mb-8 pt-8">
            <h1 className="text-3xl font-serif text-black mb-2">TEAJIA</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest mb-8">Fine Tea Inventory & Sales</p>
            <div className="border-b border-tea-border mb-8" />
          </div>
          <div className="bg-tea-surface border border-tea-border p-8 rounded-2xl shadow-2xl text-center w-full print:border-none print:shadow-none print:bg-white print:p-0 print:text-left">
            <div className="mx-auto bg-tea-gold/10 text-tea-gold w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-tea-border print:hidden">
              <Clock size={32} />
            </div>
            <h2 className="text-2xl font-serif text-tea-text mb-2 print:text-black">{isPurchase ? 'Purchase Order Ready' : 'Order Submitted'}</h2>
            <p className="text-tea-text-sec mb-6 text-xs print:text-gray-600 print:mb-4">
              {lastInvoice.invoice_number} • {new Date().toLocaleDateString()}
            </p>
            {isPurchase ? (
              <div className="bg-tea-gold/10 border border-tea-border p-3 rounded mb-6 text-xs text-tea-gold print:hidden text-left font-serif italic">
                Send this order to your vendor via WhatsApp, copy, or print.
              </div>
            ) : (
              <div className="bg-tea-gold/10 border border-tea-border p-3 rounded mb-6 text-xs text-tea-gold print:hidden text-left font-serif italic">
                Status: <strong className="font-sans not-italic">Pending Fulfillment</strong>.<br />
                Stock has not been deducted yet. Mark as "Filled" in Orders view when packing.
              </div>
            )}
            <div className="hidden print:block mb-8">
              <p className="text-sm text-gray-500 uppercase">{isPurchase ? 'Vendor' : 'Customer'}</p>
              <p className="text-lg font-bold text-black">{lastInvoice.customer_name}</p>
            </div>
            <div className="bg-tea-bg p-4 rounded-lg border border-tea-border mb-6 text-left print:bg-white print:border-none">
              <div className="space-y-4 mb-4 print:space-y-2">
                {cart.map(item => (
                  <div key={item.productId} className="flex justify-between items-start text-sm border-b border-tea-border pb-2 mb-2 print:border-tea-border">
                    <div>
                      <div className="text-tea-text font-medium print:text-black">{item.product.givenName}</div>
                      <div className="text-tea-text-sec text-xs print:text-gray-500">{item.product.productName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-tea-text print:text-black">{formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}</div>
                      <div className="text-tea-text-sec text-xs print:text-gray-500">
                        {item.quantity}{item.product.type === 'Teaware' ? 'u' : 'g'} × {formatCurrency(item.priceAtSale, displayCurrency, rates)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2 print:text-black">
                  <span className="text-tea-text-sec print:text-gray-600">Subtotal</span>
                  <span className="text-tea-text font-medium print:text-black">{formatCurrency(subtotalUSD, displayCurrency, rates)}</span>
                </div>
                {shippingCostUSD > 0 && (
                  <div className="flex justify-between text-sm mb-2 print:text-black">
                    <span className="text-tea-text-sec print:text-gray-600">Shipping</span>
                    <span className="text-tea-text font-medium print:text-black">{formatCurrency(shippingCostUSD, displayCurrency, rates)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-tea-border pt-3 mt-2 print:border-tea-border print:text-black">
                  <span className="text-tea-text print:text-black">Total</span>
                  <span className="text-tea-gold print:text-black">{formatCurrency(totalUSD, displayCurrency, rates)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3 print:hidden">
              {isPurchase && lastInvoice._purchaseMessage && (
                <button
                  onClick={() => { navigator.clipboard.writeText(lastInvoice._purchaseMessage); showToast('Order copied to clipboard', 'success'); }}
                  className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-gold text-tea-bg hover:bg-tea-gold/90 transition-colors"
                >
                  <Share2 size={16} /> Copy Order Text
                </button>
              )}
              {isPurchase && lastInvoice._vendorPhone && lastInvoice._vendorPhone.length >= 7 ? (
                <a href={buildWhatsAppUrl(lastInvoice._vendorPhone, lastInvoice._purchaseMessage || '')} target="_blank" rel="noreferrer"
                  className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-gold/10 hover:bg-tea-gold/20 text-tea-gold border border-tea-border transition-colors">
                  <Share2 size={16} /> Send to Vendor via WhatsApp
                </a>
              ) : !isPurchase && customerPhone ? (
                <a href={generateWhatsAppLink()} target="_blank" rel="noreferrer"
                  className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-gold/10 hover:bg-tea-gold/20 text-tea-gold border border-tea-border transition-colors">
                  <Share2 size={16} /> Share on WhatsApp
                </a>
              ) : !isPurchase ? (
                <div className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-bg text-tea-text-sec border border-tea-border cursor-not-allowed">
                  <Share2 size={16} /> Share on WhatsApp
                </div>
              ) : null}
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-surface hover:bg-tea-elevated/50 text-tea-text border border-tea-border transition-colors"
              >
                {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                {pdfLoading ? 'Generating...' : isPurchase ? 'Download PO as PDF' : 'Download Invoice PDF'}
              </button>
              <div className="h-px bg-tea-border my-4" />
              <button onClick={() => { handleStartNewSale(); if (isPurchase) setCartDirection('sale'); }}
                className="w-full bg-tea-gold text-tea-bg py-3 rounded-lg font-medium hover:bg-tea-gold/90 transition-colors flex items-center justify-center gap-2 text-sm">
                <RefreshCcw size={16} /> {isPurchase ? 'Done' : 'Start New Sale'}
              </button>
              {!isPurchase && (
                <button
                  onClick={() => { onClose(); navigate(`/admin/orders?search=${encodeURIComponent(lastInvoice.invoice_number)}`); }}
                  className="w-full bg-transparent border border-tea-border text-tea-text-sec py-2.5 rounded-lg font-medium hover:text-tea-text hover:bg-tea-surface transition-colors flex items-center justify-center gap-2 text-xs mt-2"
                >
                  <ExternalLink size={14} /> View in Orders
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal cart view ───────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface/50 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            {isPurchase ? (
              <ArrowDownLeft size={16} className="text-tea-gold" />
            ) : (
              <ArrowUpRight size={16} className="text-tea-gold-lt" />
            )}
            <h2 className="text-xl font-serif text-tea-text tracking-wide">
              {isPurchase ? 'Purchase Order' : 'Registry Manifest'}
            </h2>
          </div>
          <p className="text-[10px] text-tea-text-sec uppercase tracking-widest mt-0.5">
            {customerName.trim()
              ? <>{isPurchase ? 'From' : 'For'} <span className="text-tea-gold/80 normal-case tracking-normal">{customerName}</span></>
              : isPurchase ? 'Ordering from vendor' : 'Pending Items'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Direction toggle */}
          {isEmpty && (
            <button
              onClick={() => setCartDirection(isPurchase ? 'sale' : 'purchase')}
              className="text-[10px] text-tea-text-sec hover:text-tea-gold transition-colors flex items-center gap-1 px-2 py-1.5 hover:bg-tea-surface rounded border border-tea-border"
              title={isPurchase ? 'Switch to Sale' : 'Switch to Purchase'}
            >
              {isPurchase ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
              {isPurchase ? 'Sale' : 'Purchase'}
            </button>
          )}
          {!isEmpty && (
            <button onClick={onClearCart}
              className="text-[10px] text-tea-text-sec hover:text-tea-gold transition-colors flex items-center gap-1 px-2 py-1 hover:bg-tea-surface rounded">
              <Trash2 size={12} /> Clear
            </button>
          )}
          <button onClick={onClose}
            className="nav-control p-1.5">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar px-6 py-4">
        {/* Vendor / Customer name — prominent at top */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <input
              ref={customerInputRef}
              type="text"
              value={customerName}
              onChange={(e) => handleCustomerSearch(e.target.value)}
              onFocus={() => { if (customerName.trim() && customerSuggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full bg-tea-bg border rounded-lg px-3 py-2.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder-tea-text-sec/50 ${
                validationError ? 'border-tea-gold' : selectedCustomerId ? 'border-green-500/50' : 'border-tea-border focus:border-tea-text-sec'
              }`}
              placeholder={isPurchase ? 'Vendor Name *' : 'Client Name *'}
            />
            {selectedCustomerId && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-green-400 uppercase tracking-wider">Linked</span>
            )}

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-tea-bg border border-tea-border rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                {customerSuggestions.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-tea-surface transition-colors flex items-center justify-between"
                  >
                    <div>
                      <span className="text-tea-text">{c.name}</span>
                      {c.company && <span className="text-tea-text-sec text-xs ml-2">{c.company}</span>}
                    </div>
                    {c.tags?.length > 0 && (
                      <span className="text-[9px] text-tea-text-sec uppercase">{c.tags[0]}</span>
                    )}
                  </button>
                ))}
                {customerSuggestions.length === 0 && customerName.trim() && (
                  <div className="px-3 py-2 text-xs text-tea-text-sec">
                    <span className="italic">New contact — will be saved automatically</span>
                    <span className="block mt-1 text-tea-accent/70">Tip: Add full details in Customers & Sources after checkout</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {dedupSuggestion && (
            <div className="flex items-center justify-between bg-tea-gold/10 rounded-lg px-3 py-2 text-xs">
              <span className="text-tea-gold font-serif italic">
                Did you mean "{dedupSuggestion.name}"?
              </span>
              <button
                onClick={() => {
                  selectCustomer(allCustomers.find(c => c.id === dedupSuggestion.id)!);
                  setDedupSuggestion(null);
                }}
                className="text-tea-gold font-semibold uppercase tracking-wider text-[10px] ml-2 hover:text-tea-gold/80"
              >
                Use This
              </button>
            </div>
          )}
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec placeholder-tea-text-sec/50"
            placeholder={isPurchase ? 'Vendor Contact (Optional)' : 'WhatsApp (Optional)'}
          />
        </div>

        {/* Undo toast */}
        {undoState && (
          <div className="mb-4 animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-between bg-tea-surface text-tea-text border border-tea-border px-4 py-3 rounded-lg">
              <span className="text-xs font-sans">{undoState.label} removed</span>
              <button
                onClick={() => {
                  clearTimeout(undoState.timeout);
                  setCart(undoState.prevCart);
                  setUndoState(null);
                }}
                className="text-tea-gold text-xs uppercase tracking-[0.15em] font-medium ml-4 hover:text-tea-gold/80 transition-colors"
              >
                Undo
              </button>
            </div>
          </div>
        )}

        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-tea-text-sec space-y-4 min-h-[300px]">
            {isPurchase ? (
              <ArrowDownLeft size={40} strokeWidth={1} className="opacity-50" />
            ) : (
              <Package size={40} strokeWidth={1} className="opacity-50" />
            )}
            <div className="text-center">
              <p className="font-serif italic text-base mb-1">{isPurchase ? 'Purchase Order Empty' : 'Registry Empty'}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec/70 mb-4">{isPurchase ? 'Add items to order from vendor' : 'Select items from catalog'}</p>
              <button
                onClick={() => { onClose(); navigate('/admin/inventory'); }}
                className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg hover:bg-tea-surface border border-tea-border"
              >
                <Package size={12} /> Browse Inventory
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, idx) => (
              <div key={item.productId} className="group bg-tea-surface border border-tea-border rounded-xl p-3 hover:border-tea-text-sec/50 transition-colors flex gap-3">
                <div className="w-12 h-12 bg-tea-bg rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-tea-border">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} className="w-full h-full object-cover opacity-70" alt="" />
                  ) : (
                    <div className="p-2">
                      <TeaIllustration type={item.product.type} className="w-full h-full" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-serif text-tea-text truncate pr-2">{item.product.givenName}</h4>
                    <button onClick={() => removeItem(idx)} className="text-tea-text-sec hover:text-tea-gold p-0.5 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-[10px] text-tea-text-sec truncate mb-2 font-serif italic">{item.product.productName}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 bg-tea-bg rounded-lg border border-tea-border px-1.5 py-0.5">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                        className="w-8 bg-transparent text-center text-xs outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg num text-tea-text"
                      />
                      <span className="text-[9px] text-tea-text-sec border-l border-tea-border pl-1.5 uppercase tracking-[0.2em]">
                        {item.product.type === 'Teaware' ? 'u' : 'g'}
                      </span>
                    </div>
                    <span className="num text-xs text-tea-text">
                      {formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}
                    </span>
                  </div>
                  {/* Stock availability — only relevant for sales */}
                  {!isPurchase && (
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[9px] num ${item.quantity > item.product.stockGrams ? 'text-tea-gold' : 'text-tea-text-sec/50'}`}>
                        {item.quantity}{item.product.type === 'Teaware' ? 'u' : 'g'} / {item.product.stockGrams}{item.product.type === 'Teaware' ? 'u' : 'g'} avail.
                        {item.quantity > item.product.stockGrams && ' — exceeds stock'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-tea-surface border-t border-tea-border p-6 space-y-4 z-20 flex-shrink-0" style={{ boxShadow: '0 -10px 40px var(--tea-accent-sub)' }}>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[9px] text-tea-text-sec uppercase block mb-1">Currency</label>
            <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
                className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer"
              >
                {rates.map(r => <option key={r.currency} value={r.currency}>{r.currency}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-tea-text-sec uppercase block mb-1">Shipping (USD)</label>
            <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
              <input
                type="number"
                min={0}
                value={shippingCostUSD}
                onChange={(e) => setShippingCostUSD(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg num"
              />
            </div>
          </div>
        </div>
        {/* Source Event (sales only) */}
        {!isPurchase && allEvents.length > 0 && (
          <div>
            <label className="text-[9px] text-tea-text-sec uppercase block mb-1">Source Event (Optional)</label>
            <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
              <select
                value={sourceEventId || ''}
                onChange={(e) => setSourceEventId(e.target.value || null)}
                className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer"
              >
                <option value="">None</option>
                {allEvents
                  .filter(ev => ev.status === 'active' || ev.status === 'draft' || ev.status === 'completed')
                  .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
                  .slice(0, 20)
                  .map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({new Date(ev.eventDate).toLocaleDateString()})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <div className="flex justify-between items-end text-tea-text mb-4 pt-2 border-t border-tea-border">
            <span className="text-xs uppercase tracking-[0.2em] text-tea-text-sec">Total</span>
            <span className="text-xl font-serif text-tea-gold">
              {formatCurrency(totalUSD, displayCurrency, rates)}
            </span>
          </div>
          <button
            onClick={handleCompleteSale}
            disabled={isProcessing || isEmpty}
            className={`w-full py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2 transition-all ${
              isEmpty
                ? 'bg-tea-bg text-tea-text-sec cursor-not-allowed border border-tea-border'
                : 'bg-tea-gold text-tea-bg hover:bg-tea-gold/90 shadow-lg shadow-tea-gold/10'
            }`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={14} /> : isPurchase ? 'Send Purchase Order' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </>
  );
};
