import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';

interface FindRSVPSheetProps {
  slug: string;
  onClose: () => void;
}

type LookupMethod = 'phone' | 'email' | 'account';

const FindRSVPSheet: React.FC<FindRSVPSheetProps> = ({ slug, onClose }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  useScrollLock(true);

  const [method, setMethod] = useState<LookupMethod>(isAuthenticated ? 'account' : 'phone');
  const [contact, setContact] = useState('');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Focus trap on the sheet container.
  const sheetRef = useFocusTrap<HTMLDivElement>(true);

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

  const findMutation = useMutation<{ magic_token: string }, Error, void>({
    mutationFn: () => {
      if (method === 'account') return api.rsvp.findByAccount(slug);
      if (method === 'email') return api.rsvp.findByEmail(slug, contact.trim());
      return api.rsvp.findByPhone(slug, contact.trim());
    },
    onSuccess: (result) => {
      navigate(`/m/${result.magic_token}`);
    },
  });

  const canSubmit =
    method === 'account' ? isAuthenticated : contact.trim().length > 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    findMutation.mutate();
  };

  const methods: { id: LookupMethod; label: string }[] = [
    ...(isAuthenticated ? [{ id: 'account' as LookupMethod, label: 'My account' }] : []),
    { id: 'phone', label: 'Phone' },
    { id: 'email', label: 'Email' },
  ];

  const inputClass =
    'w-full px-3 py-2.5 bg-tea-bg border border-tea-border rounded-md text-tea-text text-ui-14 placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50 transition-colors';

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Find my RSVP"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-md bg-tea-surface border-t border-tea-border md:border md:border-tea-border rounded-t-xl md:rounded-xl shadow-2xl animate-[slideUp_0.3s_ease-out]"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={() => handleDragEnd()}
          aria-hidden="true"
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
          <h2 className="h3 flex-1 truncate">Find my RSVP</h2>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {/* Method tabs — underline style */}
          {methods.length > 1 && (
            <div className="flex gap-6 border-b border-tea-border mb-5">
              {methods.map(({ id, label }) => {
                const isActive = method === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setMethod(id); setContact(''); findMutation.reset(); }}
                    className={`relative -mb-px pb-2 pt-1 transition-colors ${
                      isActive ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                    }`}
                  >
                    <span className="text-ui-12 font-semibold">{label}</span>
                    <span
                      className={`absolute left-0 right-0 -bottom-px h-px transition-colors ${
                        isActive ? 'bg-tea-gold' : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {method === 'account' ? (
              <p className="body-light">
                Looking up RSVP for{' '}
                <span className="text-tea-text">{user?.name || user?.email}</span>.
              </p>
            ) : (
              <div>
                <label className="label-caps block mb-2">
                  {method === 'phone' ? 'Phone number' : 'Email address'}
                </label>
                <input
                  type={method === 'email' ? 'email' : 'tel'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={method === 'email' ? 'your@email.com' : '+62 812 3456 7890'}
                  autoFocus
                  className={inputClass}
                />
              </div>
            )}

            {findMutation.isError && (() => {
              const raw = findMutation.error?.message ?? '';
              const isNotFound = /not found|404/i.test(raw);
              const friendly = isNotFound
                ? "We couldn't find your reservation. Try searching by your other contact method, or message the host directly."
                : 'Something went wrong. Please try again.';
              return (
                <div role="alert" className="p-3 bg-tea-gold/8 border border-tea-gold/20 rounded-md">
                  <p className="text-ui-12 text-tea-text-sec leading-relaxed">{friendly}</p>
                </div>
              );
            })()}

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
                disabled={!canSubmit || findMutation.isPending}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {findMutation.isPending ? (
                  <span className="inline-block w-4 h-4 border-2 border-tea-bg/40 border-t-tea-bg rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Find my RSVP
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

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

export default FindRSVPSheet;
