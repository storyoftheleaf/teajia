import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CartItem as PublicCartItem } from '../../types';
import type { Currency } from '../../admin/types';
import { lineKeyOf, useAppStore } from '../../lib/store';
import { buildOrderMessage } from '../../lib/whatsapp';
import { internationalWhatsAppNumber } from '../../lib/whatsappContact';
import { resolveContactChannels } from '../../lib/contact';
import { useRates } from '../../admin/hooks/useAdminData';
import { useShopPrice } from '../shop/shopPrice';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { Button } from './Button';
import { CartItemRow } from './CartItem';
import { api } from '../../lib/api';
import { createHumanOrderRef, createInquiryPayloadKey, createTrackingToken, validateStoreCart } from '../../lib/publicCartDomain';
import { checkoutLocation, readCheckoutDetails, validateCheckoutDetails, type CheckoutDetails, type DeliveryChoice, type ReplyChannel } from '../../lib/checkoutDetails';
import { readRecentOrderRequests, rememberRecentOrderRequest, recentOrderRequestPath, type RecentOrderRequest } from '../../lib/recentOrderRequests';

export interface PublicCartProps {
  storeSlug: string;
  storeName: string;
  cart: PublicCartItem[];
  onRemoveItem: (lineKey: string) => void;
  onUpdateQuantity: (lineKey: string, grams: number) => void;
  onUpdatePacks: (lineKey: string, packs: number) => void;
  onAddItem: (item: PublicCartItem) => void;
  isOpen: boolean;
  whatsappNumber?: string;
  contactEmail?: string;
  canBePaid?: boolean;
  checkoutState?: 'loading' | 'error' | 'ready';
  onRetryStore?: () => void;
  onClose?: () => void;
}

type SavedOrder = {
  request: RecentOrderRequest;
  items: PublicCartItem[];
  total: string;
  message: string;
  remembered: boolean;
  invoiceNumber?: string;
};

const PENDING_KEY = 'teajia_pendingOrderRequest';

/** A timed-out save can have succeeded. Retrying the same basket reuses its key,
 * including after a reload, instead of silently filing another request. */
function requestIdentity(payloadKey: string) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    if (pending?.payloadKey === payloadKey && /^[A-Za-z0-9_-]{43}$/.test(pending.trackingToken) && /^TJ-\d{8}-[A-F0-9]{8}$/.test(pending.ref)) return pending as { ref: string; trackingToken: string; payloadKey: string };
  } catch { /* In-memory retry remains available. */ }
  return { ref: createHumanOrderRef(), trackingToken: createTrackingToken(), payloadKey };
}

