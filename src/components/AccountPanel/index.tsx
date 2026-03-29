
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Icons, SealIcon } from '../Icons';
import { LogoEmblem } from '../Logos/LogoEmblem';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../lib/store';
import { api, setToken } from '../../lib/api';
import { MyCollection } from './MyCollection';
import { TastingJournal } from './TastingJournal';
import { TeaCompass } from '../TeaCompass';
import { AdminMiniDashboard } from '../admin-overlay/AdminMiniDashboard';
import type { Currency } from '../../admin/types';

type PanelView = 'main' | 'signin' | 'signup' | 'collection' | 'tasting-journal' | 'tea-compass' | 'saved-stories' | 'reading-history' | 'change-password' | 'edit-profile';

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
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const { favoriteTeas, currency, setCurrency, publicCart, tastingJournal } = useAppStore();
  useScrollLock(true);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const PERSISTABLE_VIEWS: PanelView[] = ['main', 'tea-compass', 'collection', 'tasting-journal', 'saved-stories', 'reading-history'];
  const STORAGE_KEY = 'teajia-account-view';

  const [panelView, setPanelViewRaw] = useState<PanelView>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PanelView | null;
      if (saved && PERSISTABLE_VIEWS.includes(saved)) return saved;
    } catch {}
    return 'main';
  });

  const setPanelView = (view: PanelView) => {
    setPanelViewRaw(view);
    try {
      if (PERSISTABLE_VIEWS.includes(view)) {
        localStorage.setItem(STORAGE_KEY, view);
      }
    } catch {}
  };

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Edit profile state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Admin request state
  const [adminRequestLoading, setAdminRequestLoading] = useState(false);
  const [adminRequestStatus, setAdminRequestStatus] = useState<string | null>(null);


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
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setEditName('');
    setEditEmail('');
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (newPassword.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFormError('New passwords do not match.');
      return;
    }
    setFormLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      resetForm();
      setPanelView('main');
      setFormError('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to change password.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const updates: { name?: string; email?: string } = {};
      if (editName && editName !== auth.user?.name) updates.name = editName;
      if (editEmail && editEmail !== auth.user?.email) updates.email = editEmail;
      if (Object.keys(updates).length === 0) {
        setFormError('No changes to save.');
        setFormLoading(false);
        return;
      }
      const result = await api.auth.updateProfile(updates);
      if (result.token) setToken(result.token);
      await auth.checkSession();
      resetForm();
      setPanelView('main');
    } catch (err: any) {
      setFormError(err.message || 'Failed to update profile.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRequestAdmin = async () => {
    setAdminRequestLoading(true);
    try {
      await api.auth.requestAdmin();
      setAdminRequestStatus('pending');
    } catch (err: any) {
      if (err.message?.includes('already')) {
        setAdminRequestStatus('pending');
      } else {
        setFormError(err.message || 'Failed to request admin access.');
      }
    } finally {
      setAdminRequestLoading(false);
    }
  };

  const handleGoToAdmin = (path: string = '/admin/inventory') => {
    onClose();
    window.location.href = path;
  };


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
      case 'tasting-journal': return 'Tasting Journal';
      case 'tea-compass': return 'Tea Compass';
      case 'saved-stories': return 'Saved Stories';
      case 'reading-history': return 'Reading History';
      case 'change-password': return 'Change Password';
      case 'edit-profile': return 'Edit Profile';
      default: return 'Account';
    }
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-drawer bg-tea-text/80 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-tea-bg  z-modal shadow-2xl flex flex-col"
        style={{
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out, opacity 300ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--tea-border)] bg-tea-surface/50">
          {panelView !== 'main' ? (
            <button
              onClick={() => {
                setPanelView('main');
                resetForm();
              }}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5"
            >
              <Icons.Back className="w-5 h-5 text-tea-text-sec hover:text-tea-text transition-colors" />
            </button>
          ) : (
            <button
              onClick={(e) => toggleTheme(e)}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 hover:bg-tea-gold/10 rounded-full transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 text-tea-gold" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-tea-gold" />
              )}
            </button>
          )}
          <h2 className="text-sm font-serif text-tea-text tracking-wide">{headerTitle}</h2>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5"
          >
            <Icons.Close className="w-5 h-5 text-tea-text-sec hover:text-tea-text transition-colors" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-6 relative">
          {/* Grain texture overlay — design bible SVG noise */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '120px' }} />

          <div className="space-y-8 relative z-10">

            {/* ============ SIGN IN FORM ============ */}
            {panelView === 'signin' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <Icons.LogIn className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text ">Welcome Back</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Sign in to your Teajia account</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 pr-12 text-tea-text outline-none focus:border-tea-gold transition-colors font-sans text-sm"
                        style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-text/30 hover:text-tea-text transition-colors"
                      >
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-tea-gold/20 border-t-tea-text-sec rounded-full animate-spin" />
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-text-sec">
                    Don't have an account?{' '}
                    <button
                      onClick={() => { resetForm(); setPanelView('signup'); }}
                      className="text-tea-gold hover:text-tea-gold/80 font-medium transition-colors"
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
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <SealIcon className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text ">Join Teajia</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Create your account to get started</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder="Your name"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 pr-12 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                        style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                        placeholder="Min 6 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-text/30 hover:text-tea-text transition-colors"
                      >
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-tea-text/40 /30 mt-1.5">Must be at least 6 characters</p>
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-tea-gold/20 border-t-tea-text-sec rounded-full animate-spin" />
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-text-sec">
                    Already have an account?{' '}
                    <button
                      onClick={() => { resetForm(); setPanelView('signin'); }}
                      className="text-tea-gold hover:text-tea-gold/80 font-medium transition-colors"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ============ CHANGE PASSWORD ============ */}
            {panelView === 'change-password' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <Icons.Lock className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text">Change Password</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Update your account password</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder="Min 6 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      required
                    />
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-tea-gold/20 border-t-tea-text-sec rounded-full animate-spin" />
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ============ EDIT PROFILE ============ */}
            {panelView === 'edit-profile' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <Icons.User className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text">Edit Profile</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Update your name or email</p>
                </div>

                <form onSubmit={handleEditProfile} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder={auth.user?.name || 'Your name'}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full bg-tea-surface border border-[var(--tea-border)] p-3.5 text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm"
                      style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' }}
                      placeholder={auth.user?.email || 'you@example.com'}
                    />
                  </div>

                  {formError && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
                      <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-tea-gold/20 border-t-tea-text-sec rounded-full animate-spin" />
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ============ MY COLLECTION SUB-VIEW ============ */}
            {panelView === 'collection' && (
              <MyCollection onBack={() => setPanelView('main')} />
            )}

            {/* ============ TASTING JOURNAL SUB-VIEW ============ */}
            {panelView === 'tasting-journal' && (
              <TastingJournal
                onBack={() => setPanelView('main')}
                onOrderTea={(teaId) => {
                  onClose();
                  navigate(`/shop/product/${teaId}`);
                }}
              />
            )}

            {/* ============ TEA COMPASS SUB-VIEW ============ */}
            {panelView === 'tea-compass' && (
              <TeaCompass onBack={() => setPanelView('main')} />
            )}

            {/* ============ SAVED STORIES SUB-VIEW ============ */}
            {panelView === 'saved-stories' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <button
                  onClick={() => setPanelView('main')}
                  className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
                >
                  <Icons.Back className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.15em]">Back</span>
                </button>

                {savedStoryEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                      <Icons.Leaf className="w-7 h-7 text-tea-gold/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-text  mb-2">No Saved Stories</h3>
                    <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
                      Tap the leaf icon while reading to save stories for later.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[var(--tea-border)] overflow-hidden rounded-md">
                    {savedStoryEntries.map((storyId, i) => (
                      <button
                        key={storyId}
                        onClick={() => {
                          onNavigateToStory?.(storyId);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${
                          i < savedStoryEntries.length - 1 ? 'border-b border-[var(--tea-accent-sub)]' : ''
                        }`}
                      >
                        <Icons.Leaf filled className="w-4 h-4 text-tea-gold shrink-0" />
                        <span className="font-serif text-sm text-tea-text  group-hover:text-tea-gold transition-colors truncate">
                          Story #{storyId}
                        </span>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 ml-auto shrink-0" />
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
                  className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
                >
                  <Icons.Back className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.15em]">Back</span>
                </button>

                {readingHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                      <Icons.BookOpen className="w-7 h-7 text-tea-gold/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-text  mb-2">No Reading History</h3>
                    <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
                      Your reading progress will appear here as you explore articles.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[var(--tea-border)] overflow-hidden rounded-md">
                    {readingHistory.map((entry, i) => (
                      <button
                        key={entry.storyId}
                        onClick={() => {
                          onNavigateToStory?.(entry.storyId);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${
                          i < readingHistory.length - 1 ? 'border-b border-[var(--tea-accent-sub)]' : ''
                        }`}
                      >
                        <Icons.BookOpen className="w-4 h-4 text-tea-text-sec shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-serif text-sm text-tea-text  group-hover:text-tea-gold transition-colors truncate block">
                            Story #{entry.storyId}
                          </span>
                          <span className="text-[10px] text-tea-text-sec">
                            Page {entry.page + 1}
                          </span>
                        </div>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />
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
                  <div className="flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
                    <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-gold/20 shrink-0">
                      <span className="text-sm font-serif text-tea-gold font-medium">
                        {getInitials(auth.user.name || auth.user.email)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-sm text-tea-text truncate">
                          {auth.user.name || 'Tea Enthusiast'}
                        </h3>
                        {auth.isAdmin && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] uppercase tracking-[0.1em] text-tea-gold bg-tea-gold/10 rounded shrink-0">
                            <Icons.Shield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-tea-text-sec truncate block">{auth.user.email}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-tea-bg/5 flex items-center justify-center shrink-0">
                      <Icons.User className="w-5 h-5 text-tea-text/30" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm text-tea-text">Tea Enthusiast</h3>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">Guest</span>
                    </div>
                  </div>
                )}

                {/* Sign In / Create Account buttons for guests */}
                {!auth.isAuthenticated && (
                  <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                    <button
                      onClick={() => setPanelView('signin')}
                      className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors flex justify-center items-center gap-2"
                    >
                      <Icons.LogIn className="w-4 h-4" />
                      Sign In
                    </button>
                    <button
                      onClick={() => setPanelView('signup')}
                      className="w-full py-3.5 bg-transparent text-tea-text border border-tea-border font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-elevated/50 transition-colors flex justify-center items-center gap-2"
                    >
                      Create Account
                    </button>
                  </div>
                )}

                {/* Navigation — admin + account in one flat list */}
                {auth.isAuthenticated && (
                  <div className="border border-tea-border overflow-hidden rounded-md">
                    {[
                      ...(auth.isAdmin ? [
                        { action: () => handleGoToAdmin('/admin/inventory'), label: 'Inventory', icon: <Icons.Settings className="w-4 h-4" />, gold: true },
                        { action: () => handleGoToAdmin('/admin/orders'), label: 'Orders', icon: <Icons.Clock className="w-4 h-4" />, gold: true },
                        { action: () => handleGoToAdmin('/admin/records'), label: 'Records', icon: <Icons.BookOpen className="w-4 h-4" />, gold: true },
                      ] : []),
                      { action: () => { setEditName(auth.user?.name || ''); setEditEmail(auth.user?.email || ''); setPanelView('edit-profile'); }, label: 'Edit Profile', icon: <Icons.User className="w-4 h-4" /> },
                      { action: () => { resetForm(); setPanelView('change-password'); }, label: 'Change Password', icon: <Icons.Lock className="w-4 h-4" /> },
                    ].map((item, i, arr) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-tea-surface/50 transition-colors group ${
                          i < arr.length - 1 ? 'border-b border-tea-border' : ''
                        }`}
                      >
                        <div className={item.gold ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-gold transition-colors'}>{item.icon}</div>
                        <span className="text-sm text-tea-text flex-1 text-left">{item.label}</span>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Your Tea */}
                {auth.isAuthenticated && (
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-sec/50 block mb-3">Your Tea</span>
                    <div className="border border-tea-border overflow-hidden rounded-md">
                      <button
                        onClick={() => setPanelView('tea-compass')}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-tea-border hover:bg-tea-surface/50 transition-colors group"
                      >
                        <Icons.MapPin className="w-4 h-4 text-tea-gold transition-colors" />
                        <span className="text-sm text-tea-text flex-1 text-left">Tea Compass</span>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15" />
                      </button>
                      <button
                        onClick={() => setPanelView('collection')}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-tea-border hover:bg-tea-surface/50 transition-colors group"
                      >
                        <Icons.Heart filled={favoriteTeas.length > 0} className={`w-4 h-4 ${favoriteTeas.length > 0 ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-gold'} transition-colors`} />
                        <span className="text-sm text-tea-text flex-1 text-left">Favorites</span>
                        {favoriteTeas.length > 0 && <span className="text-[11px] font-mono text-tea-text-sec">{favoriteTeas.length}</span>}
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15" />
                      </button>
                      <button
                        onClick={() => setPanelView('tasting-journal')}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-tea-surface/50 transition-colors group"
                      >
                        <Icons.Sparkles className={`w-4 h-4 ${tastingJournal.length > 0 ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-gold'} transition-colors`} />
                        <span className="text-sm text-tea-text flex-1 text-left">Tasting Journal</span>
                        {tastingJournal.length > 0 && <span className="text-[11px] font-mono text-tea-text-sec">{tastingJournal.length}</span>}
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15" />
                      </button>
                    </div>

                    {/* Currency — inline */}
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-sec/50 shrink-0">Currency</span>
                      <div className="flex flex-wrap gap-1">
                        {CURRENCY_OPTIONS.map((opt) => (
                          <button
                            key={opt.code}
                            onClick={() => setCurrency(opt.code)}
                            className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded transition-colors ${
                              currency === opt.code
                                ? 'bg-tea-gold/15 text-tea-gold'
                                : 'text-tea-text-sec/40 hover:text-tea-text-sec'
                            }`}
                          >
                            {opt.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sign Out */}
                {auth.isAuthenticated && (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-tea-text-sec/40 hover:text-red-500 transition-colors text-xs uppercase tracking-[0.2em]"
                  >
                    <Icons.LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                )}
              </>
            )}

          </div>
        </div>

      </div>
    </>
  );
};
