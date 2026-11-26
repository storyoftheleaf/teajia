import React, { useEffect, useMemo, useRef, useState } from 'react';
import { currentOrderVia, forgetOrderVia } from '../../lib/orderVia';
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
import { WHATSAPP_UPDATES_DEFAULT, WhatsAppUpdatesConsent, updateEmailError, updateEmailForRequest } from './WhatsAppUpdatesConsent';
import { isoCurrencyCode } from '../../lib/currency';
import { formatPersonalTeaMoney } from '../../lib/personalTeaMoney';
import { Button } from './Button';
import { Icons } from '../Icons';
import { CartItemRow } from './CartItem';
import { api } from '../../lib/api';
import { useMyTeaCredit } from '../../hooks/useMyTeaCredit';
import { formatCredit } from '../../lib/hostCreditApi';
import { agreedItemForDisplay } from '../../lib/orderTrackingDomain';
import { createHumanOrderRef, createInquiryPayloadKey, createTrackingToken, validateStoreCart } from '../../lib/publicCartDomain';
import { checkoutLocation, isUsDelivery, readCheckoutDetails, validateCheckoutDetails, type CheckoutDetails, type DeliveryChoice, type ReplyChannel } from '../../lib/checkoutDetails';
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
  paymentDeadline?: string;
  shippingTotal?: string;
  shippingQuoteRequested?: boolean;
  handoff: boolean;
  /** The customer chose WhatsApp (with or without a number), not email. */
  viaWhatsApp: boolean;
  /** Launch 5: the tea credit the server held for this order, waiting for the shop. */
  creditAsked?: string;
};

const PENDING_KEY = 'teajia_pendingOrderRequest';

/* Shipping and pickup remain separate visible choices.
   Each tile is a real radio, so the order is still a plain form. */
const DELIVERY_TILES: [DeliveryChoice, string, string][] = [
  ['international', 'US shipping', 'charged separately later'],
  ['bali-pickup', 'Pickup', 'by arrangement in Bali'],
];
/* Two ways to be answered, not three. "WhatsApp chat" and "WhatsApp number"
   read as the same choice; the difference is only whether the customer leaves
   a number, so the number field under the one WhatsApp tile decides it: empty,
   they send the order from WhatsApp themselves; filled, the shop writes to it. */