export const PublicCart: React.FC<PublicCartProps> = ({ storeSlug, storeName, cart, onRemoveItem, onUpdateQuantity, onUpdatePacks, onAddItem, isOpen, whatsappNumber, contactEmail, checkoutState = 'ready', onRetryStore, onClose }) => {
  const isBaliStore = storeSlug === 'teajia-bali';
  const [details, setDetails] = useState(() => readCheckoutDetails(isBaliStore));
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [channelChoice, setChannelChoice] = useState<ReplyChannel | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<SavedOrder | null>(null);
  const [recentRequests, setRecentRequests] = useState(() => readRecentOrderRequests(storeSlug));
  const [copyStatus, setCopyStatus] = useState('');
  const [undoItem, setUndoItem] = useState<PublicCartItem | null>(null);
  const pendingIdentity = useRef<ReturnType<typeof requestIdentity> | null>(null);
  const saving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currency = useAppStore(s => s.currency);
  const setCurrency = useAppStore(s => s.setCurrency);
  const clearPublicCart = useAppStore(s => s.clearPublicCart);
  const { data: rates = [] } = useRates();
  const shopPrice = useShopPrice();
  const channels = resolveContactChannels({ whatsappNumber, email: contactEmail, message: '' });
  const channel: ReplyChannel = channelChoice === 'website' || !channels.whatsapp ? 'website' : 'whatsapp';
  const subtotal = useMemo(() => cart.reduce((total, item) => total + item.totalPrice, 0), [cart]);
  const unavailable = checkoutState !== 'ready';

  useEffect(() => {
    if (isOpen) setRecentRequests(readRecentOrderRequests(storeSlug));
  }, [isOpen, storeSlug]);

  useEffect(() => {
    try {
      if (Object.entries(details).some(([key, value]) => key !== 'delivery' && value.trim())) localStorage.setItem('teajia_cartDetails', JSON.stringify(details));
      else localStorage.removeItem('teajia_cartDetails');
    } catch { /* Storage is optional: it must never block an order. */ }
  }, [details]);

  useEffect(() => {
    if (!undoItem) return;
    const timeout = setTimeout(() => setUndoItem(null), 10000);
    return () => clearTimeout(timeout);
  }, [undoItem]);

  useEffect(() => {
    // A newly added basket is independent of the receipt currently on screen.
    if (placedOrder && cart.length > 0) setPlacedOrder(null);
  }, [cart, placedOrder]);

  useEffect(() => {
    if (placedOrder && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [placedOrder]);

  const updateDetail = (field: keyof CheckoutDetails, value: string) => {
    if (field === 'contact') setWhatsappConsent(false);
    setDetails(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: '' }));
    setCheckoutError(null);
  };

  const removeItem = (lineKey: string) => {
    setUndoItem(cart.find(item => lineKeyOf(item) === lineKey) || null);
    onRemoveItem(lineKey);
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current || placedOrder) return;
    if (unavailable) { setCheckoutError('We could not check the shop. Please retry.'); return; }
    const nextErrors = validateCheckoutDetails(details, channel);
    const requestWhatsApp = channel === 'whatsapp' && whatsappConsent;
    if (requestWhatsApp && !internationalWhatsAppNumber(details.contact)) nextErrors.contact = 'Include + and your country code, for example +62…';
    if (requestWhatsApp && internationalWhatsAppNumber(details.contact)?.slice(1) === whatsappNumber?.replace(/\D/g, '')) nextErrors.contact = 'Enter your own WhatsApp number, rather than the store’s number.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const validation = validateStoreCart(cart);
    if (!validation.ok || validation.storeSlug !== storeSlug) { setCheckoutError('Please review your basket. Each request must contain items from one shop.'); return; }

    const location = checkoutLocation(details);
    const payloadKey = createInquiryPayloadKey({ storeSlug, name: details.name, contact: details.contact, location, notes: details.notes, cart, totalUsd: subtotal, currency: shopPrice.code });
    const identity = pendingIdentity.current?.payloadKey === payloadKey ? pendingIdentity.current : requestIdentity(payloadKey);
    pendingIdentity.current = identity;
    const trackingUrl = `${window.location.origin}/order/${identity.trackingToken}`;
    const message = buildOrderMessage({
      type: 'inquiry', ref: identity.ref, trackingUrl,
      customerName: details.name.trim(), customerContact: details.contact.trim(), customerLocation: location,
      notes: details.notes.trim(), currency: shopPrice.code,
      items: cart.map(item => ({ name: item.name, variant: item.variant, quantity: item.packGrams ?? item.quantityGrams, packs: item.packs ?? 1, unit: item.category === 'tea' ? 'g' : ' pcs', price: shopPrice.total(item.totalPrice / (item.packs ?? 1)), total: shopPrice.total(item.totalPrice) })),
      subtotal: shopPrice.total(subtotal), total: shopPrice.total(subtotal),
    });
    saving.current = true;
    setIsPersisting(true);
    setCheckoutError(null);
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(identity)); } catch { /* Keep the identity in memory for retry. */ }
    try {
      const result = await api.inquiries.create({ tracking_token: identity.trackingToken, ref_number: identity.ref, store_slug: storeSlug, customer_name: details.name.trim(), customer_contact: details.contact.trim(), whatsapp_confirmation_consent: requestWhatsApp, customer_location: location, notes: details.notes.trim() || undefined, items_json: JSON.stringify(cart), total_estimate_usd: subtotal, currency: shopPrice.code, source: 'website' });
      const request: RecentOrderRequest = { trackingToken: result.tracking_token, reference: result.ref_number, storeSlug, createdAt: new Date().toISOString() };
      const remembered = rememberRecentOrderRequest(request);
      setWhatsappConsent(false);
      setPlacedOrder({ request, items: [...cart], total: shopPrice.total(subtotal), message, remembered, invoiceNumber: result.invoice_number });
      setRecentRequests(readRecentOrderRequests(storeSlug));
      setUndoItem(null);
      clearPublicCart();
      try { sessionStorage.removeItem(PENDING_KEY); sessionStorage.removeItem('teajia_cartState'); } catch { /* Best effort. */ }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'We could not save your request. Your basket is still here. Please retry.');
    } finally {
      saving.current = false;
      setIsPersisting(false);
    }
  };

  const copyReceipt = async () => {
    if (!placedOrder) return;
    try { await navigator.clipboard.writeText(placedOrder.message); setCopyStatus('Order details and tracking link copied.'); }
    catch { setCopyStatus('Could not copy. Open your order-status page and bookmark it instead.'); }
  };

  const field = (key: 'name' | 'contact' | 'location' | 'country' | 'postcode', label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <label className={`${T.label} text-tea-text-sec`} htmlFor={`checkout-${key}`}>{label}</label>
      <input id={`checkout-${key}`} name={key} value={details[key]} onChange={event => updateDetail(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `checkout-${key}-error` : undefined} className="checkout-input" {...props} />
      {errors[key] && <p id={`checkout-${key}-error`} role="alert" className={`${T.bodyLight} text-tea-text`}>{errors[key]}</p>}
    </div>
  );

  return <>
    <div className="flex items-center justify-between gap-3 px-5 pb-3 border-b border-tea-border bg-tea-surface shrink-0">
      <h2 className={`${T.h3} text-tea-text`}>{placedOrder ? 'Request received' : 'Your order'}</h2>
      {!placedOrder && rates.length > 0 && <select aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value as Currency)} disabled={isPersisting} className="checkout-currency">
        {rates.map(rate => <option key={rate.currency} value={rate.currency}>{rate.currency}</option>)}
      </select>}
    </div>
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto tea-card-scroll px-5 py-4">
      {checkoutError && <p role="alert" className={`${T.bodyLight} text-tea-text bg-tea-elevated p-3 mb-4`}>{checkoutError}</p>}
      {placedOrder ? <section className="space-y-5" aria-label="Order request confirmation">
        <div role="status" className="space-y-2">
          <p className={`${T.body} text-tea-text`}>Your request is saved with {storeName}.</p>
          <p className={`${T.bodyLight} text-tea-text-sec`}>Your order request and draft invoice are saved. We’ll arrange stock, payment and shipping with you personally.</p>
          {placedOrder.invoiceNumber && <p className={`${T.bodyLight} text-tea-text-sec`}>Invoice {placedOrder.invoiceNumber}</p>}
          <p className={`${T.bodyLight} text-tea-text-sec`}>Keep your private order-status link. It shows the latest status even if a separate message does not arrive.</p>
        </div>
        <a className="checkout-tracking-link" href={recentOrderRequestPath(placedOrder.request)} onClick={onClose}>View order status <span className="block break-all">{placedOrder.request.reference}</span></a>
        <p className={`${T.bodyLight} text-tea-text-sec`}>{placedOrder.remembered ? 'You can also find this link under Recent requests in your cart on this browser.' : 'This browser could not save the link. Bookmark the order-status page so you can return.'} Keep the link private.</p>
        <div className="divide-y divide-tea-border border-y border-tea-border">
          {placedOrder.items.map(item => <div key={lineKeyOf(item)} className="py-3 flex justify-between gap-3">
            <span className={`${T.bodyLight} text-tea-text`}>{item.name}<span className="block text-tea-text-sec">{item.category === 'tea' ? `${item.packs ?? 1} × ${item.packGrams ?? item.quantityGrams} g` : `${item.quantityGrams} pieces`}</span></span>
          </div>)}
          <div className="flex justify-between gap-3 py-3"><span className={`${T.bodyLight} text-tea-text-sec`}>{placedOrder.items.every(item => item.category === 'tea') ? 'Tea subtotal estimate' : 'Tea & teaware subtotal estimate'}</span><span className={`${T.body} num text-tea-text`}>{placedOrder.total}</span></div>
        </div>
        <p className={`${T.bodyLight} text-tea-text-sec`}>The final amount and shipping arrangement will be confirmed personally. No payment has been taken.</p>
        <button type="button" onClick={copyReceipt} className="checkout-text-action">Copy order details and link</button>
        {copyStatus && <p role="status" className={`${T.bodyLight} text-tea-text-sec`}>{copyStatus}</p>}
      </section> : <>
        {undoItem && <div className="flex items-center justify-between gap-3 mb-3 bg-tea-surface p-2" role="status"><span className={`${T.bodyLight} text-tea-text-sec`}>{undoItem.name} removed</span><button type="button" onClick={() => { onAddItem(undoItem); setUndoItem(null); }} className="checkout-text-action">Undo</button></div>}
        {cart.length === 0 ? <div className="py-10 space-y-4">
          <p className={`${T.body} text-tea-text`}>Your basket is empty.</p>
          <a href={storeSlug === 'teajia-bali' ? '/shop' : `/store/${encodeURIComponent(storeSlug)}`} onClick={onClose} className="checkout-text-action">Browse the teas</a>
        </div> : <form id="checkout-form" ref={formRef} onSubmit={submitOrder} noValidate>
          <fieldset disabled={isPersisting} className="min-w-0 space-y-5">
            <legend className="sr-only">Your tea selection and delivery details</legend>
            <div className="space-y-3">{cart.map(item => <CartItemRow key={lineKeyOf(item)} item={item} onRemove={removeItem} onUpdateQuantity={onUpdateQuantity} onUpdatePacks={onUpdatePacks} onNavigate={onClose} />)}</div>
            {unavailable && <div role="status" className={`${T.bodyLight} text-tea-text bg-tea-surface p-3`}>
              <p>{checkoutState === 'loading' ? 'Checking the shop’s ordering details…' : 'We could not check the shop. Your basket is safe.'}</p>
              {checkoutState === 'error' && onRetryStore && <button type="button" onClick={onRetryStore} className="checkout-text-action">Retry shop details</button>}
            </div>}
            <div className="space-y-3 border-t border-tea-border pt-4">
              <h3 className={`${T.h3} text-tea-text`}>How would you like to receive it?</h3>
              {isBaliStore && <div className="space-y-1"><label htmlFor="checkout-delivery" className={`${T.label} text-tea-text-sec`}>Delivery</label><select id="checkout-delivery" value={details.delivery} onChange={event => { updateDetail('delivery', event.target.value as DeliveryChoice); setErrors({}); }} className="checkout-input">
                <option value="bali-delivery">Delivery in Bali</option><option value="bali-pickup">Request pickup in Bali</option><option value="indonesia">Elsewhere in Indonesia</option><option value="international">International shipping</option>
              </select></div>}
              {details.delivery !== 'bali-pickup' && field('location', details.delivery === 'bali-delivery' ? 'Your area in Bali' : details.delivery === 'indonesia' ? 'City and province' : 'Town or city', { autoComplete: 'address-level2', placeholder: details.delivery === 'bali-delivery' ? 'e.g. Ubud or Canggu' : details.delivery === 'indonesia' ? 'e.g. Jakarta, DKI Jakarta' : undefined })}
              {details.delivery === 'international' && field('country', 'Country', { autoComplete: 'country-name' })}
              {(details.delivery === 'indonesia' || details.delivery === 'international') && field('postcode', 'Postcode (optional)', { autoComplete: 'postal-code' })}
              <p className={`${T.bodyLight} text-tea-text-sec`}>{details.delivery === 'bali-pickup' ? 'We’ll confirm whether pickup is available and arrange the place and time.' : details.delivery === 'international' ? 'We’ll confirm shipping availability and cost with you. No full address needed yet.' : 'We’ll confirm delivery cost and timing, then ask for your address or map pin.'}</p>
            </div>
            <fieldset className="space-y-2 min-w-0">
              <legend className={`${T.h3} text-tea-text mb-2`}>How should we reply?</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {channels.whatsapp && <label className="checkout-channel"><input type="radio" name="reply-channel" value="whatsapp" checked={channel === 'whatsapp'} onChange={() => { setChannelChoice('whatsapp'); setWhatsappConsent(false); setErrors({}); }} />WhatsApp</label>}
                <label className="checkout-channel"><input type="radio" name="reply-channel" value="website" checked={channel === 'website'} onChange={() => { setChannelChoice('website'); setWhatsappConsent(false); setErrors({}); }} />Email reply</label>
              </div>
              <p className={`${T.bodyLight} text-tea-text-sec`}>Your request is submitted here on the website. We’ll use this contact to reply; no message app opens.</p>
            </fieldset>
            {field('name', 'Your name', { autoComplete: 'name' })}
            {field('contact', channel === 'website' ? 'Your email address' : 'Your WhatsApp number', { type: channel === 'website' ? 'email' : 'tel', inputMode: channel === 'website' ? 'email' : 'tel', autoComplete: channel === 'website' ? 'email' : 'tel', placeholder: channel === 'whatsapp' ? '+62…' : 'you@example.com' })}
            {channel === 'whatsapp' && <div className="space-y-1">
              <label className="checkout-channel"><input type="checkbox" checked={whatsappConsent} onChange={event => setWhatsappConsent(event.target.checked)} />Send me a WhatsApp order confirmation from {storeName} (optional)</label>
              <p className={`${T.bodyLight} text-tea-text-sec`}>I agree to receive a confirmation and replies about this order at this number. Automatic confirmations depend on availability; your order is saved even if a message does not arrive.</p>
            </div>}
            <details className="border-t border-tea-border pt-3"><summary className="checkout-text-action">Add a note (optional)</summary><label htmlFor="checkout-notes" className="sr-only">Order note</label><textarea id="checkout-notes" value={details.notes} onChange={event => updateDetail('notes', event.target.value)} className="checkout-input mt-2" rows={3} /></details>
          </fieldset>
        </form>}
        {recentRequests.length > 0 && <section aria-label="Recent requests" className="border-t border-tea-border pt-4 mt-6 space-y-2"><h3 className={`${T.h3} text-tea-text`}>Recent requests</h3>{recentRequests.map(request => <a key={request.trackingToken} href={recentOrderRequestPath(request)} onClick={onClose} className="checkout-text-action block break-all">{request.reference}</a>)}</section>}
      </>}
    </div>
    <div className="px-5 pt-3 pb-nav-gap border-t border-tea-border bg-tea-surface shrink-0 space-y-2">
      {placedOrder ? <Button fullWidth onClick={onClose}>Continue browsing</Button> : cart.length > 0 ? <>
        <div className="flex items-baseline justify-between gap-3"><span className={`${T.bodyLight} text-tea-text-sec`}>{cart.every(item => item.category === 'tea') ? 'Tea subtotal' : 'Tea & teaware subtotal'}</span><span className={`${T.h3} num text-tea-text`}>{shopPrice.total(subtotal)}</span></div>
        <p className={`${T.bodyLight} text-tea-text-sec`}>Payment and shipping will be arranged personally.</p>
        <Button type="submit" form="checkout-form" fullWidth loading={isPersisting} disabled={unavailable}>{isPersisting ? 'Saving request…' : 'Place order request'}</Button>
      </> : <Button variant="secondary" fullWidth onClick={onClose}>Continue browsing</Button>}
    </div>
  </>;
};
