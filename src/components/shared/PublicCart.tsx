
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CartItem as PublicCartItem } from '../../types';
import { buildOrderMessage } from '../../lib/whatsapp';
import { CONTACT_UNAVAILABLE, resolveContactChannels } from '../../lib/contact';
import { useAppStore } from '../../lib/store';
import { useRates } from '../../admin/hooks/useAdminData';
import { useShopPrice } from '../shop/shopPrice';
import { Icons } from '../Icons';
import { Button } from './Button';
import { CartItemRow } from './CartItem';
import { api } from '../../lib/api';
import {
  copyDeliveryStep,
  createHumanOrderRef,
  createInquiryPayloadKey,
  createTrackingToken,
  navigateDeliveryPlaceholder,
  openDeliveryPlaceholder,
  shouldRotateInquiryIdentity,
  validateStoreCart,
} from '../../lib/publicCartDomain';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicCartProps {
  storeSlug: string;
  storeName: string;
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
  contactEmail?: string;
  onClose?: () => void;
}

type CheckoutStep = 'CART' | 'INQUIRY' | 'CONFIRM';

// ── Component ────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'CART' as const, label: 'Cart' },
  { key: 'INQUIRY' as const, label: 'Details' },
  { key: 'CONFIRM' as const, label: 'Review' },
];

