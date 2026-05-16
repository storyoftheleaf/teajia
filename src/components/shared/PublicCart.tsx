
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CartItem as PublicCartItem } from '../../types';
import { fmtPrice, fmtShopPrice } from '../../utils/formatNumber';
import { buildOrderMessage, buildWhatsAppUrl } from '../../lib/whatsapp';
import { useAppStore } from '../../lib/store';
import { formatCurrency } from '../../admin/utils';
import { useRates } from '../../admin/hooks/useAdminData';
import { Icons } from '../Icons';
import { Button } from './Button';
import { CartItemRow } from './CartItem';
import { api } from '../../lib/api';

const TEAJIA_WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '+18313259164';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicCartProps {
  cart: PublicCartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
  onAddItem: (item: PublicCartItem) => void;
  isOpen: boolean;
  /**
   * Optional override for the WhatsApp destination phone. When present,
   * checkout messages are routed to this number instead of the platform
   * default. Used by per-store storefronts under /store/:slug.
   */
  whatsappNumber?: string;
  onClose?: () => void;
}

type CheckoutStep = 'CART' | 'INQUIRY' | 'CONFIRM';

// ── Component ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'CART' as const, label: 'Cart' },
  { key: 'INQUIRY' as const, label: 'Details' },
  { key: 'CONFIRM' as const, label: 'Review' },
];

