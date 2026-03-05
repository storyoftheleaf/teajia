
import React, { useState, useEffect, useRef } from 'react';
import { Icons, SealIcon } from '../Icons';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface AccountPanelProps {
  onClose: () => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ onClose }) => {
  const { theme, toggleTheme } = useTheme();
  useScrollLock(true);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  // Store trigger element for focus restoration on close (#14)
  const triggerRef = useRef<HTMLElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [progressCount, setProgressCount] = useState(0);

  // Swipe to dismiss state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Save trigger and animate in on mount (#14)
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => setIsVisible(true));
    return () => {
      // Restore focus when panel unmounts
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Read localStorage stats on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('teajia_cart');
      if (saved) setCartCount(JSON.parse(saved).length);
    } catch {}

    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('teajia_progress_')) count++;
    }
    setProgressCount(count);
  }, []);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const offset = e.touches[0].clientX - touchStart;
    if (offset > 0) setTouchOffset(offset);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    if (touchOffset > 150) onClose();
    setTouchStart(null);
    setTouchOffset(0);
    setIsDragging(false);
  };

  const handleOpenCart = () => {
    onClose();
    setTimeout(() => window.dispatchEvent(new Event('openCart')), 50);
  };

  const swipeProgress = touchOffset / 150;
  const swipeOpacity = Math.max(0.3, 1 - swipeProgress * 0.7);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-[#F3F0E7] dark:bg-[#1a1a1a] z-[100] shadow-2xl flex flex-col"
        style={{
          transform: isVisible ? `translateX(${touchOffset}px)` : 'translateX(100%)',
          opacity: isDragging ? swipeOpacity : 1,
          transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex flex-col">
          {/* Mobile drag handle */}
          <div className="md:hidden flex flex-col items-center py-3 gap-1 bg-[#E6E2D6] dark:bg-[#242424]">
            <div className={`h-1 rounded-full transition-all duration-150 ${
              isDragging ? 'bg-tea-seal w-16' : 'bg-tea-charcoal/20 dark:bg-white/20 w-12'
            }`} />
            <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/30 dark:text-white/20">Swipe to close</span>
          </div>

          <div className="flex items-center justify-center p-6 border-b border-tea-charcoal/10 dark:border-white/10 bg-[#E6E2D6] dark:bg-[#242424] relative">
            <button
              onClick={onClose}
              className="absolute left-6 min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5"
            >
              <Icons.Close className="w-6 h-6 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors" />
            </button>
            <h2 className="text-lg font-serif text-tea-charcoal dark:text-white tracking-wide">Account</h2>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {/* Paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.1] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />

          <div className="space-y-8 relative z-10">

            {/* Profile Header */}
            <div className="flex flex-col items-center pt-4 pb-2">
              <div className="w-20 h-20 rounded-full bg-tea-charcoal/5 dark:bg-white/10 flex items-center justify-center mb-4">
                <Icons.User className="w-8 h-8 text-tea-charcoal/30 dark:text-white/30" />
              </div>
              <h3 className="font-serif text-xl text-tea-charcoal dark:text-white">Tea Enthusiast</h3>
              <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mt-1">Guest</span>
            </div>

            {/* Activity Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-4 flex flex-col items-center gap-2">
                <Icons.Bag className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40" />
                <span className="font-mono text-2xl text-tea-charcoal dark:text-white">{cartCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">Cart Items</span>
              </div>
              <div className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-4 flex flex-col items-center gap-2">
                <Icons.BookOpen className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40" />
                <span className="font-mono text-2xl text-tea-charcoal dark:text-white">{progressCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">Read</span>
              </div>
            </div>

            {/* Theme Toggle */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Appearance</span>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-4 py-4 bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {theme === 'light' ? (
                    <Icons.Sun className="w-5 h-5 text-tea-seal" />
                  ) : (
                    <Icons.Moon className="w-5 h-5 text-tea-seal" />
                  )}
                  <span className="font-serif text-sm text-tea-charcoal dark:text-white">
                    {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${theme === 'dark' ? 'bg-tea-seal' : 'bg-tea-charcoal/20'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>

            {/* Quick Actions */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Quick Actions</span>
              <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
                <button
                  onClick={handleOpenCart}
                  className="w-full flex items-center gap-4 px-4 py-4 border-b border-tea-charcoal/5 dark:border-white/5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                >
                  <Icons.Bag className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40 group-hover:text-tea-seal transition-colors" />
                  <span className="text-sm font-serif text-tea-charcoal dark:text-white">Open Cart</span>
                  {cartCount > 0 && (
                    <span className="text-xs font-mono text-tea-seal">{cartCount}</span>
                  )}
                  <Icons.ChevronRight className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20 ml-auto" />
                </button>

                <a
                  href="mailto:hello@teajia.com"
                  className="w-full flex items-center gap-4 px-4 py-4 border-b border-tea-charcoal/5 dark:border-white/5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                >
                  <Icons.Mail className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40 group-hover:text-tea-seal transition-colors" />
                  <span className="text-sm font-serif text-tea-charcoal dark:text-white">Contact Us</span>
                  <Icons.ChevronRight className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20 ml-auto" />
                </a>

                <a
                  href="https://instagram.com/teajia.journal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                >
                  <Icons.Instagram className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40 group-hover:text-tea-seal transition-colors" />
                  <span className="text-sm font-serif text-tea-charcoal dark:text-white">@teajia.journal</span>
                  <Icons.ExternalLink className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20 ml-auto" />
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-tea-charcoal/10 dark:border-white/10 bg-[#E6E2D6] dark:bg-[#242424] flex flex-col items-center gap-2">
          <SealIcon className="w-6 h-6 text-tea-seal opacity-60" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-tea-charcoal/40 dark:text-white/40">Teajia</span>
        </div>
      </div>
    </>
  );
};