export const PublicCart: React.FC<PublicCartProps> = ({ storeSlug, storeName, cart, onRemoveItem, onUpdateQuantity, onAddItem, isOpen, whatsappNumber, contactEmail, onClose }) => {
  const [step, setStep] = useState<CheckoutStep>('CART');
  const [details, setDetails] = useState({ name: '', contact: '', location: '', notes: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<{ show: boolean; type: 'whatsapp' | 'email' | 'copy' } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [recoveredCart, setRecoveredCart] = useState(false);
  const [inquiryIdentity, setInquiryIdentity] = useState(() => ({
    ref: createHumanOrderRef(),
    trackingToken: createTrackingToken(),
  }));
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [persistedPayloadKey, setPersistedPayloadKey] = useState<string | null>(null);
  const [copyReady, setCopyReady] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  /**
   * What was actually sent, kept after the cart it came from is emptied.
   *
   * The cart used to survive its own checkout, so a customer could send the same
   * order a second time by tapping again. Emptying it is the fix, but the review
   * screen, the outgoing message and the copy-to-clipboard text all read from the
   * cart, so emptying it alone would blank the screen at the exact moment the
   * customer is looking for confirmation. This snapshot is taken the instant the
   * server accepts the order, and every one of those three reads from it
   * afterwards.
   */
  const [placedOrder, setPlacedOrder] = useState<{
    items: PublicCartItem[];
    totalUsd: number;
    message: string;
  } | null>(null);
  const wasOpen = useRef(isOpen);

  // Undo state for removed items
  const [undoItem, setUndoItem] = useState<{ item: PublicCartItem; timeout: ReturnType<typeof setTimeout> } | null>(null);

  // Multi-currency support
  const currency = useAppStore(s => s.currency);
  const setCurrency = useAppStore(s => s.setCurrency);
  const clearPublicCart = useAppStore(s => s.clearPublicCart);
  const { data: rates = [] } = useRates();

  /**
   * One conversion, owned by the shop.
   *
   * This was four lines of private arithmetic against the same rate table the
   * shop price helper already reads, and `CartItem` one file over held a
   * verbatim copy of it. Two conversions against one table is two chances to
   * round differently, and the row total and the cart total are the two numbers
   * a customer is most likely to compare.
   *
   * `rates` is still read here, but only to decide whether the currency
   * selector and the exchange-rate line have anything to offer.
   */
  const shopPrice = useShopPrice();
  const displayPrice = useCallback((usd: number) => shopPrice.total(usd), [shopPrice]);

  const orderRef = inquiryIdentity.ref;

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('teajia_cartDetails');
    if (saved) {
      try { setDetails(JSON.parse(saved)); } catch { /* ignore */ }
    }
    const sessionCart = sessionStorage.getItem('teajia_cartState');
    if (sessionCart && isOpen && cart.length === 0) setRecoveredCart(true);
    // Use a media query (no resize storm), re-evaluated only when crossing the breakpoint
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
        // Dropping the snapshot releases the identity guard below, so the next
        // basket opens on a fresh reference rather than the sent order's.
        setPlacedOrder(null);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Validation ───────────────────────────────────────────────────────────

  const validateField = (field: string, value: string): string => {
    if (field === 'name' && !value.trim()) return 'Name is required';
    if (field === 'contact' && !value.trim()) return 'Email or phone is required';
    if (field === 'location') {
      const trimmed = value.trim();
      if (!trimmed) return 'Location is required';
      if (trimmed.length < 4) return 'Please enter your city and country';
      if (!trimmed.includes(',')) return 'Include your country, e.g. Bangkok, Thailand';
      const country = trimmed.split(',')[1]?.trim() ?? '';
      if (country.length < 2) return 'Include your country, e.g. Bangkok, Thailand';
    }
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
  const currentPayloadKey = useMemo(() => createInquiryPayloadKey({
    storeSlug,
    name: details.name,
    contact: details.contact,
    location: details.location,
    notes: details.notes,
    cart,
    totalUsd: subtotal,
    currency: shopPrice.code,
  }), [storeSlug, details, cart, subtotal, shopPrice.code]);

  const rotateInquiryIdentity = useCallback(() => {
    setInquiryIdentity({ ref: createHumanOrderRef(), trackingToken: createTrackingToken() });
    setPersistedPayloadKey(null);
    setTrackingToken(null);
    setCopyReady(false);
    setSuccessMessage(null);
    setCheckoutError(null);
  }, []);

  useEffect(() => {
    const reopened = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    // An emptied cart after a sent order is the result of that order, not an
    // edit to it. Rotating here would discard the tracking token and the success
    // message the customer is currently reading.
    if (placedOrder && cart.length === 0) return;
    // Tea back in the cart after a sent order is a new order. Release the
    // snapshot so the next one gets its own reference.
    if (placedOrder) setPlacedOrder(null);
    if (shouldRotateInquiryIdentity(persistedPayloadKey, currentPayloadKey, reopened)) {
      rotateInquiryIdentity();
    }
  }, [isOpen, persistedPayloadKey, currentPayloadKey, rotateInquiryIdentity, placedOrder, cart.length]);

  const orderMessage = useMemo(() => buildOrderMessage({
    type: 'inquiry',
    ref: orderRef,
    customerName: details.name,
    customerContact: details.contact,
    customerLocation: details.location,
    notes: details.notes,
    currency: shopPrice.code,
    items: cart.map(item => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantityGrams,
      unit: item.category === 'tea' ? 'g' : '\u00d7',
      // The same figures the reader has been looking at for three steps. These
      // were the raw dollar formatters while the totals beside them were
      // localised, so the review screen and the message it produced disagreed
      // about the price of the same basket. Loose leaf is quoted per gram, a
      // pot per pot, which is how each of them is sold.
      price: item.category === 'tea'
        ? shopPrice.perGram(item.pricePerGram)
        : shopPrice.total(item.pricePerGram),
      total: shopPrice.total(item.totalPrice),
    })),
    subtotal: shopPrice.total(subtotal),
    total: shopPrice.total(subtotal),
  }), [cart, details, subtotal, orderRef, shopPrice]);

  /**
   * The three reads that used to depend on the cart still being full.
   *
   * Once an order is placed the cart is empty on purpose, so the review block,
   * the message the alternate channels carry, and the clipboard text all come
   * from the snapshot instead. Before that they come from the live cart, exactly
   * as they always did.
   */
  const outgoingMessage = placedOrder ? placedOrder.message : orderMessage;
  const reviewItems = placedOrder ? placedOrder.items : cart;
  const reviewTotal = placedOrder ? placedOrder.totalUsd : subtotal;
  /**
   * Whether this order is already on the server. The payload key stops matching
   * the moment the cart is emptied, so the snapshot is what answers this after a
   * send: without it, a second tap would file the order a second time.
   */
  const isPersistedForPayload = !!trackingToken && (!!placedOrder || persistedPayloadKey === currentPayloadKey);

  const contactChannels = useMemo(() => resolveContactChannels({ whatsappNumber, email: contactEmail, subject: `Tea Order - ${details.name}`, message: outgoingMessage }), [whatsappNumber, contactEmail, details.name, outgoingMessage]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleRemoveWithUndo = (id: string) => {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    if (undoItem) clearTimeout(undoItem.timeout);
    const timeout = setTimeout(() => setUndoItem(null), 10000);
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
    // Persistent success message, user dismisses manually or it stays
    setSuccessMessage({ show: true, type });
  };

  const persistInquiry = async (source: 'whatsapp' | 'email' | 'copy') => {
    const validation = validateStoreCart(cart);
    if (!validation.ok || validation.storeSlug !== storeSlug) {
      throw new Error(`This order must contain items from ${storeName} only. Please review your cart and try again.`);
    }
    const result = await api.inquiries.create({
        tracking_token: inquiryIdentity.trackingToken,
        ref_number: orderRef,
        store_slug: storeSlug,
        customer_name: details.name,
        customer_contact: details.contact,
        customer_location: details.location,
        notes: details.notes || undefined,
        items_json: JSON.stringify(cart),
        total_estimate_usd: subtotal,
        currency: shopPrice.code,
        source,
      });
    setTrackingToken(result.tracking_token);
    setPersistedPayloadKey(currentPayloadKey);
    // Only past this line, with the server's answer in hand, is the basket spent.
    // A failed create throws above and leaves the cart untouched to try again.
    setPlacedOrder({ items: cart, totalUsd: subtotal, message: orderMessage });
    clearPublicCart();
    try { sessionStorage.removeItem('teajia_cartState'); } catch { /* best effort */ }
    return result;
  };

  const persistenceError = (error: unknown) => {
    const detail = error instanceof Error ? error.message : '';
    return `We couldn't save your order request${detail ? `: ${detail}` : '.'} Please try again.`;
  };

  const deliverToWindow = (source: 'whatsapp' | 'email', href: string) => {
    if (isPersisting) return;
    const popup = openDeliveryPlaceholder();
    if (!popup) {
      setCheckoutError('Your browser blocked the delivery window. Allow popups for Teajia, then try again.');
      return;
    }

    setCheckoutError(null);
    const navigate = () => {
      if (navigateDeliveryPlaceholder(popup, href)) {
        showSuccess(source);
      } else {
        setCheckoutError(`Your order was saved, but ${source === 'whatsapp' ? 'WhatsApp' : 'your email client'} could not be opened. Please try again.`);
      }
    };

    if (isPersistedForPayload) {
      navigate();
      return;
    }

    setIsPersisting(true);
    void persistInquiry(source)
      .then(navigate)
      .catch((error) => {
        try { popup.close(); } catch { /* best effort */ }
        setCheckoutError(persistenceError(error));
      })
      .finally(() => setIsPersisting(false));
  };

  const handleWhatsApp = () => {
    // Validate the resolved phone before opening WhatsApp. buildWhatsAppUrl
    // silently falls back to a recipient-less wa.me link when digits < 7,
    // which sends nothing, surface a clear error and offer email instead.
    if (!contactChannels.whatsapp) {
      setCheckoutError("This store doesn't have WhatsApp ordering set up. Please use Email or Copy text below to send your order.");
      return;
    }
    deliverToWindow('whatsapp', contactChannels.whatsapp.href);
  };

  const handleEmail = () => {
    if (!contactChannels.email) { setCheckoutError(CONTACT_UNAVAILABLE); return; }
    deliverToWindow('email', contactChannels.email.href);
  };

  const handleCopy = () => {
    if (isPersisting) return;
    if (copyDeliveryStep(isPersistedForPayload) === 'persist') {
      setCheckoutError(null);
      setIsPersisting(true);
      void persistInquiry('copy')
        .then(() => {
          setCopyReady(true);
          setSuccessMessage(null);
        })
        .catch((error) => setCheckoutError(persistenceError(error)))
        .finally(() => setIsPersisting(false));
      return;
    }

    setCheckoutError(null);
    let copyPromise: Promise<void>;
    try {
      copyPromise = navigator.clipboard.writeText(outgoingMessage);
    } catch {
      setCheckoutError('Your order is saved, but the text could not be copied. Check clipboard permission and tap again.');
      return;
    }
    void copyPromise
      .then(() => {
        setCopyReady(false);
        showSuccess('copy');
      })
      .catch(() => setCheckoutError('Your order is saved, but the text could not be copied. Check clipboard permission and tap again.'));
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
      {/*
        Steps set as type, centred, with the currency at the trailing edge.
        The bronze that used to mark the active step is gone: the accent is
        spent once per panel, on the request button, so the current step is
        carried by full-strength cream against dim.
      */}
      <div className="flex-shrink-0 bg-tea-surface border-b border-tea-border">
        <div className="flex items-center gap-3 px-4 pb-2">
          <span className="w-12 shrink-0" aria-hidden="true" />
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
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
                    className={`font-serif text-[12.5px] transition-colors duration-300 whitespace-nowrap min-h-[44px] ${
                      isActive ? 'text-tea-text' : isPast ? 'text-tea-text-sec hover:text-tea-text cursor-pointer' : 'text-tea-text-dim cursor-default'
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
          <div className="w-12 shrink-0 flex justify-end">
            {rates.length > 0 && (
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="num bg-transparent border-none text-ui-11 text-tea-text-sec outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 cursor-pointer hover:text-tea-text transition-colors shrink-0"
                aria-label="Currency"
              >
                {rates.map(r => (
                  <option key={r.currency} value={r.currency}>{r.currency}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        {/*
          The rate, once. This line used to repeat the footer total, so the
          basket was priced twice on one screen, forty pixels apart.
        */}
        {rates.length > 0 && currency !== 'USD' && (
          <div className="px-4 pb-1.5 text-right num text-ui-10 text-tea-text-dim">
            1 USD = {rates.find(r => r.currency === currency)?.rateToUSD.toFixed(2)} {currency}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative tea-card-scroll">
        <div className={`min-h-full ${step === 'CART' ? 'p-3.5' : 'px-5 py-5'}`}>

          {/* Undo toast */}
          {undoItem && (
            <div className="relative z-20 mb-4 cart-slide-up">
              {/* Same paper as a tea, and the control is a word rather than a
                  tracked-out caps label, so the toast belongs to the list it
                  interrupts instead of announcing itself. */}
              <div className="flex items-center justify-between gap-3 bg-tea-surface text-tea-text px-4 py-2 rounded-[3px]">
                <span className="font-serif text-[12.5px] text-tea-text-sec">{undoItem.item.name} removed</span>
                <button
                  onClick={handleUndo}
                  className="font-serif text-[12.5px] text-tea-text underline decoration-tea-border hover:decoration-tea-text/50 underline-offset-[5px] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Cart items */}
          {step === 'CART' && (
            <div className="relative z-[1] flex flex-col gap-2.5">
              {isEmpty ? (
                <div className="bg-tea-surface rounded-[3px] text-center py-20 px-5">
                  <span className="block w-8 h-px mx-auto mb-6 bg-tea-border" aria-hidden="true" />
                  <p className="font-serif italic text-base text-tea-text leading-snug max-w-[24ch] mx-auto">
                    The cart is quiet. The kettle is patient.
                  </p>
                  <a
                    href="/shop"
                    onClick={onClose}
                    className="inline-block mt-6 font-serif text-[12.5px] text-tea-text-sec hover:text-tea-text underline decoration-tea-border hover:decoration-tea-text/50 underline-offset-[5px] transition-colors min-h-[44px] py-3"
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
                    onNavigate={onClose}
                  />
                ))
              )}
            </div>
          )}

          {/* Step 2: Inquiry Form */}
          {step === 'INQUIRY' && (
            <div className="space-y-6 relative z-[1]">
              <p className="font-serif text-sm text-tea-text-sec italic mb-4">
                Fill in your details below. Your order request will be generated automatically.
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
                  <label htmlFor="inquiry-location" className="block text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec mb-0.5">
                    Shipping Location *
                  </label>
                  <p className="text-ui-11 text-tea-text-dim mb-1">City, Country (e.g. Tokyo, Japan)</p>
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
                <h3 className="font-serif text-lg text-tea-text mb-1">Review your order</h3>
                <p className="text-xs text-tea-text-sec">Please review before sending.</p>
              </div>

              {/* Single editorial block, top + bottom hairline rules, internal sections divided by rules only */}
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
                  {reviewItems.map(item => (
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
                  <span className="num text-xl font-serif text-tea-gold">{displayPrice(reviewTotal)}</span>
                </div>
              </div>

              <p className="text-ui-11 text-tea-text-sec text-center font-mono">{orderRef}</p>

              {/* Persistent success message, editorial confirmation, no green */}
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
                  {trackingToken && <div className="pl-7 flex items-center justify-between gap-4">
                    <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Order ref</span>
                    <a href={`/order/${trackingToken}`} className="font-mono text-xs text-tea-text underline underline-offset-4 decoration-tea-border hover:decoration-tea-gold transition-colors">{orderRef}</a>
                  </div>}
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

              {trackingToken && !successMessage?.show && isPersistedForPayload && (
                <div className="cart-fade-in text-center text-ui-12 text-tea-text-sec space-y-1" role="status">
                  <p>{copyReady ? 'Order saved. Tap Copy saved order to place the text on your clipboard.' : 'Order saved.'}</p>
                  <a href={`/order/${trackingToken}`} className="font-mono text-tea-text underline underline-offset-4 decoration-tea-border hover:decoration-tea-gold transition-colors">
                    Track {orderRef}
                  </a>
                </div>
              )}

              {/* Send actions: WhatsApp is the intentional primary channel; alternatives step down to text links */}
              <div className="flex flex-col gap-3">
                {contactChannels.whatsapp && <Button
                  onClick={handleWhatsApp}
                  disabled={isPersisting}
                  variant="primary"
                  fullWidth
                  icon={<Icons.Message className="w-4 h-4" />}
                  className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
                >
                  Send via WhatsApp
                </Button>}
                <div className="flex items-center justify-center gap-6 pt-1">
                  {contactChannels.email && <button
                    onClick={handleEmail}
                    disabled={isPersisting}
                    className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text underline underline-offset-[6px] decoration-tea-border hover:decoration-tea-gold transition-colors min-h-[44px]"
                  >
                    Email
                  </button>}
                  {(contactChannels.whatsapp || contactChannels.email) && <span className="block w-px h-3 bg-tea-border" aria-hidden="true" />}
                  <button
                    onClick={handleCopy}
                    disabled={isPersisting}
                    className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text underline underline-offset-[6px] decoration-tea-border hover:decoration-tea-gold transition-colors min-h-[44px]"
                  >
                    {copyReady && isPersistedForPayload ? 'Copy saved order' : 'Copy text'}
                  </button>
                </div>
                {contactChannels.unavailable && <p className="text-center text-sm text-tea-text-sec">{CONTACT_UNAVAILABLE}</p>}
              </div>

              <p className="text-center text-xs text-tea-text-sec italic">
                Sending this message will initiate your order request with Teajia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pt-4 pb-5 border-t border-tea-border bg-tea-surface relative z-20 shrink-0">
        {step === 'CART' && (
          <div className="flex flex-col gap-3">
            {/* No total on an empty cart. The localised formatter renders zero
                as "IDR 0k", which is a price for nothing. */}
            {!isEmpty && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline text-tea-text">
                  <span className="font-display text-[23px]">Total</span>
                  <span className="num text-ui-20">{displayPrice(subtotal)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ui-9 uppercase tracking-[0.2em] text-tea-text-dim">
                    {cart.length} {cart.length === 1 ? 'tea' : 'teas'}
                    {' · '}
                    {cart.filter(i => i.category === 'tea').reduce((g, i) => g + i.quantityGrams, 0)}g
                  </span>
                  {currency !== 'USD' && (
                    <span className="num text-ui-10 text-tea-text-dim">approx. USD {Math.round(subtotal)}</span>
                  )}
                </div>
              </div>
            )}
            {!isEmpty && (
              <p className="font-serif italic text-[12.5px] leading-[1.6] text-tea-text-dim">
                We confirm every order personally. Availability, pricing and shipping are settled by message.
              </p>
            )}
            <Button
              onClick={() => !isEmpty && setStep('INQUIRY')}
              disabled={isEmpty}
              variant="primary"
              fullWidth
              className="h-[52px] !rounded-[2px] !font-serif !tracking-normal text-ui-14"
            >
              Request order
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
            {(successMessage?.show || placedOrder) && onClose && (
              <Button
                onClick={onClose}
                variant="primary"
                fullWidth
                className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
              >
                Done
              </Button>
            )}
            {/* Editing stops being offered once the order is with us: the basket
                it was built from is spent, so stepping back would show an empty
                form and invite a second order for the same tea. */}
            {!placedOrder && (
              <Button
                onClick={() => setStep('INQUIRY')}
                variant="secondary"
                fullWidth
                className="py-3 uppercase tracking-[0.2em] text-xs"
              >
                Edit Details
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
