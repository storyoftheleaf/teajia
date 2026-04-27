import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { ContactMethod } from '../../types/events';

interface VerifySheetProps {
  onClose: () => void;
  onVerified: (contact: string, sessionToken: string) => void;
  /** If provided, shown as contextual hint */
  purpose?: 'journey' | 'find-ticket';
}

const VerifySheet: React.FC<VerifySheetProps> = ({ onClose, onVerified, purpose = 'journey' }) => {
  useScrollLock(true);

  const [step, setStep] = useState<'contact' | 'code'>('contact');
  const [method, setMethod] = useState<ContactMethod>('whatsapp');
  const [contact, setContact] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

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
    mutationFn: () => api.verify.requestCode(contact.trim(), method),
    onSuccess: () => setStep('code'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.verify.confirmCode(contact.trim(), codeDigits.join('')),
    onSuccess: (data: any) => {
      onVerified(contact.trim(), data.sessionToken ?? '');
    },
  });

  const handleCodeInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...codeDigits];
    next[idx] = digit;
    setCodeDigits(next);
    if (digit && idx < 5) {
      codeRefs.current[idx + 1]?.focus();
    }
    // Auto-submit when last digit entered
    if (digit && idx === 5) {
      const full = next.join('');
      if (full.length === 6) {
        confirmMutation.mutate();
      }
    }
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const purposeLabel = purpose === 'find-ticket' ? 'to find your ticket' : 'to view your journey';
  const isContactValid = contact.trim().length > 3;
  const isCodeComplete = codeDigits.every(Boolean);

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-md bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 bg-tea-text-sec/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border">
          <h2 className="font-serif text-xl text-tea-text">Verify Identity</h2>
          <button onClick={onClose} className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">
          <p className="text-sm text-tea-text-sec leading-relaxed">
            Enter your phone or email {purposeLabel}. We'll send a short code.
          </p>

          {step === 'contact' && (
            <>
              {/* Method toggle */}
              <div className="flex gap-2">
                {(['whatsapp', 'email'] as ContactMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex-1 py-2.5 text-xs uppercase tracking-[0.15em] rounded-sm transition-colors ${
                      method === m
                        ? 'bg-tea-gold/10 text-tea-gold'
                        : 'bg-tea-surface text-tea-text-sec hover:text-tea-text border border-tea-border'
                    }`}
                  >
                    {m === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </button>
                ))}
              </div>

              <input
                type={method === 'email' ? 'email' : 'tel'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={method === 'email' ? 'your@email.com' : '0912-345-678'}
                autoFocus
                className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
                onKeyDown={(e) => { if (e.key === 'Enter' && isContactValid) requestMutation.mutate(); }}
              />

              {requestMutation.isError && (
                <p className="text-sm text-red-400">
                  {(requestMutation.error as Error)?.message || 'Could not send code. Try again.'}
                </p>
              )}

              <button
                type="button"
                disabled={!isContactValid || requestMutation.isPending}
                onClick={() => requestMutation.mutate()}
                className="w-full py-3.5 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.2em] rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {requestMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
                ) : (
                  'Send Code'
                )}
              </button>
            </>
          )}

          {step === 'code' && (
            <>
              <p className="text-sm text-tea-text-sec">
                Code sent to <span className="text-tea-text">{contact}</span>.
                <button onClick={() => setStep('contact')} className="ml-2 text-tea-gold hover:text-tea-gold/80 transition-colors">
                  Change
                </button>
              </p>

              {/* 6-digit code inputs */}
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
                    className="w-11 h-14 text-center bg-tea-surface border border-tea-border rounded-sm text-tea-text text-xl font-serif focus:outline-none focus:border-tea-gold transition-colors"
                    autoFocus={idx === 0}
                    aria-label={`Code digit ${idx + 1}`}
                  />
                ))}
              </div>

              {confirmMutation.isError && (
                <p className="text-sm text-red-400 text-center">
                  {(confirmMutation.error as Error)?.message || 'Incorrect code. Please try again.'}
                </p>
              )}

              <button
                type="button"
                disabled={!isCodeComplete || confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
                className="w-full py-3.5 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.2em] rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {confirmMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
                ) : (
                  'Verify'
                )}
              </button>
            </>
          )}
        </div>

        {/* Bottom safe-area padding */}
        <div className="pb-[env(safe-area-inset-bottom,0px)]" />
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

export default VerifySheet;
