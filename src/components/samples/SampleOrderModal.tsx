import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, MessageCircle } from 'lucide-react';
import { buildOrderMessage, buildWhatsAppUrl } from '../../lib/whatsapp';

interface SampleOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleName: string;
  sampleId: string;
  teaType?: string;
}

const QUANTITY_PRESETS = ['50g', '100g', '250g'];

export const SampleOrderModal: React.FC<SampleOrderModalProps> = ({
  isOpen,
  onClose,
  sampleName,
  sampleId,
  teaType,
}) => {
  const [quantity, setQuantity] = useState('50g');
  const [customQty, setCustomQty] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuantity('50g');
      setCustomQty('');
      setIsCustom(false);
      setName('');
      setWhatsapp('');
      setLocation('');
      setSubmitting(false);
      setSubmitted(false);
      setRefNumber('');
    }
  }, [isOpen]);

  const resolvedQty = isCustom ? customQty : quantity;

  const handleSubmit = async () => {
    if (!name.trim() || !whatsapp.trim() || !resolvedQty) return;
    setSubmitting(true);

    const ref = `SAM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setRefNumber(ref);

    // Open WhatsApp immediately, primary action on this platform
    const phone = import.meta.env.VITE_WHATSAPP_NUMBER || '';
    const message = buildOrderMessage({
      type: 'inquiry',
      ref,
      customerName: name.trim(),
      customerContact: whatsapp.trim(),
      customerLocation: location.trim() || undefined,
      items: [{
        name: sampleName,
        variant: teaType,
        quantity: parseInt(resolvedQty, 10) || 0,
        unit: 'g',
        price: 'TBD',
        total: 'TBD',
      }],
      subtotal: 'TBD',
      total: 'TBD',
    });
    window.open(buildWhatsAppUrl(phone, message), '_blank');

    setSubmitting(false);
    setSubmitted(true);
  };

  const handleWhatsAppResend = () => {
    const phone = import.meta.env.VITE_WHATSAPP_NUMBER || '';
    const message = buildOrderMessage({
      type: 'inquiry',
      ref: refNumber,
      customerName: name,
      customerContact: whatsapp,
      customerLocation: location || undefined,
      items: [{
        name: sampleName,
        variant: teaType,
        quantity: parseInt(resolvedQty, 10) || 0,
        unit: 'g',
        price: 'TBD',
        total: 'TBD',
      }],
      subtotal: 'TBD',
      total: 'TBD',
    });
    window.open(buildWhatsAppUrl(phone, message), '_blank');
  };

  const canSubmit = name.trim() && whatsapp.trim() && resolvedQty;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-priority"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7 }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm bg-tea-bg border border-tea-border rounded-t-xl sm:rounded-xl z-priority overflow-hidden"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-tea-border">
              <h2 className="text-base text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
                Order This Tea
              </h2>
              <button
                onClick={onClose}
                className="text-tea-text-sec hover:text-tea-text transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-0">
              {!submitted ? (
                <div className="space-y-4">
                  {/* Tea name */}
                  <div>
                    <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                      Tea
                    </p>
                    <p className="text-sm text-tea-text" style={{ fontFamily: 'var(--font-body)' }}>
                      {sampleName}
                      {teaType && <span className="text-tea-text-sec ml-1.5 text-xs">· {teaType}</span>}
                    </p>
                  </div>

                  {/* Quantity */}
                  <div>
                    <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                      Quantity
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {QUANTITY_PRESETS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => { setQuantity(q); setIsCustom(false); }}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all duration-150 ${
                            !isCustom && quantity === q
                              ? 'cta-solid'
                              : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsCustom(true)}
                        className={`px-3 py-1.5 text-sm rounded-full transition-all duration-150 ${
                          isCustom
                            ? 'cta-solid'
                            : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {isCustom && (
                      <input
                        type="text"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        placeholder="e.g. 500g"
                        className="mt-2 w-full px-3 py-2 min-h-[44px] bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                        style={{ fontFamily: 'var(--font-body)' }}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Contact fields */}
                  <div className="space-y-2">
                    <p className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec" style={{ fontFamily: 'var(--font-display)' }}>
                      Your Details
                    </p>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="your name"
                      className="w-full px-3 py-2 min-h-[44px] bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="WhatsApp number (with country code)"
                      className="w-full px-3 py-2 min-h-[44px] bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Shipping location (optional)"
                      className="w-full px-3 py-2 min-h-[44px] bg-tea-surface border border-tea-border rounded-md text-tea-text text-sm placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors"
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1 pb-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 cta-solid text-xs uppercase tracking-[0.2em] font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {submitting ? (
                        <span className="w-4 h-4 border-2 border-tea-bg/30 border-t-tea-bg rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart size={14} />
                          Send Request
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Success state */
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#25D366]/15 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle size={22} className="text-[#25D366]" />
                  </div>
                  <h3 className="text-base text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                    WhatsApp Opened
                  </h3>
                  <p className="text-xs text-tea-text-sec mb-1">
                    {sampleName} · {resolvedQty}
                  </p>
                  <p className="text-ui-11 text-tea-text-dim font-mono mb-1">{refNumber}</p>
                  <p className="text-ui-11 text-tea-text-dim mb-6">Send the message to complete your request.</p>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleWhatsAppResend}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-tea-border text-tea-text-sec text-xs rounded-md hover:bg-tea-surface transition-colors"
                    >
                      <MessageCircle size={14} />
                      Resend message
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};
