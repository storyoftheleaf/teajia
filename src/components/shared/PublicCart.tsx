import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CartItem as PublicCartItem } from '../../types';
import type { Currency } from '../../admin/types';
import { lineKeyOf, useAppStore } from '../../lib/store';
import { QRCodeSVG } from 'qrcode.react';
import { buildOrderMessage, buildWhatsAppUrl } from '../../lib/whatsapp';
import { internationalWhatsAppNumber } from '../../lib/whatsappContact';
import { resolveContactChannels } from '../../lib/contact';
import { useRates } from '../../admin/hooks/useAdminData';
import { useShopPrice } from '../shop/shopPrice';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { isoCurrencyCode } from '../../lib/currency';
import { Button } from './Button';
import { Icons } from '../Icons';
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
  handoff: boolean;
};

const PENDING_KEY = 'teajia_pendingOrderRequest';

/* Delivery and reply are picked from tiles, not a dropdown: four and three
   choices are few enough to see at once, and a tap beats opening a menu.
   Each tile is a real radio, so the order is still a plain form. */
const DELIVERY_TILES: [DeliveryChoice, string, string][] = [
  ['bali-delivery', 'Delivery', 'in Bali'],
  ['bali-pickup', 'Pickup', 'in Bali'],
  ['indonesia', 'Indonesia', 'outside Bali'],
  ['international', 'International', 'shipping'],
];
const REPLY_TILES: [ReplyChannel, string, string][] = [
  ['whatsapp-chat', 'WhatsApp', 'chat'],
  ['whatsapp', 'WhatsApp', 'number'],
  ['website', 'Email', 'reply'],
];
const checkoutTile = (on: boolean) => `relative flex flex-col justify-center gap-0.5 min-h-[52px] px-3 py-2.5 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tea-gold ${
  on ? 'bg-tea-elevated text-tea-text shadow-[inset_0_-2px_0_rgb(var(--tea-gold-rgb))]' : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
}`;

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
  const channel: ReplyChannel = channelChoice === 'website' || !channels.whatsapp ? 'website' : channelChoice ?? 'whatsapp-chat';
  const subtotal = useMemo(() => cart.reduce((total, item) => total + item.totalPrice, 0), [cart]);
  const unavailable = checkoutState !== 'ready';
  /* The shop keys yuan and Taiwan dollars as 'Yuan' and 'NT'; an order names
     its money by ISO code, which is what the server checks for. Sending the
     shop key refused every order placed in yuan with "Currency must be a
     three-letter code", and the error sat off screen, so the button looked dead. */
  const orderCurrency = isoCurrencyCode(shopPrice.code);

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
    const contact = channel === 'whatsapp-chat' ? '' : details.contact.trim();
    const payloadKey = createInquiryPayloadKey({ storeSlug, name: details.name, contact, location, notes: details.notes, cart, totalUsd: subtotal, currency: orderCurrency });
    const identity = pendingIdentity.current?.payloadKey === payloadKey ? pendingIdentity.current : requestIdentity(payloadKey);
    pendingIdentity.current = identity;
    saving.current = true;
    setIsPersisting(true);
    setCheckoutError(null);
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(identity)); } catch { /* Keep the identity in memory for retry. */ }
    try {
      const result = await api.inquiries.create({ tracking_token: identity.trackingToken, ref_number: identity.ref, store_slug: storeSlug, customer_name: details.name.trim(), customer_contact: contact, whatsapp_handoff: channel === 'whatsapp-chat', whatsapp_confirmation_consent: requestWhatsApp, customer_location: location, notes: details.notes.trim() || undefined, items_json: JSON.stringify(cart), total_estimate_usd: subtotal, currency: orderCurrency, source: 'website' });
      const trackingUrl = `${window.location.origin}/order/${result.tracking_token}`;
      const message = buildOrderMessage({
        type: 'inquiry', ref: result.ref_number, invoiceNumber: result.invoice_number, trackingUrl,
        customerName: details.name.trim(), customerContact: contact, customerLocation: location,
        notes: details.notes.trim(), currency: orderCurrency,
        items: cart.map(item => ({ name: item.name, variant: item.variant, quantity: item.packGrams ?? item.quantityGrams, packs: item.packs ?? 1, unit: item.category === 'tea' ? 'g' : ' pcs', price: shopPrice.total(item.totalPrice / (item.packs ?? 1)), total: shopPrice.total(item.totalPrice) })),
        subtotal: shopPrice.total(subtotal), total: shopPrice.total(subtotal),
      });
      const request: RecentOrderRequest = { trackingToken: result.tracking_token, reference: result.ref_number, storeSlug, createdAt: new Date().toISOString() };
      const remembered = rememberRecentOrderRequest(request);
      setWhatsappConsent(false);
      setPlacedOrder({ request, items: [...cart], total: shopPrice.total(subtotal), message, remembered, invoiceNumber: result.invoice_number, handoff: channel === 'whatsapp-chat' });
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
      <label className="block font-body text-ui-13 text-tea-text-sec" htmlFor={`checkout-${key}`}>{label}</label>
      <input id={`checkout-${key}`} name={key} value={details[key]} onChange={event => updateDetail(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `checkout-${key}-error` : undefined} className="checkout-input" {...props} />
      {errors[key] && <p id={`checkout-${key}-error`} role="alert" className={`${T.bodyLight} text-tea-text`}>{errors[key]}</p>}
    </div>
  );

  return <>
    {/* One row: close on the left (the panel rule), the name, the currency.
        The close used to sit on a row of its own above this one. */}
    <div className="flex items-center gap-2 pl-2 pr-4 min-h-[52px] shrink-0">
      <button type="button" onClick={onClose} aria-label="Close cart" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors">
        <Icons.Close className="w-5 h-5" />
      </button>
      <h2 className="flex-1 min-w-0 font-display text-[22px] leading-none text-tea-text">{placedOrder ? 'Request received' : 'Your order'}</h2>
      {!placedOrder && rates.length > 0 && <select aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value as Currency)} disabled={isPersisting} className="checkout-currency">
        {rates.map(rate => <option key={rate.currency} value={rate.currency}>{rate.currency}</option>)}
      </select>}
    </div>
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto tea-card-scroll px-4 pt-1 pb-6">
      {placedOrder ? <section className="space-y-5" aria-label="Order request confirmation">
        <div role="status" className="space-y-2">
          <p className={`${T.body} text-tea-text`}>Your request is saved with {storeName}.</p>
          <p className={`${T.bodyLight} text-tea-text-sec`}>Your order request and draft invoice are saved. We’ll arrange stock, payment and shipping with you personally.</p>
          {placedOrder.invoiceNumber && <p className={`${T.bodyLight} text-tea-text-sec`}>Invoice {placedOrder.invoiceNumber}</p>}
          <p className={`${T.bodyLight} text-tea-text-sec`}>Keep your private order-status link. It shows the latest status even if a separate message does not arrive.</p>
        </div>
        {channels.whatsapp && <section className="space-y-3" aria-label="Discuss your saved order">
          <a className="checkout-tracking-link" href={buildWhatsAppUrl(whatsappNumber!, placedOrder.message)} target="_blank" rel="noopener noreferrer">Discuss this order on WhatsApp</a>
          <p className={`${T.bodyLight} text-tea-text-sec`}>{placedOrder.handoff ? 'One more step: open WhatsApp and tap Send so we can reply to you.' : 'Open WhatsApp and tap Send to discuss this order.'} The message includes your order and invoice link. Nothing is sent until you tap Send.</p>
          <details><summary className="checkout-text-action">Using a computer? Scan with your phone</summary>
            <div className="py-3 space-y-2">
              <QRCodeSVG value={buildWhatsAppUrl(whatsappNumber!, `Hi, I would like to discuss invoice ${placedOrder.invoiceNumber || placedOrder.request.reference}. Order ${placedOrder.request.reference}. Details: ${window.location.origin}${recentOrderRequestPath(placedOrder.request)}`)} size={176} includeMargin bgColor="#ffffff" fgColor="#000000" aria-label="Scan to open WhatsApp with this invoice link" />
              <p className={`${T.bodyLight} text-tea-text-sec`}>Scan to open your invoice conversation on your phone, then tap Send. Keep this code private.</p>
            </div>
          </details>
        </section>}
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
        {undoItem && <div className="flex items-baseline justify-between gap-3 mb-2" role="status"><span className="font-body text-ui-13 text-tea-text-sec">{undoItem.name} is out of your order.</span><button type="button" onClick={() => { onAddItem(undoItem); setUndoItem(null); }} className="checkout-text-action text-ui-13 text-tea-gold-lt">Put it back</button></div>}
        {cart.length === 0 ? <div className="py-10 space-y-4">
          <p className={`${T.body} text-tea-text`}>Your basket is empty.</p>
          <a href={storeSlug === 'teajia-bali' ? '/shop' : `/store/${encodeURIComponent(storeSlug)}`} onClick={onClose} className="checkout-text-action">Browse the teas</a>
        </div> : <form id="checkout-form" ref={formRef} onSubmit={submitOrder} noValidate>
          <fieldset disabled={isPersisting} className="min-w-0 space-y-7">
            <legend className="sr-only">Your tea selection and delivery details</legend>
            <div className="space-y-7 !mt-0">{cart.map(item => <CartItemRow key={lineKeyOf(item)} item={item} onRemove={removeItem} onUpdateQuantity={onUpdateQuantity} onUpdatePacks={onUpdatePacks} onNavigate={onClose} />)}</div>
            {unavailable && <div role="status" className={`${T.bodyLight} text-tea-text bg-tea-surface p-3`}>
              <p>{checkoutState === 'loading' ? 'Checking the shop’s ordering details…' : 'We could not check the shop. Your basket is safe.'}</p>
              {checkoutState === 'error' && onRetryStore && <button type="button" onClick={onRetryStore} className="checkout-text-action">Retry shop details</button>}
            </div>}
            <fieldset className="min-w-0 space-y-3">
              <legend className={`${T.h3} text-tea-text mb-3`}>Receiving</legend>
              {isBaliStore && <div className="grid grid-cols-2 gap-1">
                {DELIVERY_TILES.map(([value, main, sub]) => <label key={value} className={checkoutTile(details.delivery === value)}>
                  <input type="radio" name="delivery" value={value} checked={details.delivery === value} onChange={() => { updateDetail('delivery', value); setErrors({}); }} className="absolute inset-0 m-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="font-body text-ui-15 leading-tight">{main}</span>{' '}<span className="font-body text-ui-12 leading-tight text-tea-text-sec">{sub}</span>
                </label>)}
              </div>}
              {details.delivery !== 'bali-pickup' && field('location', details.delivery === 'bali-delivery' ? 'Your area in Bali' : details.delivery === 'indonesia' ? 'City and province' : 'Town or city', { autoComplete: 'address-level2', placeholder: details.delivery === 'bali-delivery' ? 'e.g. Ubud or Canggu' : details.delivery === 'indonesia' ? 'e.g. Jakarta, DKI Jakarta' : undefined })}
              {details.delivery === 'international' && field('country', 'Country', { autoComplete: 'country-name' })}
              {(details.delivery === 'indonesia' || details.delivery === 'international') && field('postcode', 'Postcode (optional)', { autoComplete: 'postal-code' })}
              <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{details.delivery === 'bali-pickup' ? 'We’ll confirm whether pickup is available and arrange the place and time.' : details.delivery === 'international' ? 'We’ll confirm shipping availability and cost with you. No full address needed yet.' : 'We’ll confirm delivery cost and timing, then ask for your address or map pin.'}</p>
            </fieldset>
            <fieldset className="space-y-3 min-w-0">
              <legend className={`${T.h3} text-tea-text mb-3`}>How we reply</legend>
              <div className={`grid gap-1 ${channels.whatsapp ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {REPLY_TILES.filter(([value]) => channels.whatsapp || value === 'website').map(([value, main, sub]) => <label key={value} className={checkoutTile(channel === value)}>
                  <input type="radio" name="reply-channel" value={value} checked={channel === value} onChange={() => { setChannelChoice(value); setWhatsappConsent(false); setErrors({}); }} className="absolute inset-0 m-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="font-body text-ui-15 leading-tight">{main}</span>{' '}<span className="font-body text-ui-12 leading-tight text-tea-text-sec">{sub}</span>
                </label>)}
              </div>
              <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{channel === 'whatsapp-chat' ? 'No phone number needed. Save your order here, then open WhatsApp and tap Send to start the conversation.' : 'Your request is submitted here on the website. We’ll use this contact to reply; no message app opens.'}</p>
            </fieldset>
            {field('name', 'Your name', { autoComplete: 'name' })}
            {channel !== 'whatsapp-chat' && field('contact', channel === 'website' ? 'Your email address' : 'Your WhatsApp number', { type: channel === 'website' ? 'email' : 'tel', inputMode: channel === 'website' ? 'email' : 'tel', autoComplete: channel === 'website' ? 'email' : 'tel', placeholder: channel === 'whatsapp' ? '+62…' : 'you@example.com' })}
            {channel === 'whatsapp' && <div className="space-y-1">
              <label className="checkout-channel"><input type="checkbox" checked={whatsappConsent} onChange={event => setWhatsappConsent(event.target.checked)} />Send me a WhatsApp order confirmation from {storeName} (optional)</label>
              <p className={`${T.bodyLight} text-tea-text-sec`}>I agree to receive a confirmation and replies about this order at this number. Automatic confirmations depend on availability; your order is saved even if a message does not arrive.</p>
            </div>}
            <details><summary className="checkout-text-action text-ui-13 cursor-pointer">Add a note (optional)</summary><label htmlFor="checkout-notes" className="sr-only">Order note</label><textarea id="checkout-notes" value={details.notes} onChange={event => updateDetail('notes', event.target.value)} className="checkout-input mt-2" rows={3} /></details>
          </fieldset>
        </form>}
        {recentRequests.length > 0 && <section aria-label="Recent requests" className="mt-8 flex flex-wrap items-baseline gap-x-3"><h3 className="font-body text-ui-13 text-tea-text-sec">Recent requests</h3>{recentRequests.map(request => <a key={request.trackingToken} href={recentOrderRequestPath(request)} onClick={onClose} className="checkout-text-action num text-ui-13 break-all">{request.reference}</a>)}</section>}
      </>}
    </div>
    {/* No bottom-bar clearance here: the app hides the bottom bar while the
        cart is open, so reserving its 80px left a band of empty panel under
        the button. The panel itself keeps the safe-area inset. */}
    <div className="bg-tea-surface shrink-0"><div className="px-4 py-3 space-y-2">
      {/* A failed save is said beside the button that was pressed. It used to
          print at the top of the scrolling list, which is off screen by the
          time a reader reaches the button, so pressing it looked like nothing. */}
      {checkoutError && <p role="alert" className="font-body text-ui-13 leading-snug text-tea-text bg-tea-elevated px-3 py-2">{checkoutError}</p>}
      {placedOrder ? placedOrder.handoff && channels.whatsapp
        ? <a className={`checkout-whatsapp-action cta-solid ${T.label}`} href={buildWhatsAppUrl(whatsappNumber!, placedOrder.message)} target="_blank" rel="noopener noreferrer">Continue in WhatsApp</a>
        : <Button fullWidth onClick={onClose}>Continue browsing</Button> : cart.length > 0 ? <>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="num text-ui-26 leading-none text-tea-text"><span className="sr-only">{cart.every(item => item.category === 'tea') ? 'Tea subtotal' : 'Tea & teaware subtotal'} </span>{shopPrice.total(subtotal)}</span>
            <span className="font-body text-ui-11 leading-none text-tea-text-sec">Shipping arranged personally</span>
          </div>
          <Button type="submit" form="checkout-form" fullWidth className="flex-1 min-w-0 whitespace-nowrap !px-4" loading={isPersisting} disabled={unavailable}>{isPersisting ? 'Saving request…' : 'Place order request'}</Button>
        </div>
      </> : <Button variant="secondary" fullWidth onClick={onClose}>Continue browsing</Button>}
    </div></div>
  </>;
};