export const PublicCart: React.FC<PublicCartProps> = ({ cart, onRemoveItem, onUpdateQuantity, onAddItem, isOpen, whatsappNumber, onClose }) => {
  const effectiveWhatsAppNumber = whatsappNumber && whatsappNumber.trim() ? whatsappNumber : TEAJIA_WHATSAPP_NUMBER;
  const [step, setStep] = useState<CheckoutStep>('CART');
  const [details, setDetails] = useState({ name: '', contact: '', location: '', notes: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<{ show: boolean; type: 'whatsapp' | 'email' | 'copy' } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [recoveredCart, setRecoveredCart] = useState(false);

  // Undo state for removed items
  const [undoItem, setUndoItem] = useState<{ item: PublicCartItem; timeout: ReturnType<typeof setTimeout> } | null>(null);

  // Multi-currency support
  const currency = useAppStore(s => s.currency);
  const setCurrency = useAppStore(s => s.setCurrency);
  const { data: rates = [] } = useRates();

  const displayPrice = useCallback((usd: number) => {
    const rounded = Math.ceil(usd);
    if (rates.length > 0 && currency !== 'USD') {
      return formatCurrency(rounded, currency, rates);
    }
    return fmtShopPrice(usd);
  }, [currency, rates]);

  const orderRef = useMemo(() => {
    const stored = localStorage.getItem('teajia_orderRef');
    if (stored) return stored;
    const d = new Date();
    const ref = `TJ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem('teajia_orderRef', ref);
    return ref;
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('teajia_cartDetails');
    if (saved) {
      try { setDetails(JSON.parse(saved)); } catch { /* ignore */ }
    }
    const sessionCart = sessionStorage.getItem('teajia_cartState');
    if (sessionCart && isOpen && cart.length === 0) setRecoveredCart(true);
    // Use a media query (no resize storm) — re-evaluated only when crossing the breakpoint
    const mql = window.matchMedia('(min-width: 768px)');
    const apply = () => setPreferredChannel(mql.matches ? 'email' : 'whatsapp');
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [isOpen]);

  useEffect(() => {
    if (cart.length > 0) sessionStorage.setItem('teajia_cartState', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (details.name || details.contact) localStorage.setItem('teajia_cartDetails', JSON.stringify(details));
  }, [details]);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setStep('CART');
        setSuccessMessage(null);
        setCheckoutError(null);
        setRecoveredCart(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Validation ───────────────────────────────────────────────────────────

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

  const isFormValid = !!details.name.trim() && !!details.contact.trim() && !!details.location.trim();

  // ── Computed ─────────────────────────────────────────────────────────────

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.totalPrice, 0), [cart]);
  const isEmpty = cart.length === 0;

  const orderMessage = useMemo(() => buildOrderMessage({
    type: 'inquiry',
    ref: orderRef,
    customerName: details.name,
    customerContact: details.contact,
    customerLocation: details.location,
    notes: details.notes,
    items: cart.map(item => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantityGrams,
      unit: item.category === 'tea' ? 'g' : '\u00d7',
      price: fmtPrice(item.pricePerGram),
      total: fmtShopPrice(item.totalPrice),
    })),
    subtotal: fmtShopPrice(subtotal),
    total: fmtShopPrice(subtotal),
  }), [cart, details, subtotal, orderRef]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleRemoveWithUndo = (id: string) => {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    if (undoItem) clearTimeout(undoItem.timeout);
    const timeout = setTimeout(() => setUndoItem(null), 5000);
    setUndoItem({ item, timeout });
    onRemoveItem(id);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    clearTimeout(undoItem.timeout);
    onAddItem(undoItem.item);
    setUndoItem(null);
  };

  const showSuccess = (type: 'whatsapp' | 'email' | 'copy') => {
    // Persistent success message — user dismisses manually or it stays
    setSuccessMessage({ show: true, type });
  };

  const persistInquiry = async (source: 'whatsapp' | 'email' | 'copy') => {
    try {
      await api.inquiries.create({
        ref_number: orderRef,
        customer_name: details.name,
        customer_contact: details.contact,
        customer_location: details.location,
        notes: details.notes || undefined,
        items_json: JSON.stringify(cart),
        total_estimate_usd: subtotal,
        source,
      });
    } catch {
      // Non-critical — inquiry still sent via WhatsApp/email
    }
  };

  const handleWhatsApp = () => {
    // Validate the resolved phone before opening WhatsApp. buildWhatsAppUrl
    // silently falls back to a recipient-less wa.me link when digits < 7,
    // which sends nothing — surface a clear error and offer email instead.
    const digits = String(effectiveWhatsAppNumber || '').replace(/\D/g, '');
    if (digits.length < 7) {
      setCheckoutError("This store doesn't have WhatsApp ordering set up. Please use Email or Copy text below to send your order.");
      return;
    }
    setCheckoutError(null);
    window.open(buildWhatsAppUrl(String(effectiveWhatsAppNumber), orderMessage));
    showSuccess('whatsapp');
    persistInquiry('whatsapp');
  };

  const handleEmail = () => {
    const subject = `Tea Order Inquiry - ${details.name}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderMessage)}`);
    showSuccess('email');
    persistInquiry('email');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderMessage);
    showSuccess('copy');
    persistInquiry('copy');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all fields before proceeding
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    for (const field of ['name', 'contact', 'location'] as const) {
      newTouched[field] = true;
      const err = validateField(field, details[field]);
      if (err) newErrors[field] = err;
    }
    setTouched(prev => ({ ...prev, ...newTouched }));
    setErrors(prev => ({ ...prev, ...newErrors }));
    if (Object.keys(newErrors).length === 0) {
      setStep('CONFIRM');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <>
      {/* Step indicator + currency selector — hairline rules, single bronze for active step */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-tea-border bg-tea-surface flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isPast = currentStepIndex > i;
            const canJump = isPast;
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => canJump && setStep(s.key)}
                  disabled={!canJump}
                  className={`text-ui-11 uppercase tracking-[0.15em] transition-colors duration-300 whitespace-nowrap min-h-[44px] py-3 ${
                    isActive ? 'text-tea-gold' : isPast ? 'text-tea-text-sec hover:text-tea-text cursor-pointer' : 'text-tea-text-sec/70 cursor-default'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <span className="block w-4 h-px bg-tea-border" aria-hidden="true" />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {rates.length > 0 && (
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="bg-transparent border-none text-ui-11 text-tea-text-sec outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 cursor-pointer hover:text-tea-text transition-colors shrink-0"
            aria-label="Currency"
          >
            {rates.map(r => (
              <option key={r.currency} value={r.currency}>{r.currency}</option>
            ))}
          </select>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative tea-card-scroll">
        <div className="px-5 py-5 min-h-full">

          {/* Undo toast */}
          {undoItem && (
            <div className="relative z-20 mb-4 cart-slide-up">
              <div className="flex items-center justify-between bg-tea-bg border border-tea-border text-tea-text px-4 py-3 rounded-md">
                <span className="text-xs">{undoItem.item.name} removed</span>
                <button
                  onClick={handleUndo}
                  className="text-tea-text text-xs uppercase tracking-[0.15em] underline underline-offset-4 decoration-tea-border hover:decoration-tea-gold ml-4 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Cart items */}
          {step === 'CART' && (
            <div className="relative z-[1]">
              {isEmpty ? (
                <div className="text-center py-20">
                  <span className="block w-8 h-px mx-auto mb-6 bg-tea-border" aria-hidden="true" />
                  <p className="font-serif italic text-base text-tea-text leading-snug max-w-[24ch] mx-auto">
                    The cart is quiet. The kettle is patient.
                  </p>
                  <a
                    href="/shop"
                    onClick={onClose}
                    className="inline-block mt-6 text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-gold underline underline-offset-[6px] decoration-tea-border hover:decoration-tea-gold transition-colors min-h-[44px] py-3"
                  >
                    Browse the shop
                  </a>
                </div>
              ) : (
                cart.map(item => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onRemove={handleRemoveWithUndo}
                    onUpdateQuantity={onUpdateQuantity}
                  />
                ))
              )}
            </div>
          )}

          {/* Step 2: Inquiry Form */}
          {step === 'INQUIRY' && (
            <div className="space-y-6 relative z-[1]">
              <p className="font-serif text-sm text-tea-text-sec italic mb-4">
                Fill in your details below. Your order inquiry will be generated automatically.
              </p>
              <form onSubmit={handleFormSubmit} className="space-y-4 p-4 bg-tea-surface rounded-md border border-tea-border" id="inquiry-form">
                <div>
                  <label htmlFor="inquiry-name" className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mb-1">
                    Name *
                  </label>
                  <div className="relative">
                    <input
                      id="inquiry-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={details.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      onBlur={() => handleFieldBlur('name')}
                      aria-invalid={touched.name && !!errors.name}
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg font-serif text-lg placeholder:text-tea-text-dim transition-colors min-h-[44px] ${
                        touched.name && errors.name ? 'border-tea-error focus:border-tea-error' : 'border-tea-border focus:border-tea-gold'
                      }`}
                      placeholder="Your full name"
                    />
                    {details.name && !errors.name && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec" />
                    )}
                  </div>
                  {touched.name && errors.name && (
                    <p role="alert" className="text-tea-error text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-contact" className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mb-1">
                    Contact *
                  </label>
                  <div className="relative">
                    <input
                      id="inquiry-contact"
                      name="contact"
                      type="text"
                      autoComplete="email"
                      inputMode="email"
                      value={details.contact}
                      onChange={(e) => handleFieldChange('contact', e.target.value)}
                      onBlur={() => handleFieldBlur('contact')}
                      aria-invalid={touched.contact && !!errors.contact}
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg font-serif text-lg placeholder:text-tea-text-dim transition-colors min-h-[44px] ${
                        touched.contact && errors.contact ? 'border-tea-error focus:border-tea-error' : 'border-tea-border focus:border-tea-gold'
                      }`}
                      placeholder="Phone or email"
                    />
                    {details.contact && !errors.contact && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec" />
                    )}
                  </div>
                  {touched.contact && errors.contact && (
                    <p role="alert" className="text-tea-error text-xs mt-1">{errors.contact}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-location" className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mb-1">
                    Shipping Location *
                  </label>
                  <div className="relative">
                    <input
                      id="inquiry-location"
                      name="address-level2"
                      type="text"
                      autoComplete="address-level2"
                      value={details.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      onBlur={() => handleFieldBlur('location')}
                      aria-invalid={touched.location && !!errors.location}
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg font-serif text-lg placeholder:text-tea-text-dim transition-colors min-h-[44px] ${
                        touched.location && errors.location ? 'border-tea-error focus:border-tea-error' : 'border-tea-border focus:border-tea-gold'
                      }`}
                      placeholder="City, Country"
                    />
                    {details.location && !errors.location && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec" />
                    )}
                  </div>
                  {touched.location && errors.location && (
                    <p role="alert" className="text-tea-error text-xs mt-1">{errors.location}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-notes" className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mb-1">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    id="inquiry-notes"
                    name="notes"
                    value={details.notes}
                    onChange={(e) => setDetails(d => ({ ...d, notes: e.target.value }))}
                    className="w-full bg-tea-surface border-b border-tea-border p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold font-serif text-base h-20 resize-none placeholder:text-tea-text-dim min-h-[44px]"
                    placeholder="Any special requests..."
                  />
                </div>

                {/* Submit button is hidden here; the footer button triggers form submit */}
                <button type="submit" className="sr-only">Review Order</button>
              </form>

              {recoveredCart && (
                <p className="text-center text-xs text-tea-gold italic">Recovered your previous order request</p>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'CONFIRM' && (
            <div className="space-y-6 relative z-[1]">
              <div className="text-center mb-2">
                <h3 className="font-serif text-lg text-tea-text mb-1">Review your inquiry</h3>
                <p className="text-xs text-tea-text-sec">Please review before sending.</p>
              </div>

              {/* Single editorial block — top + bottom hairline rules, internal sections divided by rules only */}
              <div className="border-y border-tea-border divide-y divide-tea-border">
                {/* Customer details */}
                <dl className="py-4 space-y-2.5">
                  <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">Recipient</p>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Name</dt>
                    <dd className="text-sm text-tea-text">{details.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Contact</dt>
                    <dd className="text-sm text-tea-text">{details.contact}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Location</dt>
                    <dd className="text-sm text-tea-text">{details.location}</dd>
                  </div>
                  {details.notes && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Notes</dt>
                      <dd className="text-sm text-tea-text text-right max-w-[60%]">{details.notes}</dd>
                    </div>
                  )}
                </dl>

                {/* Order items */}
                <div className="py-4 space-y-3">
                  <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">Order</p>
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-baseline text-sm gap-4">
                      <div className="min-w-0">
                        <span className="text-tea-text font-serif">{item.name}</span>
                        <span className="text-tea-text-sec text-ui-11 ml-2 num">
                          {item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`}
                        </span>
                      </div>
                      <span className="num text-tea-text shrink-0">{displayPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="py-4 flex justify-between items-baseline">
                  <span className="text-ui-11 uppercase tracking-[0.2em] text-tea-text-sec">Total estimate</span>
                  <span className="num text-xl font-serif text-tea-gold">{displayPrice(subtotal)}</span>
                </div>
              </div>

              <p className="text-ui-11 text-tea-text-sec text-center font-mono">{orderRef}</p>

              {/* Persistent success message — editorial confirmation, no green */}
              {successMessage?.show && (
                <div className="cart-fade-in border border-tea-border rounded-md px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <Icons.Check className="w-4 h-4 text-tea-text-sec shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {successMessage.type === 'whatsapp' && (
                          <>
                            <p className="text-xs text-tea-text">WhatsApp opened. Tap Send to complete your order.</p>
                            <p className="text-xs text-tea-text-sec">We'll reply on WhatsApp to confirm and arrange delivery.</p>
                          </>
                        )}
                        {successMessage.type === 'email' && (
                          <p className="text-xs text-tea-text">Email client opened. Review and send to place your order.</p>
                        )}
                        {successMessage.type === 'copy' && (
                          <p className="text-xs text-tea-text">Order details copied to clipboard.</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSuccessMessage(null)}
                      className="text-tea-text-sec hover:text-tea-text min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                      aria-label="Dismiss"
                    >
                      <Icons.Close className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="pl-7 flex items-center justify-between gap-4">
                    <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Order ref</span>
                    <a href={`/order/${orderRef}`} className="font-mono text-xs text-tea-text underline underline-offset-4 decoration-tea-border hover:decoration-tea-gold transition-colors">{orderRef}</a>
                  </div>
                </div>
              )}

              {checkoutError && (
                <div
                  className="cart-fade-in border border-tea-border rounded-md px-4 py-3 flex items-start justify-between gap-2 bg-tea-elevated"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <Icons.AlertCircle className="w-4 h-4 text-tea-text-sec shrink-0 mt-0.5" />
                    <span className="text-xs text-tea-text leading-relaxed">{checkoutError}</span>
                  </div>
                  <button
                    onClick={() => setCheckoutError(null)}
                    className="text-tea-text-sec hover:text-tea-text min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                    aria-label="Dismiss"
                  >
                    <Icons.Close className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Send actions — WhatsApp is the intentional primary channel; alternatives step down to text links */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleWhatsApp}
                  variant="primary"
                  fullWidth
                  icon={<Icons.Message className="w-4 h-4" />}
                  className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
                >
                  Send via WhatsApp
                </Button>
                <div className="flex items-center justify-center gap-6 pt-1">
                  <button
                    onClick={handleEmail}
                    className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text underline underline-offset-[6px] decoration-tea-border hover:decoration-tea-gold transition-colors min-h-[44px]"
                  >
                    Email
                  </button>
                  <span className="block w-px h-3 bg-tea-border" aria-hidden="true" />
                  <button
                    onClick={handleCopy}
                    className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text underline underline-offset-[6px] decoration-tea-border hover:decoration-tea-gold transition-colors min-h-[44px]"
                  >
                    Copy text
                  </button>
                </div>
              </div>

              <p className="text-center text-xs text-tea-text-sec italic">
                Sending this message will initiate your order request with Teajia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-tea-border bg-tea-surface relative z-20 shrink-0">
        {step === 'CART' && (
          <div className="flex flex-col gap-4">
            {!isEmpty && (
              <p className="text-xs text-tea-text-sec leading-relaxed font-serif italic">
                We confirm every order personally. Availability, pricing, and shipping are settled by message. This is a service, not a checkout.
              </p>
            )}
            <div className="flex justify-between items-baseline font-serif text-tea-text">
              <span className="text-xl">Total</span>
              <span className="num text-xl">{displayPrice(subtotal)}</span>
            </div>
            {!isEmpty && (
              <div className="flex items-center justify-between text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec -mt-2">
                <span>{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
                <span className="num">
                  {cart.filter(i => i.category === 'tea').reduce((g, i) => g + i.quantityGrams, 0)}g
                </span>
              </div>
            )}
            <Button
              onClick={() => !isEmpty && setStep('INQUIRY')}
              disabled={isEmpty}
              variant="primary"
              fullWidth
              className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
            >
              Send inquiry
            </Button>
          </div>
        )}
        {step === 'INQUIRY' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center font-serif text-lg text-tea-text">
              <span>Total</span>
              <span className="num">{displayPrice(subtotal)}</span>
            </div>
            <Button
              type="submit"
              form="inquiry-form"
              disabled={!isFormValid}
              variant="primary"
              fullWidth
              className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
            >
              Review Order
            </Button>
          </div>
        )}
        {step === 'CONFIRM' && (
          <div className="flex flex-col gap-3">
            {successMessage?.show && onClose && (
              <Button
                onClick={onClose}
                variant="primary"
                fullWidth
                className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
              >
                Done
              </Button>
            )}
            <Button
              onClick={() => setStep('INQUIRY')}
              variant="secondary"
              fullWidth
              className="py-3 uppercase tracking-[0.2em] text-xs"
            >
              Edit Details
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
