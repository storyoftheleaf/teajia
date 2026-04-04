import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { RSVPFormData, ContactMethod, RSVPResponse } from '../../types/events';

interface RSVPFormSheetProps {
  slug: string;
  onClose: () => void;
}

const RSVPFormSheet: React.FC<RSVPFormSheetProps> = ({ slug, onClose }) => {
  const navigate = useNavigate();
  useScrollLock(true);

  const [formData, setFormData] = useState<RSVPFormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    contactMethod: 'whatsapp',
    guests: [],
    notes: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Drag-to-dismiss handlers
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 150) {
      onClose();
    } else {
      setDragY(0);
    }
  }, [dragY, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleDragEnd();

  const submitMutation = useMutation<RSVPResponse, Error, RSVPFormData>({
    mutationFn: (data) => api.rsvp.submit(slug, data),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    submitMutation.mutate(formData);
  };

  const updateField = <K extends keyof RSVPFormData>(field: K, value: RSVPFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setContactMethod = (method: ContactMethod) => {
    setFormData((prev) => ({
      ...prev,
      contactMethod: method,
      phoneNumber: method === 'email' ? '' : prev.phoneNumber,
      email: method === 'whatsapp' ? '' : prev.email,
    }));
  };

  const addGuest = () => {
    const guests = formData.guests ?? [];
    if (guests.length >= 3) return;
    updateField('guests', [...guests, { nameHint: '' }]);
  };

  const removeGuest = (idx: number) => {
    const guests = (formData.guests ?? []).filter((_, i) => i !== idx);
    updateField('guests', guests);
  };

  const updateGuest = (idx: number, nameHint: string) => {
    const guests = (formData.guests ?? []).map((g, i) =>
      i === idx ? { nameHint } : g
    );
    updateField('guests', guests);
  };

  const contactValue =
    formData.contactMethod === 'whatsapp'
      ? formData.phoneNumber ?? ''
      : formData.email ?? '';

  const isValid =
    formData.fullName.trim().length > 0 && contactValue.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Request your seat"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tea-text/80 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[calc(100dvh-44px-env(safe-area-inset-bottom,0px))] md:max-h-[85vh] overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className="w-10 h-1 bg-tea-text-sec/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border shrink-0">
          <h2 className="font-serif text-xl text-tea-text">Request Your Seat</h2>
          <button
            onClick={onClose}
            className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.5s_ease-out]">
              <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-serif text-tea-gold">茶</span>
              </div>
              <h3 className="font-serif text-2xl text-tea-text mb-3 text-center">Request received.</h3>
              <p className="text-sm text-tea-text-sec text-center max-w-xs leading-relaxed">
                We'll be in touch shortly to confirm your seat.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Full Name */}
              <div>
                <label
                  htmlFor="rsvp-name"
                  className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2"
                >
                  Your name
                </label>
                <input
                  id="rsvp-name"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* Contact Method Toggle + Input */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  How should we reach you?
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setContactMethod('whatsapp')}
                    className={`flex-1 py-2.5 rounded-sm text-xs uppercase tracking-[0.15em] transition-all duration-200 ${
                      formData.contactMethod === 'whatsapp'
                        ? 'bg-tea-gold text-white'
                        : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
                    }`}
                  >
                    WhatsApp / Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMethod('email')}
                    className={`flex-1 py-2.5 rounded-sm text-xs uppercase tracking-[0.15em] transition-all duration-200 ${
                      formData.contactMethod === 'email'
                        ? 'bg-tea-gold text-white'
                        : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
                    }`}
                  >
                    Email
                  </button>
                </div>

                {formData.contactMethod === 'whatsapp' ? (
                  <div>
                    <input
                      id="rsvp-phone"
                      type="tel"
                      value={formData.phoneNumber ?? ''}
                      onChange={(e) => updateField('phoneNumber', e.target.value)}
                      placeholder="0912-345-678"
                      autoComplete="tel"
                      required
                      className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setContactMethod('email')}
                      className="mt-2 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
                    >
                      Don't have WhatsApp? Use email instead
                    </button>
                  </div>
                ) : (
                  <input
                    id="rsvp-email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    required
                    className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                  />
                )}
              </div>

              {/* Guest Requests */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-3">
                  Bringing anyone?
                </label>
                <div className="space-y-2">
                  {(formData.guests ?? []).map((guest, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 animate-[fadeIn_0.25s_ease-out]"
                    >
                      <span className="text-xs text-tea-text-sec shrink-0 w-14">
                        Guest {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={guest.nameHint}
                        onChange={(e) => updateGuest(idx, e.target.value)}
                        placeholder="e.g. my partner"
                        className="flex-1 px-3 py-2.5 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => removeGuest(idx)}
                        className="p-2 text-tea-text-sec hover:text-red-400 transition-colors"
                        aria-label={`Remove guest ${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {(formData.guests ?? []).length < 3 && (
                  <button
                    type="button"
                    onClick={addGuest}
                    className="mt-3 flex items-center gap-2 text-xs text-tea-text-sec hover:text-tea-gold transition-colors py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {(formData.guests ?? []).length === 0
                      ? 'Add a guest'
                      : 'Add another guest'}
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="rsvp-notes"
                  className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2"
                >
                  Anything we should know?{' '}
                  <span className="normal-case tracking-normal text-tea-text-sec/70">(optional)</span>
                </label>
                <textarea
                  id="rsvp-notes"
                  value={formData.notes ?? ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Dietary restrictions, questions, anything…"
                  rows={3}
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/40 focus:outline-none focus:border-tea-gold/50 transition-colors resize-none"
                />
              </div>

              {/* Error message */}
              {submitMutation.isError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-sm">
                  <p className="text-sm text-red-400">
                    {submitMutation.error?.message || 'Something went wrong. Please try again.'}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid || submitMutation.isPending}
                className="w-full py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
              >
                {submitMutation.isPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
                ) : (
                  'Request My Seat'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default RSVPFormSheet;
