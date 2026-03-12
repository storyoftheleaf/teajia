
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, Share2, Loader2, Printer, RefreshCcw, Clock, Package, X } from 'lucide-react';
import { CartItem as AdminCartItem, ExchangeRate, Currency } from '../../admin/types';
import { api } from '../../lib/api';
import { formatCurrency } from '../../admin/utils';
import { TeaIllustration } from '../../admin/components/TeaIllustration';
import { useCustomers } from '../../admin/hooks/useAdminData';

// ── Types ────────────────────────────────────────────────────────────────────

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
  // ── State ──────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = useState('');
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

  // Undo state
  const [undoState, setUndoState] = useState<{ prevCart: AdminCartItem[]; label: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

  // Debounce timer ref for customer search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Customer search with 300ms debounce ────────────────────────────────

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerName(value);
    setValidationError('');
    setSelectedCustomerId(null);

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

  // ── Invoice creation ──────────────────────────────────────────────────

  const handleCompleteSale = async () => {
    setValidationError('');
    if (!customerName.trim()) {
      setValidationError('Name required');
      showToast('Customer name is required', 'error');
      return;
    }
    if (cart.length === 0) return;
    setIsProcessing(true);

    let custId = selectedCustomerId;
    if (!custId && customerName.trim()) {
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
      onSuccess();
      showToast('Order submitted successfully', 'success');
      setLastInvoice({ ...invoiceData, items: cart });
      setTransactionComplete(true);
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
    setLastInvoice(null);
    setTransactionComplete(false);
    setUndoState(null);
  };

  const generateWhatsAppLink = () => {
    if (!lastInvoice) return '#';
    let message = `*Teajia Order*\n\n*Invoice:* ${lastInvoice.invoice_number}\n*Customer:* ${lastInvoice.customer_name}\n*Date:* ${new Date().toLocaleDateString()}\n\n*Items:*\n`;
    cart.forEach(item => {
      const unit = item.product.type === 'Teaware' ? 'units' : 'g';
      message += `• ${item.product.givenName} - ${item.quantity}${unit} @ ${formatCurrency(item.priceAtSale, displayCurrency, rates)} = ${formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}\n`;
    });
    message += `\n*Subtotal:* ${formatCurrency(subtotalUSD, displayCurrency, rates)}\n`;
    if (shippingCostUSD > 0) message += `*Shipping:* ${formatCurrency(shippingCostUSD, displayCurrency, rates)}\n`;
    message += `*Total:* ${formatCurrency(totalUSD, displayCurrency, rates)}`;
    const phone = customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (phone.length < 7) return '#';
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // ── Derived ────────────────────────────────────────────────────────────

  const subtotalUSD = useMemo(() => cart.reduce((acc, item) => acc + item.quantity * item.priceAtSale, 0), [cart]);
  const totalUSD = subtotalUSD + shippingCostUSD;
  const isEmpty = cart.length === 0;

  // ── Receipt screen ─────────────────────────────────────────────────────

  if (transactionComplete && lastInvoice) {
    return (
      <div className="flex flex-col h-full bg-tea-bg overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-tea-border bg-tea-surface/50">
          <h2 className="text-xl font-serif text-tea-text tracking-wide">Order Submitted</h2>
          <button onClick={onClose} className="text-tea-text-dim hover:text-tea-text bg-tea-surface hover:bg-tea-surface/80 rounded-full p-1.5 transition-colors border border-tea-border">
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
            <div className="mx-auto bg-tea-gold/10 text-tea-gold w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-tea-gold/20 print:hidden">
              <Clock size={32} />
            </div>
            <h2 className="text-2xl font-serif text-tea-text mb-2 print:text-black">Order Submitted</h2>
            <p className="text-tea-text-dim mb-6 text-xs print:text-gray-600 print:mb-4">
              Invoice #{lastInvoice.invoice_number} • {new Date().toLocaleDateString()}
            </p>
            <div className="bg-tea-gold/10 border border-tea-gold/30 p-3 rounded mb-6 text-xs text-tea-gold print:hidden text-left font-serif italic">
              Status: <strong className="font-sans not-italic">Pending Fulfillment</strong>.<br />
              Stock has not been deducted yet. Mark as "Filled" in Orders view when packing.
            </div>
            <div className="hidden print:block mb-8">
              <p className="text-sm text-gray-500 uppercase">Customer</p>
              <p className="text-lg font-bold text-black">{lastInvoice.customer_name}</p>
            </div>
            <div className="bg-tea-bg p-4 rounded-lg border border-tea-border mb-6 text-left print:bg-white print:border-none">
              <div className="space-y-4 mb-4 print:space-y-2">
                {cart.map(item => (
                  <div key={item.productId} className="flex justify-between items-start text-sm border-b border-tea-border pb-2 mb-2 print:border-tea-border">
                    <div>
                      <div className="text-tea-text font-medium print:text-black">{item.product.givenName}</div>
                      <div className="text-tea-text-dim text-xs print:text-gray-500">{item.product.productName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-tea-text print:text-black">{formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}</div>
                      <div className="text-tea-text-dim text-xs print:text-gray-500">
                        {item.quantity}{item.product.type === 'Teaware' ? 'u' : 'g'} × {formatCurrency(item.priceAtSale, displayCurrency, rates)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-sm mb-2 print:text-black">
                  <span className="text-tea-text-dim print:text-gray-600">Subtotal</span>
                  <span className="text-tea-text font-medium print:text-black">{formatCurrency(subtotalUSD, displayCurrency, rates)}</span>
                </div>
                {shippingCostUSD > 0 && (
                  <div className="flex justify-between text-sm mb-2 print:text-black">
                    <span className="text-tea-text-dim print:text-gray-600">Shipping</span>
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
              {customerPhone ? (
                <a href={generateWhatsAppLink()} target="_blank" rel="noreferrer"
                  className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-gold/10 hover:bg-tea-gold/20 text-tea-gold border border-tea-gold/30 transition-colors">
                  <Share2 size={16} /> Share on WhatsApp
                </a>
              ) : (
                <div className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-bg text-tea-text-dim border border-tea-border cursor-not-allowed">
                  <Share2 size={16} /> Share on WhatsApp
                </div>
              )}
              <button onClick={() => window.print()}
                className="flex w-full bg-tea-bg border border-tea-border text-tea-text py-3 rounded-lg font-medium hover:bg-tea-surface transition-colors items-center justify-center gap-2 text-sm">
                <Printer size={16} /> Print Receipt
              </button>
              <div className="h-px bg-tea-border my-4" />
              <button onClick={handleStartNewSale}
                className="w-full bg-tea-gold text-tea-bg py-3 rounded-lg font-medium hover:bg-tea-gold/90 transition-colors flex items-center justify-center gap-2 text-sm">
                <RefreshCcw size={16} /> Start New Sale
              </button>
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
      <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface/50">
        <div>
          <h2 className="text-xl font-serif text-tea-text tracking-wide">Registry Manifest</h2>
          <p className="text-[10px] text-tea-text-dim uppercase tracking-widest mt-0.5">Pending Items</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEmpty && (
            <button onClick={onClearCart}
              className="text-[10px] text-tea-text-dim hover:text-tea-gold transition-colors flex items-center gap-1 px-2 py-1 hover:bg-tea-surface rounded">
              <Trash2 size={12} /> Clear
            </button>
          )}
          <button onClick={onClose}
            className="text-tea-text-dim hover:text-tea-text bg-tea-surface hover:bg-tea-surface/80 rounded-full p-1.5 transition-colors border border-tea-border">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar px-6 py-4">
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
          <div className="h-full flex flex-col items-center justify-center text-tea-text-dim space-y-4 min-h-[300px]">
            <Package size={40} strokeWidth={1} className="opacity-50" />
            <div className="text-center">
              <p className="font-serif italic text-base mb-1">Registry Empty</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim/70">Select items from catalog</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, idx) => (
              <div key={item.productId} className="group bg-tea-surface border border-tea-border rounded-xl p-3 hover:border-tea-text-dim/50 transition-colors flex gap-3">
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
                    <button onClick={() => removeItem(idx)} className="text-tea-text-dim hover:text-tea-gold p-0.5 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-[10px] text-tea-text-dim truncate mb-2 font-serif italic">{item.product.productName}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 bg-tea-bg rounded-lg border border-tea-border px-1.5 py-0.5">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                        className="w-8 bg-transparent text-center text-xs outline-none num text-tea-text"
                      />
                      <span className="text-[9px] text-tea-text-dim border-l border-tea-border pl-1.5 uppercase tracking-[0.2em]">
                        {item.product.type === 'Teaware' ? 'u' : 'g'}
                      </span>
                    </div>
                    <span className="num text-xs text-tea-text">
                      {formatCurrency(item.quantity * item.priceAtSale, displayCurrency, rates)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-tea-surface border-t border-tea-border p-6 space-y-5 z-20" style={{ boxShadow: '0 -10px 40px var(--tea-accent-sub)' }}>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-[9px] text-tea-text-dim uppercase block mb-1">Currency</label>
            <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
                className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none cursor-pointer"
              >
                {rates.map(r => <option key={r.currency} value={r.currency}>{r.currency}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-tea-text-dim uppercase block mb-1">Shipping (USD)</label>
            <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
              <input
                type="number"
                min={0}
                value={shippingCostUSD}
                onChange={(e) => setShippingCostUSD(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none num"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={customerInputRef}
              type="text"
              value={customerName}
              onChange={(e) => handleCustomerSearch(e.target.value)}
              onFocus={() => { if (customerName.trim() && customerSuggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className={`w-full bg-tea-bg border rounded-lg px-3 py-2 text-sm text-tea-text outline-none transition-colors placeholder-tea-text-dim/50 ${
                validationError ? 'border-tea-gold' : selectedCustomerId ? 'border-green-500/50' : 'border-tea-border focus:border-tea-text-dim'
              }`}
              placeholder="Client Name *"
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
                      {c.company && <span className="text-tea-text-dim text-xs ml-2">{c.company}</span>}
                    </div>
                    {c.tags?.length > 0 && (
                      <span className="text-[9px] text-tea-text-dim uppercase">{c.tags[0]}</span>
                    )}
                  </button>
                ))}
                {customerSuggestions.length === 0 && customerName.trim() && (
                  <div className="px-3 py-2 text-xs text-tea-text-dim">
                    <span className="italic">New contact — will be saved automatically</span>
                    <span className="block mt-1 text-tea-accent/70">Tip: Add full details in Customers & Sources after checkout</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-text-dim placeholder-tea-text-dim/50"
            placeholder="WhatsApp (Optional)"
          />
        </div>
        <div>
          <div className="flex justify-between items-end text-tea-text mb-4 pt-2 border-t border-tea-border/50">
            <span className="text-xs uppercase tracking-[0.2em] text-tea-text-dim">Total</span>
            <span className="text-xl font-serif text-tea-gold">
              {formatCurrency(totalUSD, displayCurrency, rates)}
            </span>
          </div>
          <button
            onClick={handleCompleteSale}
            disabled={isProcessing || isEmpty}
            className={`w-full py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2 transition-all ${
              isEmpty
                ? 'bg-tea-bg text-tea-text-dim cursor-not-allowed border border-tea-border'
                : 'bg-tea-gold text-tea-bg hover:bg-tea-gold/90 shadow-lg shadow-tea-gold/10'
            }`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={14} /> : 'Create Invoice'}
          </button>
        </div>
      </div>
    </>
  );
};
