
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons, SealIcon } from '../Icons';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../lib/store';
import { MyCollection } from './MyCollection';
import { AdminMiniDashboard } from '../admin-overlay/AdminMiniDashboard';
import type { Currency } from '../../admin/types';

type PanelView = 'main' | 'signin' | 'signup' | 'collection' | 'saved-stories' | 'reading-history';

interface AccountPanelProps {
  onClose: () => void;
  onNavigateToStory?: (storyId: string) => void;
}

const CURRENCY_OPTIONS: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'NT', label: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'Yuan', label: 'Chinese Yuan', symbol: '\u00a5' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '\u00a5' },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp' },
];

export const AccountPanel: React.FC<AccountPanelProps> = ({ onClose, onNavigateToStory }) => {
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const { favoriteTeas, currency, setCurrency, publicCart } = useAppStore();
  useScrollLock(true);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('main');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Swipe to dismiss state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Derived stats
  const cartCount = publicCart.length;

  const progressCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('teajia_progress_')) count++;
    }
    return count;
  }, []);

  const savedStoryCount = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('teajia_saved_stories') || '{}');
      return Object.values(saved).filter(Boolean).length;
    } catch { return 0; }
  }, []);

  const savedStoryEntries = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('teajia_saved_stories') || '{}');
      return Object.entries(saved).filter(([, v]) => v).map(([id]) => id);
    } catch { return []; }
  }, []);

  const readingHistory = useMemo(() => {
    const entries: { storyId: string; page: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('teajia_progress_')) {
        const storyId = key.replace('teajia_progress_', '');
        const page = parseInt(localStorage.getItem(key) || '0');
        entries.push({ storyId, page });
      }
    }
    return entries;
  }, []);

  // Save trigger and animate in on mount
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => setIsVisible(true));
    return () => {
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelView !== 'main') {
          setPanelView('main');
          resetForm();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, panelView]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setFormError('');
    setFormLoading(false);
    setShowPassword(false);
  };

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await auth.login(email, password);
      resetForm();
      setPanelView('main');
    } catch (err: any) {
      setFormError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    setFormLoading(true);
    try {
      await auth.signup(email, password, name);
      resetForm();
      setPanelView('main');
    } catch (err: any) {
      setFormError(err.message || 'Account creation failed. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignOut = () => {
    auth.logout();
  };

  const handleGoToAdmin = (path: string = '/admin/inventory') => {
    onClose();
    window.location.href = path;
  };

  const swipeProgress = touchOffset / 150;
  const swipeOpacity = Math.max(0.3, 1 - swipeProgress * 0.7);

  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isSubView = panelView !== 'main' && panelView !== 'signin' && panelView !== 'signup';

  // Header title based on view
  const headerTitle = (() => {
    switch (panelView) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'collection': return 'My Collection';
      case 'saved-stories': return 'Saved Stories';
      case 'reading-history': return 'Reading History';
      default: return 'Account';
    }
  })();

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
              onClick={() => {
                if (panelView !== 'main') {
                  setPanelView('main');
                  resetForm();
                } else {
                  onClose();
                }
              }}
              className="absolute left-6 min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5"
            >
              {panelView !== 'main' ? (
                <Icons.Back className="w-6 h-6 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors" />
              ) : (
                <Icons.Close className="w-6 h-6 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors" />
              )}
            </button>
            <h2 className="text-lg font-serif text-tea-charcoal dark:text-white tracking-wide">{headerTitle}</h2>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {/* Paper texture overlay */}
          <div className="absolute inset-0 opacity-[0.1] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply pointer-events-none" />

          <div className="space-y-8 relative z-10">

            {/* ============ SIGN IN FORM ============ */}
            {panelView === 'signin' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4">
                    <Icons.LogIn className="w-7 h-7 text-tea-seal" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-charcoal dark:text-white">Welcome Back</h3>
                  <p className="text-sm text-tea-charcoal/50 dark:text-white/50 mt-1 font-serif italic">Sign in to your Teajia account</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-charcoal/50 dark:text-white/50 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/40 dark:bg-white/5 border border-tea-charcoal/10 dark:border-white/10 p-3.5 text-tea-charcoal dark:text-white outline-none focus:border-tea-seal dark:focus:border-tea-seal transition-colors placeholder-tea-charcoal/30 dark:placeholder-white/20 font-sans text-sm"
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-charcoal/50 dark:text-white/50 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/40 dark:bg-white/5 border border-tea-charcoal/10 dark:border-white/10 p-3.5 pr-12 text-tea-charcoal dark:text-white outline-none focus:border-tea-seal dark:focus:border-tea-seal transition-colors font-sans text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-charcoal/30 dark:text-white/30 hover:text-tea-charcoal dark:hover:text-white transition-colors"
                      >
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-seal text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-seal/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-charcoal/50 dark:text-white/50">
                    Don't have an account?{' '}
                    <button
                      onClick={() => { resetForm(); setPanelView('signup'); }}
                      className="text-tea-seal hover:text-tea-seal/80 font-medium transition-colors"
                    >
                      Create one
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ============ SIGN UP FORM ============ */}
            {panelView === 'signup' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4">
                    <SealIcon className="w-7 h-7 text-tea-seal" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-charcoal dark:text-white">Join Teajia</h3>
                  <p className="text-sm text-tea-charcoal/50 dark:text-white/50 mt-1 font-serif italic">Create your account to get started</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-charcoal/50 dark:text-white/50 mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/40 dark:bg-white/5 border border-tea-charcoal/10 dark:border-white/10 p-3.5 text-tea-charcoal dark:text-white outline-none focus:border-tea-seal dark:focus:border-tea-seal transition-colors placeholder-tea-charcoal/30 dark:placeholder-white/20 font-sans text-sm"
                      placeholder="Your name"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-charcoal/50 dark:text-white/50 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/40 dark:bg-white/5 border border-tea-charcoal/10 dark:border-white/10 p-3.5 text-tea-charcoal dark:text-white outline-none focus:border-tea-seal dark:focus:border-tea-seal transition-colors placeholder-tea-charcoal/30 dark:placeholder-white/20 font-sans text-sm"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-charcoal/50 dark:text-white/50 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/40 dark:bg-white/5 border border-tea-charcoal/10 dark:border-white/10 p-3.5 pr-12 text-tea-charcoal dark:text-white outline-none focus:border-tea-seal dark:focus:border-tea-seal transition-colors placeholder-tea-charcoal/30 dark:placeholder-white/20 font-sans text-sm"
                        placeholder="Min 6 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-charcoal/30 dark:text-white/30 hover:text-tea-charcoal dark:hover:text-white transition-colors"
                      >
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-tea-charcoal/40 dark:text-white/30 mt-1.5">Must be at least 6 characters</p>
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-seal text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-seal/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-charcoal/50 dark:text-white/50">
                    Already have an account?{' '}
                    <button
                      onClick={() => { resetForm(); setPanelView('signin'); }}
                      className="text-tea-seal hover:text-tea-seal/80 font-medium transition-colors"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ============ MY COLLECTION SUB-VIEW ============ */}
            {panelView === 'collection' && (
              <MyCollection onBack={() => setPanelView('main')} />
            )}

            {/* ============ SAVED STORIES SUB-VIEW ============ */}
            {panelView === 'saved-stories' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <button
                  onClick={() => setPanelView('main')}
                  className="flex items-center gap-2 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors mb-6"
                >
                  <Icons.Back className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">Back</span>
                </button>

                {savedStoryEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4">
                      <Icons.Leaf className="w-7 h-7 text-tea-seal/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-charcoal dark:text-white mb-2">No Saved Stories</h3>
                    <p className="text-sm text-tea-charcoal/50 dark:text-white/50 text-center max-w-[260px] leading-relaxed">
                      Tap the leaf icon while reading to save stories for later.
                    </p>
                  </div>
                ) : (
                  <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
                    {savedStoryEntries.map((storyId, i) => (
                      <button
                        key={storyId}
                        onClick={() => {
                          onNavigateToStory?.(storyId);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group text-left ${
                          i < savedStoryEntries.length - 1 ? 'border-b border-tea-charcoal/5 dark:border-white/5' : ''
                        }`}
                      >
                        <Icons.Leaf filled className="w-4 h-4 text-tea-seal shrink-0" />
                        <span className="font-serif text-sm text-tea-charcoal dark:text-white group-hover:text-tea-seal transition-colors truncate">
                          Story #{storyId}
                        </span>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-charcoal/20 dark:text-white/20 ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ READING HISTORY SUB-VIEW ============ */}
            {panelView === 'reading-history' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <button
                  onClick={() => setPanelView('main')}
                  className="flex items-center gap-2 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors mb-6"
                >
                  <Icons.Back className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest">Back</span>
                </button>

                {readingHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4">
                      <Icons.BookOpen className="w-7 h-7 text-tea-seal/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-charcoal dark:text-white mb-2">No Reading History</h3>
                    <p className="text-sm text-tea-charcoal/50 dark:text-white/50 text-center max-w-[260px] leading-relaxed">
                      Your reading progress will appear here as you explore articles.
                    </p>
                  </div>
                ) : (
                  <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
                    {readingHistory.map((entry, i) => (
                      <button
                        key={entry.storyId}
                        onClick={() => {
                          onNavigateToStory?.(entry.storyId);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group text-left ${
                          i < readingHistory.length - 1 ? 'border-b border-tea-charcoal/5 dark:border-white/5' : ''
                        }`}
                      >
                        <Icons.BookOpen className="w-4 h-4 text-tea-charcoal/40 dark:text-white/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-serif text-sm text-tea-charcoal dark:text-white group-hover:text-tea-seal transition-colors truncate block">
                            Story #{entry.storyId}
                          </span>
                          <span className="text-[10px] text-tea-charcoal/40 dark:text-white/30">
                            Page {entry.page + 1}
                          </span>
                        </div>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-charcoal/20 dark:text-white/20 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ MAIN VIEW (GUEST or AUTHENTICATED) ============ */}
            {panelView === 'main' && (
              <>
                {/* Profile Header */}
                {auth.isAuthenticated && auth.user ? (
                  <div className="flex flex-col items-center pt-4 pb-2 animate-[fadeIn_0.3s_ease-out]">
                    <div className="w-20 h-20 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4 border-2 border-tea-seal/20">
                      <span className="text-2xl font-serif text-tea-seal font-medium">
                        {getInitials(auth.user.name || auth.user.email)}
                      </span>
                    </div>
                    <h3 className="font-serif text-xl text-tea-charcoal dark:text-white">
                      {auth.user.name || 'Tea Enthusiast'}
                    </h3>
                    <span className="text-[11px] text-tea-charcoal/50 dark:text-white/50 mt-0.5">{auth.user.email}</span>
                    {auth.isAdmin && (
                      <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-tea-seal bg-tea-seal/10 dark:bg-tea-seal/20 border border-tea-seal/20">
                        <Icons.Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center pt-4 pb-2">
                    <div className="w-20 h-20 rounded-full bg-tea-charcoal/5 dark:bg-white/10 flex items-center justify-center mb-4">
                      <Icons.User className="w-8 h-8 text-tea-charcoal/30 dark:text-white/30" />
                    </div>
                    <h3 className="font-serif text-xl text-tea-charcoal dark:text-white">Tea Enthusiast</h3>
                    <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 mt-1">Guest</span>
                  </div>
                )}

                {/* Sign In / Create Account buttons for guests */}
                {!auth.isAuthenticated && (
                  <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                    <button
                      onClick={() => setPanelView('signin')}
                      className="w-full py-3.5 bg-tea-seal text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-seal/90 transition-colors flex justify-center items-center gap-2"
                    >
                      <Icons.LogIn className="w-4 h-4" />
                      Sign In
                    </button>
                    <button
                      onClick={() => setPanelView('signup')}
                      className="w-full py-3.5 bg-transparent text-tea-charcoal dark:text-white border border-tea-charcoal/15 dark:border-white/15 font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/30 dark:hover:bg-white/5 transition-colors flex justify-center items-center gap-2"
                    >
                      Create Account
                    </button>
                    <p className="text-center text-[11px] text-tea-charcoal/40 dark:text-white/30 pt-1">
                      Sign in to track orders, save favorites, and more
                    </p>
                  </div>
                )}

                {/* Admin Mini Dashboard — quick overview */}
                {auth.isAuthenticated && auth.isAdmin && (
                  <AdminMiniDashboard onClose={onClose} />
                )}

                {/* Admin Navigation — only for admins */}
                {auth.isAuthenticated && auth.isAdmin && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Administration</span>
                    <div className="border border-tea-seal/15 dark:border-tea-seal/20 overflow-hidden">
                      {[
                        { path: '/admin/inventory', label: 'Inventory', desc: 'Manage products & stock', icon: <Icons.Settings className="w-4.5 h-4.5" /> },
                        { path: '/admin/personal', label: 'Collection', desc: 'Personal tea collection', icon: <Icons.Heart className="w-4.5 h-4.5" /> },
                        { path: '/admin/orders', label: 'Orders', desc: 'Track & manage orders', icon: <Icons.Clock className="w-4.5 h-4.5" /> },
                        { path: '/admin/records', label: 'Records', desc: 'Sales logs & history', icon: <Icons.BookOpen className="w-4.5 h-4.5" /> },
                        { path: '/admin/settings', label: 'Settings', desc: 'System configuration', icon: <Icons.Settings className="w-4.5 h-4.5" /> },
                      ].map((item, i, arr) => (
                        <button
                          key={item.path}
                          onClick={() => handleGoToAdmin(item.path)}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 bg-tea-seal/5 dark:bg-tea-seal/10 hover:bg-tea-seal/10 dark:hover:bg-tea-seal/15 transition-colors group ${
                            i < arr.length - 1 ? 'border-b border-tea-seal/10 dark:border-tea-seal/15' : ''
                          }`}
                        >
                          <div className="text-tea-seal">{item.icon}</div>
                          <div className="flex flex-col items-start flex-1">
                            <span className="text-sm font-serif text-tea-charcoal dark:text-white">{item.label}</span>
                            <span className="text-[10px] text-tea-charcoal/40 dark:text-white/40">{item.desc}</span>
                          </div>
                          <Icons.ChevronRight className="w-4 h-4 text-tea-seal/30 group-hover:text-tea-seal/60 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Stats — 3 columns now */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-4 flex flex-col items-center gap-2">
                    <Icons.Bag className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40" />
                    <span className="font-mono text-2xl text-tea-charcoal dark:text-white">{cartCount}</span>
                    <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">Cart</span>
                  </div>
                  <div className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-4 flex flex-col items-center gap-2">
                    <Icons.Heart className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40" />
                    <span className="font-mono text-2xl text-tea-charcoal dark:text-white">{favoriteTeas.length}</span>
                    <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">Favorites</span>
                  </div>
                  <div className="bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 p-4 flex flex-col items-center gap-2">
                    <Icons.BookOpen className="w-5 h-5 text-tea-charcoal/40 dark:text-white/40" />
                    <span className="font-mono text-2xl text-tea-charcoal dark:text-white">{progressCount}</span>
                    <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">Read</span>
                  </div>
                </div>

                {/* My Collection — shareable favorites */}
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Your Tea Collection</span>
                  <button
                    onClick={() => setPanelView('collection')}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10 transition-colors group"
                  >
                    <Icons.Heart filled={favoriteTeas.length > 0} className={`w-5 h-5 ${favoriteTeas.length > 0 ? 'text-tea-seal' : 'text-tea-charcoal/40 dark:text-white/40'} group-hover:text-tea-seal transition-colors`} />
                    <div className="flex flex-col items-start flex-1">
                      <span className="font-serif text-sm text-tea-charcoal dark:text-white">My Favorites</span>
                      <span className="text-[10px] text-tea-charcoal/40 dark:text-white/40">
                        {favoriteTeas.length === 0 ? 'No teas saved yet' : `${favoriteTeas.length} ${favoriteTeas.length === 1 ? 'tea' : 'teas'} — shareable`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {favoriteTeas.length > 0 && (
                        <Icons.Share className="w-3.5 h-3.5 text-tea-seal/40" />
                      )}
                      <Icons.ChevronRight className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20 group-hover:text-tea-charcoal/40 dark:group-hover:text-white/40 transition-colors" />
                    </div>
                  </button>
                </div>

                {/* Reading & Stories */}
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Reading</span>
                  <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
                    <button
                      onClick={() => setPanelView('saved-stories')}
                      className="w-full flex items-center gap-4 px-4 py-4 border-b border-tea-charcoal/5 dark:border-white/5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                    >
                      <Icons.Leaf filled={savedStoryCount > 0} className={`w-5 h-5 ${savedStoryCount > 0 ? 'text-tea-seal' : 'text-tea-charcoal/40 dark:text-white/40'} group-hover:text-tea-seal transition-colors`} />
                      <div className="flex flex-col items-start flex-1">
                        <span className="font-serif text-sm text-tea-charcoal dark:text-white">Saved Stories</span>
                        <span className="text-[10px] text-tea-charcoal/40 dark:text-white/40">
                          {savedStoryCount === 0 ? 'None saved' : `${savedStoryCount} saved`}
                        </span>
                      </div>
                      <Icons.ChevronRight className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20" />
                    </button>
                    <button
                      onClick={() => setPanelView('reading-history')}
                      className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                    >
                      <Icons.BookOpen className={`w-5 h-5 ${progressCount > 0 ? 'text-tea-seal' : 'text-tea-charcoal/40 dark:text-white/40'} group-hover:text-tea-seal transition-colors`} />
                      <div className="flex flex-col items-start flex-1">
                        <span className="font-serif text-sm text-tea-charcoal dark:text-white">Reading History</span>
                        <span className="text-[10px] text-tea-charcoal/40 dark:text-white/40">
                          {progressCount === 0 ? 'No articles read' : `${progressCount} ${progressCount === 1 ? 'article' : 'articles'}`}
                        </span>
                      </div>
                      <Icons.ChevronRight className="w-4 h-4 text-tea-charcoal/20 dark:text-white/20" />
                    </button>
                  </div>
                </div>

                {/* Preferences: Theme + Currency */}
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50 block mb-4">Preferences</span>
                  <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
                    {/* Theme Toggle */}
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between px-4 py-4 border-b border-tea-charcoal/5 dark:border-white/5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
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

                    {/* Currency Selector */}
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-tea-seal font-mono text-sm font-bold">$</span>
                        <span className="font-serif text-sm text-tea-charcoal dark:text-white">Currency</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {CURRENCY_OPTIONS.map((opt) => (
                          <button
                            key={opt.code}
                            onClick={() => setCurrency(opt.code)}
                            className={`px-2.5 py-1.5 text-[11px] uppercase tracking-wider border transition-colors ${
                              currency === opt.code
                                ? 'bg-tea-seal text-white border-tea-seal'
                                : 'border-tea-charcoal/10 dark:border-white/10 text-tea-charcoal/60 dark:text-white/50 hover:border-tea-seal/30'
                            }`}
                          >
                            {opt.symbol} {opt.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
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

                {/* Sign Out — only for authenticated users */}
                {auth.isAuthenticated && (
                  <div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-tea-charcoal/50 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 border border-tea-charcoal/5 dark:border-white/10 hover:border-red-500/20 dark:hover:border-red-400/20 transition-colors"
                    >
                      <Icons.LogOut className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-[0.2em] font-medium">Sign Out</span>
                    </button>
                  </div>
                )}
              </>
            )}

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
