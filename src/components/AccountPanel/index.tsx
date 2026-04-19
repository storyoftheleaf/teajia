
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Icons, SealIcon } from '../Icons';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../lib/store';
import { api, setToken, hydrateAccountStateFromToken } from '../../lib/api';
import { MyCollection } from './MyCollection';
import { TastingJournal } from './TastingJournal';
import { TeaCompass } from '../TeaCompass';
import type { Currency } from '../../admin/types';
import type { AccountMembership } from '../../types';

import type { PanelView } from './types';

interface AccountPanelProps {
  onClose: () => void;
  onNavigateToStory?: (storyId: string) => void;
  initialView?: PanelView;
}

const CURRENCY_OPTIONS: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'NT', label: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'Yuan', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
];

// Derive a readable location string from a membership slug (best-effort for inactive cards
// where we don't have the full Account object)
function getLocationFromSlug(slug: string): string {
  if (slug.includes('bali') || slug.includes('indonesia') || slug.includes('ubud')) return 'Ubud, Bali';
  if (slug.includes('australia') || slug.includes('melbourne') || slug.includes('sydney')) return 'Australia';
  if (slug.includes('taiwan') || slug.includes('taipei')) return 'Taiwan';
  if (slug.includes('japan') || slug.includes('tokyo') || slug.includes('kyoto')) return 'Japan';
  if (slug.includes('hong-kong') || slug.includes('hongkong')) return 'Hong Kong';
  if (slug.includes('singapore')) return 'Singapore';
  if (slug.includes('malaysia') || slug.includes('kl') || slug.includes('kuala')) return 'Malaysia';
  // Fallback: capitalise slug words
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getCurrencyFromSlug(slug: string): Currency {
  if (slug.includes('australia') || slug.includes('melbourne') || slug.includes('sydney')) return 'AUD';
  if (slug.includes('taiwan') || slug.includes('taipei')) return 'NT';
  if (slug.includes('japan') || slug.includes('tokyo') || slug.includes('kyoto')) return 'JPY';
  if (slug.includes('malaysia') || slug.includes('kl')) return 'MYR';
  if (slug.includes('indonesia') || slug.includes('bali')) return 'IDR';
  return 'USD';
}

// Role badge label — returns null for plain members (no badge needed)
function getRoleBadgeLabel(role: string | undefined, platformRole: string | null): string | null {
  if (platformRole === 'platform_owner') return 'Platform Owner';
  if (platformRole === 'platform_admin') return 'Platform Admin';
  if (role === 'owner') return 'Owner';
  if (role === 'staff') return 'Staff';
  return null;
}

// Thin zone separator
const Separator: React.FC = () => (
  <div className="h-px bg-tea-gold/10" />
);

// Consistent zone label
const ZoneLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-sec/50 block mb-3">
    {children}
  </span>
);

