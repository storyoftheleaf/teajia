import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, LogIn } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useAuth } from '../../hooks/useAuth';
import type { RSVPFormData, ContactMethod, RSVPResponse } from '../../types/events';

interface RSVPFormSheetProps {
  slug: string;
  onClose: () => void;
  accountLocationCountry?: string;
  requiresApproval?: boolean;
}

const RSVPFormSheet: React.FC<RSVPFormSheetProps> = ({ slug, onClose, accountLocationCountry, requiresApproval = true }) => {
  const { user, isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  useScrollLock(true);

  // Parse saved phone into dial code + local number
  const parseSavedPhone = (phone?: string | null) => {
    if (!phone) return { dialCode: '', local: '' };
    const match = phone.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) return { dialCode: match[1], local: match[2] };
    return { dialCode: '', local: phone };
  };

  const savedPhone = parseSavedPhone(user?.phone);
  const defaultContact = (user?.phone) ? 'whatsapp' : user ? 'email' : 'whatsapp';

  const [countryCode, setCountryCode] = useState(savedPhone.dialCode);
  const [localPhone, setLocalPhone] = useState(savedPhone.local);

  const [formData, setFormData] = useState<RSVPFormData>(() => ({
    fullName: user?.name ?? '',
    phoneNumber: '',
    email: user?.email ?? '',
    contactMethod: defaultContact,
    guests: [],
    notes: '',
  }));

  // Pre-fill when auth resolves after mount
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || user.name,
        email: prev.email || user.email,
        contactMethod: prev.contactMethod === 'whatsapp' && !prev.phoneNumber ? 'email' : prev.contactMethod,
      }));
    }
  }, [user?.email]);

  // Sync combined phone number whenever parts change
  useEffect(() => {
    if (formData.contactMethod === 'whatsapp') {
      setFormData(prev => ({ ...prev, phoneNumber: localPhone ? `${countryCode}${localPhone}` : '' }));
    }
  }, [countryCode, localPhone, formData.contactMethod]);

  // Whether the signed-in user wants to override their saved contact
  const [overrideContact, setOverrideContact] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Inline sign-in state
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    onSuccess: (response) => {
      // Persist magic token so returning visitors are detected on EventLanding
      // without having to re-enter their contact details.
      const token = response?.magicToken ?? (response as { magic_token?: string })?.magic_token;
      if (token) {
        try { localStorage.setItem(`teajia_rsvp_${slug}`, token); } catch { /* ignore quota / private mode */ }
      }
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

  const updateGuest = (idx: number, patch: Partial<{ nameHint: string; contact: string }>) => {
    const guests = (formData.guests ?? []).map((g, i) =>
      i === idx ? { ...g, ...patch } : g
    );
    updateField('guests', guests);
  };

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginPending(true);
    try {
      await login(loginIdentifier, loginPassword);
      setShowLoginForm(false);
    } catch {
      setLoginError('Incorrect email or password.');
    } finally {
      setLoginPending(false);
    }
  };

  const contactValue =
    formData.contactMethod === 'whatsapp'
      ? formData.phoneNumber ?? ''
      : formData.email ?? '';

  const isValid =
    formData.fullName.trim().length > 0 && contactValue.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={requiresApproval === false ? 'Reserve your seat' : 'Request your seat'}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-lg bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl h-[calc(100dvh-44px-env(safe-area-inset-bottom,0px))] md:h-auto md:max-h-[85vh] overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
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
          <h2 className="font-serif text-xl text-tea-text">{requiresApproval === false ? 'Reserve Your Seat' : 'Request Your Seat'}</h2>
          <button
            onClick={onClose}
            className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 pb-[calc(1.25rem+44px+env(safe-area-inset-bottom,0px)+env(keyboard-inset-height,0px))] lg:pb-6">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 animate-[fadeIn_0.5s_ease-out]">
              <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mb-6">
                <span className="text-2xl font-serif text-tea-gold">茶</span>
              </div>
              {requiresApproval === false ? (
                <>
                  <h3 className="font-serif text-2xl text-tea-text mb-3 text-center">You're confirmed.</h3>
                  <p className="text-sm text-tea-text-sec text-center max-w-xs leading-relaxed mb-2">
                    We've reserved your seat.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-2xl text-tea-text mb-3 text-center">Request received.</h3>
                  <p className="text-sm text-tea-text-sec text-center max-w-xs leading-relaxed mb-2">
                    {formData.contactMethod === 'whatsapp'
                      ? "We'll send you a WhatsApp message once your seat is confirmed."
                      : formData.contactMethod === 'email'
                      ? "We'll email you once your seat is confirmed."
                      : "We'll be in touch shortly to confirm your seat."}
                  </p>
                </>
              )}
              <p className="text-sm text-tea-text-sec text-center mb-6">See you at this event.</p>
              <p className="text-xs text-tea-text-sec text-center max-w-xs leading-relaxed mb-8 px-2">
                If your plans change, please let us know in advance. You can manage or cancel your RSVP at any time using the link in your confirmation message.
              </p>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['event-public', slug] });
                  onClose();
                }}
                className="w-full max-w-xs py-4 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 transition-all duration-300"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

              {/* Member banner / sign-in prompt */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-tea-gold/8 border border-tea-gold/20 rounded-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0" />
                  <p className="text-xs text-tea-text-sec">
                    Signed in as <span className="text-tea-text">{user.name}</span>
                  </p>
                </div>
              ) : showLoginForm ? (
                <div className="border border-tea-border rounded-sm p-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <p className="text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec">Sign in to your account</p>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Email or username"
                    autoComplete="username"
                    className="w-full px-3 py-2.5 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="w-full px-3 py-2.5 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                  />
                  {loginError && (
                    <p className="text-xs text-red-400">{loginError}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleInlineLogin}
                      disabled={loginPending || !loginIdentifier || !loginPassword}
                      className="flex-1 py-2 bg-tea-gold text-tea-bg text-xs uppercase tracking-display rounded-sm disabled:opacity-50 transition-colors hover:bg-tea-gold/90"
                    >
                      {loginPending ? 'Signing in…' : 'Sign in'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginForm(true)}
                  className="flex items-center gap-2 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Already a member? Sign in to pre-fill
                </button>
              )}

              {/* Full Name */}
              <div>
                <label
                  htmlFor="rsvp-name"
                  className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-2"
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

              {/* Contact Method — hidden if signed-in user already has contact saved */}
              {isAuthenticated && (user?.phone || user?.email) && !overrideContact ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-tea-surface border border-tea-border rounded-sm">
                  <span className="text-xs text-tea-text-sec truncate">
                    {user?.phone
                      ? <>We'll reach you on <span className="text-tea-text">WhatsApp</span> at <span className="text-tea-text">{user.phone}</span></>
                      : <>We'll reach you at <span className="text-tea-text">{user?.email}</span></>
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => setOverrideContact(true)}
                    className="text-ui-10 uppercase tracking-caps text-tea-text-sec hover:text-tea-gold transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                    How should we reach you?
                  </label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setContactMethod('whatsapp')}
                      className={`flex-1 py-2.5 rounded-sm text-xs uppercase tracking-caps transition-all duration-200 ${
                        formData.contactMethod === 'whatsapp'
                          ? 'bg-tea-gold text-tea-bg'
                          : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
                      }`}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactMethod('email')}
                      className={`flex-1 py-2.5 rounded-sm text-xs uppercase tracking-caps transition-all duration-200 ${
                        formData.contactMethod === 'email'
                          ? 'bg-tea-gold text-tea-bg'
                          : 'bg-tea-surface text-tea-text-sec border border-tea-border hover:border-tea-gold/30'
                      }`}
                    >
                      Email
                    </button>
                  </div>

                  {formData.contactMethod === 'whatsapp' ? (
                    <div>
                      <div className="flex gap-0 border border-tea-border rounded-sm overflow-hidden focus-within:border-tea-gold/50 transition-colors">
                        <input
                          type="tel"
                          value={countryCode}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^\d+]/g, '');
                            if (cleaned.length === 0) { setCountryCode(''); return; }
                            setCountryCode(cleaned.startsWith('+') ? cleaned : `+${cleaned}`);
                          }}
                          placeholder="+1"
                          autoComplete="tel-country-code"
                          aria-label="Country code"
                          className="bg-tea-surface text-tea-text text-sm px-3 py-3 border-r border-tea-border focus:outline-none shrink-0 w-[72px]"
                        />
                        <input
                          id="rsvp-phone"
                          type="tel"
                          value={localPhone}
                          onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="912 345 678"
                          autoComplete="tel-national"
                          required
                          className="flex-1 min-w-0 px-4 py-3 bg-tea-surface text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none"
                        />
                      </div>
                      <p className="mt-1.5 text-ui-10 text-tea-text-dim">Include the country code (we'll add the + for you)</p>
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
              )}

              {/* Guest Requests */}
              <div>
                <label className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-3">
                  Bringing anyone?
                </label>
                <div className="space-y-3">
                  {(formData.guests ?? []).map((guest, idx) => (
                    <div
                      key={idx}
                      className="border border-tea-border rounded-sm p-3 space-y-2 animate-[fadeIn_0.25s_ease-out]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-ui-10 uppercase tracking-display text-tea-text-sec shrink-0">
                          Guest {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={guest.nameHint}
                          onChange={(e) => updateGuest(idx, { nameHint: e.target.value })}
                          placeholder="e.g. my partner"
                          className="flex-1 px-3 py-2 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/40 focus:outline-none focus:border-tea-gold/50 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => removeGuest(idx)}
                          className="p-1.5 text-tea-text-sec hover:text-red-400 transition-colors shrink-0"
                          aria-label={`Remove guest ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={guest.contact ?? ''}
                          onChange={(e) => updateGuest(idx, { contact: e.target.value })}
                          placeholder="Their WhatsApp or email (we'll reach out, or message you if we can't)"
                          className="w-full px-3 py-2 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/40 focus:outline-none focus:border-tea-gold/50 transition-colors"
                        />
                      </div>
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
                  className="block text-ui-10 uppercase tracking-[0.25em] text-tea-text-sec mb-2"
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

              {/* Guest list opt-in */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!formData.show_in_guest_list}
                  onChange={(e) => updateField('show_in_guest_list', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-sm border border-tea-border bg-tea-surface accent-tea-gold cursor-pointer"
                />
                <span className="text-xs text-tea-text-sec leading-relaxed group-hover:text-tea-text transition-colors">
                  Show my first name to other confirmed guests
                  <span className="block text-ui-10 text-tea-text-dim mt-0.5">So people can see who's coming</span>
                </span>
              </label>

              {/* Error */}
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
                className="w-full py-4 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
              >
                {submitMutation.isPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
                ) : requiresApproval === false ? (
                  'Reserve My Seat'
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
