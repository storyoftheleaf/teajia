import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useScrollLock } from '../../hooks/useScrollLock';

interface FindRSVPSheetProps {
  slug: string;
  onClose: () => void;
}

const FindRSVPSheet: React.FC<FindRSVPSheetProps> = ({ slug, onClose }) => {
  const navigate = useNavigate();
  useScrollLock(true);

  const [phone, setPhone] = useState('');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Drag-to-dismiss
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

  const findMutation = useMutation<{ magicToken: string }, Error, string>({
    mutationFn: (phoneNumber) => api.rsvp.findByPhone(slug, phoneNumber),
    onSuccess: (result) => {
      navigate(`/m/${result.magicToken}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    findMutation.mutate(phone.trim());
  };

  return (
    <div
      className="fixed inset-0 z-modal animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-tea-text/80 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:rounded-lg bg-tea-bg border-t border-tea-border md:border rounded-t-2xl md:rounded-2xl shadow-2xl animate-[slideUp_0.3s_ease-out]"
        style={{ transform: `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab md:hidden"
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={() => handleDragEnd()}
        >
          <div className="w-10 h-1 bg-tea-text-dim/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border/50">
          <h2 className="font-serif text-xl text-tea-text">Find My RSVP</h2>
          <button
            onClick={onClose}
            className="p-2 text-tea-text-dim hover:text-tea-gold transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-sm text-tea-text-sec mb-5">
            Enter the phone number you used to RSVP and we'll find your reservation.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-tea-text-dim mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812 3456 7890"
                autoFocus
                className="w-full px-4 py-3 bg-tea-surface border border-tea-border rounded-sm text-tea-text text-sm placeholder:text-tea-text-dim/50 focus:outline-none focus:border-tea-gold/50 transition-colors"
              />
            </div>

            {findMutation.isError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-sm">
                <p className="text-sm text-red-400">
                  {findMutation.error?.message || 'No reservation found with that number.'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!phone.trim() || findMutation.isPending}
              className="w-full py-4 bg-tea-gold text-white text-xs uppercase tracking-[0.25em] font-semibold rounded-sm hover:bg-tea-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
            >
              {findMutation.isPending ? (
                <span className="inline-block w-4 h-4 border-2 border-tea-gold/30 border-t-tea-gold rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Find My RSVP
                </>
              )}
            </button>
          </form>
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

export default FindRSVPSheet;
