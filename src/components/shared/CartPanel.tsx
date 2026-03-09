
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trash2, Share2, Loader2, Printer, RefreshCcw, Clock, Package, X } from 'lucide-react';
import { CartItem as AdminCartItem, ExchangeRate, Currency } from '../../admin/types';
import { CartItem as PublicCartItem } from '../../types';
import { api } from '../../lib/api';
import { formatCurrency } from '../../admin/utils';
import { fmtPrice } from '../../utils/formatNumber';
import { Icons } from '../Icons';
import { TeaIllustration } from '../../admin/components/TeaIllustration';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const TEAJIA_WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '+18313259164';

// ── Types ───────────────────────────────────────────────────────────────────

type AdminProps = {
  mode: 'admin';
  cart: AdminCartItem[];
  setCart: (cart: AdminCartItem[]) => void;
  onClearCart: () => void;
  onSuccess: () => void;
  rates: ExchangeRate[];
  showToast: (message: string, type?: string) => void;
};

type PublicProps = {
  mode: 'public';
  cart: PublicCartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
};

type CartPanelProps = { isOpen: boolean; onClose: () => void } & (AdminProps | PublicProps);

type CheckoutStep = 'CART' | 'CHECKOUT';

// ── Component ────────────────────────────────────────────────────────────────

