import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';
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
    ...(isAuthenticated ? [{ id: 'account' as LookupMethod, label: 'My Account' }] : []),
    { id: 'phone', label: 'Phone' },
    { id: 'email', label: 'Email' },
  ];

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out] md:flex md:items-center md:justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full md:max-w-md bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl animate-[slideUp_0.3s_ease-out]"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={() => handleDragEnd()}
        >
          <div className="w-10 h-1 bg-tea-text-sec/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border">
          <h2 className="font-serif text-xl text-tea-text">Find My RSVP</h2>
          <button
            onClick={onClose}
            className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Method tabs */}
          {methods.length > 1 && (
            <div className="flex gap-2 mb-5">
              {methods.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMethod(id); setContact(''); findMutation.reset(); }}
                  className={`flex-1 py-2.5 text-xs uppercase tracking-[0.15em] rounded-sm transition-colors ${
                    method === id
                      ? 'bg-tea-gold/10 text-tea-gold'
                      : 'bg-tea-surface text-tea-text-sec hover:text-tea-text border border-tea-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {method === 'account' ? (
              <p className="text-sm text-tea-text-sec">
                Looking up RSVP for{' '}
                <span className="text-tea-text">{user?.name || user?.email}</span>.
              </p>
            ) : (
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-sec mb-2">
                  {method === 'phone' ? 'Phone Number' : 'Email Address'}
                </label>
                <input
                  type={method === 'email' ? 'email' : 'tel'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={method === 'email' ? 'your@email.com' : '+62 812 3456 7890'}
                  autoFocus
                  className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-sec/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold/50 transition-colors"
                />
              </div>
            )}

            {findMutation.isError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-sm">
                <p className="text-sm text-red-400">
                  {findMutation.error?.message || 'No reservation found.'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || findMutation.isPending}
              className="w-full py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
            >
              {findMutation.isPending ? (
                <span className="inline-block w-4 h-4 border-2 border-tea-border border-t-tea-gold rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Find My RSVP
                </>
              )}
            </button>
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
