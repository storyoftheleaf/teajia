
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons, SealIcon } from '../Icons';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../hooks/useAuth';
import { selectHasBundle, useAppStore } from '../../lib/store';

import { api, hydrateAccountStateFromToken, isTokenScopedToAccount } from '../../lib/api';
import { authPagePath, authReturnTo } from '../../lib/authNavigation';
import { fetchStoreEvents } from '../../lib/storefrontApi';
import { hydrateTastingJournal } from '../../lib/tastingJournalSync';
import type { Currency } from '../../admin/types';
import type { AccountMembership } from '../../types';
import type { TeaEvent } from '../../types/events';

import type { PanelView } from './types';
import { TastingJournalView } from './TastingJournalView';
import { CellarView } from './CellarView';
import { ReaderView } from './ReaderView';
import { useManageNav } from '../manageNav';
import { LaunchpadView } from './LaunchpadView';
import { useSiteIncidents, activeIncidentCount } from '../../lib/useSiteIncidents';
import { useAtlasAccess } from '../../atlas/access';
import { usePayAccess } from '../profile/PayAccessPanel';
import { THREADS, profileThreads } from '../TeaDiscovery/threads';
import { AccountSwitcherChip } from './AccountSwitcherChip';
import { buildTeaMasterReadiness, type ShopReadinessInput, type TeaMasterReadiness } from '../readiness/teaMasterReadiness';
import { usePersonReadiness } from '../readiness/usePersonReadiness';

interface AccountPanelProps {
  onClose: () => void;
  initialView?: PanelView;
}

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

const AVATAR_KEY = 'teajia_avatar_data_url';

const Separator: React.FC = () => (
  <div className="h-px bg-tea-border" />
);

const ZoneLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-ui-11 uppercase tracking-[0.22em] text-tea-text-sec font-medium block mb-2.5 px-0.5">
    {children}
  </span>
);

