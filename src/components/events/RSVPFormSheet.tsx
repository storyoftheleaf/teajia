import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { RSVPFormData, TeaPreference, RSVPResponse } from '../../types/events';

interface RSVPFormSheetProps {
  slug: string;
  onClose: () => void;
}

const TEA_PREFERENCES: { id: TeaPreference; label: string; emoji: string }[] = [
  { id: 'light_floral', label: 'Light & Floral', emoji: '\u{1F338}' },
  { id: 'rich_roasted', label: 'Rich & Roasted', emoji: '\u{1F525}' },
  { id: 'aged_earthy', label: 'Aged & Earthy', emoji: '\u{1FAB4}' },
  { id: 'surprise_me', label: 'Surprise me!', emoji: '\u{2728}' },
];

const RSVPFormSheet: React.FC<RSVPFormSheetProps> = ({ slug, onClose }) => {
  const navigate = useNavigate();
  useScrollLock(true);

  const [formData, setFormData] = useState<RSVPFormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    plusOne: false,
    plusOneName: '',
    teaPreference: undefined,
    bringingTea: '',
    photoConsent: false,
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
    onSuccess: (result) => {
      setSubmitted(true);
      setTimeout(() => {
        navigate(`/m/${result.magicToken}`);
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phoneNumber.trim()) return;
    submitMutation.mutate(formData);
  };

  const updateField = <K extends keyof RSVPFormData>(field: K, value: RSVPFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = formData.fullName.trim().length > 0 && formData.phoneNumber.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tea-text/80 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:rounded-lg bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] md:max-h-[85vh] overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-tea-text-sec/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border/50">
          <h2 className="font-serif text-xl text-tea-text">Reserve Your Seat</h2>
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
            <div className="flex flex-col items-center justify-center py-12 animate-[fadeIn_0.5s_ease-out]">
              <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-6 animate-[scaleIn_0.5s_ease-out]">
                <Check className="w-8 h-8 text-tea-gold" />
              </div>
              <h3 className="font-serif text-2xl text-tea-text mb-2">You're In</h3>
              <p className="text-sm text-tea-text-sec text-center max-w-xs">
                Your seat has been reserved. Redirecting to your personal event page...
              </p>
              <div className="mt-6 w-32 h-0.5 bg-tea-border rounded-full overflow-hidden">
                <div className="h-full bg-tea-gold animate-[fillBar_2s_ease-in-out]" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  Full Name <span className="text-tea-gold">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  WhatsApp / Phone <span className="text-tea-gold">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                  placeholder="+62 812 3456 7890"
                  required
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  Email <span className="text-tea-text-sec">(for calendar invite)</span>
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* +1 Toggle */}
              <div className="bg-tea-surface border border-tea-border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-tea-text font-medium">Bringing a +1?</p>
                    <p className="text-xs text-tea-text-sec mt-0.5">Reserve a second seat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('plusOne', !formData.plusOne)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                      formData.plusOne ? 'bg-tea-gold' : 'bg-tea-text-sec/20'
                    }`}
                    aria-label="Toggle plus one"
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                        formData.plusOne ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
                {formData.plusOne && (
                  <div className="mt-3 animate-[fadeIn_0.3s_ease-out]">
                    <input
                      type="text"
                      value={formData.plusOneName || ''}
                      onChange={(e) => updateField('plusOneName', e.target.value)}
                      placeholder="Guest's name"
                      className="w-full px-4 py-3 bg-tea-bg border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Tea Preference */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-3">
                  Tea Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TEA_PREFERENCES.map((pref) => (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() =>
                        updateField(
                          'teaPreference',
                          formData.teaPreference === pref.id ? undefined : pref.id
                        )
                      }
                      className={`px-3 py-2.5 rounded-sm text-xs text-left transition-all duration-200 border ${
                        formData.teaPreference === pref.id
                          ? 'bg-tea-gold/10 border-tea-gold/40 text-tea-gold'
                          : 'bg-tea-surface border-tea-border text-tea-text-sec hover:border-tea-gold/20'
                      }`}
                    >
                      <span className="mr-1.5">{pref.emoji}</span>
                      {pref.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bringing tea? */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  Bringing tea to share? <span className="text-tea-text-sec">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.bringingTea || ''}
                  onChange={(e) => updateField('bringingTea', e.target.value)}
                  placeholder="e.g. 2005 Aged Oolong from Nantou"
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                />
              </div>

              {/* Photo consent */}
              <div className="flex items-start gap-3 bg-tea-surface border border-tea-border rounded-md p-4">
                <button
                  type="button"
                  onClick={() => updateField('photoConsent', !formData.photoConsent)}
                  className={`mt-0.5 w-5 h-5 rounded-sm border shrink-0 flex items-center justify-center transition-all duration-200 ${
                    formData.photoConsent
                      ? 'bg-tea-gold border-tea-gold'
                      : 'border-tea-border hover:border-tea-gold/40'
                  }`}
                  aria-label="Toggle photo consent"
                >
                  {formData.photoConsent && <Check className="w-3 h-3 text-white" />}
                </button>
                <div>
                  <p className="text-sm text-tea-text">I'm okay with photos being shared</p>
                  <p className="text-xs text-tea-text-sec mt-0.5">Photos may be posted on social media or our website</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  Notes <span className="text-tea-text-sec">(optional)</span>
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Anything we should know? Dietary restrictions, allergies..."
                  rows={3}
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors resize-none"
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
                  <span className="inline-block w-4 h-4 border-2 border-tea-gold/30 border-t-tea-gold rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Confirm My Seat
                  </>
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
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fillBar {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default RSVPFormSheet;
