
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon, Calendar, Receipt, UserPlus, Package, Clock, CalendarCheck, AlertTriangle, Zap, UserCheck, Compass, LogIn, Users, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons, SealIcon } from '../Icons';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../lib/store';

import { api, setToken, hydrateAccountStateFromToken } from '../../lib/api';
import { fetchStoreEvents, fetchStoreProducts } from '../../lib/storefrontApi';
import { hydrateTastingJournal } from '../../lib/tastingJournalSync';
import type { Currency } from '../../admin/types';
import type { AccountMembership } from '../../types';
import type { TeaEvent } from '../../types/events';

import type { PanelView } from './types';
import { TastingJournalView } from './TastingJournalView';
import { OperatorView } from './OperatorView';
import { MemberView } from './MemberView';
import { ReaderView } from './ReaderView';
import { StaffView } from './StaffView';
import { buildFirstDoorReadiness } from './workflows';

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

function getLocationFromSlug(slug: string): string {
  if (slug.includes('bali') || slug.includes('indonesia') || slug.includes('ubud')) return 'Ubud, Bali';
  if (slug.includes('australia') || slug.includes('melbourne') || slug.includes('sydney')) return 'Australia';
  if (slug.includes('taiwan') || slug.includes('taipei')) return 'Taiwan';
  if (slug.includes('japan') || slug.includes('tokyo') || slug.includes('kyoto')) return 'Japan';
  if (slug.includes('hong-kong') || slug.includes('hongkong')) return 'Hong Kong';
  if (slug.includes('singapore')) return 'Singapore';
  if (slug.includes('malaysia') || slug.includes('kl') || slug.includes('kuala')) return 'Malaysia';
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

function getRoleBadgeLabel(role: string | undefined, platformRole: string | null): string | null {
  if (platformRole === 'platform_owner') return 'Platform Owner';
  if (platformRole === 'platform_admin') return 'Platform Admin';
  if (role === 'owner') return 'Owner';
  if (role === 'staff') return 'Staff';
  return null;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AVATAR_KEY = 'teajia_avatar_data_url';

const Separator: React.FC = () => (
  <div className="h-px bg-tea-border" />
);

const ZoneLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-ui-11 uppercase tracking-[0.22em] text-tea-text-sec font-medium block mb-2.5 px-0.5">
    {children}
  </span>
);

const CardSectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-2.5 border-b border-tea-border bg-tea-surface">
    <span className="text-ui-11 uppercase tracking-[0.22em] text-tea-text-sec font-medium">{children}</span>
  </div>
);