export const AccountPanel: React.FC<AccountPanelProps> = ({ onClose, initialView }) => {
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
    teaDiscoveryProfile,
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

  const VALID_VIEWS: PanelView[] = ['main', 'location-switcher', 'events', 'signin', 'signup', 'journal', 'cellar'];
  const [panelView, setPanelViewRaw] = useState<PanelView>(() => {
    if (initialView && initialView !== 'signin' && initialView !== 'signup' && VALID_VIEWS.includes(initialView)) return initialView;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PanelView | null;
      if (saved && PERSISTABLE_VIEWS.includes(saved)) return saved;
    } catch {}
    return 'main';
  });

  const setPanelView = (view: PanelView) => {
    if (view === 'signin' || view === 'signup') {
      const params = new URLSearchParams(location.search);
      if (location.pathname !== '/account') params.set('account', '1');
      const search = params.toString();
      const returnTo = authReturnTo(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
      onClose();
      navigate(authPagePath(view, returnTo));
      return;
    }
    const safeView = VALID_VIEWS.includes(view) ? view : 'main';
    setPanelViewRaw(safeView);
    try {
      if (PERSISTABLE_VIEWS.includes(safeView)) {
        localStorage.setItem(STORAGE_KEY, safeView);
      }
    } catch {}
  };

  // Compatibility for old commands that opened an auth view in the panel.
  useEffect(() => {
    if (initialView === 'signin' || initialView === 'signup') setPanelView(initialView);
    // The entry location is captured before navigation closes this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);

  // Location switch state
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');

  // Avatar state
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(AVATAR_KEY); } catch { return null; }
  });

  // Derived
  const activeMembership = memberships.find(m => m.account_id === activeAccountId);
  const localAccountContextName =
    activeMembership?.account_name ||
    (activeAccount?.id === activeAccountId ? activeAccount.name : null);
  const { data: accountContext } = useQuery({
    queryKey: ['panel-account-context', activeAccountId],
    queryFn: () => api.accounts.get(activeAccountId!),
    enabled: auth.isAuthenticated && !!activeAccountId && !localAccountContextName,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const accountContextName = localAccountContextName || accountContext?.name || null;
  const inactiveMemberships = memberships.filter(m => m.account_id !== activeAccountId);
  const membershipRole = activeMembership?.role;
  const isStaff = membershipRole === 'staff' || membershipRole === 'owner' || auth.isAdmin;
  // The Manage rooms this person may open, from the same list the desktop
  // column and the phone's site panel read. The panel offers ONE door to
  // them, and only once the token is confirmed for the active table.
  const manageNav = useManageNav();
  const canReadAtlas = useAtlasAccess();
  const canSell = isTokenScopedToAccount(activeAccountId) && (
    activeMembership?.role === 'owner' ||
    selectHasBundle({ memberships, activeAccountId, platformRole }, 'sell')
  );

  const activeLocationStr = [activeAccount?.location_city, activeAccount?.location_country]
    .filter(Boolean)
    .join(', ');
  const activeDisplayCurrency = (activeAccount?.currency_default || currency) as string;

  const roleBadgeLabel = getRoleBadgeLabel(membershipRole, platformRole);

  // Counts from localStorage

  const cartCount = publicCart.length;

  // Cart "new" indicator: added within last 30 min
  const cartIsNew = cartLastAddedAt != null && (Date.now() - cartLastAddedAt) < 30 * 60 * 1000;

  // Tea Discovery, the threads that draw them, joined ("Stillness · Quality").
  const dispositionName = teaDiscoveryProfile
    ? profileThreads(teaDiscoveryProfile)
        .map((id) => THREADS[id]?.name)
        .filter(Boolean)
        .join(' · ') || null
    : null;

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
          setLocationSearch('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, panelView]);

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

  const handleSignOut = () => { auth.logout(); };

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
  // The shop half of "am I set up yet". The storefront read above only sees a
  // store that is already public, which is exactly the store this question is
  // never about, so the shop's own record and its own stock are read instead.
  const shopAccountQuery = useQuery({
    queryKey: ['panel-shop-account', activeAccountId],
    queryFn: () => api.accounts.get(activeAccountId!),
    enabled: !!activeAccountId && canOperateCurrentTable,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const shopStockQuery = useQuery({
    queryKey: ['panel-shop-sellable-count', activeAccountId],
    queryFn: async () => {
      const products = await api.products.list() as any[];
      return products.filter(product =>
        product.status !== 'Archived'
        && product.is_public !== false
        && (Number(product.stock_grams) > 0 || Number(product.quantity_units) > 0)
        && (Number(product.retail_price_per_gram_usd) > 0 || Number(product.fixed_retail_price_usd) > 0)
      ).length;
    },
    enabled: !!activeAccountId && canOperateCurrentTable,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const [eventListFilter, setEventListFilter] = useState<'upcoming' | 'open' | 'past'>('upcoming');

  // One read, two answers: what is still pending, and whether this shop has ever
  // taken an order at all. The second is a setup question and the first is a
  // daily one, but asking twice would be two calls for one list.
  const invoiceCountsQuery = useQuery({
    queryKey: ['panel-invoice-counts'],
    enabled: isStaff,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const invoices = await api.invoices.list(200) as any[];
      return { total: invoices.length, pending: invoices.filter(i => i.status === 'Pending').length };
    },
  });
  const pendingCount = invoiceCountsQuery.data?.pending ?? 0;

  // What needs Adrian: the four kinds of waiting work, gathered server-side
  // and already ordered oldest first. Only ever fetched for a reader who can
  // actually sell for this table, so a customer never receives the queue.
  const { data: attention, isSuccess: attentionLoaded } = useQuery({
    queryKey: ['panel-attention', activeAccountId],
    enabled: auth.isAuthenticated && canSell,
    staleTime: 1000 * 60,
    retry: false,
    queryFn: () => api.attention.list(),
  });
  // `null` until the read succeeds, so the panel never claims a calm it has
  // not measured. An empty array is a real answer; a failed read is not.
  const attentionItems = attentionLoaded ? attention.items : null;

  // Pay is private: requests to see this person's payment details, answered
  // here. Null for a reader with no public profile (the worker says 409 and
  // the hook turns that into "nothing to show").
  const payAccessQuery = usePayAccess(auth.isAuthenticated);
  const payAccessMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approve' | 'decline' }): Promise<{ status: string }> =>
      decision === 'approve' ? api.profile.approvePayAccess(id) : api.profile.declinePayAccess(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', 'pay-access'] }),
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

  // Site problems are the builder's to resolve, so they surface here and only
  // for the platform owner. A visitor never makes this request.
  const siteIncidentsQuery = useSiteIncidents(auth.isAuthenticated && auth.isAdmin);
  const siteProblemCount = activeIncidentCount(siteIncidentsQuery.data);

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

  // ── Am I set up yet ─────────────────────────────────────────────────────
  // Being a tea master is one thing to a person and two things to the system,
  // and until now nothing knew about both halves at once. The person's side is
  // read from their own profile; the shop's side only exists when a shop is
  // attached, because a tea master can be paid while selling nothing.
  const person = usePersonReadiness(auth.isAuthenticated);

  const shopReadiness = useMemo<ShopReadinessInput | null>(() => {
    if (!canOperateCurrentTable) return null;
    const shopAccount = shopAccountQuery.data;
    if (!shopAccount) return null;
    return {
      name: shopAccount.name ?? null,
      hasCurrency: Boolean(shopAccount.currency_default),
      hasContact: Boolean(shopAccount.whatsapp_number || shopAccount.contact_email),
      sellableProductCount: shopStockQuery.data ?? 0,
      isPublicEnabled: Boolean(shopAccount.public_enabled),
      orderCount: invoiceCountsQuery.data?.total ?? 0,
    };
  }, [canOperateCurrentTable, shopAccountQuery.data, shopStockQuery.data, invoiceCountsQuery.data]);

  const teaMasterReadiness = useMemo<TeaMasterReadiness | null>(() => {
    // Nothing is claimed before it is measured: a half-answered read looks the
    // same as a finished setup, and the wrong one of those hides the card.
    if (!person.isLoaded) return null;
    if (canOperateCurrentTable && !(shopAccountQuery.isSuccess && shopStockQuery.isSuccess && invoiceCountsQuery.isSuccess)) return null;
    // A signed-in customer is not being asked to become a tea master.
    if (!person.hasProfile && !canOperateCurrentTable) return null;
    return buildTeaMasterReadiness({ person, shop: shopReadiness });
  }, [
    canOperateCurrentTable,
    invoiceCountsQuery.isSuccess,
    person,
    shopAccountQuery.isSuccess,
    shopReadiness,
    shopStockQuery.isSuccess,
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
  // One width rule for the whole panel. The panel fills the screen, so any
  // view left uncapped stretches its buttons edge to edge on desktop. Three
  // widths: the signed-in launchpad's tile grid, the three lists (sessions,
  // the tasting journal and the cellar, whose rows carry more than a form field), and
  // everything else.
  const panelColumn =
    panelView === 'main' && auth.isAuthenticated ? 'max-w-[920px]' :
    panelView === 'events' || panelView === 'journal' || panelView === 'cellar' ? 'max-w-xl' :
    'max-w-sm';

  const headerTitle =
    panelView === 'location-switcher' ? 'Switch table' :
    panelView === 'events' ? 'Sessions' :
    panelView === 'signin' ? 'Sign In' :
    panelView === 'signup' ? 'Create Account' :
    panelView === 'journal' ? 'Tasting Journal' :
    panelView === 'cellar' ? 'My Cellar' :
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
  // Its Shop / Sessions / Ops links were cut (2026-09-29): the manage tile is
  // the one door into Manage, and Shop and Sessions have their own doors.
  const ActiveLocationCard: React.FC<{ showSwitchButton?: boolean }> = ({ showSwitchButton }) => (
    <div className="rounded-xl overflow-hidden border border-tea-border bg-tea-surface">
      <div className="flex items-start justify-between px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2 h-2 rounded-full bg-tea-gold shrink-0" />
            <span className="font-display text-ui-15 text-tea-text">
              {activeAccount?.name || activeMembership?.account_name || 'Teajia'}
            </span>
            {roleBadgeLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40 shrink-0">
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
            className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text transition-colors shrink-0 ml-3 mt-0.5 py-2 -my-2"
          >
            Switch
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
        className="w-full rounded-xl border border-tea-border bg-tea-surface px-4 py-3.5 flex items-center justify-between hover:bg-tea-accent-sub transition-colors group text-left disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tea-text-sec group-hover:bg-tea-gold transition-colors shrink-0" />
            <span className="font-display text-ui-15 text-tea-text-sec group-hover:text-tea-text transition-colors truncate">
              {membership.account_name}
            </span>
            {membership.role !== 'viewer' && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps bg-tea-elevated text-tea-text-sec shrink-0">
                {membership.role}
              </span>
            )}
          </div>
          <span className="text-ui-12 text-tea-text-sec mt-1 block ml-4">
            {getLocationFromSlug(membership.slug)} · {getCurrencyFromSlug(membership.slug)}
          </span>
        </div>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin text-tea-text-sec shrink-0 ml-2" />
        ) : (
          <Icons.ChevronRight className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-text transition-colors shrink-0 ml-2" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 sidebar-inset z-panel-backdrop bg-black/80 backdrop-blur-sm ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: isVisible ? 'opacity 300ms ease' : 'opacity 150ms ease' }}
        onClick={onClose}
      />

      {/* Panel, full-screen at all sizes (launchpad, not side drawer).
          Was md:w-[400px] right-anchored drawer; now fills the viewport so
          the tile grid has stage. It stops at the desktop sidebar
          (sidebar-inset) so the rail stays usable, and the phone's bottom bar
          sits above it (z-nav). X (top-left), Escape, and backdrop-click all close. */}
      <div
        ref={focusTrapRef}
        className="fixed inset-0 sidebar-inset bg-tea-bg z-panel-modal flex flex-col"
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

        {/* Header: Close + Back cluster top-left; title absolutely centered; theme toggle demoted right */}
        <div className="relative flex items-center px-4 py-2.5 border-b border-tea-border bg-tea-surface">
          {/* Left cluster: Close, then Back (when in a sub-view) */}
          <div className="flex items-center gap-1 shrink-0 relative z-10">
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 text-tea-text-sec hover:text-tea-text active:scale-95 transition-[color,transform] duration-150"
              aria-label="Close"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
            {isSubView && (
              <button
                onClick={() => { setPanelView('main'); setLocationSearch(''); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 text-tea-text-sec hover:text-tea-text active:scale-95 transition-[color,transform] duration-150"
                aria-label="Back"
              >
                <Icons.ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centered title, absolutely positioned so it ignores sibling width */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60%] text-center">
            <h2 className="h3 truncate">{headerTitle}</h2>
            {!isSubView && auth.isAuthenticated && (
              <p className="text-ui-10 text-tea-text-sec truncate mt-0.5">
                {accountContextName ? `Logged in to ${accountContextName}` : 'Logged in to your account'}
              </p>
            )}
          </div>

          {/* Right, theme toggle, demoted */}
          <button
            onClick={(e) => toggleTheme(e)}
            className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 text-tea-text-dim hover:text-tea-text-sec active:scale-95 transition-[color,transform] duration-150 shrink-0 relative z-10"
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
          {/* Account-switcher chip, only when user has multiple memberships
              and we're on the main panel view (any role: Operator/Member/Reader/Staff). */}
          {panelView === 'main' && memberships.length > 1 && (
            <div className="px-4 pt-3 pb-1 relative z-20">
              <AccountSwitcherChip
                memberships={memberships}
                activeAccountId={activeAccountId}
                switchingTo={switchingTo}
                onSwitch={handleSwitchLocation}
              />
            </div>
          )}
          <AnimatePresence mode="wait">
          <motion.div
            key={panelView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`relative z-10 w-full mx-auto ${panelColumn}`}
          >

            {/* ══════════════════════════════════════════════════════════════
                EVENTS VIEW, inline sessions listing
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'events' && (
              <div className="px-6 pt-6 pb-6 animate-[fadeIn_0.25s_ease-out] space-y-1">
                <div className="mb-4">
                  <p className="label-caps text-tea-text-dim mb-2">
                    {activeAccount?.name || 'Sessions'} · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <h2 className="h2">
                    Gather <em className="text-tea-gold italic">around tea.</em>
                  </h2>
                  <div className="flex items-center gap-6 mt-4 border-b border-tea-border">
                    {([['upcoming', 'Upcoming'], ['open', 'Open seats'], ['past', 'Past']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setEventListFilter(key)}
                        className={`py-2.5 text-ui-12 uppercase tracking-[0.15em] transition-colors border-b ${
                          eventListFilter === key
                            ? 'text-tea-text border-tea-gold'
                            : 'text-tea-text-sec hover:text-tea-text border-transparent'
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
                  <p className="font-body italic text-ui-15 text-tea-text-sec py-10 text-center">
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
                              <div className="text-ui-11 tracking-caps text-tea-text-sec uppercase">{day}</div>
                              <div className="font-display text-ui-28 text-tea-text leading-none mt-0.5">{dateNum}</div>
                              <div className="text-ui-11 tracking-caps text-tea-text-sec mt-0.5">{month}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-display text-ui-15 text-tea-text leading-snug">{ev.title}</h3>
                              {ev.subtitle && (
                                <p className="font-body italic text-ui-13 text-tea-text-sec mt-1">{ev.subtitle}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-ui-12 text-tea-text-sec flex-wrap">
                                <span className="font-mono tabular-nums">{time}</span>
                                {(ev.areaHint || ev.locationName) && (
                                  <>
                                    <span className="w-0.5 h-0.5 rounded-full bg-tea-text-sec shrink-0" />
                                    <span>{ev.areaHint ?? ev.locationName}</span>
                                  </>
                                )}
                                {seats != null && !isPast && (
                                  <span className={`ml-auto font-mono tabular-nums${isFull ? ' text-tea-error' : ' text-tea-gold'}`}>
                                    {isFull ? 'Full' : `${seats}/${ev.totalCapacity}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {/* RSVP button, only for upcoming events with seats available */}
                          {!isPast && !isFull && (
                            <div className="mt-3 ml-[calc(3rem+0.875rem)]">
                              <a
                                href={buildRsvpLink(ev)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors tap-target"
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
                PERSONAL CELLAR (stock spine step 4)
            ══════════════════════════════════════════════════════════════ */}
            {panelView === 'cellar' && (
              <CellarView onBack={() => setPanelView('main')} />
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
                    className="w-full bg-tea-surface border border-tea-border rounded-md pl-9 pr-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
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
                MAIN VIEW, three zones
            ══════════════════════════════════════════════════════════════ */}
            {/* MAIN: Launchpad for any authenticated tier (member, staff, owner).
                Tier gates which tiles appear inside LaunchpadView. ReaderView
                still handles the signed-out case below. */}
            {panelView === 'main' && auth.isAuthenticated && (
              <LaunchpadView
                user={auth.user}
                avatarDataUrl={avatarDataUrl}
                onAvatarClick={handleAvatarClick}
                roleBadgeLabel={roleBadgeLabel}
                accountName={activeAccount?.name ?? null}
                locationLabel={activeLocationStr || null}
                hasManageRoom={isTokenScopedToAccount(activeAccountId) && manageNav.hasTableRoom}
                manageEntryPath={manageNav.today?.path ?? manageNav.tableItems[0]?.path ?? '/admin/collections'}
                isPlatformOwner={auth.isAdmin}
                siteProblemCount={siteProblemCount}
                canReadAtlas={canReadAtlas}
                membershipsCount={memberships.length}
                pendingInvoiceCount={pendingCount}
                todayEventCount={todayEventCount}
                inboundUnreadCount={inboundUnreadCount}
                journalLastAt={tastingJournal[0]?.createdAt ?? null}
                journalLastTea={tastingJournal[0]?.productName ?? null}
                collectionCount={favoriteTeas.length}
                dispositionName={dispositionName}
                nextEvent={nextEvent ?? null}
                attentionItems={attentionItems}
                readiness={teaMasterReadiness}
                payAccess={payAccessQuery.data ?? null}
                payAccessBusy={payAccessMutation.isPending}
                onApprovePayAccess={id => payAccessMutation.mutate({ id, decision: 'approve' })}
                onDeclinePayAccess={id => payAccessMutation.mutate({ id, decision: 'decline' })}
                onClose={onClose}
                onOpenJournal={() => setPanelView('journal')}
                onOpenEvents={() => setPanelView('events')}
                onOpenCellar={() => setPanelView('cellar')}
                onOpenLocationSwitcher={() => setPanelView('location-switcher')}
                onSignOut={handleSignOut}
              />
            )}

            {panelView === 'main' && !auth.isAuthenticated && (
              <ReaderView
                onClose={onClose}
                onOpenSignIn={() => setPanelView('signin')}
                onOpenSignUp={() => setPanelView('signup')}
                onOpenEvents={() => setPanelView('events')}
              />
            )}


          </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