export const AccountPanel: React.FC<AccountPanelProps> = ({ onClose, onNavigateToStory, initialView }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const {
    favoriteTeas,
    currency,
    setCurrency,
    publicCart,
    tastingJournal,
    memberships,
    activeAccountId,
    activeAccount,
    platformRole,
    setShopStoreSlug,
    setActiveAccountId,
    setActiveAccount,
  } = useAppStore();

  useScrollLock(true);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const PERSISTABLE_VIEWS: PanelView[] = ['main', 'tea-compass', 'collection', 'tasting-journal', 'saved-stories', 'reading-history'];
  const STORAGE_KEY = 'teajia-account-view';

  const [panelView, setPanelViewRaw] = useState<PanelView>(() => {
    if (initialView) return initialView;
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
  const [username, setUsername] = useState('');
  const [signinIdentifier, setSigninIdentifier] = useState('');
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
  const [editUsername, setEditUsername] = useState('');

  // Location switch state
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');

  // Derived
  const activeMembership = memberships.find(m => m.account_id === activeAccountId);
  const inactiveMemberships = memberships.filter(m => m.account_id !== activeAccountId);
  const membershipRole = activeMembership?.role;
  const isStaff = membershipRole === 'staff' || membershipRole === 'owner' || auth.isAdmin;

  const activeLocationStr = [activeAccount?.location_city, activeAccount?.location_country]
    .filter(Boolean)
    .join(', ');
  const activeDisplayCurrency = (activeAccount?.currency_default || currency) as string;

  const roleBadgeLabel = getRoleBadgeLabel(membershipRole, platformRole);

  // Counts from localStorage
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

  const cartCount = publicCart.length;

  // Animate in
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    return () => { triggerRef.current?.focus(); };
  }, []);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelView !== 'main') {
          setPanelView('main');
          resetForm();
          setLocationSearch('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, panelView]);

  const resetForm = () => {
    setEmail(''); setPassword(''); setName(''); setUsername('');
    setSigninIdentifier(''); setFormError(''); setFormLoading(false);
    setShowPassword(false); setCurrentPassword(''); setNewPassword('');
    setConfirmNewPassword(''); setEditName(''); setEditEmail(''); setEditUsername('');
  };

  const handleOpenCart = () => {
    onClose();
    setTimeout(() => window.dispatchEvent(new Event('openCart')), 50);
  };

  // ── Location switch ──────────────────────────────────────────────────────────
  const handleSwitchLocation = async (membership: AccountMembership) => {
    if (membership.account_id === activeAccountId || switchingTo) return;
    const prevAccountId = activeAccountId;
    const prevSlug = activeMembership?.slug ?? null;

    setSwitchingTo(membership.account_id);

    // Optimistic update — apply immediately so the UI feels instant
    setShopStoreSlug(membership.slug);
    setActiveAccountId(membership.account_id);

    try {
      if (auth.isAuthenticated) {
        await api.accounts.switch(membership.account_id);
        hydrateAccountStateFromToken();
        // Fetch full account to get real location + currency
        try {
          const account = await api.accounts.get(membership.account_id);
          setActiveAccount(account);
          if (account.currency_default) {
            setCurrency(account.currency_default as Currency);
          }
        } catch { /* non-critical — best-effort currency from slug */ }
      }
      // Best-effort currency from slug when full account fetch isn't available
      if (!activeAccount?.currency_default) {
        setCurrency(getCurrencyFromSlug(membership.slug));
      }
    } catch {
      // Revert on failure
      setShopStoreSlug(prevSlug);
      setActiveAccountId(prevAccountId);
    } finally {
      setSwitchingTo(null);
      if (panelView === 'location-switcher') setPanelView('main');
    }
  };

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await auth.login(signinIdentifier.trim(), password);
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
    if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    setFormLoading(true);
    try {
      await auth.signup(email, password, name, username.trim() || null);
      resetForm();
      setPanelView('main');
    } catch (err: any) {
      setFormError(err.message || 'Account creation failed. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignOut = () => { auth.logout(); };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (newPassword.length < 6) { setFormError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmNewPassword) { setFormError('New passwords do not match.'); return; }
    setFormLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      resetForm();
      setPanelView('main');
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
      const updates: { name?: string; email?: string; username?: string | null } = {};
      if (editName && editName !== auth.user?.name) updates.name = editName;
      if (editEmail && editEmail !== auth.user?.email) updates.email = editEmail;
      const trimmedUsername = editUsername.trim();
      const currentUsername = auth.user?.username ?? '';
      if (trimmedUsername !== currentUsername) {
        updates.username = trimmedUsername === '' ? null : trimmedUsername;
      }
      if (Object.keys(updates).length === 0) { setFormError('No changes to save.'); setFormLoading(false); return; }
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

  const handleGoToAdmin = (path: string = '/admin/inventory') => {
    onClose();
    window.location.href = path;
  };

  const getInitials = (nameStr: string) =>
    nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Header state
  const isSubView = !['main', 'signin', 'signup'].includes(panelView);
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
      case 'location-switcher': return 'Switch Location';
      default: return 'Account';
    }
  })();

  // Filtered memberships for location switcher search
  const filteredMemberships = useMemo(() => {
    if (!locationSearch.trim()) return memberships;
    const q = locationSearch.toLowerCase();
    return memberships.filter(m =>
      m.account_name.toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q) ||
      getLocationFromSlug(m.slug).toLowerCase().includes(q)
    );
  }, [memberships, locationSearch]);

  // ── Nav row helper ──────────────────────────────────────────────────────────
  const NavRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    count?: number;
    gold?: boolean;
    last?: boolean;
  }> = ({ icon, label, onClick, count, gold, last }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-tea-surface/50 transition-colors group ${
        !last ? 'border-b border-tea-border' : ''
      }`}
    >
      <div className={gold ? 'text-tea-gold' : 'text-tea-text-sec group-hover:text-tea-gold transition-colors'}>
        {icon}
      </div>
      <span className="text-sm text-tea-text flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] font-mono text-tea-text-sec mr-1">{count}</span>
      )}
      <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15 group-hover:text-tea-text/30 transition-colors" />
    </button>
  );

  // ── Location card ───────────────────────────────────────────────────────────
  const ActiveLocationCard: React.FC<{ showSwitchButton?: boolean }> = ({ showSwitchButton }) => (
    <div className="rounded-md overflow-hidden border border-tea-border">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 py-3 bg-tea-surface/40 border-l-2 border-tea-gold">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-1.5 h-1.5 rounded-full bg-tea-gold shrink-0" />
            <span className="text-sm font-serif text-tea-text">
              {activeAccount?.name || activeMembership?.account_name || 'Teajia'}
            </span>
            {roleBadgeLabel && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] uppercase tracking-[0.1em] text-tea-gold bg-tea-gold/10 rounded shrink-0">
                {(membershipRole === 'owner' || platformRole) && <SealIcon className="w-2.5 h-2.5" />}
                {roleBadgeLabel}
              </span>
            )}
          </div>
          {activeLocationStr && (
            <span className="text-[11px] text-tea-text-sec mt-0.5 block ml-3.5">
              {activeLocationStr}
              {activeDisplayCurrency && ` · ${activeDisplayCurrency}`}
            </span>
          )}
        </div>
        {showSwitchButton && (
          <button
            onClick={() => setPanelView('location-switcher')}
            className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec/60 hover:text-tea-gold transition-colors shrink-0 ml-3 mt-0.5"
          >
            Switch
          </button>
        )}
      </div>
      {/* Quick links */}
      <div className="flex border-t border-tea-border divide-x divide-tea-border">
        <button
          onClick={() => { onClose(); navigate('/shop'); }}
          className="flex-1 py-2.5 text-[9px] uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-gold hover:bg-tea-surface/50 transition-colors"
        >
          Shop
        </button>
        <button
          onClick={() => { onClose(); navigate(activeMembership?.slug ? `/store/${activeMembership.slug}` : '/find-a-table'); }}
          className="flex-1 py-2.5 text-[9px] uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-gold hover:bg-tea-surface/50 transition-colors"
        >
          Events
        </button>
        {isStaff && (
          <button
            onClick={() => handleGoToAdmin('/admin/inventory')}
            className="flex-1 py-2.5 text-[9px] uppercase tracking-[0.15em] text-tea-gold hover:bg-tea-surface/50 transition-colors"
          >
            Ops
          </button>
        )}
      </div>
    </div>
  );

  const InactiveLocationCard: React.FC<{ membership: AccountMembership }> = ({ membership }) => {
    const isLoading = switchingTo === membership.account_id;
    return (
      <button
        onClick={() => handleSwitchLocation(membership)}
        disabled={!!switchingTo}
        className="w-full rounded-md border border-tea-border px-4 py-3 flex items-center justify-between hover:bg-tea-surface/30 transition-colors group text-left disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-tea-text/20 group-hover:bg-tea-gold/50 transition-colors shrink-0" />
            <span className="text-sm text-tea-text-sec group-hover:text-tea-text transition-colors font-serif truncate">
              {membership.account_name}
            </span>
            {membership.role !== 'viewer' && (
              <span className="text-[8px] uppercase tracking-[0.1em] text-tea-text-dim shrink-0">
                {membership.role}
              </span>
            )}
          </div>
          <span className="text-[10px] text-tea-text-dim mt-0.5 block ml-3.5">
            {getLocationFromSlug(membership.slug)} · {getCurrencyFromSlug(membership.slug)}
          </span>
        </div>
        {isLoading ? (
          <div className="w-3.5 h-3.5 border border-tea-border border-t-tea-text-sec rounded-full animate-spin shrink-0 ml-2" />
        ) : (
          <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/15 group-hover:text-tea-text/30 transition-colors shrink-0 ml-2" />
        )}
      </button>
    );
  };

  // ── Error block ─────────────────────────────────────────────────────────────
  const FormError: React.FC = () =>
    formError ? (
      <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
        <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{formError}</span>
      </div>
    ) : null;

  // ── Submit button ───────────────────────────────────────────────────────────
  const SubmitButton: React.FC<{ label: string }> = ({ label }) => (
    <button
      type="submit"
      disabled={formLoading}
      className="w-full py-3.5 bg-tea-gold text-tea-text font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
    >
      {formLoading
        ? <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" />
        : label}
    </button>
  );

  const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold transition-colors placeholder-tea-text-sec/50 font-sans text-sm";
  const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
  const labelClass = "block text-[10px] font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-2";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-drawer bg-tea-text/80 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-tea-bg z-modal shadow-2xl flex flex-col"
        style={{
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out, opacity 300ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-tea-border bg-tea-surface/50">
          {panelView !== 'main' ? (
            <button
              onClick={() => { setPanelView('main'); resetForm(); setLocationSearch(''); }}
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
              {theme === 'dark'
                ? <Sun className="w-4.5 h-4.5 text-tea-gold" />
                : <Moon className="w-4.5 h-4.5 text-tea-gold" />}
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

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-6 relative">
          {/* Grain texture */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '120px' }} />

          <div className="space-y-6 relative z-10">

            {/* ══════════════════════════════════════════════════════════════
                SIGN IN
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'signin' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <Icons.LogIn className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text">Welcome Back</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Sign in to your Teajia account</p>
                </div>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className={labelClass}>Email or Username</label>
                    <input type="text" value={signinIdentifier} onChange={e => setSigninIdentifier(e.target.value)} autoComplete="username" className={inputClass} style={inputStyle} placeholder="you@example.com or username" required autoFocus />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} style={inputStyle} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-text/30 hover:text-tea-text transition-colors">
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <FormError />
                  <SubmitButton label="Sign In" />
                </form>
                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-text-sec">
                    Don't have an account?{' '}
                    <button onClick={() => { resetForm(); setPanelView('signup'); }} className="text-tea-gold hover:text-tea-gold/80 font-medium transition-colors">Create one</button>
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SIGN UP
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'signup' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <SealIcon className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text">Join Teajia</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Create your account to get started</p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="Your name" required autoFocus />
                  </div>
                  <div>
                    <label className={labelClass}>Username <span className="normal-case tracking-normal font-normal text-tea-text-dim">(optional)</span></label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" pattern="[a-zA-Z0-9_.\-]{3,32}" className={inputClass} style={inputStyle} placeholder="Letters, numbers, . _ -" />
                    <p className="text-[11px] text-tea-text/40 mt-1.5">Sign in with either your email or username.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} style={inputStyle} placeholder="you@example.com" required />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} style={inputStyle} placeholder="Min 6 characters" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-tea-text/30 hover:text-tea-text transition-colors">
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-tea-text/40 mt-1.5">Must be at least 6 characters</p>
                  </div>
                  <FormError />
                  <SubmitButton label="Create Account" />
                </form>
                <div className="mt-8 text-center">
                  <p className="text-sm text-tea-text-sec">
                    Already have an account?{' '}
                    <button onClick={() => { resetForm(); setPanelView('signin'); }} className="text-tea-gold hover:text-tea-gold/80 font-medium transition-colors">Sign in</button>
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                CHANGE PASSWORD
            ══════════════════════════════════════════════════════════════ */}
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
                    <label className={labelClass}>Current Password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} style={inputStyle} required autoFocus />
                  </div>
                  <div>
                    <label className={labelClass}>New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} style={inputStyle} placeholder="Min 6 characters" required />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className={inputClass} style={inputStyle} required />
                  </div>
                  <FormError />
                  <SubmitButton label="Update Password" />
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                EDIT PROFILE
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'edit-profile' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col items-center pt-2 pb-6">
                  <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                    <Icons.User className="w-7 h-7 text-tea-gold" />
                  </div>
                  <h3 className="font-serif text-xl text-tea-text">Edit Profile</h3>
                  <p className="text-sm text-tea-text-sec mt-1 font-serif italic">Update your name, username, or email</p>
                </div>
                <form onSubmit={handleEditProfile} className="space-y-4">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} style={inputStyle} placeholder={auth.user?.name || 'Your name'} autoFocus />
                  </div>
                  <div>
                    <label className={labelClass}>Username <span className="normal-case tracking-normal font-normal text-tea-text-dim">(optional)</span></label>
                    <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} autoComplete="username" pattern="[a-zA-Z0-9_.\-]{3,32}" className={inputClass} style={inputStyle} placeholder={auth.user?.username || 'Pick a username'} />
                    <p className="text-[11px] text-tea-text/40 mt-1.5">Leave blank to remove. Sign in with email or username.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={inputClass} style={inputStyle} placeholder={auth.user?.email || 'you@example.com'} />
                  </div>
                  <FormError />
                  <SubmitButton label="Save Changes" />
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MY COLLECTION
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'collection' && (
              <MyCollection onBack={() => setPanelView('main')} />
            )}

            {/* ══════════════════════════════════════════════════════════════
                TASTING JOURNAL
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'tasting-journal' && (
              <TastingJournal
                onBack={() => setPanelView('main')}
                onOrderTea={(teaId) => { onClose(); navigate(`/shop/product/${teaId}`); }}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                TEA COMPASS
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'tea-compass' && (
              <TeaCompass onBack={() => setPanelView('main')} />
            )}

            {/* ══════════════════════════════════════════════════════════════
                SAVED STORIES
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'saved-stories' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                {savedStoryEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                      <Icons.Leaf className="w-7 h-7 text-tea-gold/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-text mb-2">No Saved Stories</h3>
                    <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
                      Tap the leaf icon while reading to save stories for later.
                    </p>
                  </div>
                ) : (
                  <div className="border border-tea-border overflow-hidden rounded-md">
                    {savedStoryEntries.map((storyId, i) => (
                      <button
                        key={storyId}
                        onClick={() => { onNavigateToStory?.(storyId); onClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${i < savedStoryEntries.length - 1 ? 'border-b border-tea-border' : ''}`}
                      >
                        <Icons.Leaf className="w-4 h-4 text-tea-gold shrink-0" />
                        <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors truncate">Story #{storyId}</span>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                READING HISTORY
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'reading-history' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                {readingHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
                      <Icons.BookOpen className="w-7 h-7 text-tea-gold/40" />
                    </div>
                    <h3 className="font-serif text-lg text-tea-text mb-2">No Reading History</h3>
                    <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
                      Your reading progress will appear here as you explore articles.
                    </p>
                  </div>
                ) : (
                  <div className="border border-tea-border overflow-hidden rounded-md">
                    {readingHistory.map((entry, i) => (
                      <button
                        key={entry.storyId}
                        onClick={() => { onNavigateToStory?.(entry.storyId); onClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-tea-surface/50 transition-colors group text-left ${i < readingHistory.length - 1 ? 'border-b border-tea-border' : ''}`}
                      >
                        <Icons.BookOpen className="w-4 h-4 text-tea-text-sec shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-serif text-sm text-tea-text group-hover:text-tea-gold transition-colors truncate block">Story #{entry.storyId}</span>
                          <span className="text-[10px] text-tea-text-sec">Page {entry.page + 1}</span>
                        </div>
                        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text/20 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                LOCATION SWITCHER (4+ memberships)
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'location-switcher' && (
              <div className="animate-[fadeIn_0.3s_ease-out] space-y-4">
                {/* Search */}
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec/50 pointer-events-none" />
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={e => setLocationSearch(e.target.value)}
                    placeholder="Search locations…"
                    autoFocus
                    className="w-full bg-tea-surface border border-tea-border pl-9 pr-4 py-2.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold transition-colors placeholder-tea-text-sec/40"
                  />
                </div>

                {/* Current */}
                {!locationSearch && (
                  <>
                    <div>
                      <ZoneLabel>Current</ZoneLabel>
                      <ActiveLocationCard />
                    </div>
                    <Separator />
                    <div>
                      <ZoneLabel>All Locations ({memberships.length})</ZoneLabel>
                    </div>
                  </>
                )}

                {/* All / filtered list */}
                <div className="space-y-2">
                  {filteredMemberships
                    .filter(m => locationSearch ? true : m.account_id !== activeAccountId)
                    .map(m => (
                      <InactiveLocationCard key={m.account_id} membership={m} />
                    ))
                  }
                  {filteredMemberships.length === 0 && (
                    <p className="text-sm text-tea-text-sec/60 text-center py-8">No locations match "{locationSearch}"</p>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MAIN VIEW
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'main' && (
              <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">

                {/* ── Zone: Identity ────────────────────────────────────── */}
                {auth.isAuthenticated && auth.user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-tea-gold/10 flex items-center justify-center border border-tea-border shrink-0">
                      <span className="text-base font-serif text-tea-gold font-medium">
                        {getInitials(auth.user.name || auth.user.email)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-sm text-tea-text truncate">
                          {auth.user.name || 'Tea Enthusiast'}
                        </h3>
                        {roleBadgeLabel && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-px text-[8px] uppercase tracking-[0.1em] text-tea-gold bg-tea-gold/10 rounded shrink-0">
                            {(membershipRole === 'owner' || platformRole) && <SealIcon className="w-2.5 h-2.5" />}
                            {roleBadgeLabel}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-tea-text-sec truncate block">{auth.user.email}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-tea-elevated/50 flex items-center justify-center shrink-0">
                      <Icons.User className="w-5 h-5 text-tea-text/30" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm text-tea-text">Tea Enthusiast</h3>
                      <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">Guest</span>
                    </div>
                  </div>
                )}

                <Separator />

                {/* ── Zone: Your Locations ──────────────────────────────── */}
                <div>
                  <ZoneLabel>Your Location</ZoneLabel>

                  {/* Authenticated — passport / single card / switcher */}
                  {auth.isAuthenticated && memberships.length > 0 && (
                    <div className="space-y-2">
                      {/* Active card — always shown */}
                      <ActiveLocationCard showSwitchButton={memberships.length >= 4} />

                      {/* Passport: 2–3 memberships — show inactive cards inline */}
                      {memberships.length >= 2 && memberships.length <= 3 && inactiveMemberships.map(m => (
                        <InactiveLocationCard key={m.account_id} membership={m} />
                      ))}
                    </div>
                  )}

                  {/* Guest — static location strip */}
                  {!auth.isAuthenticated && (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-md bg-tea-surface/30 border border-tea-border">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-tea-gold/60 shrink-0" />
                        <span className="text-sm text-tea-text-sec font-serif">Teajia Bali</span>
                        <span className="text-[10px] text-tea-text-dim">· USD</span>
                      </div>
                      <button
                        onClick={() => { onClose(); navigate('/shop'); }}
                        className="text-[9px] uppercase tracking-[0.15em] text-tea-text-sec/50 hover:text-tea-text-sec transition-colors"
                      >
                        Switch in Shop
                      </button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Zone: Guest CTAs ──────────────────────────────────── */}
                {!auth.isAuthenticated && (
                  <>
                    <div className="space-y-3">
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
                    <Separator />
                  </>
                )}

                {/* ── Zone: Operations (staff+) ─────────────────────────── */}
                {auth.isAuthenticated && isStaff && (
                  <>
                    <div>
                      <ZoneLabel>Operations</ZoneLabel>
                      <div className="border border-tea-border overflow-hidden rounded-md">
                        <NavRow
                          icon={<Icons.Settings className="w-4 h-4" />}
                          label="Inventory"
                          onClick={() => handleGoToAdmin('/admin/inventory')}
                          gold
                        />
                        <NavRow
                          icon={<Icons.Clock className="w-4 h-4" />}
                          label="Orders"
                          onClick={() => handleGoToAdmin('/admin/orders')}
                          gold
                        />
                        {auth.isAdmin && (
                          <NavRow
                            icon={<Icons.BookOpen className="w-4 h-4" />}
                            label="Records"
                            onClick={() => handleGoToAdmin('/admin/records')}
                            gold
                          />
                        )}
                        {auth.isAdmin && (
                          <NavRow
                            icon={<Icons.User className="w-4 h-4" />}
                            label="Team"
                            onClick={() => handleGoToAdmin('/admin/team')}
                            gold
                          />
                        )}
                        {membershipRole === 'owner' && (
                          <NavRow
                            icon={<Icons.Shield className="w-4 h-4" />}
                            label="Account Settings"
                            onClick={() => handleGoToAdmin('/admin/account-settings')}
                            gold
                            last
                          />
                        )}
                        {membershipRole !== 'owner' && (
                          /* last item for non-owners is Team or Records */
                          <></>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* ── Zone: Your Tea (authenticated) ───────────────────── */}
                {auth.isAuthenticated && (
                  <>
                    <div>
                      <ZoneLabel>Your Tea</ZoneLabel>
                      <div className="border border-tea-border overflow-hidden rounded-md">
                        <NavRow
                          icon={<Icons.MapPin className="w-4 h-4" />}
                          label="Tea Compass"
                          onClick={() => setPanelView('tea-compass')}
                        />
                        <NavRow
                          icon={<Icons.Sparkles className={`w-4 h-4 ${tastingJournal.length > 0 ? 'text-tea-gold' : ''}`} />}
                          label="Tasting Journal"
                          onClick={() => setPanelView('tasting-journal')}
                          count={tastingJournal.length}
                        />
                        <NavRow
                          icon={<Icons.Heart className={`w-4 h-4 ${favoriteTeas.length > 0 ? 'text-tea-gold' : ''}`} />}
                          label="My Collection"
                          onClick={() => setPanelView('collection')}
                          count={favoriteTeas.length}
                        />
                        <NavRow
                          icon={<Icons.Bag className="w-4 h-4" />}
                          label="Cart"
                          onClick={handleOpenCart}
                          count={cartCount}
                          last
                        />
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* ── Zone: Library (all users — localStorage backed) ───── */}
                {(savedStoryCount > 0 || progressCount > 0) && (
                  <>
                    <div>
                      <ZoneLabel>Library</ZoneLabel>
                      <div className="border border-tea-border overflow-hidden rounded-md">
                        {savedStoryCount > 0 && (
                          <NavRow
                            icon={<Icons.Leaf className="w-4 h-4 text-tea-gold" />}
                            label="Saved Stories"
                            onClick={() => setPanelView('saved-stories')}
                            count={savedStoryCount}
                            last={progressCount === 0}
                          />
                        )}
                        {progressCount > 0 && (
                          <NavRow
                            icon={<Icons.BookOpen className="w-4 h-4" />}
                            label="Reading History"
                            onClick={() => setPanelView('reading-history')}
                            count={progressCount}
                            last
                          />
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* ── Zone: Explore (all users) ─────────────────────────── */}
                <div>
                  <ZoneLabel>Explore</ZoneLabel>
                  <div className="border border-tea-border overflow-hidden rounded-md">
                    <NavRow
                      icon={<Icons.MapPin className="w-4 h-4" />}
                      label="Find a Teahouse"
                      onClick={() => { onClose(); navigate('/find-a-table'); }}
                    />
                    <NavRow
                      icon={<Icons.Clock className="w-4 h-4" />}
                      label="Upcoming Events"
                      onClick={() => { onClose(); navigate(activeMembership?.slug ? `/store/${activeMembership.slug}` : '/find-a-table'); }}
                    />
                    <NavRow
                      icon={<Icons.Sparkles className="w-4 h-4" />}
                      label="Book a Consult"
                      onClick={() => { onClose(); navigate('/consult'); }}
                      last
                    />
                  </div>
                </div>

                <Separator />

                {/* ── Zone: Preferences ─────────────────────────────────── */}
                <div>
                  <ZoneLabel>Preferences</ZoneLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-tea-text-sec/50 shrink-0">Currency</span>
                    <div className="flex flex-wrap gap-1">
                      {CURRENCY_OPTIONS.map(opt => (
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

                {/* ── Zone: Account Settings (authenticated) ───────────── */}
                {auth.isAuthenticated && (
                  <>
                    <Separator />
                    <div>
                      <ZoneLabel>Account</ZoneLabel>
                      <div className="border border-tea-border overflow-hidden rounded-md">
                        <NavRow
                          icon={<Icons.User className="w-4 h-4" />}
                          label="Edit Profile"
                          onClick={() => {
                            setEditName(auth.user?.name || '');
                            setEditEmail(auth.user?.email || '');
                            setEditUsername(auth.user?.username || '');
                            setPanelView('edit-profile');
                          }}
                        />
                        <NavRow
                          icon={<Icons.Lock className="w-4 h-4" />}
                          label="Change Password"
                          onClick={() => { resetForm(); setPanelView('change-password'); }}
                          last
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Zone: Platform (platform role only) ──────────────── */}
                {platformRole && (
                  <>
                    <Separator />
                    <div>
                      <ZoneLabel>Platform</ZoneLabel>
                      <div className="border border-tea-border overflow-hidden rounded-md">
                        <NavRow
                          icon={<Icons.Shield className="w-4 h-4" />}
                          label="Platform Admin"
                          onClick={() => handleGoToAdmin('/admin/platform')}
                          gold
                          last
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Sign Out ──────────────────────────────────────────── */}
                {auth.isAuthenticated && (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-tea-text-sec/40 hover:text-red-500 transition-colors text-xs uppercase tracking-[0.2em]"
                  >
                    <Icons.LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
};