export const CartPanel: React.FC<CartPanelProps> = (props) => {
  const { isOpen, onClose } = props;

  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // ── Swipe to dismiss (shared drawer shell) ───────────────────────────────
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDragHandle = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    isDragHandle.current = !!target.closest('[data-drag-handle]');
    if (!isDragHandle.current) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragHandle.current || touchStart === null) return;
    const offset = e.touches[0].clientX - touchStart;
    if (offset > 0) setTouchOffset(offset);
  };
  const handleTouchEnd = () => {
    if (!isDragHandle.current || touchStart === null) return;
    if (touchOffset > 150) onClose();
    setTouchStart(null);
    setTouchOffset(0);
    setIsDragging(false);
    isDragHandle.current = false;
  };

  const swipeProgress = touchOffset / 150;
  const swipeOpacity = Math.max(0.3, 1 - swipeProgress * 0.7);

  // ── Public-only state ────────────────────────────────────────────────────
  const [step, setStep] = useState<CheckoutStep>('CART');
  const [details, setDetails] = useState({ name: '', contact: '', location: '', notes: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<{ show: boolean; type: 'whatsapp' | 'email' | 'copy' }>({ show: false, type: 'copy' });
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [recoveredCart, setRecoveredCart] = useState(false);

  // Public undo: store removed item for 5s re-add window
  const [publicUndoItem, setPublicUndoItem] = useState<{ item: PublicCartItem; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const orderRef = useMemo(() => {
    const d = new Date();
    return `TJ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
  }, []);

  // ── Admin-only state ─────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
  const [shippingCostUSD, setShippingCostUSD] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [transactionComplete, setTransactionComplete] = useState(false);

  // Admin undo: store full previous cart state for 5s restore window
  const [adminUndoState, setAdminUndoState] = useState<{ prevCart: AdminCartItem[]; label: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

  // ── Load customers for autocomplete (admin only) ────────────────────────
  useEffect(() => {
    if (props.mode !== 'admin' || customersLoaded) return;
    api.customers.list()
      .then((data: any[]) => {
        setAllCustomers((data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          whatsapp: c.whatsapp,
          email: c.email,
          preferredCurrency: c.preferred_currency || 'USD',
          tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        })));
        setCustomersLoaded(true);
      })
      .catch(() => setCustomersLoaded(true));
  }, [props.mode, customersLoaded]);

  const handleCustomerSearch = (value: string) => {
    setCustomerName(value);
    setValidationError('');
    setSelectedCustomerId(null);
    if (value.trim().length > 0 && allCustomers.length > 0) {
      const q = value.toLowerCase();
      const matches = allCustomers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      ).slice(0, 6);
      setCustomerSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.whatsapp || '');
    setSelectedCustomerId(customer.id);
    if (customer.preferredCurrency) setDisplayCurrency(customer.preferredCurrency);
    setShowSuggestions(false);
    setValidationError('');
  };

  const handleCreateAndSelectCustomer = async () => {
    if (!customerName.trim()) return;
    try {
      const result = await api.customers.create({
        name: customerName.trim(),
        whatsapp: customerPhone || undefined,
        preferred_currency: displayCurrency,
      });
      setSelectedCustomerId(result.id);
      setShowSuggestions(false);
      setCustomersLoaded(false); // Refresh the list
      if (props.mode === 'admin') props.showToast(`"${customerName}" saved as a new contact`, 'success');
    } catch {
      // Non-critical — invoice still works without customer_id
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (props.mode !== 'public') return;
    // Load saved details from localStorage
    const saved = localStorage.getItem('teajia_cartDetails');
    if (saved) {
      try { setDetails(JSON.parse(saved)); } catch { /* ignore */ }
    }
    // Abandoned cart recovery
    const sessionCart = sessionStorage.getItem('teajia_cartState');
    if (sessionCart && isOpen && props.cart.length === 0) setRecoveredCart(true);
    // Device detection
    const update = () => {
      const mobile = window.innerWidth < 768;
      setPreferredChannel(mobile ? 'whatsapp' : 'email');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen, props.mode]);

  useEffect(() => {
    if (props.mode !== 'public') return;
    if (props.cart.length > 0) sessionStorage.setItem('teajia_cartState', JSON.stringify(props.cart));
  }, [props.mode === 'public' ? props.cart : null]);

  useEffect(() => {
    if (props.mode !== 'public') return;
    if (details.name || details.contact) localStorage.setItem('teajia_cartDetails', JSON.stringify(details));
  }, [details, props.mode]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setStep('CART');
        setSuccessMessage({ show: false, type: 'copy' });
        setRecoveredCart(false);
        setTouchOffset(0);
        setIsDragging(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Public helpers ────────────────────────────────────────────────────────

  const validateField = (field: string, value: string): string => {
    if (field === 'name' && !value.trim()) return 'Name is required';
    if (field === 'contact' && !value.trim()) return 'Email or phone is required';
    if (field === 'location' && !value.trim()) return 'Location is required';
    return '';
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, details[field as keyof typeof details] || '') }));
  };

  const handleFieldChange = (field: string, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
    if (touched[field]) setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const publicSubtotal = useMemo(() => {
    if (props.mode !== 'public') return 0;
    return props.cart.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [props.mode === 'public' ? props.cart : null, props.mode]);

  const orderMessage = useMemo(() => {
    if (props.mode !== 'public') return '';
    const date = new Date().toLocaleDateString();
    let msg = `ORDER INQUIRY [TEAJIA]\nRef: ${orderRef}\nDate: ${date}\n\n`;
    msg += `CUSTOMER:\nName: ${details.name}\nContact: ${details.contact}\nShipping To: ${details.location}\n`;
    if (details.notes) msg += `Notes: ${details.notes}\n`;
    msg += `\nITEMS:\n`;
    props.cart.forEach(item => {
      const qtyLabel = item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`;
      msg += `- ${item.name} (${item.variant}): ${qtyLabel} @ $${fmtPrice(item.totalPrice)}\n`;
    });
    msg += `\nTOTAL ESTIMATE: ${fmtPrice(publicSubtotal)}\n\nPlease confirm availability and shipping costs.`;
    return msg;
  }, [props.mode === 'public' ? props.cart : null, details, publicSubtotal, orderRef, props.mode]);

  const showPublicSuccess = (type: 'whatsapp' | 'email' | 'copy') => {
    setSuccessMessage({ show: true, type });
    setTimeout(() => setSuccessMessage({ show: false, type }), 3000);
  };

  const handleWhatsApp = () => {
    const clean = String(TEAJIA_WHATSAPP_NUMBER).replace(/\D/g, '');
    window.open(clean && clean !== '1234567890'
      ? `https://wa.me/${clean}?text=${encodeURIComponent(orderMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(orderMessage)}`);
    showPublicSuccess('whatsapp');
  };

  const handleEmail = () => {
    if (props.mode !== 'public') return;
    const subject = `Tea Order Inquiry - ${details.name}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderMessage)}`);
    showPublicSuccess('email');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderMessage);
    showPublicSuccess('copy');
  };

  // ── Admin helpers ─────────────────────────────────────────────────────────

  const adminSubtotalUSD = useMemo(() => {
    if (props.mode !== 'admin') return 0;
    return props.cart.reduce((acc, item) => acc + item.quantity * item.priceAtSale, 0);
  }, [props.mode === 'admin' ? props.cart : null, props.mode]);

  const adminTotalUSD = adminSubtotalUSD + shippingCostUSD;

  const adminUpdateQuantity = (index: number, newQty: number) => {
    if (props.mode !== 'admin' || isNaN(newQty) || newQty < 0) return;
    props.setCart(props.cart.map((item, i) => i === index ? { ...item, quantity: newQty } : item));
  };

  const adminRemoveItem = (index: number) => {
    if (props.mode !== 'admin') return;
    const prevCart = [...props.cart];
    const removed = props.cart[index];
    const newCart = [...props.cart];
    newCart.splice(index, 1);
    props.setCart(newCart);
    const timeout = setTimeout(() => setAdminUndoState(null), 5000);
    setAdminUndoState({ prevCart, label: removed.product.givenName, timeout });
  };

  const handleCompleteSale = async () => {
    if (props.mode !== 'admin') return;
    setValidationError('');
    if (!customerName.trim()) {
      setValidationError('Name required');
      props.showToast('Customer name is required', 'error');
      return;
    }
    if (props.cart.length === 0) return;
    setIsProcessing(true);

    // Auto-create customer if this is a new name (no existing customer selected)
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
        setCustomersLoaded(false);
      } catch {
        // Non-critical — invoice still works without customer_id
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
        props.cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price_at_sale: item.priceAtSale,
        }))
      );
      if (!invoiceData) {
        props.showToast('Transaction failed', 'error');
        setIsProcessing(false);
        return;
      }
      props.onSuccess();
      props.showToast('Order submitted successfully', 'success');
      setLastInvoice({ ...invoiceData, items: props.cart });
      setTransactionComplete(true);
    } catch (err: any) {
      props.showToast('Transaction failed: ' + (err.message || 'Unknown error'), 'error');
    }
    setIsProcessing(false);
  };

  const handleStartNewSale = () => {
    if (props.mode !== 'admin') return;
    props.onClearCart();
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setShippingCostUSD(0);
    setLastInvoice(null);
    setTransactionComplete(false);
    setAdminUndoState(null);
  };

  const generateWhatsAppLink = () => {
    if (props.mode !== 'admin' || !lastInvoice) return '#';
    let message = `*Teajia Order*\n\n*Invoice:* ${lastInvoice.invoice_number}\n*Customer:* ${lastInvoice.customer_name}\n*Date:* ${new Date().toLocaleDateString()}\n\n*Items:*\n`;
    props.cart.forEach(item => {
      const unit = item.product.type === 'Teaware' ? 'units' : 'g';
      message += `• ${item.product.givenName} - ${item.quantity}${unit} @ ${formatCurrency(item.priceAtSale, displayCurrency, props.rates)} = ${formatCurrency(item.quantity * item.priceAtSale, displayCurrency, props.rates)}\n`;
    });
    message += `\n*Subtotal:* ${formatCurrency(adminSubtotalUSD, displayCurrency, props.rates)}\n`;
    if (shippingCostUSD > 0) message += `*Shipping:* ${formatCurrency(shippingCostUSD, displayCurrency, props.rates)}\n`;
    message += `*Total:* ${formatCurrency(adminTotalUSD, displayCurrency, props.rates)}`;
    const phone = customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (phone.length < 7) return '#';
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const isEmpty = props.cart.length === 0;
  const isAdmin = props.mode === 'admin';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-full w-full z-[100] shadow-2xl flex flex-col ${
          isAdmin
            ? 'md:w-[480px] bg-tea-bg/95 backdrop-blur-2xl border-l border-tea-border'
            : 'md:w-[450px] bg-tea-bg surface-warm'
        } ${isOpen ? '' : 'pointer-events-none'}`}
        style={{
          transform: isOpen ? `translateX(${touchOffset}px)` : 'translateX(100%)',
          opacity: isDragging ? swipeOpacity : 1,
          transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Admin Receipt Screen ─────────────────────────────────────────── */}
        {isAdmin && transactionComplete && lastInvoice && props.mode === 'admin' && (
          <div className="flex flex-col h-full bg-tea-bg overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-tea-border bg-tea-surface/50">
              <h2 className="text-xl font-serif text-tea-text tracking-wide">Order Submitted</h2>
              <button onClick={onClose} className="text-tea-muted hover:text-tea-text bg-tea-surface hover:bg-tea-surface/80 rounded-full p-1.5 transition-colors border border-tea-border">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300 print:p-0 print:block">
              <div className="hidden print:block text-center mb-8 pt-8">
                <h1 className="text-3xl font-serif text-black mb-2">TEAJIA</h1>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-8">Fine Tea Inventory & Sales</p>
                <div className="border-b border-black mb-8" />
              </div>
              <div className="bg-tea-surface border border-tea-border p-8 rounded-2xl shadow-2xl text-center w-full print:border-none print:shadow-none print:bg-white print:p-0 print:text-left">
                <div className="mx-auto bg-tea-accent/10 text-tea-accent w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-tea-accent/20 print:hidden">
                  <Clock size={32} />
                </div>
                <h2 className="text-2xl font-serif text-tea-text mb-2 print:text-black">Order Submitted</h2>
                <p className="text-tea-muted mb-6 text-xs print:text-gray-600 print:mb-4">
                  Invoice #{lastInvoice.invoice_number} • {new Date().toLocaleDateString()}
                </p>
                <div className="bg-tea-accent/10 border border-tea-accent/30 p-3 rounded mb-6 text-xs text-tea-accent print:hidden text-left font-serif italic">
                  Status: <strong className="font-sans not-italic">Pending Fulfillment</strong>.<br />
                  Stock has not been deducted yet. Mark as "Filled" in Orders view when packing.
                </div>
                <div className="hidden print:block mb-8">
                  <p className="text-sm text-gray-500 uppercase">Customer</p>
                  <p className="text-lg font-bold text-black">{lastInvoice.customer_name}</p>
                </div>
                <div className="bg-tea-bg p-4 rounded-lg border border-tea-border mb-6 text-left print:bg-white print:border-none">
                  <div className="space-y-4 mb-4 print:space-y-2">
                    {props.cart.map(item => (
                      <div key={item.productId} className="flex justify-between items-start text-sm border-b border-tea-border pb-2 mb-2 print:border-gray-200">
                        <div>
                          <div className="text-tea-text font-medium print:text-black">{item.product.givenName}</div>
                          <div className="text-tea-muted text-xs print:text-gray-500">{item.product.productName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-tea-text print:text-black">{formatCurrency(item.quantity * item.priceAtSale, displayCurrency, props.rates)}</div>
                          <div className="text-tea-muted text-xs print:text-gray-500">
                            {item.quantity}{item.product.type === 'Teaware' ? 'u' : 'g'} × {formatCurrency(item.priceAtSale, displayCurrency, props.rates)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-sm mb-2 print:text-black">
                      <span className="text-tea-muted print:text-gray-600">Subtotal</span>
                      <span className="text-tea-text font-medium print:text-black">{formatCurrency(adminSubtotalUSD, displayCurrency, props.rates)}</span>
                    </div>
                    {shippingCostUSD > 0 && (
                      <div className="flex justify-between text-sm mb-2 print:text-black">
                        <span className="text-tea-muted print:text-gray-600">Shipping</span>
                        <span className="text-tea-text font-medium print:text-black">{formatCurrency(shippingCostUSD, displayCurrency, props.rates)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-tea-border pt-3 mt-2 print:border-gray-300 print:text-black">
                      <span className="text-tea-text print:text-black">Total</span>
                      <span className="text-tea-accent print:text-black">{formatCurrency(adminTotalUSD, displayCurrency, props.rates)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 print:hidden">
                  {customerPhone ? (
                    <a href={generateWhatsAppLink()} target="_blank" rel="noreferrer"
                      className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-accent/10 hover:bg-tea-accent/20 text-tea-accent border border-tea-accent/30 transition-colors">
                      <Share2 size={16} /> Share on WhatsApp
                    </a>
                  ) : (
                    <div className="flex w-full py-3 rounded-lg font-medium items-center justify-center gap-2 text-sm bg-tea-bg text-tea-muted border border-tea-border cursor-not-allowed">
                      <Share2 size={16} /> Share on WhatsApp
                    </div>
                  )}
                  <button onClick={() => window.print()}
                    className="flex w-full bg-tea-bg border border-tea-border text-tea-text py-3 rounded-lg font-medium hover:bg-tea-surface transition-colors items-center justify-center gap-2 text-sm">
                    <Printer size={16} /> Print Receipt
                  </button>
                  <div className="h-px bg-tea-border my-4" />
                  <button onClick={handleStartNewSale}
                    className="w-full bg-tea-accent text-tea-bg py-3 rounded-lg font-medium hover:bg-tea-accent/90 transition-colors flex items-center justify-center gap-2 text-sm">
                    <RefreshCcw size={16} /> Start New Sale
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Normal Cart View ─────────────────────────────────────────────── */}
        {!(isAdmin && transactionComplete) && (
          <>
            {/* Header */}
            <div className="flex flex-col relative z-10">
              {/* Mobile drag handle */}
              {!isAdmin && (
                <div data-drag-handle className="md:hidden flex justify-center py-3 bg-tea-surface cursor-grab active:cursor-grabbing touch-pan-x">
                  <div className={`h-1 rounded-full transition-all duration-150 ${isDragging ? 'bg-tea-gold w-16' : 'bg-tea-bg/20 w-12'}`} />
                </div>
              )}

              {isAdmin ? (
                /* Admin header */
                <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface/50">
                  <div>
                    <h2 className="text-xl font-serif text-tea-text tracking-wide">Registry Manifest</h2>
                    <p className="text-[10px] text-tea-muted uppercase tracking-widest mt-0.5">Pending Items</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isEmpty && (
                      <button onClick={props.mode === 'admin' ? props.onClearCart : undefined}
                        className="text-[10px] text-tea-muted hover:text-tea-accent transition-colors flex items-center gap-1 px-2 py-1 hover:bg-tea-surface rounded">
                        <Trash2 size={12} /> Clear
                      </button>
                    )}
                    <button onClick={onClose}
                      className="text-tea-muted hover:text-tea-text bg-tea-surface hover:bg-tea-surface/80 rounded-full p-1.5 transition-colors border border-tea-border">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Public header */
                <div className="flex items-center justify-between p-6 border-b border-tea-gold/20 bg-tea-surface">
                  {step !== 'CART' ? (
                    <button onClick={() => setStep('CART')} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Back to cart">
                      <Icons.Back className="w-5 h-5 text-tea-text/50 hover:text-tea-text" />
                    </button>
                  ) : (
                    <div className="w-[44px]" />
                  )}
                  <div className="text-center">
                    <h2 className="text-lg font-serif text-tea-text tracking-wide">
                      {step === 'CART' ? 'Your Selection' : 'Request Order'}
                    </h2>
                    {step === 'CHECKOUT' && (
                      <p className="text-[10px] font-mono text-tea-text-dim mt-0.5">{orderRef}</p>
                    )}
                  </div>
                  <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Close cart">
                    <Icons.Close className="w-6 h-6 text-tea-text-dim hover:text-tea-text" />
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className={`flex-1 overflow-y-auto relative ${isAdmin ? 'custom-scrollbar px-6 py-4' : 'tea-card-scroll'}`}>
              {isAdmin ? (
                /* ── Admin cart list ─────────────────────────────────── */
                <>
                  {/* Admin undo toast */}
                  {adminUndoState && (
                    <div className="mb-4 animate-[slideUp_0.3s_ease-out]">
                      <div className="flex items-center justify-between bg-tea-surface text-tea-text border border-tea-border px-4 py-3 rounded-lg">
                        <span className="text-xs font-sans">{adminUndoState.label} removed</span>
                        <button
                          onClick={() => {
                            if (props.mode !== 'admin') return;
                            clearTimeout(adminUndoState.timeout);
                            props.setCart(adminUndoState.prevCart);
                            setAdminUndoState(null);
                          }}
                          className="text-tea-accent text-xs uppercase tracking-[0.15em] font-medium ml-4 hover:text-tea-accent/80 transition-colors"
                        >
                          Undo
                        </button>
                      </div>
                    </div>
                  )}

                  {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-tea-muted space-y-4 min-h-[300px]">
                      <Package size={40} strokeWidth={1} className="opacity-50" />
                      <div className="text-center">
                        <p className="font-serif italic text-base mb-1">Registry Empty</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-tea-muted/70">Select items from catalog</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {props.mode === 'admin' && props.cart.map((item, idx) => (
                        <div key={item.productId} className="group bg-tea-surface border border-tea-border rounded-xl p-3 hover:border-tea-muted/50 transition-colors flex gap-3">
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
                              <button onClick={() => adminRemoveItem(idx)} className="text-tea-muted hover:text-tea-accent p-0.5 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <p className="text-[10px] text-tea-muted truncate mb-2 font-serif italic">{item.product.productName}</p>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 bg-tea-bg rounded-lg border border-tea-border px-1.5 py-0.5">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => adminUpdateQuantity(idx, Number(e.target.value))}
                                  className="w-8 bg-transparent text-center text-xs outline-none num text-tea-text"
                                />
                                <span className="text-[9px] text-tea-muted border-l border-tea-border pl-1.5 uppercase tracking-[0.2em]">
                                  {item.product.type === 'Teaware' ? 'u' : 'g'}
                                </span>
                              </div>
                              <span className="num text-xs text-tea-text">
                                {formatCurrency(item.quantity * item.priceAtSale, displayCurrency, props.rates)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* ── Public cart / checkout ──────────────────────────── */
                <div className="surface-warm-inset mx-2 mt-2 mb-2 p-4 min-h-full">

                  {/* Public undo toast */}
                  {publicUndoItem && props.mode === 'public' && (
                    <div className="relative z-20 mb-4 animate-[slideUp_0.3s_ease-out]">
                      <div className="flex items-center justify-between bg-tea-bg text-tea-text px-4 py-3 rounded-sm">
                        <span className="text-xs font-sans">{publicUndoItem.item.name} removed</span>
                        <button
                          onClick={() => {
                            if (props.mode !== 'public') return;
                            clearTimeout(publicUndoItem.timeout);
                            props.onUpdateQuantity(publicUndoItem.item.id, publicUndoItem.item.quantityGrams);
                            setPublicUndoItem(null);
                          }}
                          className="text-tea-gold text-xs uppercase tracking-[0.15em] font-medium ml-4 hover:text-tea-gold/80 transition-colors"
                        >
                          Undo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Cart items */}
                  {step === 'CART' && (
                    <div className="space-y-6 relative z-[1]">
                      {isEmpty ? (
                        <div className="text-center py-20 opacity-40">
                          <Icons.Bag className="w-12 h-12 mx-auto mb-4" />
                          <p className="font-serif italic">Your ledger is empty.</p>
                        </div>
                      ) : (
                        props.mode === 'public' && props.cart.map(item => (
                          <div key={item.id} className="flex gap-4 pb-4">
                            <div className="w-16 h-16 bg-tea-bg/5 flex items-center justify-center overflow-hidden rounded-[1px] shrink-0">
                              {item.image ? (
                                <img src={item.image} className="w-full h-full object-cover sepia-[0.3]" alt={item.name} loading="eager" />
                              ) : (
                                <Icons.Leaf className="w-6 h-6 opacity-20" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <h3 className="font-serif text-tea-text text-lg leading-none mb-1">{item.name}</h3>
                                <button
                                  onClick={() => {
                                    if (props.mode !== 'public') return;
                                    const timeout = setTimeout(() => setPublicUndoItem(null), 5000);
                                    setPublicUndoItem({ item, timeout });
                                    props.onRemoveItem(item.id);
                                  }}
                                  className="text-tea-text-dim hover:text-red-500 p-2 -mr-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  aria-label={`Remove ${item.name} from cart`}
                                >
                                  <Icons.Close className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-[10px] uppercase tracking-wider text-tea-text-dim mb-3">{item.variant}</p>
                              <div className="flex items-center justify-between gap-3 bg-tea-gold/20 px-2 py-1.5 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => props.mode === 'public' && props.onUpdateQuantity(item.id, Math.max(1, item.quantityGrams - (item.category === 'tea' ? 10 : 1)))}
                                    className="w-7 h-7 flex items-center justify-center rounded-sm bg-tea-gold/25 hover:bg-tea-gold/40 transition-colors text-tea-text font-medium text-base leading-none"
                                    aria-label="Decrease quantity"
                                  >−</button>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min={1}
                                      max={9999}
                                      value={item.quantityGrams}
                                      onChange={(e) => {
                                        if (props.mode !== 'public') return;
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) props.onUpdateQuantity(item.id, Math.min(9999, Math.max(1, val)));
                                      }}
                                      onBlur={(e) => {
                                        if (props.mode !== 'public') return;
                                        const val = parseInt(e.target.value);
                                        if (isNaN(val) || val < 1) props.onUpdateQuantity(item.id, 1);
                                      }}
                                      className="w-12 bg-transparent num text-xs text-tea-text border-b border-tea-gold/20 focus:outline-none focus:border-tea-gold text-center"
                                    />
                                    {item.category === 'tea' && <span className="num text-xs text-tea-text-dim">g</span>}
                                  </div>
                                  <button
                                    onClick={() => props.mode === 'public' && props.onUpdateQuantity(item.id, Math.min(9999, item.quantityGrams + (item.category === 'tea' ? 10 : 1)))}
                                    className="w-7 h-7 flex items-center justify-center rounded-sm bg-tea-gold/25 hover:bg-tea-gold/40 transition-colors text-tea-text font-medium text-base leading-none"
                                    aria-label="Increase quantity"
                                  >+</button>
                                </div>
                                <span className="num text-sm text-tea-text font-medium">{fmtPrice(item.totalPrice)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Step 2: Checkout */}
                  {step === 'CHECKOUT' && (
                    <div className="space-y-6 relative z-[1]">
                      <p className="font-serif text-sm text-tea-text/70 italic mb-4">
                        Fill in your details below. Your order inquiry will be generated automatically.
                      </p>
                      <div className="space-y-4 p-4 bg-tea-gold/20 rounded-lg border border-tea-gold/20">
                        {(['name', 'contact', 'location'] as const).map((field) => (
                          <div key={field}>
                            <label className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">
                              {field === 'name' ? 'Name' : field === 'contact' ? 'Contact' : 'Shipping Location'} *
                            </label>
                            <div className="relative">
                              <input
                                type={field === 'contact' ? 'email' : 'text'}
                                inputMode={field === 'contact' ? 'email' : undefined}
                                autoComplete={field === 'contact' ? 'email' : undefined}
                                value={details[field]}
                                onChange={(e) => handleFieldChange(field, e.target.value)}
                                onBlur={() => handleFieldBlur(field)}
                                aria-invalid={touched[field] && !!errors[field]}
                                className={`w-full bg-tea-surface border-b p-2 focus:outline-none font-serif text-lg placeholder:text-tea-text/20 transition-colors ${
                                  touched[field] && errors[field] ? 'border-red-500 focus:border-red-500' : 'border-tea-gold/20 focus:border-tea-gold'
                                }`}
                                placeholder={field === 'name' ? 'Your full name' : field === 'contact' ? 'your@email.com' : 'City, Country'}
                              />
                              {details[field] && !errors[field] && (
                                <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                              )}
                            </div>
                            {touched[field] && errors[field] && (
                              <p role="alert" className="text-red-500 text-xs mt-1">{errors[field]}</p>
                            )}
                          </div>
                        ))}
                        <div>
                          <label className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">Special Requests (Optional)</label>
                          <textarea
                            value={details.notes}
                            onChange={(e) => setDetails(d => ({ ...d, notes: e.target.value }))}
                            className="w-full bg-tea-surface border-b border-tea-gold/20 p-2 focus:outline-none focus:border-tea-gold font-serif text-base h-20 resize-none placeholder:text-tea-text/20"
                            placeholder="Any special requests..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-2">Order Inquiry Preview</label>
                        <div className="bg-tea-elevated border border-tea-gold/20 p-4 font-mono text-xs leading-relaxed text-tea-text/80 whitespace-pre-wrap max-h-48 overflow-y-auto"
                          style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)' }}>
                          {orderMessage}
                        </div>
                      </div>

                      {successMessage.show && (
                        <div className="animate-[fadeIn_0.3s_ease-out] bg-tea-green/10 border border-tea-green/30 text-tea-green px-4 py-3 rounded-lg flex items-center gap-2">
                          <Icons.Check className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-[0.15em] font-medium">
                            {successMessage.type === 'whatsapp' && 'Opening WhatsApp...'}
                            {successMessage.type === 'email' && 'Opening email client...'}
                            {successMessage.type === 'copy' && 'Copied to clipboard!'}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        <button onClick={handleWhatsApp}
                          disabled={!details.name || !details.contact || !details.location}
                          className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            preferredChannel === 'whatsapp'
                              ? 'border-tea-green/50 bg-tea-green/10 text-tea-green shadow-md'
                              : 'border-tea-green/30 hover:bg-tea-green/10 text-tea-green'
                          }`}>
                          <Icons.Message className="w-4 h-4" />
                          <span className="text-[10px] uppercase tracking-[0.15em]">Send via WhatsApp</span>
                          {preferredChannel === 'whatsapp' && <span className="text-xs ml-1">✓</span>}
                        </button>
                        <button onClick={handleEmail}
                          disabled={!details.name || !details.contact || !details.location}
                          className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            preferredChannel === 'email'
                              ? 'border-tea-gold/20 bg-tea-bg/10 text-tea-text shadow-md'
                              : 'border-tea-gold/20 hover:bg-tea-bg/5 text-tea-text'
                          }`}>
                          <span className="text-[10px] uppercase tracking-[0.15em]">Send via Email</span>
                          {preferredChannel === 'email' && <span className="text-xs ml-1">✓</span>}
                        </button>
                        <button onClick={handleCopy}
                          disabled={!details.name || !details.contact || !details.location}
                          className="flex items-center justify-center gap-2 py-3 border border-tea-gold/20 hover:bg-tea-bg/5 text-tea-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <span className="text-[10px] uppercase tracking-[0.15em]">Copy to Clipboard</span>
                        </button>
                      </div>

                      {recoveredCart && (
                        <p className="text-center text-xs text-tea-gold italic">Recovered your previous order request</p>
                      )}
                      <p className="text-center text-xs text-tea-text-dim italic">
                        Sending this message will initiate your order request with Teajia.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {isAdmin ? (
              /* Admin footer: currency, shipping, customer, create invoice */
              <div className="bg-tea-surface border-t border-tea-border p-6 space-y-5 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-20">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[9px] text-tea-muted uppercase block mb-1">Currency</label>
                    <div className="relative bg-tea-bg border border-tea-border rounded-lg px-2">
                      <select
                        value={displayCurrency}
                        onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
                        className="w-full bg-transparent py-1.5 text-xs text-tea-text outline-none cursor-pointer"
                      >
                        {props.mode === 'admin' && props.rates.map(r => <option key={r.currency} value={r.currency}>{r.currency}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-tea-muted uppercase block mb-1">Shipping (USD)</label>
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
                      className={`w-full bg-tea-bg border rounded-lg px-3 py-2 text-sm text-tea-text outline-none transition-colors placeholder-tea-muted/50 ${
                        validationError ? 'border-tea-accent' : selectedCustomerId ? 'border-green-500/50' : 'border-tea-border focus:border-tea-muted'
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
                              {c.company && <span className="text-tea-muted text-xs ml-2">{c.company}</span>}
                            </div>
                            {c.tags?.length > 0 && (
                              <span className="text-[9px] text-tea-muted uppercase">{c.tags[0]}</span>
                            )}
                          </button>
                        ))}
                        {customerSuggestions.length === 0 && customerName.trim() && (
                          <div className="px-3 py-2 text-xs text-tea-muted italic">
                            New contact — will be saved automatically
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted placeholder-tea-muted/50"
                    placeholder="WhatsApp (Optional)"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end text-tea-text mb-4 pt-2 border-t border-tea-border/50">
                    <span className="text-xs uppercase tracking-[0.2em] text-tea-muted">Total</span>
                    <span className="text-xl font-serif text-tea-accent">
                      {props.mode === 'admin' ? formatCurrency(adminTotalUSD, displayCurrency, props.rates) : ''}
                    </span>
                  </div>
                  <button
                    onClick={handleCompleteSale}
                    disabled={isProcessing || isEmpty}
                    className={`w-full py-4 text-xs font-bold uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2 transition-all ${
                      isEmpty
                        ? 'bg-tea-bg text-tea-muted cursor-not-allowed border border-tea-border'
                        : 'bg-tea-accent text-tea-bg hover:bg-tea-accent/90 shadow-lg shadow-tea-accent/10'
                    }`}
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : 'Create Invoice'}
                  </button>
                </div>
              </div>
            ) : (
              /* Public footer: total + "Request Order" or instruction text */
              <div className="p-6 border-t border-tea-gold/20 bg-tea-surface relative z-20">
                {step === 'CART' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center font-serif text-xl text-tea-text">
                      <span>Total</span>
                      <span className="num">{fmtPrice(publicSubtotal)}</span>
                    </div>
                    <button
                      onClick={() => !isEmpty && setStep('CHECKOUT')}
                      disabled={isEmpty}
                      className="w-full py-4 bg-tea-gold text-tea-paper uppercase tracking-[0.2em] text-xs hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Request This Order
                    </button>
                  </div>
                )}
                {step === 'CHECKOUT' && (
                  <p className="text-xs text-center text-tea-text/60 mb-4">
                    Send your order inquiry via WhatsApp, Email, or copy to clipboard
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
