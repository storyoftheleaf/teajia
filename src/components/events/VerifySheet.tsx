import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface VerifySheetProps {
  onClose: () => void;
  onVerified: (contact: string, sessionToken: string) => void;
  /** If provided, shown as contextual hint */
  purpose?: 'journey' | 'find-ticket';
}

const TOTAL_STEPS = 2;

const VerifySheet: React.FC<VerifySheetProps> = ({ onClose, onVerified, purpose = 'journey' }) => {
  useScrollLock(true);

  const [step, setStep] = useState<'contact' | 'code'>('contact');
  const [contact, setContact] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [completionError, setCompletionError] = useState('');
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragRef = useRef<HTMLDivElement>(null);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  // Merge the focus-trap ref and the drag-logic ref onto one element.
  const sheetRef = useCallback((node: HTMLDivElement | null) => {
    dragRef.current = node;
    (focusTrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [focusTrapRef]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Drag-to-dismiss
  const handleDragStart = useCallback((y: number) => { setIsDragging(true); dragStartY.current = y; }, []);
  const handleDragMove = useCallback((y: number) => {
    if (!isDragging) return;
    const d = y - dragStartY.current;
    if (d > 0) setDragY(d);
  }, [isDragging]);
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 120) onClose(); else setDragY(0);
  }, [dragY, onClose]);

  const requestMutation = useMutation({
    mutationFn: () => api.verify.requestCode(contact.trim(), 'event'),
    onSuccess: () => { setCompletionError(''); setStep('code'); },
  });

  const confirmMutation = useMutation({
    mutationFn: (submittedCode?: string) => api.verify.confirmCode(contact.trim(), submittedCode ?? codeDigits.join(''), 'event'),
    onSuccess: (data: any) => {
      const token = data.sessionToken ?? data.attendances?.[0]?.magic_token;
      if (!token) {
        setCompletionError("We couldn't find an event history for this email. Try another email or contact the tea house.");
        return;
      }
      setCompletionError('');
      onVerified(contact.trim(), token);
    },
  });

  const handleCodeInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...codeDigits];
    next[idx] = digit;
    setCodeDigits(next);
    setCompletionError('');
    if (digit && idx < 5) {
      codeRefs.current[idx + 1]?.focus();
    }
    // Auto-submit when last digit entered
    if (digit && idx === 5) {
      const full = next.join('');
      if (full.length === 6) {
        confirmMutation.mutate(full);
      }
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setCodeDigits(next);
    const lastFilled = Math.min(pasted.length, 6) - 1;
    codeRefs.current[lastFilled]?.focus();
    if (pasted.length === 6) confirmMutation.mutate(pasted);
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const purposeLabel = purpose === 'find-ticket' ? 'to find your ticket' : 'to view your journey';
  const isContactValid = contact.trim().length > 3;
  const isCodeComplete = codeDigits.every(Boolean);
  const currentStepNumber = step === 'contact' ? 1 : 2;
  const inputClass =
    'w-full px-3 py-2.5 bg-tea-bg border border-tea-border rounded-md text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50 transition-colors';

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Verify identity"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-md bg-tea-surface border-t border-tea-border md:border md:border-tea-border rounded-t-xl md:rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 bg-tea-border rounded-full" />
        </div>

        {/* Header — close X top-LEFT (§15) */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-tea-border">
          <button
            onClick={onClose}
            className="tap-target shrink-0 p-1.5 -ml-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="h3 flex-1 truncate">Verify identity</h2>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Stepper eyebrow */}
          <p className="label-caps text-tea-text-dim">
            Step {currentStepNumber} of {TOTAL_STEPS}
          </p>

          <p className="body-light">
            Enter your email {purposeLabel}. We'll send a short code.
          </p>

          {step === 'contact' && (
            <div key="step-contact" className="space-y-4 verify-step-enter">
              {/* Delivery method */}
              <div className="flex gap-6 border-b border-tea-border">
                <div className="relative -mb-px pb-2 pt-1 text-tea-text" aria-label="Delivery method: Email">
                  <span className="text-ui-12 font-semibold">Email</span>
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-tea-gold" />
                </div>
              </div>

              <div>
                <label className="label-caps block mb-2" htmlFor="verify-contact">
                  Email address
                </label>
                <input
                  id="verify-contact"
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="your@email.com"
                  autoFocus
                  aria-invalid={requestMutation.isError || undefined}
                  className={inputClass}
                  onKeyDown={(e) => { if (e.key === 'Enter' && isContactValid) requestMutation.mutate(); }}
                />
              </div>

              {requestMutation.isError && (
                <p role="alert" className="text-ui-12 text-tea-error">
                  {(requestMutation.error as Error)?.message || 'Could not send code. Try again.'}
                </p>
              )}

              {/* Footer — Cancel-left, primary-right */}
              <div className="flex justify-between items-center gap-3 pt-2 pb-nav-gap">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isContactValid || requestMutation.isPending}
                  onClick={() => requestMutation.mutate()}
                  className="inline-flex items-center justify-center px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[140px]"
                >
                  {requestMutation.isPending ? (
                    <span className="w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
                  ) : (
                    'Send code'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'code' && (
            <div key="step-code" className="space-y-4 verify-step-enter">
              <p className="body-light">
                Code sent to <span className="text-tea-text">{contact}</span>.
                <button
                  type="button"
                  onClick={() => { setCompletionError(''); setStep('contact'); }}
                  className="ml-2 text-tea-gold hover:text-tea-text transition-colors font-semibold"
                >
                  Change
                </button>
              </p>

              {/* 6-digit code inputs */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="label-caps block mb-3">
                  Verification code
                </legend>
                <div className="flex gap-2 justify-center">
                  {codeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { codeRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeInput(idx, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                      onPaste={handleCodePaste}
                      aria-invalid={confirmMutation.isError || undefined}
                      className="w-11 h-14 text-center bg-tea-bg border border-tea-border rounded-md text-tea-text text-ui-20 focus:outline-none focus:border-tea-gold transition-colors"
                      style={{ fontFamily: 'var(--font-display)' }}
                      autoFocus={idx === 0}
                      aria-label={`Code digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </fieldset>

              {confirmMutation.isError && (
                <p role="alert" className="text-ui-12 text-tea-error text-center">
                  {(confirmMutation.error as Error)?.message || 'Incorrect code. Please try again.'}
                </p>
              )}

              {completionError && (
                <div role="alert" className="rounded-md border border-tea-border bg-tea-bg p-3 text-center">
                  <p className="text-ui-12 text-tea-text-sec">{completionError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletionError('');
                      setContact('');
                      setCodeDigits(['', '', '', '', '', '']);
                      confirmMutation.reset();
                      requestMutation.reset();
                      setStep('contact');
                    }}
                    className="mt-3 min-h-11 px-3 text-ui-13 font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Try another email
                  </button>
                </div>
              )}

              {/* Footer — Cancel-left, primary-right */}
              <div className="flex justify-between items-center gap-3 pt-2 pb-nav-gap">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isCodeComplete || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(undefined)}
                  className="inline-flex items-center justify-center px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[140px]"
                >
                  {confirmMutation.isPending ? (
                    <span className="w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom safe-area padding */}
        <div className="pb-[env(safe-area-inset-bottom,0px)]" />
      </div>

      <style>{`
        @keyframes verifyStepIn {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .verify-step-enter {
          animation: verifyStepIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>
  );
};

export default VerifySheet;
