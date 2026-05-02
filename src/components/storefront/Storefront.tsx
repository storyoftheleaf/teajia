import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Account, InventoryItem } from '../../types';
import type { TeaEvent } from '../../types/events';
import { fetchStore, fetchStoreProducts, fetchStoreEvents } from '../../lib/storefrontApi';
import { TeaInventory } from '../TeaInventory';
import { TeawareCatalog } from '../TeawareCatalog';
import { SectionSkeleton } from '../shared/SectionSkeleton';
import { Icons } from '../Icons';
import { api } from '../../lib/api';

interface StorefrontProps {
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  /** Override for tests / direct invocation */
  slug?: string;
}

type StorefrontTab = 'shop' | 'events' | 'about' | 'contact';

const TABS: { id: StorefrontTab; label: string }[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'events', label: 'Events' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
];

export const Storefront: React.FC<StorefrontProps> = ({
  onAddToCart,
  onCartClick,
  onAccountClick,
  cartItemCount = 0,
  slug: slugProp,
}) => {
  const params = useParams<{ slug: string }>();
  const slug = slugProp ?? params.slug ?? '';
  const [activeTab, setActiveTab] = useState<StorefrontTab>('shop');

  const {
    data: store,
    isLoading: storeLoading,
    isError: storeError,
    error: storeErrorObj,
  } = useQuery<Account>({
    queryKey: ['storefront', 'store', slug],
    queryFn: () => fetchStore(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: products = [],
    isLoading: productsLoading,
  } = useQuery<InventoryItem[]>({
    queryKey: ['storefront', 'products', slug],
    queryFn: () => fetchStoreProducts(slug),
    enabled: !!slug && !!store,
    staleTime: 1000 * 60 * 5,
  });

  const { data: events = [] } = useQuery<TeaEvent[]>({
    queryKey: ['storefront', 'events', slug],
    queryFn: () => fetchStoreEvents(slug),
    enabled: !!slug && !!store,
    staleTime: 1000 * 60 * 5,
  });

  const teaInventory = useMemo(() => products.filter(p => p.category === 'tea'), [products]);
  const teawareInventory = useMemo(() => products.filter(p => p.category === 'ware'), [products]);

  // Page metadata
  useEffect(() => {
    if (store?.name) {
      document.title = `${store.name} — Teajia`;
    }
  }, [store?.name]);

  if (storeLoading) {
    return (
      <div className="w-full">
        <SectionSkeleton variant="hero" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-4xl md:text-5xl font-serif text-tea-gold mb-4">Store not found</h1>
        <p className="text-sm text-tea-text-sec mb-2 max-w-md">
          {(storeErrorObj as Error | undefined)?.message || 'We could not find a Teajia table at that address.'}
        </p>
        <p className="text-sm text-tea-text-dim mb-8 max-w-md">
          It may have moved, or the link may be mistyped.
        </p>
        <Link
          to="/find-a-table"
          className="px-8 py-3 bg-tea-gold text-tea-bg text-xs uppercase tracking-display hover:bg-tea-gold/90 transition-colors"
        >
          Browse the network
        </Link>
      </div>
    );
  }

  const location = [store.location_city, store.location_country].filter(Boolean).join(', ');

  return (
    <div className="w-full animate-[fadeIn_0.5s_ease-out]">
      <Helmet>
        <title>{store.name} — Teajia</title>
        {store.tagline && <meta name="description" content={store.tagline} />}
        {store.description && !store.tagline && (
          <meta name="description" content={store.description.slice(0, 160)} />
        )}
      </Helmet>

      {/* Hero */}
      <header className="relative overflow-hidden">
        {store.cover_image_url && (
          <div className="absolute inset-0">
            <img
              src={store.cover_image_url}
              alt=""
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-tea-bg/60 via-tea-bg/80 to-tea-bg" />
          </div>
        )}
        <div className="relative flex flex-col items-center text-center py-12 md:py-20 px-6">
          {store.logo_url && (
            <img
              src={store.logo_url}
              alt={`${store.name} emblem`}
              className="w-16 h-16 md:w-20 md:h-20 object-contain mb-5"
            />
          )}
          <p className="text-ui-11 uppercase tracking-[0.3em] text-tea-text-dim mb-3">
            A Teajia table
          </p>
          <h1
            className="text-3xl md:text-5xl text-tea-text mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {store.name}
          </h1>
          {store.tagline && (
            <p className="max-w-xl text-base md:text-lg text-tea-text-sec italic mb-4">
              {store.tagline}
            </p>
          )}
          {location && (
            <p className="flex items-center gap-2 text-xs uppercase tracking-display text-tea-text-dim">
              <Icons.Location className="w-3.5 h-3.5 text-tea-gold" />
              {location}
            </p>
          )}
        </div>
      </header>

      {/* Tab nav */}
      <nav
        className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border"
        aria-label="Storefront sections"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-1 md:gap-2 px-4 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pill whitespace-nowrap my-3 ${isActive ? 'pill-active' : ''}`}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content sections */}
      <div className="max-w-7xl mx-auto px-0 md:px-2 pt-6 pb-12">
        {activeTab === 'shop' && (
          <StorefrontShopSection
            store={store}
            teaInventory={teaInventory}
            teawareInventory={teawareInventory}
            isLoading={productsLoading}
            onAddToCart={onAddToCart}
            onCartClick={onCartClick}
            onAccountClick={onAccountClick}
            cartItemCount={cartItemCount}
          />
        )}

        {activeTab === 'events' && <StorefrontEventsSection events={events} />}

        {activeTab === 'about' && <StorefrontAboutSection store={store} />}

        {activeTab === 'contact' && <StorefrontContactSection store={store} />}
      </div>

      {/* Network footer */}
      <footer className="border-t border-tea-border mt-8 pt-8 pb-6 text-center">
        <p className="text-ui-11 uppercase tracking-[0.3em] text-tea-text-dim mb-2">
          Part of the Teajia network
        </p>
        <Link
          to="/find-a-table"
          className="text-sm text-tea-gold hover:text-tea-gold-lt transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Find another table &rarr;
        </Link>
      </footer>
    </div>
  );
};

// ─── Shop section ──────────────────────────────────────────────────────────

interface StorefrontShopSectionProps {
  store: Account;
  teaInventory: InventoryItem[];
  teawareInventory: InventoryItem[];
  isLoading: boolean;
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount: number;
}

const StorefrontShopSection: React.FC<StorefrontShopSectionProps> = ({
  teaInventory,
  teawareInventory,
  isLoading,
  onAddToCart,
  onCartClick,
  onAccountClick,
  cartItemCount,
}) => {
  const [pane, setPane] = useState<'tea' | 'teaware'>('tea');

  if (isLoading) {
    return <SectionSkeleton variant="shop" />;
  }

  const hasTea = teaInventory.length > 0;
  const hasWare = teawareInventory.length > 0;

  if (!hasTea && !hasWare) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <p className="text-sm text-tea-text-sec italic">
          The shelves are being restocked. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      {hasTea && hasWare && (
        <div className="flex items-center justify-center gap-2 mb-6 px-4">
          <button
            onClick={() => setPane('tea')}
            className={`pill ${pane === 'tea' ? 'pill-active' : ''}`}
            aria-pressed={pane === 'tea'}
          >
            Tea
          </button>
          <button
            onClick={() => setPane('teaware')}
            className={`pill ${pane === 'teaware' ? 'pill-active' : ''}`}
            aria-pressed={pane === 'teaware'}
          >
            Teaware
          </button>
        </div>
      )}

      {(pane === 'tea' || !hasWare) && hasTea && (
        <TeaInventory
          inventory={teaInventory}
          onAddToCart={onAddToCart}
          onCartClick={onCartClick}
          onAccountClick={onAccountClick}
          cartItemCount={cartItemCount}
          hideHeader
        />
      )}

      {(pane === 'teaware' || !hasTea) && hasWare && (
        <TeawareCatalog
          externalInventory={teawareInventory}
          onAddToCart={onAddToCart}
          hideHeader
        />
      )}
    </div>
  );
};

// ─── Events section ────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const StorefrontEventsSection: React.FC<{ events: TeaEvent[] }> = ({ events }) => {
  const [filter, setFilter] = useState<'upcoming' | 'open-seats' | 'past'>('upcoming');
  const now = new Date();

  const sorted = [...events].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );
  const upcoming = sorted.filter(
    ev => new Date(ev.eventDate) >= now && ev.status !== 'archived'
  );
  const past = sorted.filter(
    ev => new Date(ev.eventDate) < now || ev.status === 'closed' || ev.status === 'archived'
  );
  const openSeats = upcoming.filter(ev => (ev.seatsRemaining ?? 1) > 0);

  const displayed = filter === 'past' ? past : filter === 'open-seats' ? openSeats : upcoming;

  const labelDate = upcoming[0] ? new Date(upcoming[0].eventDate) : now;
  const monthLabel = labelDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (events.length === 0) {
    return (
      <div className="py-16 text-center px-6">
        <p className="text-sm text-tea-text-sec font-serif italic">
          No upcoming gatherings at this table.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 pt-4 pb-10">
      {/* Header */}
      <div className="mb-6">
        <p className="text-ui-10 uppercase tracking-[0.3em] text-tea-text-dim mb-2">
          Sessions · {monthLabel}
        </p>
        <h2 className="font-serif text-4xl font-normal text-tea-text leading-[1.05] tracking-[-0.5px]">
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {([
            { id: 'upcoming', label: 'Upcoming' },
            ...(openSeats.length > 0 ? [{ id: 'open-seats', label: 'Open seats' }] : []),
            ...(past.length > 0 ? [{ id: 'past', label: 'Past' }] : []),
          ] as { id: string; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className={filter === id ? 'pill-active' : 'pill'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      {displayed.length === 0 ? (
        <p className="text-sm text-tea-text-sec font-serif italic py-8">
          {filter === 'open-seats' ? 'All sessions are currently full.' : 'Nothing to show yet.'}
        </p>
      ) : (
        <div>
          {displayed.map((ev, i) => {
            const d = new Date(ev.eventDate);
            const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dateNum = String(d.getDate()).padStart(2, '0');
            const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const time = d.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const seats = ev.seatsRemaining;
            const isFull = seats === 0;

            return (
              <Link
                key={ev.id}
                to={`/event/${ev.slug}`}
                className={`flex gap-3.5 py-4${i < displayed.length - 1 ? ' border-b border-tea-border' : ''} hover:opacity-80 transition-opacity`}
              >
                {/* Date column */}
                <div className="w-12 shrink-0 text-center pt-0.5">
                  <div className="text-ui-9 tracking-[0.25em] text-tea-text-dim uppercase">{day}</div>
                  <div className="font-serif text-[32px] font-normal text-tea-text leading-none mt-0.5">{dateNum}</div>
                  <div className="text-ui-9 tracking-display text-tea-text-dim mt-0.5">{month}</div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-base font-medium text-tea-text leading-snug">{ev.title}</h3>
                  {ev.subtitle && (
                    <p className="font-serif italic text-ui-13 text-tea-text-sec mt-0.5">{ev.subtitle}</p>
                  )}
                  <div className="flex items-center gap-2.5 mt-2 text-ui-11 text-tea-text-dim flex-wrap">
                    <span>{time}</span>
                    {(ev.areaHint || ev.locationName) && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-tea-text-dim shrink-0" />
                        <span>{ev.areaHint ?? ev.locationName}</span>
                      </>
                    )}
                    {seats != null && (
                      <span className={`ml-auto font-medium tabular-nums${isFull ? ' text-red-400' : ' text-tea-gold'}`}>
                        {isFull ? 'Full' : `${seats}/${ev.totalCapacity} seats`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Network reviews section ───────────────────────────────────────────────

interface NetworkReview {
  id: string;
  tea_key?: string;
  product_id?: string;
  product_account_id?: string;
  rating?: number;
  notes?: string;
  session_date?: string;
  verdict?: string;
  tasting?: Record<string, unknown>;
}

const StoreNetworkReviews: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { data, isLoading } = useQuery<{ reviews?: NetworkReview[] }>({
    queryKey: ['tea-reviews', 'network', storeId],
    queryFn: () => api.teaReviews.list({ visibility: 'network' }),
    staleTime: 1000 * 60 * 5,
  });

  const storeReviews = useMemo(() => {
    if (!data?.reviews) return [];
    return (data.reviews as NetworkReview[]).filter(
      r => r.product_account_id === storeId
    );
  }, [data, storeId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (storeReviews.length === 0) return null;

  // Group by tea_key or product_id
  const grouped = storeReviews.reduce<Record<string, NetworkReview[]>>((acc, r) => {
    const key = r.tea_key ?? r.product_id ?? r.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      <h3 className="text-ui-10 uppercase tracking-[0.25em] text-tea-text-dim mb-4">
        Network Reviews
      </h3>
      <ul className="space-y-3">
        {Object.entries(grouped).map(([key, reviews]) => {
          const avg = reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.filter(r => r.rating).length;
          return (
            <li key={key} className="inset-panel p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-tea-text font-medium font-mono truncate">{key}</p>
                {!Number.isNaN(avg) && avg > 0 && (
                  <span className="text-xs text-tea-gold shrink-0">
                    {'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))} {avg.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-ui-11 text-tea-text-dim">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ─── About section ─────────────────────────────────────────────────────────

const StorefrontAboutSection: React.FC<{ store: Account }> = ({ store }) => {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {store.description ? (
        <div
          className="text-base md:text-lg leading-relaxed text-tea-text-sec whitespace-pre-line"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {store.description}
        </div>
      ) : (
        <p className="text-sm text-tea-text-dim italic text-center">
          This table is still finding its voice.
        </p>
      )}
      {store.id && <StoreNetworkReviews storeId={store.id} />}
    </div>
  );
};

// ─── Contact section ───────────────────────────────────────────────────────

const StorefrontContactSection: React.FC<{ store: Account }> = ({ store }) => {
  const location = [store.location_city, store.location_country].filter(Boolean).join(', ');
  const waHref = store.whatsapp_number
    ? `https://wa.me/${store.whatsapp_number.replace(/[^\d]/g, '')}`
    : null;

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6 text-center">
      {location && (
        <div>
          <p className="text-ui-11 uppercase tracking-[0.25em] text-tea-text-dim mb-1">Location</p>
          <p className="text-base text-tea-text">{location}</p>
        </div>
      )}

      {waHref && (
        <div>
          <p className="text-ui-11 uppercase tracking-[0.25em] text-tea-text-dim mb-1">WhatsApp</p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            Message {store.name}
          </a>
        </div>
      )}

      {store.contact_email && (
        <div>
          <p className="text-ui-11 uppercase tracking-[0.25em] text-tea-text-dim mb-1">Email</p>
          <a
            href={`mailto:${store.contact_email}`}
            className="text-base text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            {store.contact_email}
          </a>
        </div>
      )}

      {!waHref && !store.contact_email && !location && (
        <p className="text-sm text-tea-text-dim italic">No contact details yet.</p>
      )}
    </div>
  );
};

export default Storefront;
