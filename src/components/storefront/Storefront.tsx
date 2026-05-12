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
        <h1 className="h2 mb-4">Store not found</h1>
        <p className="text-ui-13 text-tea-text-sec mb-2 max-w-md">
          {(storeErrorObj as Error | undefined)?.message || 'We could not find a Teajia table at that address.'}
        </p>
        <p className="text-ui-13 text-tea-text-dim mb-8 max-w-md">
          It may have moved, or the link may be mistyped.
        </p>
        <Link
          to="/find-a-table"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
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
          <p className="label-caps text-tea-text-dim mb-3">
            A Teajia table
          </p>
          <h1 className="h1 mb-3">
            {store.name}
          </h1>
          {store.tagline && (
            <p className="subtitle max-w-xl mb-4">
              {store.tagline}
            </p>
          )}
          {location && (
            <p className="label-caps flex items-center gap-2">
              <Icons.Location className="w-3.5 h-3.5 text-tea-gold" />
              {location}
            </p>
          )}
        </div>
      </header>

      {/* Tab nav — bottom-border underline (§6) */}
      <nav
        className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border"
        aria-label="Storefront sections"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6 px-4">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tap-target py-2.5 text-ui-12 uppercase tracking-caps font-sans transition-colors border-b ${
                  isActive
                    ? 'text-tea-text border-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
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
        <p className="label-caps text-tea-text-dim mb-2">
          Part of the Teajia network
        </p>
        <Link
          to="/find-a-table"
          className="link-text hover:text-tea-text transition-colors"
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
  store,
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
      <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
        <h2 className="h3">Stock is being prepared</h2>
        <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
          {store.name} has not published tea or teaware yet. Use the contact tab for questions, or check back after the opening inventory is added.
        </p>
      </div>
    );
  }

  return (
    <div>
      {hasTea && hasWare && (
        <div className="flex items-center justify-center gap-6 mb-6 px-4 border-b border-tea-border">
          <button
            onClick={() => setPane('tea')}
            className={`tap-target py-2.5 text-ui-12 uppercase tracking-caps font-sans transition-colors border-b ${
              pane === 'tea'
                ? 'text-tea-text border-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text border-transparent'
            }`}
            aria-pressed={pane === 'tea'}
          >
            Tea
          </button>
          <button
            onClick={() => setPane('teaware')}
            className={`tap-target py-2.5 text-ui-12 uppercase tracking-caps font-sans transition-colors border-b ${
              pane === 'teaware'
                ? 'text-tea-text border-tea-gold'
                : 'text-tea-text-sec hover:text-tea-text border-transparent'
            }`}
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
        <p className="font-body italic text-ui-14 text-tea-text-sec">
          No upcoming gatherings at this table.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-10">
      {/* Header */}
      <div className="mb-6">
        <p className="label-caps text-tea-text-dim mb-2">
          Sessions · {monthLabel}
        </p>
        <h2 className="h2">
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <div className="flex items-center gap-6 mt-4 border-b border-tea-border">
          {([
            { id: 'upcoming', label: 'Upcoming' },
            ...(openSeats.length > 0 ? [{ id: 'open-seats', label: 'Open seats' }] : []),
            ...(past.length > 0 ? [{ id: 'past', label: 'Past' }] : []),
          ] as { id: string; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className={`tap-target py-2.5 text-ui-12 uppercase tracking-caps font-sans transition-colors border-b ${
                filter === id
                  ? 'text-tea-text border-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      {displayed.length === 0 ? (
        <p className="font-body italic text-ui-14 text-tea-text-sec py-8">
          {filter === 'open-seats' ? 'All sessions are currently full.' : 'Nothing to show yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden mt-4">
          {displayed.map((ev) => {
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
              <li key={ev.id}>
                <Link
                  to={`/event/${ev.slug}`}
                  className="flex gap-4 px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors"
                >
                  {/* Date column */}
                  <div className="w-12 shrink-0 text-center pt-0.5">
                    <div className="text-ui-9 tracking-caps text-tea-text-dim uppercase">{day}</div>
                    <div className="font-display text-ui-28 text-tea-text leading-none mt-0.5">{dateNum}</div>
                    <div className="text-ui-9 tracking-caps text-tea-text-dim mt-0.5">{month}</div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-ui-15 text-tea-text leading-snug">{ev.title}</h3>
                    {ev.subtitle && (
                      <p className="font-body italic text-ui-13 text-tea-text-sec mt-0.5">{ev.subtitle}</p>
                    )}
                    <div className="flex items-center gap-2.5 mt-2 text-ui-11 text-tea-text-dim flex-wrap">
                      <span className="font-mono tabular-nums">{time}</span>
                      {(ev.areaHint || ev.locationName) && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-tea-text-dim shrink-0" />
                          <span>{ev.areaHint ?? ev.locationName}</span>
                        </>
                      )}
                      {seats != null && (
                        <span className={`ml-auto font-mono tabular-nums${isFull ? ' text-tea-error' : ' text-tea-gold'}`}>
                          {isFull ? 'Full' : `${seats}/${ev.totalCapacity} seats`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      <h3 className="label-caps text-tea-text-dim mb-4">
        Network Reviews
      </h3>
      <ul className="space-y-3">
        {Object.entries(grouped).map(([key, reviews]) => {
          const avg = reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.filter(r => r.rating).length;
          return (
            <li key={key} className="bg-tea-surface border border-tea-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-ui-14 text-tea-text font-mono truncate">{key}</p>
                {!Number.isNaN(avg) && avg > 0 && (
                  <span className="text-ui-12 text-tea-gold shrink-0 font-mono tabular-nums">
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
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      {store.description ? (
        <div className="body-prose whitespace-pre-line">
          {store.description}
        </div>
      ) : (
        <p className="body-light italic text-center">
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
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6 text-center">
      {location && (
        <div>
          <p className="label-caps text-tea-text-dim mb-1">Location</p>
          <p className="text-ui-15 text-tea-text">{location}</p>
        </div>
      )}

      {waHref && (
        <div>
          <p className="label-caps text-tea-text-dim mb-1">WhatsApp</p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="link-text hover:text-tea-text transition-colors"
          >
            Message {store.name}
          </a>
        </div>
      )}

      {store.contact_email && (
        <div>
          <p className="label-caps text-tea-text-dim mb-1">Email</p>
          <a
            href={`mailto:${store.contact_email}`}
            className="link-text hover:text-tea-text transition-colors"
          >
            {store.contact_email}
          </a>
        </div>
      )}

      {!waHref && !store.contact_email && !location && (
        <p className="body-light italic">No contact details yet.</p>
      )}
    </div>
  );
};

export default Storefront;
