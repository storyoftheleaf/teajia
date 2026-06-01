import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, LogIn } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_URL } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
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
  const formRef = useRef<HTMLFormElement>(null);

  // Focus trap on the dialog/sheet container. Merged with sheetRef via callback ref.
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  const setSheetRef = useCallback((node: HTMLDivElement | null) => {
    sheetRef.current = node;
    (focusTrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [focusTrapRef]);

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
    if (!isValid) {
      // Focus the first invalid required field so the failure is discoverable.
      const invalid = formRef.current?.querySelector<HTMLElement>(
        'input[aria-required="true"][aria-invalid="true"]'
      );
      invalid?.focus();
      return;
    }
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

  const handleInlineLogin = async (e: { preventDefault: () => void }) => {
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

  const sheetTitle = requiresApproval === false ? 'Reserve your seat' : 'Request your seat';
  const inputClass =
    'w-full px-3 py-2.5 bg-tea-bg border border-tea-border rounded-md text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50 transition-colors';

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={sheetTitle}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        ref={setSheetRef}
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-lg bg-tea-surface border-t border-tea-border md:border md:border-tea-border rounded-t-xl md:rounded-xl shadow-2xl h-[calc(100dvh-44px-env(safe-area-inset-bottom,0px))] md:h-auto md:max-h-[85vh] overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col"
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
          <div className="w-10 h-1 bg-tea-border rounded-full" />
        </div>

        {/* Header — close X top-LEFT for sheet/drawer (§15) */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-tea-border shrink-0">
          <button
            onClick={onClose}
            className="tap-target shrink-0 p-1.5 -ml-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="h3 flex-1 truncate">{sheetTitle}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+64px+env(safe-area-inset-bottom,0px)+env(keyboard-inset-height,0px))] lg:pb-6">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 animate-[fadeIn_0.5s_ease-out]">
              <div className="w-14 h-14 rounded-full bg-tea-gold/10 flex items-center justify-center mb-6">
                <span
                  className="text-ui-26 text-tea-gold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  茶
                </span>
              </div>
              {requiresApproval === false ? (
                <>
                  <h3 className="h2 mb-3 text-center">You're confirmed.</h3>
                  <p className="body-light text-center max-w-xs mb-2">
                    We've reserved your seat.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="h2 mb-3 text-center">Request received.</h3>
                  <p className="body-light text-center max-w-xs mb-2">
                    {formData.contactMethod === 'whatsapp'
                      ? "We'll send you a WhatsApp message once your seat is confirmed."
                      : formData.contactMethod === 'email'
                      ? "We'll email you once your seat is confirmed."
                      : "We'll be in touch shortly to confirm your seat."}
                  </p>
                </>
              )}
              <p className="body-light text-center mb-6">See you at this event.</p>
              <p className="text-ui-12 text-tea-text-dim text-center max-w-xs leading-relaxed mb-8 px-2">
                If your plans change, please let us know in advance. You can manage or cancel your RSVP at any time using the link in your confirmation message.
              </p>
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['event-public', slug] });
                  onClose();
                }}
                className="w-full max-w-xs inline-flex items-center justify-center px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>

              {/* Member banner / sign-in prompt */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-tea-gold/8 border border-tea-gold/20 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0" />
                  <p className="text-ui-12 text-tea-text-sec">
                    Signed in as <span className="text-tea-text">{user.name}</span>
                  </p>
                </div>
              ) : showLoginForm ? (
                <div className="border border-tea-border rounded-md p-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <p className="label-caps">Sign in to your account</p>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Email or username"
                    autoComplete="username"
                    className={inputClass}
                  />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Prevent the outer RSVP form from submitting; run the
                        // inline login instead.
                        e.preventDefault();
                        if (loginIdentifier && loginPassword && !loginPending) {
                          handleInlineLogin(e);
                        }
                      }
                    }}
                    placeholder="Password"
                    autoComplete="current-password"
                    className={inputClass}
                  />
                  {loginError && (
                    <p className="text-ui-12 text-tea-error">{loginError}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowLoginForm(false)}
                      className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleInlineLogin}
                      disabled={loginPending || !loginIdentifier || !loginPassword}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold disabled:opacity-50 transition-colors hover:bg-tea-gold/90"
                    >
                      {loginPending ? 'Signing in…' : 'Sign in'}
                    </button>
                  </div>
                  {API_URL && (
                    <div className="pt-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-px bg-tea-border" />
                        <span className="text-ui-11 uppercase tracking-[0.22em] text-tea-text-dim">Or</span>
                        <div className="flex-1 h-px bg-tea-border" />
                      </div>
                      <a
                        href={`${API_URL}/api/auth/google?return=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                        className="w-full flex items-center justify-center gap-3 py-2.5 bg-tea-surface rounded-md border border-tea-border text-tea-text-sec text-ui-14 hover:text-tea-text hover:bg-tea-elevated transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginForm(true)}
                  className="inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Already a member? Sign in to pre-fill
                </button>
              )}

              {/* Full Name */}
              <div>
                <label htmlFor="rsvp-name" className="label-caps block mb-2">
                  Your name
                  <span aria-hidden="true" className="text-tea-gold"> *</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <input
                  id="rsvp-name"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={formData.fullName.trim().length === 0}
                  className={inputClass}
                />
              </div>

              {/* Contact Method — hidden if signed-in user already has contact saved */}
              {isAuthenticated && (user?.phone || user?.email) && !overrideContact ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-tea-bg border border-tea-border rounded-md">
                  <span className="text-ui-12 text-tea-text-sec truncate">
                    {user?.phone
                      ? <>We'll reach you on <span className="text-tea-text">WhatsApp</span> at <span className="text-tea-text">{user.phone}</span></>
                      : <>We'll reach you at <span className="text-tea-text">{user?.email}</span></>
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => setOverrideContact(true)}
                    className="label-caps text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <label className="label-caps block mb-2">
                    How should we reach you?
                    <span aria-hidden="true" className="text-tea-gold"> *</span>
                    <span className="sr-only"> (required)</span>
                  </label>
                  {/* Method toggle — underline tabs */}
                  <div className="flex gap-6 border-b border-tea-border mb-3">
                    {(['whatsapp', 'email'] as ContactMethod[]).map((m) => {
                      const isActive = formData.contactMethod === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setContactMethod(m)}
                          className={`relative -mb-px pb-2 pt-1 transition-colors ${
                            isActive ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                          }`}
                        >
                          <span className="text-ui-12 font-semibold">
                            {m === 'whatsapp' ? 'WhatsApp' : 'Email'}
                          </span>
                          <span
                            className={`absolute left-0 right-0 -bottom-px h-px transition-colors ${
                              isActive ? 'bg-tea-gold' : 'bg-transparent'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {formData.contactMethod === 'whatsapp' ? (
                    <div>
                      <div className="flex gap-0 border border-tea-border rounded-md overflow-hidden focus-within:border-tea-gold/50 transition-colors">
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
                          className="bg-tea-bg text-tea-text text-ui-14 px-3 py-2.5 border-r border-tea-border focus:outline-none shrink-0 w-[72px]"
                        />
                        <input
                          id="rsvp-phone"
                          type="tel"
                          value={localPhone}
                          onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="912 345 678"
                          autoComplete="tel-national"
                          required
                          aria-required="true"
                          aria-invalid={contactValue.trim().length === 0}
                          aria-label="WhatsApp number"
                          className="flex-1 min-w-0 px-3 py-2.5 bg-tea-bg text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none"
                        />
                      </div>
                      <p className="mt-1.5 text-ui-10 text-tea-text-dim">Include the country code (we'll add the + for you)</p>
                      <button
                        type="button"
                        onClick={() => setContactMethod('email')}
                        className="mt-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
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
                      aria-required="true"
                      aria-invalid={contactValue.trim().length === 0}
                      aria-label="Email address"
                      className={inputClass}
                    />
                  )}
                </div>
              )}

              {/* Guest Requests */}
              <div>
                <label className="label-caps block mb-3">
                  Bringing anyone?
                </label>
                <div className="space-y-3">
                  {(formData.guests ?? []).map((guest, idx) => (
                    <div
                      key={idx}
                      className="border border-tea-border rounded-md p-3 space-y-2 animate-[fadeIn_0.25s_ease-out]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="label-caps shrink-0">
                          Guest {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={guest.nameHint}
                          onChange={(e) => updateGuest(idx, { nameHint: e.target.value })}
                          placeholder="e.g. my partner"
                          aria-label={`Guest ${idx + 1} name`}
                          className={inputClass + ' flex-1'}
                        />
                        <button
                          type="button"
                          onClick={() => removeGuest(idx)}
                          className="tap-target p-1.5 text-tea-text-sec hover:text-tea-error transition-colors shrink-0"
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
                          aria-label={`Guest ${idx + 1} contact`}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {(formData.guests ?? []).length < 3 && (
                  <button
                    type="button"
                    onClick={addGuest}
                    className="mt-3 inline-flex items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors py-1"
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
                <label htmlFor="rsvp-notes" className="label-caps block mb-2">
                  Anything we should know?{' '}
                  <span className="normal-case tracking-normal text-tea-text-dim">(optional)</span>
                </label>
                <textarea
                  id="rsvp-notes"
                  value={formData.notes ?? ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Dietary restrictions, questions, anything…"
                  rows={3}
                  className={inputClass + ' resize-none'}
                />
              </div>

              {/* Guest list opt-in */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!formData.show_in_guest_list}
                  onChange={(e) => updateField('show_in_guest_list', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-md border border-tea-border bg-tea-bg accent-tea-gold cursor-pointer"
                />
                <span className="text-ui-12 text-tea-text-sec leading-relaxed group-hover:text-tea-text transition-colors">
                  Show my first name to other confirmed guests
                  <span className="block text-ui-10 text-tea-text-dim mt-0.5">So people can see who's coming</span>
                </span>
              </label>

              {/* Error */}
              {submitMutation.isError && (
                <div role="alert" className="p-3 bg-tea-error/10 border border-tea-error/20 rounded-md">
                  <p className="text-ui-12 text-tea-error">
                    {submitMutation.error?.message || 'Something went wrong. Please try again.'}
                  </p>
                </div>
              )}

              {/* Footer — Cancel-left, primary-right */}
              <div className="flex justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || submitMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[180px]"
                >
                  {submitMutation.isPending ? (
                    <span className="inline-block w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
                  ) : requiresApproval === false ? (
                    'Reserve my seat'
                  ) : (
                    'Request my seat'
                  )}
                </button>
              </div>
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