const REPLY_TILES: ['whatsapp' | 'website', string, string][] = [
  ['whatsapp', 'WhatsApp', 'chat with us'],
  ['website', 'Email', 'reply by email'],
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

export const PublicCart: React.FC<PublicCartProps> = ({ storeSlug, storeName, cart, onRemoveItem, onUpdateQuantity, onUpdatePacks, onAddItem, isOpen, whatsappNumber, contactEmail, canBePaid, checkoutState = 'ready', onRetryStore, onClose }) => {
  const isBaliStore = storeSlug === 'teajia-bali';
  const [details, setDetails] = useState(() => readCheckoutDetails(isBaliStore));
  const [whatsappConsent, setWhatsappConsent] = useState(WHATSAPP_UPDATES_DEFAULT);
  const [updateEmail, setUpdateEmail] = useState('');
  const [replyChoice, setReplyChoice] = useState<'whatsapp' | 'website' | null>(() => (readCheckoutDetails(isBaliStore).contact.includes('@') ? 'website' : null));
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
  const isFixedPackOrder = (placedOrder?.items ?? cart).some(item => item.exactPackPriceUsd != null);
  const channels = resolveContactChannels({ whatsappNumber: isFixedPackOrder ? undefined : whatsappNumber, email: contactEmail, message: '' });
  const replyMode: 'whatsapp' | 'website' = replyChoice === 'website' || !channels.whatsapp ? 'website' : 'whatsapp';
  const channel: ReplyChannel = replyMode === 'website' ? 'website' : details.contact.trim() ? 'whatsapp' : 'whatsapp-chat';
  const subtotal = useMemo(() => cart.reduce((total, item) => total + item.totalPrice, 0), [cart]);
  const paymentUnavailable = isFixedPackOrder && canBePaid === false;
  const unavailable = checkoutState !== 'ready' || paymentUnavailable;
  /* The shop keys yuan and Taiwan dollars as 'Yuan' and 'NT'; an order names
     its money by ISO code, which is what the server checks for. Sending the
     shop key refused every order placed in yuan with "Currency must be a
     three-letter code", and the error sat off screen, so the button looked dead. */
  const orderCurrency = isFixedPackOrder ? 'USD' : isoCurrencyCode(shopPrice.code);
  const formatTotal = isFixedPackOrder ? (usd: number) => formatPersonalTeaMoney(usd, orderCurrency) : shopPrice.total;
  // Launch 5: a signed-in host with credit in this shop gets one plain choice.
  // The worker decides the amount; closed or signed out, nothing is asked.
  const teaCredit = useMyTeaCredit(isOpen ? storeSlug : undefined);
  const creditAvailable = teaCredit.data?.store_available ?? 0;
  const offerCredit = creditAvailable > 0 && cart.some(item => item.category === 'tea');
  const [useCredit, setUseCredit] = useState(false);

  useEffect(() => {
    if (isOpen) setRecentRequests(readRecentOrderRequests(storeSlug));
  }, [isOpen, storeSlug]);

  useEffect(() => {
    const { address: _privateAddress, ...savedDetails } = details;
    try {
      if (Object.entries(savedDetails).some(([key, value]) => key !== 'delivery' && value.trim())) localStorage.setItem('teajia_cartDetails', JSON.stringify(savedDetails));
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
    if (unavailable) { setCheckoutError(paymentUnavailable ? 'This seller cannot accept payment right now.' : 'We could not check the shop. Please retry.'); return; }
    const nextErrors = validateCheckoutDetails(details, channel, isBaliStore);
    const requestWhatsApp = channel === 'whatsapp' && whatsappConsent;
    if (requestWhatsApp && !internationalWhatsAppNumber(details.contact)) nextErrors.contact = 'Include + and your country code, for example +62…';
    if (requestWhatsApp && internationalWhatsAppNumber(details.contact)?.slice(1) === whatsappNumber?.replace(/\D/g, '')) nextErrors.contact = 'Enter your own WhatsApp number, rather than the store’s number.';
    const emailError = channel === 'whatsapp' ? updateEmailError(whatsappConsent, updateEmail) : null;
    if (emailError) nextErrors.updateEmail = emailError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const validation = validateStoreCart(cart);
    if (!validation.ok || validation.storeSlug !== storeSlug) { setCheckoutError('Please review your basket. Each request must contain items from one shop.'); return; }

    const location = checkoutLocation(details);
    const contact = channel === 'whatsapp-chat' ? '' : details.contact.trim();
    const deliveryAddress = details.delivery === 'bali-pickup' ? '' : details.address.trim();
    const postcode = details.postcode.trim();
    const usShippingPostcode = isUsDelivery(details) && deliveryAddress && /^\d{5}(-\d{4})?$/.test(postcode)
      ? postcode
      : undefined;
    const cartKey = createInquiryPayloadKey({ storeSlug, name: details.name, contact, location, notes: details.notes, cart, totalUsd: subtotal, currency: orderCurrency });
    saving.current = true;
    setIsPersisting(true);
    setCheckoutError(null);
    try {
      const addressDigest = deliveryAddress
        ? new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deliveryAddress))).join(',')
        : '';
      const payloadKey = addressDigest ? JSON.stringify([cartKey, addressDigest]) : cartKey;
      const identity = pendingIdentity.current?.payloadKey === payloadKey ? pendingIdentity.current : requestIdentity(payloadKey);
      pendingIdentity.current = identity;
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(identity)); } catch { /* Keep the identity in memory for retry. */ }
      const result = await api.inquiries.create({ tracking_token: identity.trackingToken, ref_number: identity.ref, store_slug: storeSlug, customer_name: details.name.trim(), customer_contact: contact, whatsapp_handoff: channel === 'whatsapp-chat', whatsapp_confirmation_consent: requestWhatsApp, update_email: channel === 'whatsapp' ? updateEmailForRequest(whatsappConsent, updateEmail) : undefined, customer_location: location, delivery_address: deliveryAddress || undefined, delivery_city: isBaliStore && isUsDelivery(details) ? details.location.trim() : undefined, delivery_state: isBaliStore && isUsDelivery(details) ? details.state.trim().toUpperCase() : undefined, pickup: details.delivery === 'bali-pickup' || undefined, us_shipping_postcode: usShippingPostcode, delivery_country: isUsDelivery(details) ? 'US' : undefined, notes: details.notes.trim() || undefined, items_json: JSON.stringify(cart), total_estimate_usd: subtotal, currency: orderCurrency, source: 'website', via: currentOrderVia(), ...(offerCredit && useCredit ? { use_tea_credit: true } : {}) });
      forgetOrderVia();
      const trackingUrl = `${window.location.origin}/order/${result.tracking_token}`;
      const savedItems: PublicCartItem[] = result.invoice_items ? result.invoice_items.map(line => {
        const original = cart.find(item => item.id === line.product_id && item.quantityGrams === line.quantity);
        return { ...original, ...agreedItemForDisplay(line), variant: original?.variant || '', storeSlug, storeName };
      }) : [...cart];
      const savedSubtotal = result.total_estimate_usd ?? savedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const shipping = result.shipping_checkout ?? result.shipping_quote;
      const total = savedSubtotal + (shipping?.shipping_usd ?? 0);
      const creditAsked = result.tea_credit?.status === 'held' ? formatCredit(result.tea_credit.amount, result.tea_credit.currency) : undefined;
      const orderMessage = buildOrderMessage({
        type: 'inquiry', ref: result.ref_number, invoiceNumber: result.invoice_number, trackingUrl,
        customerName: details.name.trim(), customerContact: contact, customerLocation: location,
        notes: details.notes.trim(), currency: orderCurrency,
        items: savedItems.map(item => ({ name: item.name, variant: item.variant, quantity: item.packGrams ?? item.quantityGrams, packs: item.packs ?? 1, unit: item.category === 'tea' ? 'g' : ' pcs', price: formatTotal(item.totalPrice / (item.packs ?? 1)), total: formatTotal(item.totalPrice) })),
        subtotal: formatTotal(savedSubtotal), total: formatTotal(total),
      });
      const message = creditAsked ? `${orderMessage}\n\nI asked to use ${creditAsked} of my tea credit on this order.` : orderMessage;
      const request: RecentOrderRequest = { trackingToken: result.tracking_token, reference: result.ref_number, storeSlug, createdAt: new Date().toISOString() };
      const remembered = rememberRecentOrderRequest(request);
      setWhatsappConsent(WHATSAPP_UPDATES_DEFAULT);
      setPlacedOrder({ request, items: savedItems, total: formatTotal(total), message, remembered, invoiceNumber: result.invoice_number, paymentDeadline: result.checkout_payment_deadline ?? result.shipping_checkout?.payment_deadline ?? result.pickup_payment_deadline, shippingQuoteRequested: result.shipping_quote_requested, shippingTotal: shipping ? formatTotal(shipping.shipping_usd) : undefined, handoff: channel === 'whatsapp-chat', viaWhatsApp: channel !== 'website', creditAsked });
      setUseCredit(false);
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

  const field = (key: 'name' | 'contact' | 'location' | 'country' | 'state' | 'postcode' | 'address', label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
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
      <button type="button" onClick={onClose} aria-label="Close cart" className="min-w-tap min-h-tap flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors">
        <Icons.Close className="w-5 h-5" />
      </button>
      <h2 className="flex-1 min-w-0 font-display text-ui-22 leading-none text-tea-text">{placedOrder ? 'Request received' : 'Your order'}</h2>
      {!placedOrder && !isFixedPackOrder && rates.length > 0 && <select aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value as Currency)} disabled={isPersisting} className="checkout-currency">
        {rates.map(rate => <option key={rate.currency} value={rate.currency}>{rate.currency}</option>)}
      </select>}
    </div>
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto tea-card-scroll px-4 pt-1 pb-6">
      {placedOrder ? <section className="space-y-7" aria-label="Order request confirmation">
        {/* The saved order in the cart's own vocabulary: the same tea rows, the
            same figures, the same footer button. It used to switch to plain
            paragraphs and bordered rows, so the moment the order was sent it
            stopped looking like the thing the reader had just built. */}
        <div role="status" className="space-y-2">
          <p className="font-display text-ui-26 leading-tight text-tea-text">{placedOrder.paymentDeadline
            ? 'Your order is reserved.' : `Your request is saved with ${storeName}.`}</p>
          <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{placedOrder.paymentDeadline ? 'Open your order to pay securely and follow its payment status.' : 'Your order request and draft invoice are saved. We’ll confirm your tea first; shipping is quoted and charged separately later.'}</p>
          {placedOrder.invoiceNumber && <p className="num text-ui-13 text-tea-text-sec">{`Invoice ${placedOrder.invoiceNumber}`}</p>}
          {placedOrder.creditAsked && <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{`You asked to use ${placedOrder.creditAsked} of your tea credit. The shop will look it over and confirm it with you.`}</p>}
        </div>
        <div className="space-y-4">
          {placedOrder.items.map(item => <div key={lineKeyOf(item)} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-display text-ui-22 leading-tight text-tea-text">{item.name}</span>
              <span className="num text-ui-13 text-tea-text-sec">{item.category === 'tea' ? `${(item.packs ?? 1) > 1 ? `${item.packs} × ` : ''}${item.packGrams ?? item.quantityGrams}g` : `${item.quantityGrams} pieces`}</span>
            </span>
            <span className="num text-ui-17 text-tea-text shrink-0">{formatTotal(item.totalPrice)}</span>
          </div>)}
          {placedOrder.shippingTotal && <div className="flex items-baseline justify-between gap-3">
            <span className="font-body text-ui-13 text-tea-text-sec">US shipping</span>
            <span className="num text-ui-17 text-tea-text">{placedOrder.shippingTotal}</span>
          </div>}
          <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-tea-border">
            <span className="font-body text-ui-13 text-tea-text-sec">{placedOrder.shippingTotal ? 'Total with shipping' : placedOrder.paymentDeadline ? placedOrder.shippingQuoteRequested ? 'Tea subtotal' : 'Total · free pickup' : placedOrder.items.every(item => item.category === 'tea') ? 'Tea subtotal estimate' : 'Tea & teaware subtotal estimate'}</span>
            <span className="num text-ui-20 text-tea-text">{placedOrder.total}</span>
          </div>
          <p className="font-body text-ui-13 text-tea-text-sec">{placedOrder.paymentDeadline
            ? `Pay by ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar' }).format(new Date(placedOrder.paymentDeadline))} Bali time to keep your reservation.`
            : placedOrder.shippingQuoteRequested ? 'Pay for your tea first. Shipping is quoted and charged separately later.' : placedOrder.shippingTotal ? 'Shipping is quoted. We’ll confirm availability with you before payment.' : 'Shipping is arranged personally. No payment has been taken.'}</p>
        </div>
        {channels.whatsapp && placedOrder.viaWhatsApp && !placedOrder.paymentDeadline && <section className="space-y-2" aria-label="Discuss your saved order">
          <h3 className={`${T.h3} text-tea-text`}>{placedOrder.handoff ? 'One more step' : 'On WhatsApp'}</h3>
          <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{placedOrder.handoff ? 'Open WhatsApp with the button below and tap Send, so we can reply to you.' : 'We’ll write to your number. To start sooner, open WhatsApp with the button below and tap Send.'} The message carries your order and its link; nothing is sent until you tap Send.</p>
          <details><summary className="checkout-text-action text-ui-13 cursor-pointer">Using a computer? Scan with your phone</summary>
            <div className="py-3 space-y-2">
              <QRCodeSVG value={buildWhatsAppUrl(whatsappNumber!, `Hi, I would like to discuss invoice ${placedOrder.invoiceNumber || placedOrder.request.reference}. Order ${placedOrder.request.reference}. Details: ${window.location.origin}${recentOrderRequestPath(placedOrder.request)}`)} size={176} includeMargin bgColor="#ffffff" fgColor="#000000" aria-label="Scan to open WhatsApp with this invoice link" />
              <p className="font-body text-ui-13 text-tea-text-sec">Scan to open your invoice conversation on your phone, then tap Send. Keep this code private.</p>
            </div>
          </details>
        </section>}
        <section className="space-y-2" aria-label="Your order page">
          <h3 className={`${T.h3} text-tea-text`}>Your order page</h3>
          <a className="checkout-text-action text-ui-15 text-tea-text" href={recentOrderRequestPath(placedOrder.request)} onClick={onClose}>View order status <span className="num text-ui-13 text-tea-text-sec ml-2 break-all">{placedOrder.request.reference}</span></a>
          <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">Keep your private order-status link. It shows the latest status even if a separate message does not arrive. {placedOrder.remembered ? 'It is also under Recent requests in this cart, on this browser.' : 'This browser could not save it, so bookmark the page.'}</p>
          <button type="button" onClick={copyReceipt} className="checkout-text-action text-ui-13">Copy order details and link</button>
          {copyStatus && <p role="status" className="font-body text-ui-13 text-tea-text-sec">{copyStatus}</p>}
        </section>
      </section> : <>
        {undoItem && <div className="flex items-baseline justify-between gap-3 mb-2" role="status"><span className="font-body text-ui-13 text-tea-text-sec">{undoItem.name} is out of your order.</span><button type="button" onClick={() => { onAddItem(undoItem); setUndoItem(null); }} className="checkout-text-action text-ui-13 text-tea-gold-lt">Put it back</button></div>}
        {cart.length === 0 ? <div className="py-10 space-y-4">
          <p className={`${T.body} text-tea-text`}>Your basket is empty.</p>
          <a href={storeSlug === 'teajia-bali' ? '/shop' : `/store/${encodeURIComponent(storeSlug)}`} onClick={onClose} className="checkout-text-action">Browse the teas</a>
        </div> : <form id="checkout-form" ref={formRef} onSubmit={submitOrder} noValidate>
          <fieldset disabled={isPersisting} className="min-w-0 space-y-7">
            <legend className="sr-only">Your tea selection and delivery details</legend>
            {isFixedPackOrder && <p className="mb-3 text-ui-13 text-tea-text-sec">Order from {storeName}</p>}
            <div className="space-y-7 !mt-0">{cart.map(item => <CartItemRow key={lineKeyOf(item)} item={item} onRemove={removeItem} onUpdateQuantity={onUpdateQuantity} onUpdatePacks={onUpdatePacks} onNavigate={onClose} />)}</div>
            {unavailable && <div role="status" className={`${T.bodyLight} text-tea-text bg-tea-surface p-3`}>
              <p>{paymentUnavailable ? 'This seller cannot accept payment right now.' : checkoutState === 'loading' ? 'Checking the shop’s ordering details…' : 'We could not check the shop. Your basket is safe.'}</p>
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
              {details.delivery !== 'bali-pickup' && field('location', details.delivery === 'bali-delivery' ? 'Your area in Bali' : details.delivery === 'indonesia' ? 'City and province' : isBaliStore && isUsDelivery(details) ? 'City' : isUsDelivery(details) ? 'City and state' : 'Town or city', { autoComplete: 'address-level2', placeholder: details.delivery === 'bali-delivery' ? 'e.g. Ubud or Canggu' : details.delivery === 'indonesia' ? 'e.g. Jakarta, DKI Jakarta' : undefined })}
              {details.delivery === 'international' && (isBaliStore ? <p className="font-body text-ui-13 text-tea-text-sec">United States only</p> : field('country', 'Country', { autoComplete: 'country-name' }))}
              {isBaliStore && isUsDelivery(details) && field('state', 'State (two-letter code)', { autoComplete: 'address-level1', maxLength: 2, placeholder: 'CA' })}
              {(details.delivery === 'indonesia' || details.delivery === 'international') && field('postcode', isUsDelivery(details) ? 'ZIP code' : 'Postcode (optional)', { autoComplete: 'postal-code' })}
              {details.delivery !== 'bali-pickup' && field('address', isBaliStore ? 'Street address and apartment' : 'Street address (optional)', { autoComplete: 'street-address', maxLength: 500 })}
              <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{isFixedPackOrder ? 'The seller confirms your order before you pay. Shipping is quoted separately.' : details.delivery === 'bali-pickup' ? 'Pickup is free. If we can confirm your order now, you can pay right away.' : 'Pay for your tea first. Shipping is quoted and charged separately later.'}</p>
            </fieldset>
            <fieldset className="space-y-3 min-w-0">
              <legend className={`${T.h3} text-tea-text mb-3`}>How we reply</legend>
              <div className={`grid gap-1 ${channels.whatsapp ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {REPLY_TILES.filter(([value]) => channels.whatsapp || value === 'website').map(([value, main, sub]) => <label key={value} className={checkoutTile(replyMode === value)}>
                  <input type="radio" name="reply-channel" value={value} aria-label={main} checked={replyMode === value} onChange={() => { if (value !== replyMode) updateDetail('contact', ''); setReplyChoice(value); setWhatsappConsent(WHATSAPP_UPDATES_DEFAULT); setErrors({}); }} className="absolute inset-0 m-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="font-body text-ui-15 leading-tight">{main}</span>{' '}<span className="font-body text-ui-12 leading-tight text-tea-text-sec">{sub}</span>
                </label>)}
              </div>
              <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec">{channel === 'whatsapp-chat' ? 'Save your order here, then send it to us from WhatsApp. No number needed; leave one below if you would rather we write first.' : channel === 'whatsapp' ? 'We’ll write to you at this number on WhatsApp.' : 'We’ll reply by email. No message app opens.'}</p>
            </fieldset>
            {offerCredit && <label className={checkoutTile(useCredit)}>
              <input type="checkbox" name="use-tea-credit" checked={useCredit} onChange={event => setUseCredit(event.target.checked)} className="absolute inset-0 m-0 w-full h-full opacity-0 cursor-pointer" />
              <span className="font-body text-ui-15 leading-tight">Use my tea credit on this order</span>{' '}
              <span className="font-body text-ui-12 leading-tight text-tea-text-sec">{`You have ${formatCredit(creditAvailable)}. The shop approves it by hand.`}</span>
            </label>}
            {field('name', 'Your name', { autoComplete: 'name' })}
            {field('contact', replyMode === 'website' ? 'Your email address' : 'Your WhatsApp number', { type: replyMode === 'website' ? 'email' : 'tel', inputMode: replyMode === 'website' ? 'email' : 'tel', autoComplete: replyMode === 'website' ? 'email' : 'tel', placeholder: replyMode === 'website' ? 'you@example.com' : '+62… (optional)' })}
            {channel === 'whatsapp' && <WhatsAppUpdatesConsent storeName={storeName} consent={whatsappConsent} onConsent={setWhatsappConsent} email={updateEmail} onEmail={value => { setUpdateEmail(value); setErrors(previous => ({ ...previous, updateEmail: '' })); }} error={errors.updateEmail} />}
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
      {placedOrder?.paymentDeadline ? <a href={recentOrderRequestPath(placedOrder.request)} onClick={onClose} className="btn-primary btn-primary-lg w-full">View order and pay</a>
        : placedOrder ? channels.whatsapp && placedOrder.viaWhatsApp && !placedOrder.paymentDeadline
        ? <a className="btn-primary btn-primary-lg w-full whitespace-nowrap" href={buildWhatsAppUrl(whatsappNumber!, placedOrder.message)} target="_blank" rel="noopener noreferrer">Discuss this order on WhatsApp</a>
        : <Button fullWidth onClick={onClose}>Continue browsing</Button> : cart.length > 0 ? <>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="num text-ui-26 leading-none text-tea-text"><span className="sr-only">{cart.every(item => item.category === 'tea') ? 'Tea subtotal' : 'Tea & teaware subtotal'} </span>{formatTotal(subtotal)}</span>
            <span className="font-body text-ui-11 leading-none text-tea-text-sec">{details.delivery === 'bali-pickup' ? 'Free pickup' : 'Shipping charged later'}</span>
          </div>
          <Button type="submit" form="checkout-form" fullWidth className="flex-1 min-w-0 whitespace-nowrap !px-4" loading={isPersisting} disabled={unavailable}>{isPersisting ? 'Saving request…' : 'Place order request'}</Button>
        </div>
      </> : <Button variant="secondary" fullWidth onClick={onClose}>Continue browsing</Button>}
    </div></div>
  </>;
};