const Item: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  gold?: boolean;
  pulse?: boolean;
  locked?: boolean;
}> = ({ icon, label, description, onClick, gold, pulse, locked }) => {
  const [tapped, setTapped] = useState(false);

  const handleClick = () => {
    if (locked) {
      setTapped(true);
      setTimeout(() => setTapped(false), 350);
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors group border-b border-tea-border last:border-0 ${
        locked
          ? tapped ? 'opacity-90 bg-tea-gold/10' : 'opacity-75'
          : 'hover:bg-tea-surface/50'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className={`shrink-0 ${gold ? 'text-tea-gold' : 'text-tea-gold/70 group-hover:text-tea-gold transition-colors'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-ui-14 font-medium text-tea-text leading-tight">{label}</div>
        <div className="text-ui-12 text-tea-text-sec mt-1 leading-snug">{description}</div>
      </div>
      {pulse ? (
        <span className="relative flex shrink-0">
          <span className="absolute inline-flex h-2 w-2 rounded-full bg-tea-gold opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-tea-gold" />
        </span>
      ) : locked ? (
        <Icons.Lock className={`w-3.5 h-3.5 shrink-0 transition-colors ${tapped ? 'text-tea-gold' : 'text-tea-text-sec'}`} />
      ) : (
        <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors shrink-0" />
      )}
    </button>
  );
};


const JourneyCard: React.FC<{
  journey?: { hasLinkedCustomer: boolean; sessionsAttended: number; totalTeas: number; seals: { eventId: string; title: string; date: string; flyerUrl?: string | null }[]; milestones: string[]; teaTypeMap: Record<string, number>; samples?: unknown[]; compass?: unknown[] } | null;
  onClick: () => void;
}> = ({ journey, onClick }) => {
  const topTypes = journey?.teaTypeMap
    ? Object.entries(journey.teaTypeMap).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t)
    : [];

  return (
    <button
      onClick={onClick}
      className="w-full text-left group px-4 py-4 hover:bg-tea-surface/50 transition-colors border-b border-tea-border last:border-0"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex items-start gap-3.5">
        {/* Circular emblem — mirrors the avatar */}
        <div className="w-10 h-10 rounded-full bg-tea-gold/10 border border-tea-border flex items-center justify-center shrink-0 group-hover:border-tea-gold/40 transition-colors">
          <span className="font-serif text-ui-17 text-tea-gold/80 group-hover:text-tea-gold transition-colors leading-none">茶</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-ui-14 font-medium text-tea-text leading-tight">My Journey</span>
            <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors shrink-0" />
          </div>

          {journey?.hasLinkedCustomer ? (
            <>
              {/* Stat line */}
              <div className="text-ui-12 text-tea-text-sec leading-snug">
                <span className="font-serif text-tea-text">{journey.sessionsAttended}</span>
                {' '}gathering{journey.sessionsAttended !== 1 ? 's' : ''}
                {journey.totalTeas > 0 && (
                  <span className="text-tea-text-sec"> · {journey.totalTeas} teas</span>
                )}
                {(journey.samples?.length ?? 0) > 0 && (
                  <span className="text-tea-text-sec"> · {journey.samples!.length} sampled</span>
                )}
                {(journey.compass?.length ?? 0) > 0 && (
                  <span className="text-tea-text-sec"> · {journey.compass!.length} in collection</span>
                )}
                {topTypes.length > 0 && (
                  <span className="text-tea-text-sec"> · {topTypes.join(', ')}</span>
                )}
              </div>

              {/* Mini seals + milestones */}
              {(journey.seals.length > 0 || journey.milestones.length > 0) && (
                <div className="flex items-center gap-1.5 mt-2">
                  {journey.seals.slice(-5).map(s => (
                    <div key={s.eventId} className="w-5 h-5 rounded-full border border-tea-border overflow-hidden bg-tea-surface shrink-0">
                      {s.flyerUrl
                        ? <img src={s.flyerUrl} alt="" className="w-full h-full object-cover opacity-90" />
                        : <span className="flex items-center justify-center w-full h-full text-ui-8 font-serif text-tea-gold/80">茶</span>}
                    </div>
                  ))}
                  {journey.milestones.length > 0 && (
                    <div className="flex items-center gap-1 ml-0.5">
                      {journey.milestones.slice(-3).map(m => (
                        <span key={m} className="text-ui-12 font-serif text-tea-gold leading-none">{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-ui-12 text-tea-text-sec leading-snug">
              Sessions attended, teas experienced, your marks
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
  gold?: boolean;
}> = ({ icon, label, onClick, badge, gold }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col items-center gap-2 p-3.5 rounded-xl bg-tea-surface border border-tea-border hover:border-tea-gold/30 hover:bg-tea-elevated transition-colors"
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    {!!badge && (
      <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 text-ui-10 bg-tea-gold text-tea-bg rounded-full flex items-center justify-center font-semibold tabular-nums">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    <div className={gold ? 'text-tea-gold' : 'text-tea-text-sec'}>{icon}</div>
    <span className="text-ui-12 text-tea-text font-medium leading-tight text-center">{label}</span>
  </button>
);

export const AccountPanel: React.FC<AccountPanelProps> = ({ onClose, onNavigateToStory, initialView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
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
    shopStoreSlug,
    setShopStoreSlug,
    setActiveAccountId,
    setActiveAccount,
    cartLastAddedAt,
    setUpcomingEventsCount,
  } = useAppStore();

  const focusTrapRef = useFocusTrap<HTMLDivElement>(true);
  const triggerRef = useRef<HTMLElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  useScrollLock(true);
  const PERSISTABLE_VIEWS: PanelView[] = ['main'];
  const STORAGE_KEY = 'teajia-account-view';

  const VALID_VIEWS: PanelView[] = ['main', 'location-switcher', 'events', 'signin', 'signup', 'journal'];
  const [panelView, setPanelViewRaw] = useState<PanelView>(() => {
    if (initialView && VALID_VIEWS.includes(initialView)) return initialView;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PanelView | null;
      if (saved && PERSISTABLE_VIEWS.includes(saved)) return saved;
    } catch {}
    return 'main';
  });

  const setPanelView = (view: PanelView) => {
    const safeView = VALID_VIEWS.includes(view) ? view : 'main';
    setPanelViewRaw(safeView);
    try {
      if (PERSISTABLE_VIEWS.includes(safeView)) {
        localStorage.setItem(STORAGE_KEY, safeView);
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

  // Avatar state
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
  });

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

  const cartCount = publicCart.length;

  // Cart "new" indicator: added within last 30 min
  const cartIsNew = cartLastAddedAt != null && (Date.now() - cartLastAddedAt) < 30 * 60 * 1000;

  // Compass last result from localStorage
  const compassProfile = useMemo(() => {
    try {
      const raw = localStorage.getItem('teajia_compass_profile') || localStorage.getItem('compass-profile');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Accept { tags: string[] } or { result: string } or array
      if (parsed?.tags?.length) return parsed.tags.slice(0, 2).join(' · ');
      if (parsed?.result) return String(parsed.result).slice(0, 30);
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 2).join(' · ');
    } catch {}
    return null;
  }, []);

  // Animate in
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    return () => { triggerRef.current?.focus(); };
  }, []);

  // Close panel whenever the route changes
  const initialPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== initialPathRef.current) {
      onClose();
    }
  }, [location.pathname, onClose]);

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

    setShopStoreSlug(membership.slug);
    setActiveAccountId(membership.account_id);

    try {
      if (auth.isAuthenticated) {
        await api.accounts.switch(membership.account_id);
        hydrateAccountStateFromToken();
        try {
          const account = await api.accounts.get(membership.account_id);
          setActiveAccount(account);
          if (account.currency_default) {
            setCurrency(account.currency_default as Currency);
          }
        } catch { /* non-critical */ }
      }
      queryClient.invalidateQueries();
      if (!activeAccount?.currency_default) {
        setCurrency(getCurrencyFromSlug(membership.slug));
      }
    } catch {
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
    navigate(path);
  };

  const getInitials = (nameStr: string) =>
    nameStr.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Avatar upload
  const handleAvatarClick = () => {
    if (auth.isAuthenticated) avatarInputRef.current?.click();
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatarDataUrl(url);
      try { localStorage.setItem(AVATAR_KEY, url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Hydrate tasting journal from server when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      hydrateTastingJournal().catch(() => {});
    }
  }, [auth.isAuthenticated]);

  // Events for current store
  const activeSlug = activeMembership?.slug || shopStoreSlug || 'teajia-bali';
  const { data: storeEvents = [], isLoading: eventsLoading } = useQuery<TeaEvent[]>({
    queryKey: ['panel-events', activeSlug],
    queryFn: () => fetchStoreEvents(activeSlug),
    enabled: !!activeSlug,
    staleTime: 1000 * 60 * 5,
  });

  const canOperateCurrentTable = membershipRole === 'owner' || auth.isAdmin;
  const { data: storeProducts = [] } = useQuery({
    queryKey: ['panel-store-products', activeSlug],
    queryFn: () => fetchStoreProducts(activeSlug),
    enabled: !!activeSlug && canOperateCurrentTable,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const { data: wholesaleOrderCount = 0 } = useQuery({
    queryKey: ['panel-wholesale-order-count', activeAccountId],
    queryFn: async () => {
      const res = await api.wholesale.listOrders({ role: 'buyer' });
      return res.orders.length;
    },
    enabled: !!activeAccountId && canOperateCurrentTable,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const [eventListFilter, setEventListFilter] = useState<'upcoming' | 'open' | 'past'>('upcoming');

  const { data: myJourney } = useQuery({
    queryKey: ['me-journey'],
    enabled: auth.isAuthenticated,
    staleTime: 1000 * 60 * 10,
    queryFn: () => api.me.journey(),
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['panel-pending-count'],
    enabled: isStaff,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const invoices = await api.invoices.list(200);
      return (invoices as any[]).filter(i => i.status === 'Pending').length;
    },
  });

  const { data: inboundUnreadCount = 0 } = useQuery({
    queryKey: ['panel-inbound-unread'],
    enabled: isStaff,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const res = await api.collections.listInbound();
      return res.unread_count ?? 0;
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return storeEvents
      .filter(ev => new Date(ev.eventDate) >= now && ev.status !== 'archived')
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [storeEvents]);

  const openSeatEvents = useMemo(() => {
    const now = new Date();
    return storeEvents
      .filter(ev => new Date(ev.eventDate) >= now && ev.status !== 'archived' && (ev.seatsRemaining ?? 1) > 0)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [storeEvents]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return storeEvents
      .filter(ev => new Date(ev.eventDate) < now || ev.status === 'closed' || ev.status === 'archived')
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  }, [storeEvents]);

  const todayEventCount = useMemo(() => {
    const today = new Date().toDateString();
    return upcomingEvents.filter(ev => new Date(ev.eventDate).toDateString() === today).length;
  }, [upcomingEvents]);

  const isAustraliaDoor = useMemo(() => {
    const haystack = [
      activeSlug,
      activeAccount?.name,
      activeAccount?.location_city,
      activeAccount?.location_country,
      activeLocationStr,
    ].filter(Boolean).join(' ').toLowerCase();
    return ['australia', 'melbourne', 'sydney', 'brisbane', 'perth', 'adelaide'].some(term => haystack.includes(term));
  }, [activeSlug, activeAccount?.name, activeAccount?.location_city, activeAccount?.location_country, activeLocationStr]);

  const isFirstDoorCandidate = useMemo(() => {
    if (!canOperateCurrentTable) return false;
    const hasOperationalHistory =
      storeEvents.length > 0 ||
      pendingCount > 0 ||
      inboundUnreadCount > 0 ||
      Boolean(activeAccount?.public_enabled);
    return isAustraliaDoor || (activeMembership?.account_kind === 'location' && !hasOperationalHistory);
  }, [
    activeMembership?.account_kind,
    activeAccount?.public_enabled,
    canOperateCurrentTable,
    inboundUnreadCount,
    isAustraliaDoor,
    pendingCount,
    storeEvents.length,
  ]);

  const firstDoorReadiness = useMemo(() => {
    const sellableProductCount = storeProducts.filter(product => {
      const price = product.category === 'tea'
        ? Number(product.price_per_gram || product.price_50g || 0)
        : Number(product.pricePerUnit || product.price_50g || 0);
      const stock = product.category === 'tea'
        ? Number(product.stock_g || 0)
        : Number(product.quantityUnits ?? product.stock_g ?? 0);
      return price > 0 && stock > 0;
    }).length;

    return buildFirstDoorReadiness({
      accountName: activeAccount?.name ?? activeMembership?.account_name ?? null,
      locationLabel: activeLocationStr || getLocationFromSlug(activeSlug),
      currencyLabel: activeDisplayCurrency || getCurrencyFromSlug(activeSlug),
      hasContact: Boolean(activeAccount?.whatsapp_number || activeAccount?.contact_email),
      isPublicEnabled: Boolean(activeAccount?.public_enabled),
      publicProductCount: storeProducts.length,
      sellableProductCount,
      wholesaleOrderCount,
      eventCount: storeEvents.length,
      memberCount: memberships.length,
    });
  }, [
    activeAccount?.contact_email,
    activeAccount?.name,
    activeAccount?.public_enabled,
    activeAccount?.whatsapp_number,
    activeDisplayCurrency,
    activeLocationStr,
    activeMembership?.account_name,
    activeSlug,
    memberships.length,
    storeEvents.length,
    storeProducts,
    wholesaleOrderCount,
  ]);

  const displayedEvents = eventListFilter === 'open' ? openSeatEvents : eventListFilter === 'past' ? pastEvents : upcomingEvents;

  // Sync upcoming events count to store for notification dot
  useEffect(() => {
    setUpcomingEventsCount(upcomingEvents.length);
  }, [upcomingEvents.length, setUpcomingEventsCount]);

  // Next upcoming event (for location card)
  const nextEvent = upcomingEvents[0];

  // 24h alert: is the next event within 24 hours?
  const nextEventWithin24h = useMemo(() => {
    if (!nextEvent) return false;
    const diff = new Date(nextEvent.eventDate).getTime() - Date.now();
    return diff > 0 && diff < 86400000;
  }, [nextEvent]);

  // WhatsApp RSVP link for an event
  const buildRsvpLink = (ev: TeaEvent) => {
    const phone = activeAccount?.whatsapp_number?.replace(/\D/g, '') || '';
    const text = encodeURIComponent(`Hi, I'd like to reserve a seat for "${ev.title}" on ${new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`);
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  // WhatsApp general contact
  const waContact = activeAccount?.whatsapp_number?.replace(/\D/g, '') || '';
  const waLink = waContact ? `https://wa.me/${waContact}` : 'https://wa.me/';

  // Header state
  const isSubView = panelView !== 'main';
  const headerTitle =
    panelView === 'location-switcher' ? 'Switch Location' :
    panelView === 'events' ? 'Sessions' :
    panelView === 'signin' ? 'Sign In' :
    panelView === 'signup' ? 'Create Account' :
    panelView === 'journal' ? 'Tasting Journal' :
    'Your Table';

  // Filtered memberships for location switcher
  const filteredMemberships = useMemo(() => {
    if (!locationSearch.trim()) return memberships;
    const q = locationSearch.toLowerCase();
    return memberships.filter(m =>
      m.account_name.toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q) ||
      getLocationFromSlug(m.slug).toLowerCase().includes(q)
    );
  }, [memberships, locationSearch]);

  // ── Location card ───────────────────────────────────────────────────────────
  const ActiveLocationCard: React.FC<{ showSwitchButton?: boolean; hideActions?: boolean }> = ({ showSwitchButton, hideActions }) => (
    <div className="rounded-md overflow-hidden border border-tea-border">
      <div className="flex items-start justify-between px-4 py-3.5 bg-tea-surface">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2 h-2 rounded-full bg-tea-gold shrink-0" />
            <span className="text-ui-15 font-serif text-tea-text">
              {activeAccount?.name || activeMembership?.account_name || 'Teajia'}
            </span>
            {roleBadgeLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-ui-10 uppercase tracking-[0.08em] text-tea-gold bg-tea-gold/10 rounded shrink-0 font-medium">
                {(membershipRole === 'owner' || platformRole) && <SealIcon className="w-2.5 h-2.5" />}
                {roleBadgeLabel}
              </span>
            )}
          </div>
          {activeLocationStr && (
            <span className="text-ui-12 text-tea-text-sec mt-1 block ml-4">
              {activeLocationStr}
              {activeDisplayCurrency && ` · ${activeDisplayCurrency}`}
            </span>
          )}
          {/* Next event line */}
          {nextEvent && (
            <span className="text-ui-12 text-tea-text-sec mt-0.5 block ml-4">
              Next: {new Date(nextEvent.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {showSwitchButton && (
          <button
            onClick={() => setPanelView('location-switcher')}
            className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-gold transition-colors shrink-0 ml-3 mt-0.5 py-2 -my-2"
          >
            Switch
          </button>
        )}
      </div>
      {!hideActions && (
        <div className="flex border-t border-tea-border divide-x divide-tea-border">
          <button
            onClick={() => { onClose(); navigate('/shop'); }}
            className="flex-1 py-3 text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-gold hover:bg-tea-surface/50 transition-colors font-medium"
          >
            Shop
          </button>
          <button
            onClick={() => setPanelView('events')}
            className="flex-1 py-3 text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-gold hover:bg-tea-surface/50 transition-colors font-medium"
          >
            Sessions
          </button>
          {isStaff && (
            <button
              onClick={() => handleGoToAdmin('/admin/inventory')}
              className="flex-1 py-3 text-ui-11 uppercase tracking-[0.15em] text-tea-gold hover:bg-tea-surface/50 transition-colors font-medium"
            >
              Ops
            </button>
          )}
        </div>
      )}
    </div>
  );

  const InactiveLocationCard: React.FC<{ membership: AccountMembership }> = ({ membership }) => {
    const isLoading = switchingTo === membership.account_id;
    return (
      <button
        onClick={() => handleSwitchLocation(membership)}
        disabled={!!switchingTo}
        className="w-full rounded-md border border-tea-border px-4 py-3.5 flex items-center justify-between hover:bg-tea-surface/40 transition-colors group text-left disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tea-text-sec group-hover:bg-tea-gold transition-colors shrink-0" />
            <span className="text-ui-15 text-tea-text-sec group-hover:text-tea-text transition-colors font-serif truncate">
              {membership.account_name}
            </span>
            {membership.role !== 'viewer' && (
              <span className="text-ui-10 uppercase tracking-[0.08em] text-tea-text-sec shrink-0 font-medium">
                {membership.role}
              </span>
            )}
          </div>
          <span className="text-ui-12 text-tea-text-sec mt-1 block ml-4">
            {getLocationFromSlug(membership.slug)} · {getCurrencyFromSlug(membership.slug)}
          </span>
        </div>
        {isLoading ? (
          <div className="w-3.5 h-3.5 border border-tea-border border-t-tea-text-sec rounded-full animate-spin shrink-0 ml-2" />
        ) : (
          <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors shrink-0 ml-2" />
        )}
      </button>
    );
  };

  const FormError: React.FC = () =>
    formError ? (
      <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 text-red-600 text-sm">
        <Icons.AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{formError}</span>
      </div>
    ) : null;

  const SubmitButton: React.FC<{ label: string }> = ({ label }) => (
    <button
      type="submit"
      disabled={formLoading}
      className="w-full py-2.5 bg-tea-gold text-tea-bg font-sans font-medium rounded hover:bg-tea-gold-lt transition-colors duration-150 disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
    >
      {formLoading
        ? <div className="w-4 h-4 border-2 border-tea-border border-t-tea-text-sec rounded-full animate-spin" />
        : label}
    </button>
  );

  const inputClass = "w-full bg-tea-surface border border-tea-border p-3.5 text-tea-text rounded outline-none focus:border-tea-gold focus:ring-0 focus:outline-none transition-colors duration-150 placeholder-tea-text-dim font-sans text-sm";
  const inputStyle = { boxShadow: 'inset 0 1px 0 var(--tea-accent-sub), inset 0 -1px 0 var(--tea-accent-sub)' };
  const labelClass = "block text-ui-10 font-semibold text-tea-text-sec mb-2";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-panel-backdrop bg-black/80 backdrop-blur-sm ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: isVisible ? 'opacity 300ms ease' : 'opacity 150ms ease' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-tea-bg z-panel-modal shadow-2xl flex flex-col"
        style={{
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? undefined : 'none',
          transition: isVisible ? 'opacity 300ms ease' : 'opacity 150ms ease',
        }}
      >
        {/* Hidden avatar file input */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />

        {/* Header — Close + Back cluster top-left; title absolutely centered; theme toggle demoted right */}
        <div className="relative flex items-center px-4 py-2.5 border-b border-tea-border bg-tea-surface">
          {/* Left cluster — Close, then Back (when in a sub-view) */}
          <div className="flex items-center gap-1 shrink-0 relative z-10">
            <button
              onClick={onClose}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 text-tea-text-sec hover:text-tea-text active:scale-95 transition-[color,transform] duration-150"
              aria-label="Close"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
            {isSubView && (
              <button
                onClick={() => { setPanelView('main'); resetForm(); setLocationSearch(''); }}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 text-tea-text-sec hover:text-tea-text active:scale-95 transition-[color,transform] duration-150"
                aria-label="Back"
              >
                <Icons.ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centered title — absolutely positioned so it ignores sibling width */}
          <h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] font-serif text-tea-text tracking-[-0.01em] truncate max-w-[60%] text-center">
            {headerTitle}
          </h2>

          {/* Right — theme toggle, demoted */}
          <button
            onClick={(e) => toggleTheme(e)}
            className="ml-auto min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 text-tea-text-dim hover:text-tea-text-sec active:scale-95 transition-[color,transform] duration-150 shrink-0 relative z-10"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain relative pb-nav-gap surface-warm">
          <AnimatePresence mode="wait">
          <motion.div
            key={panelView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="relative z-10"
          >

            {/* ══════════════════════════════════════════════════════════════
                SIGN IN VIEW (inline, no navigation away)
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'signin' && (
              <div className="px-6 pt-6 pb-6 space-y-5">
                <div>
                  <h2 className="font-serif text-2xl text-tea-text">Welcome back.</h2>
                  <p className="text-ui-14 text-tea-text-sec mt-1.5">Sign in to your Teajia account.</p>
                </div>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <FormError />
                  <div>
                    <label className={labelClass}>Email or username</label>
                    <input
                      type="text"
                      value={signinIdentifier}
                      onChange={e => setSigninIdentifier(e.target.value)}
                      autoFocus
                      required
                      placeholder="email or username"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className={inputClass + ' pr-11'}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <SubmitButton label="Sign In" />
                </form>
                <div className="text-center">
                  <button
                    onClick={() => { resetForm(); setPanelView('signup'); }}
                    className="text-ui-13 text-tea-text-sec hover:text-tea-gold transition-colors py-2 -my-2"
                  >
                    No account? <span className="underline underline-offset-2">Create one</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SIGN UP VIEW (inline)
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'signup' && (
              <div className="px-6 pt-6 pb-6 space-y-5">
                <div>
                  <h2 className="font-serif text-2xl text-tea-text">Join Teajia.</h2>
                  <p className="text-ui-14 text-tea-text-sec mt-1.5">Create your account to track teas, journal sessions, and more.</p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <FormError />
                  <div>
                    <label className={labelClass}>Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="your name" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your email" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass}>Username <span className="text-tea-text-dim normal-case tracking-normal">(optional)</span></label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="teaenthusiast" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="Min. 6 characters"
                        className={inputClass + ' pr-11'}
                        style={inputStyle}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors" tabIndex={-1}>
                        {showPassword ? <Icons.EyeSlash className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <SubmitButton label="Create Account" />
                </form>
                <div className="text-center">
                  <button
                    onClick={() => { resetForm(); setPanelView('signin'); }}
                    className="text-ui-13 text-tea-text-sec hover:text-tea-gold transition-colors py-2 -my-2"
                  >
                    Already have an account? <span className="underline underline-offset-2">Sign in</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                EVENTS VIEW — inline sessions listing
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'events' && (
              <div className="px-6 pt-6 pb-6 animate-[fadeIn_0.25s_ease-out] space-y-1">
                <div className="mb-4">
                  <p className="text-ui-11 uppercase tracking-[0.24em] text-tea-text-sec font-medium mb-2">
                    {activeAccount?.name || 'Sessions'} · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <h2 className="font-serif text-3xl font-normal text-tea-text leading-[1.05] tracking-[-0.5px]">
                    Gather <em className="text-tea-gold italic">around tea.</em>
                  </h2>
                  <div className="flex gap-1.5 mt-4">
                    {([['upcoming', 'Upcoming'], ['open', 'Open seats'], ['past', 'Past']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setEventListFilter(key)}
                        className={`px-3.5 py-2 rounded-full text-ui-12 font-medium tracking-[0.02em] transition-colors border min-h-[36px] ${
                          eventListFilter === key
                            ? 'bg-tea-gold/10 border-tea-gold/40 text-tea-gold'
                            : 'bg-transparent border-tea-border text-tea-text-sec hover:text-tea-text'
                        }`}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {eventsLoading ? (
                  <div className="space-y-3 pt-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3.5 animate-pulse">
                        <div className="w-12 shrink-0 space-y-1 pt-1">
                          <div className="h-2 bg-tea-surface rounded w-8 mx-auto" />
                          <div className="h-7 bg-tea-surface rounded w-10 mx-auto" />
                          <div className="h-2 bg-tea-surface rounded w-8 mx-auto" />
                        </div>
                        <div className="flex-1 space-y-1.5 pt-1">
                          <div className="h-3.5 bg-tea-surface rounded w-3/4" />
                          <div className="h-2.5 bg-tea-surface rounded w-1/2" />
                          <div className="h-2 bg-tea-surface rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedEvents.length === 0 ? (
                  <p className="font-serif italic text-ui-15 text-tea-text-sec py-10 text-center">
                    {eventListFilter === 'past' ? 'No past sessions yet.' : eventListFilter === 'open' ? 'No open seats right now.' : 'No upcoming gatherings at this table.'}
                  </p>
                ) : (
                  <div>
                    {displayedEvents.map((ev, i) => {
                      const d = new Date(ev.eventDate);
                      const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                      const dateNum = String(d.getDate()).padStart(2, '0');
                      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                      const seats = ev.seatsRemaining;
                      const isFull = seats === 0;
                      const isPast = eventListFilter === 'past';
                      return (
                        <div
                          key={ev.id}
                          className={`py-4 ${i < displayedEvents.length - 1 ? 'border-b border-tea-border' : ''}`}
                        >
                          <button
                            onClick={() => { onClose(); navigate(`/event/${ev.slug}`); }}
                            className="w-full flex gap-3.5 text-left hover:opacity-75 transition-opacity"
                          >
                            <div className="w-12 shrink-0 text-center pt-0.5">
                              <div className="text-ui-11 tracking-[0.2em] text-tea-text-sec uppercase font-medium">{day}</div>
                              <div className="font-serif text-ui-28 font-normal text-tea-text leading-none mt-0.5">{dateNum}</div>
                              <div className="text-ui-11 tracking-[0.18em] text-tea-text-sec mt-0.5 font-medium">{month}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-serif text-ui-15 font-medium text-tea-text leading-snug">{ev.title}</h3>
                              {ev.subtitle && (
                                <p className="font-serif italic text-ui-13 text-tea-text-sec mt-1">{ev.subtitle}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-ui-12 text-tea-text-sec flex-wrap">
                                <span>{time}</span>
                                {(ev.areaHint || ev.locationName) && (
                                  <>
                                    <span className="w-0.5 h-0.5 rounded-full bg-tea-text-sec shrink-0" />
                                    <span>{ev.areaHint ?? ev.locationName}</span>
                                  </>
                                )}
                                {seats != null && !isPast && (
                                  <span className={`ml-auto font-medium tabular-nums${isFull ? ' text-red-400' : ' text-tea-gold'}`}>
                                    {isFull ? 'Full' : `${seats}/${ev.totalCapacity}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {/* RSVP button — only for upcoming events with seats available */}
                          {!isPast && !isFull && (
                            <div className="mt-3 ml-[calc(3rem+0.875rem)]">
                              <a
                                href={buildRsvpLink(ev)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-ui-11 uppercase tracking-[0.15em] font-medium bg-tea-gold/10 text-tea-gold border border-tea-gold/30 rounded hover:bg-tea-gold/20 transition-colors min-h-[44px]"
                                onClick={e => e.stopPropagation()}
                              >
                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                Reserve seat
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TASTING JOURNAL VIEW
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'journal' && (
              <div className="px-6 pt-6 pb-6">
                <TastingJournalView
                  onBack={() => setPanelView('main')}
                  onOpenTea={(teaId) => { onClose(); navigate(`/shop/product/${teaId}`); }}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                LOCATION SWITCHER (4+ memberships)
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'location-switcher' && (
              <div className="px-6 pt-6 pb-6 animate-[fadeIn_0.3s_ease-out] space-y-4">
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tea-text-sec pointer-events-none" />
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={e => setLocationSearch(e.target.value)}
                    placeholder="Search locations…"
                    autoFocus
                    className="w-full bg-tea-surface border border-tea-border pl-9 pr-4 py-3 text-ui-14 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold transition-colors placeholder-tea-text-sec"
                  />
                </div>

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

                <div className="space-y-2">
                  {filteredMemberships
                    .filter(m => locationSearch ? true : m.account_id !== activeAccountId)
                    .map(m => (
                      <InactiveLocationCard key={m.account_id} membership={m} />
                    ))
                  }
                  {filteredMemberships.length === 0 && (
                    <p className="text-ui-14 text-tea-text-sec text-center py-8">No locations match "{locationSearch}"</p>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MAIN VIEW — three zones
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'main' && (membershipRole === 'owner' || auth.isAdmin) && (
              <OperatorView
                user={auth.user}
                avatarDataUrl={avatarDataUrl}
                onAvatarClick={handleAvatarClick}
                roleBadgeLabel={roleBadgeLabel}
                accountName={activeAccount?.name ?? null}
                locationLabel={activeLocationStr || null}
                activeStoreSlug={activeSlug}
                currencyLabel={activeDisplayCurrency || getCurrencyFromSlug(activeSlug)}
                isFirstDoorCandidate={isFirstDoorCandidate}
                firstDoorReadiness={firstDoorReadiness}
                isPlatform={!!platformRole}
                isOwner={membershipRole === 'owner' || auth.isAdmin}
                pendingInvoiceCount={pendingCount}
                todayEventCount={todayEventCount}
                unsyncedJournalCount={0}
                inboundUnreadCount={inboundUnreadCount}
                journalLastAt={tastingJournal[0]?.createdAt ?? null}
                journalLastTea={tastingJournal[0]?.productName ?? null}
                journalLastExcerpt={(() => {
                  const head = tastingJournal[0];
                  if (!head) return null;
                  const firstNote = head.note.tasting?.notes?.[0];
                  return (
                    head.note.personalNote
                    ?? (typeof firstNote === 'string' ? firstNote : firstNote?.text)
                    ?? head.note.tasting?.voiceNote
                    ?? null
                  );
                })()}
                journalCount={tastingJournal.length}
                collectionCount={favoriteTeas.length}
                compassProfile={compassProfile}
                journey={myJourney}
                nextEvent={nextEvent ?? null}
                nextEventWithin24h={nextEventWithin24h}
                onClose={onClose}
                onOpenJournal={() => setPanelView('journal')}
                onOpenEvents={() => setPanelView('events')}
                onOpenLocationSwitcher={() => setPanelView('location-switcher')}
                onSignOut={handleSignOut}
                memberCount={memberships.length}
              />
            )}

            {panelView === 'main' && !(membershipRole === 'owner' || auth.isAdmin) && !auth.isAuthenticated && (
              <ReaderView
                onClose={onClose}
                onOpenSignIn={() => setPanelView('signin')}
                onOpenSignUp={() => setPanelView('signup')}
                onOpenEvents={() => setPanelView('events')}
              />
            )}

            {panelView === 'main' && membershipRole === 'staff' && (
              <StaffView
                user={auth.user}
                avatarDataUrl={avatarDataUrl}
                onAvatarClick={handleAvatarClick}
                roleBadgeLabel={roleBadgeLabel}
                accountName={activeAccount?.name ?? null}
                locationLabel={activeLocationStr || null}
                todayEventCount={todayEventCount}
                onClose={onClose}
                onOpenEvents={() => setPanelView('events')}
                onSignOut={handleSignOut}
              />
            )}

            {panelView === 'main' && auth.isAuthenticated && !(membershipRole === 'owner' || auth.isAdmin) && membershipRole !== 'staff' && (
              <MemberView
                user={auth.user}
                avatarDataUrl={avatarDataUrl}
                onAvatarClick={handleAvatarClick}
                roleBadgeLabel={roleBadgeLabel}
                journey={myJourney}
                journalLastAt={tastingJournal[0]?.createdAt ?? null}
                journalLastTea={tastingJournal[0]?.productName ?? null}
                journalLastExcerpt={(() => {
                  const head = tastingJournal[0];
                  if (!head) return null;
                  const firstNote = head.note.tasting?.notes?.[0];
                  return (
                    head.note.personalNote
                    ?? (typeof firstNote === 'string' ? firstNote : firstNote?.text)
                    ?? head.note.tasting?.voiceNote
                    ?? null
                  );
                })()}
                journalCount={tastingJournal.length}
                collectionCount={favoriteTeas.length}
                compassProfile={compassProfile}
                cartCount={cartCount}
                cartIsNew={cartIsNew}
                nextEvent={nextEvent ?? null}
                nextEventWithin24h={nextEventWithin24h}
                upcomingEventsCount={upcomingEvents.length}
                onClose={onClose}
                onOpenJournal={() => setPanelView('journal')}
                onOpenEvents={() => setPanelView('events')}
                onOpenCart={handleOpenCart}
                onSignOut={handleSignOut}
              />
            )}


          </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
