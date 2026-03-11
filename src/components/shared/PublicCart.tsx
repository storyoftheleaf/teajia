
import React, { useState, useMemo, useEffect } from 'react';
import { CartItem as PublicCartItem } from '../../types';
import { fmtPrice } from '../../utils/formatNumber';
import { Icons } from '../Icons';
import { Button } from './Button';
import { CartItemRow } from './CartItem';

const TEAJIA_WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '+18313259164';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublicCartProps {
  cart: PublicCartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
  isOpen: boolean;
}

type CheckoutStep = 'CART' | 'INQUIRY' | 'CONFIRM';

// ── Component ────────────────────────────────────────────────────────────────

export const PublicCart: React.FC<PublicCartProps> = ({ cart, onRemoveItem, onUpdateQuantity, isOpen }) => {
  const [step, setStep] = useState<CheckoutStep>('CART');
  const [details, setDetails] = useState({ name: '', contact: '', location: '', notes: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<{ show: boolean; type: 'whatsapp' | 'email' | 'copy' } | null>(null);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [recoveredCart, setRecoveredCart] = useState(false);

  // Undo state for removed items
  const [undoItem, setUndoItem] = useState<{ item: PublicCartItem; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const orderRef = useMemo(() => {
    const d = new Date();
    return `TJ-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('teajia_cartDetails');
    if (saved) {
      try { setDetails(JSON.parse(saved)); } catch { /* ignore */ }
    }
    const sessionCart = sessionStorage.getItem('teajia_cartState');
    if (sessionCart && isOpen && cart.length === 0) setRecoveredCart(true);
    const update = () => {
      setPreferredChannel(window.innerWidth < 768 ? 'whatsapp' : 'email');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
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

  const orderMessage = useMemo(() => {
    const date = new Date().toLocaleDateString();
    let msg = `ORDER INQUIRY [TEAJIA]\nRef: ${orderRef}\nDate: ${date}\n\n`;
    msg += `CUSTOMER:\nName: ${details.name}\nContact: ${details.contact}\nShipping To: ${details.location}\n`;
    if (details.notes) msg += `Notes: ${details.notes}\n`;
    msg += `\nITEMS:\n`;
    cart.forEach(item => {
      const qtyLabel = item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`;
      msg += `- ${item.name} (${item.variant}): ${qtyLabel} @ $${fmtPrice(item.totalPrice)}\n`;
    });
    msg += `\nTOTAL ESTIMATE: ${fmtPrice(subtotal)}\n\nPlease confirm availability and shipping costs.`;
    return msg;
  }, [cart, details, subtotal, orderRef]);

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
    onUpdateQuantity(undoItem.item.id, undoItem.item.quantityGrams);
    setUndoItem(null);
  };

  const showSuccess = (type: 'whatsapp' | 'email' | 'copy') => {
    // Persistent success message — user dismisses manually or it stays
    setSuccessMessage({ show: true, type });
  };

  const handleWhatsApp = () => {
    const clean = String(TEAJIA_WHATSAPP_NUMBER).replace(/\D/g, '');
    window.open(clean && clean !== '1234567890'
      ? `https://wa.me/${clean}?text=${encodeURIComponent(orderMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(orderMessage)}`);
    showSuccess('whatsapp');
  };

  const handleEmail = () => {
    const subject = `Tea Order Inquiry - ${details.name}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderMessage)}`);
    showSuccess('email');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(orderMessage);
    showSuccess('copy');
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

  return (
    <>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative tea-card-scroll">
        <div className="surface-warm-inset mx-2 mt-2 mb-2 p-4 min-h-full">

          {/* Undo toast */}
          {undoItem && (
            <div className="relative z-20 mb-4 animate-[slideUp_0.3s_ease-out]">
              <div className="flex items-center justify-between bg-tea-bg text-tea-text px-4 py-3 rounded-sm">
                <span className="text-xs font-sans">{undoItem.item.name} removed</span>
                <button
                  onClick={handleUndo}
                  className="text-tea-gold text-xs uppercase tracking-[0.15em] font-medium ml-4 hover:text-tea-gold/80 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
              <p className="font-serif text-sm text-tea-text/70 italic mb-4">
                Fill in your details below. Your order inquiry will be generated automatically.
              </p>
              <form onSubmit={handleFormSubmit} className="space-y-4 p-4 bg-tea-gold/20 rounded-lg border border-tea-gold/20" id="inquiry-form">
                <div>
                  <label htmlFor="inquiry-name" className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">
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
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none font-serif text-lg placeholder:text-tea-text/20 transition-colors min-h-[44px] ${
                        touched.name && errors.name ? 'border-red-500 focus:border-red-500' : 'border-tea-gold/20 focus:border-tea-gold'
                      }`}
                      placeholder="Your full name"
                    />
                    {details.name && !errors.name && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                    )}
                  </div>
                  {touched.name && errors.name && (
                    <p role="alert" className="text-red-500 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-contact" className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">
                    Contact *
                  </label>
                  <div className="relative">
                    <input
                      id="inquiry-contact"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={details.contact}
                      onChange={(e) => handleFieldChange('contact', e.target.value)}
                      onBlur={() => handleFieldBlur('contact')}
                      aria-invalid={touched.contact && !!errors.contact}
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none font-serif text-lg placeholder:text-tea-text/20 transition-colors min-h-[44px] ${
                        touched.contact && errors.contact ? 'border-red-500 focus:border-red-500' : 'border-tea-gold/20 focus:border-tea-gold'
                      }`}
                      placeholder="Phone or email"
                    />
                    {details.contact && !errors.contact && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                    )}
                  </div>
                  {touched.contact && errors.contact && (
                    <p role="alert" className="text-red-500 text-xs mt-1">{errors.contact}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-location" className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">
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
                      className={`w-full bg-tea-surface border-b p-2 focus:outline-none font-serif text-lg placeholder:text-tea-text/20 transition-colors min-h-[44px] ${
                        touched.location && errors.location ? 'border-red-500 focus:border-red-500' : 'border-tea-gold/20 focus:border-tea-gold'
                      }`}
                      placeholder="City, Country"
                    />
                    {details.location && !errors.location && (
                      <Icons.Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-green" />
                    )}
                  </div>
                  {touched.location && errors.location && (
                    <p role="alert" className="text-red-500 text-xs mt-1">{errors.location}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inquiry-notes" className="block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    id="inquiry-notes"
                    name="notes"
                    value={details.notes}
                    onChange={(e) => setDetails(d => ({ ...d, notes: e.target.value }))}
                    className="w-full bg-tea-surface border-b border-tea-gold/20 p-2 focus:outline-none focus:border-tea-gold font-serif text-base h-20 resize-none placeholder:text-tea-text/20 min-h-[44px]"
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
                <h3 className="font-serif text-lg text-tea-text mb-1">Review Your Inquiry</h3>
                <p className="text-xs text-tea-text-dim">Please review before sending</p>
              </div>

              {/* Customer details summary */}
              <div className="bg-tea-accent-sub border border-tea-border rounded-md p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Name</span>
                  <span className="text-sm text-tea-text">{details.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Contact</span>
                  <span className="text-sm text-tea-text">{details.contact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Location</span>
                  <span className="text-sm text-tea-text">{details.location}</span>
                </div>
                {details.notes && (
                  <div className="flex justify-between">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Notes</span>
                    <span className="text-sm text-tea-text text-right max-w-[60%]">{details.notes}</span>
                  </div>
                )}
              </div>

              {/* Order items summary */}
              <div className="bg-tea-surface border border-tea-border rounded-md p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-2">Items</p>
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm border-b border-tea-border pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="text-tea-text">{item.name}</span>
                      <span className="text-tea-text-dim text-xs ml-2">
                        {item.category === 'tea' ? `${item.quantityGrams}g` : `×${item.quantityGrams}`}
                      </span>
                    </div>
                    <span className="num text-tea-text">{fmtPrice(item.totalPrice)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-tea-border">
                  <span className="text-sm font-medium text-tea-text">Total Estimate</span>
                  <span className="num text-lg font-serif text-tea-gold">{fmtPrice(subtotal)}</span>
                </div>
              </div>

              <p className="text-[10px] text-tea-text-dim text-center font-mono">{orderRef}</p>

              {/* Persistent success message */}
              {successMessage?.show && (
                <div className="animate-[fadeIn_0.3s_ease-out] bg-tea-green/10 border border-tea-green/30 text-tea-green px-4 py-3 rounded-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icons.Check className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-[0.15em] font-medium">
                      {successMessage.type === 'whatsapp' && 'Opened WhatsApp — inquiry sent!'}
                      {successMessage.type === 'email' && 'Opened email client — inquiry ready!'}
                      {successMessage.type === 'copy' && 'Copied to clipboard!'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="text-tea-green/60 hover:text-tea-green min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Dismiss"
                  >
                    <Icons.Close className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Send actions */}
              <div className="grid grid-cols-1 gap-3">
                <button onClick={handleWhatsApp}
                  className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all min-h-[44px] ${
                    preferredChannel === 'whatsapp'
                      ? 'border-tea-green/50 bg-tea-green/10 text-tea-green shadow-md'
                      : 'border-tea-green/30 hover:bg-tea-green/10 text-tea-green'
                  }`}>
                  <Icons.Message className="w-4 h-4" />
                  <span className="text-[10px] uppercase tracking-[0.15em]">Send via WhatsApp</span>
                  {preferredChannel === 'whatsapp' && <span className="text-xs ml-1 text-tea-green">Recommended</span>}
                </button>
                <button onClick={handleEmail}
                  className={`flex items-center justify-center gap-2 py-3 border font-medium transition-all min-h-[44px] ${
                    preferredChannel === 'email'
                      ? 'border-tea-gold/20 bg-tea-accent-sub text-tea-text shadow-md'
                      : 'border-tea-gold/20 hover:bg-tea-accent-sub text-tea-text'
                  }`}>
                  <span className="text-[10px] uppercase tracking-[0.15em]">Send via Email</span>
                  {preferredChannel === 'email' && <span className="text-xs ml-1 text-tea-text-dim">Recommended</span>}
                </button>
                <button onClick={handleCopy}
                  className="flex items-center justify-center gap-2 py-3 border border-tea-gold/20 hover:bg-tea-accent-sub text-tea-text transition-colors min-h-[44px]">
                  <span className="text-[10px] uppercase tracking-[0.15em]">Copy to Clipboard</span>
                </button>
              </div>

              <p className="text-center text-xs text-tea-text-dim italic">
                Sending this message will initiate your order request with Teajia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-tea-gold/20 bg-tea-surface relative z-20">
        {step === 'CART' && (
          <div className="flex flex-col gap-4">
            {!isEmpty && (
              <div className="bg-tea-accent-sub border border-tea-border rounded-md px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-tea-gold font-medium mb-1.5">How ordering works</p>
                <p className="text-xs text-tea-text-sec leading-relaxed">
                  We confirm every order personally — availability, pricing, and shipping are confirmed via WhatsApp or email. This is a personal service, not an automated checkout.
                </p>
              </div>
            )}
            <div className="flex justify-between items-center font-serif text-xl text-tea-text">
              <span>Total</span>
              <span className="num">{fmtPrice(subtotal)}</span>
            </div>
            <Button
              onClick={() => !isEmpty && setStep('INQUIRY')}
              disabled={isEmpty}
              variant="primary"
              fullWidth
              className="py-4 uppercase tracking-[0.2em] text-xs rounded-none"
            >
              Send Inquiry
            </Button>
          </div>
        )}
        {step === 'INQUIRY' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center font-serif text-lg text-tea-text">
              <span>Total</span>
              <span className="num">{fmtPrice(subtotal)}</span>
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
