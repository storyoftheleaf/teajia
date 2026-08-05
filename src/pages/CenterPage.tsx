import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { TeaCompassEntry } from '../components/TeaCompass/types';
import { ArrowLeft, ChevronRight } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Connection {
  id: string;
  name: string;
  username?: string | null;
  role?: string;
}

interface MemberResult {
  id: string;
  name: string;
  username?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function membershipLabel(role?: string): string {
  if (!role) return 'Member';
  if (role === 'owner' || role === 'staff') return 'Teajia team';
  return 'Member';
}

// ─── Queue / Wishlist card ────────────────────────────────────────────────────

type VerdictValue = 'love' | 'like' | 'neutral' | 'pass';

const VERDICT_LABELS: Record<VerdictValue, string> = {
  love: 'Love',
  like: 'Like',
  neutral: 'Neutral',
  pass: 'Pass',
};

function QueueCard({ entry }: { entry: TeaCompassEntry }) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<VerdictValue | null>(entry.sampleVerdict ?? null);

  const photo = entry.photos?.[0];

  return (
    <div className="shrink-0 w-40 bg-tea-bg border border-tea-border rounded-md overflow-hidden">
      {photo ? (
        <img src={photo} alt={entry.name} className="w-full h-24 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-24 bg-tea-elevated flex items-center justify-center">
          <span className="label-caps text-tea-text-dim">No photo</span>
        </div>
      )}
      <div className="p-2.5">
        <p className="font-display text-ui-14 text-tea-text leading-tight line-clamp-2">{entry.name}</p>
        {entry.type && (
          <p className="label-caps text-tea-text-sec mt-0.5">{entry.type}</p>
        )}

        {open ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(VERDICT_LABELS) as VerdictValue[]).map((v) => (
              <button
                key={v}
                onClick={() => { setVerdict(v); setOpen(false); }}
                className={[
                  'text-ui-10 px-2 py-0.5 rounded-md transition-colors',
                  verdict === v
                    ? 'cta-solid'
                    : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text',
                ].join(' ')}
              >
                {VERDICT_LABELS[v]}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="mt-2 text-ui-11 text-tea-readgold hover:text-tea-gold-lt transition-colors"
          >
            {verdict ? VERDICT_LABELS[verdict] : 'Rate'}
          </button>
        )}
      </div>
    </div>
  );
}

function WishlistRow({ entry }: { entry: TeaCompassEntry }) {
  return (
    <li className="px-4 md:px-5 py-3 border-b border-tea-border last:border-b-0">
      <p className="font-display text-ui-15 text-tea-text leading-snug">{entry.name}</p>
      <div className="flex items-center gap-2 mt-0.5 text-ui-12 text-tea-text-dim">
        {entry.type && <span>{entry.type}</span>}
        {entry.type && entry.vendorName && <span>·</span>}
        {entry.vendorName && <span>{entry.vendorName}</span>}
      </div>
    </li>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <div className="flex-1 min-w-[88px] bg-tea-surface border border-tea-border rounded-xl px-4 py-4 text-center transition-colors hover:bg-tea-accent-sub">
      <p className="font-display text-ui-28 text-tea-text leading-none">{value}</p>
      <p className="label-caps text-tea-text-dim mt-2">{label}</p>
    </div>
  );

  if (href) {
    return <a href={href} className="flex-1">{inner}</a>;
  }
  return inner;
}

// ─── Nav row ─────────────────────────────────────────────────────────────────

function NavRow({
  label,
  to,
  onClick,
  danger,
}: {
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const cls = [
    'w-full flex items-center justify-between px-4 md:px-5 py-3 border-b border-tea-border',
    'last:border-b-0 transition-colors hover:bg-tea-accent-sub',
    danger ? 'text-tea-error hover:text-tea-error' : 'text-tea-text',
  ].join(' ');

  if (to) {
    return (
      <Link to={to} className={cls}>
        <span className="text-ui-14">{label}</span>
        <ChevronRight size={14} className="text-tea-text-dim shrink-0" />
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${cls} text-left`}>
      <span className="text-ui-14">{label}</span>
      <ChevronRight size={14} className="text-tea-text-dim shrink-0" />
    </button>
  );
}

// ─── Section card wrapper ───────────────────────────────────────────────────

function SectionCard({
  id,
  title,
  subtitle,
  children,
  bodyPadding = true,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  bodyPadding?: boolean;
}) {
  return (
    <section id={id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
      <div className="px-4 md:px-5 pt-5 pb-3">
        <h2 className="h3">{title}</h2>
        {subtitle && (
          <p className="text-ui-12 text-tea-text-dim mt-1">{subtitle}</p>
        )}
      </div>
      <div className={bodyPadding ? 'px-4 md:px-5 pb-5' : 'pb-1'}>
        {children}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CenterPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Profile summary
  const { data: profileData } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.me.profile(),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  // Tasting queue
  const { data: queueData } = useQuery({
    queryKey: ['me-queue'],
    queryFn: () => api.me.queue(),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  // Wishlist
  const { data: wishlistData } = useQuery({
    queryKey: ['me-wishlist'],
    queryFn: () => api.me.wishlist(),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  // Connections
  const { data: connectionsData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.connections.list(),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  });

  // Debounced member search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = memberSearch.trim();
    if (!q) {
      setMemberResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.members.search(q);
        setMemberResults(Array.isArray(data) ? data : (data?.members ?? []));
      } catch {
        setMemberResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [memberSearch]);

  // Derive counts
  const queueEntries: TeaCompassEntry[] = queueData?.entries ?? [];
  const wishlistEntries: TeaCompassEntry[] = wishlistData?.entries ?? [];
  const connections: Connection[] = connectionsData?.connections ?? [];

  const queueCount = profileData?.queue_count ?? queueEntries.length;
  const wishlistCount = profileData?.wishlist_count ?? wishlistEntries.length;
  const connectionCount = profileData?.connection_count ?? connections.length;

  // Auth guard
  if (!auth.isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <p className="text-ui-13 text-tea-text-sec mb-4">Sign in to access your personal center.</p>
          <button
            onClick={() => navigate('/signin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const tier = membershipLabel(auth.user?.role);
  const initials = (auth.user?.name || auth.user?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={14} />
        <span className="text-ui-12">Back</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="h2">{auth.user?.name ?? 'Your center'}</h1>
        <p className="label-caps text-tea-text-dim mt-1">
          {tier}
          {auth.user?.username ? ` · @${auth.user.username}` : ''}
        </p>
      </div>

      {/* Identity card, §19 */}
      <div className="bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-15 flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="h3">{auth.user?.name || 'Member'}</h3>
          <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{auth.user?.email}</p>
          {auth.user?.username && (
            <p className="text-ui-12 text-tea-text-dim mt-0.5">@{auth.user.username}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">
              {tier}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3">
        <StatCard label="Queue" value={queueCount} href="#queue" />
        <StatCard label="Want list" value={wishlistCount} href="#wishlist" />
        <StatCard label="Connections" value={connectionCount} href="#circle" />
      </div>

      {/* Tasting queue */}
      <SectionCard id="queue" title="Available to taste" subtitle="Teas shared with you or from recent purchases.">
        {queueEntries.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {queueEntries.map((entry) => (
              <QueueCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-ui-12 text-tea-text-sec leading-relaxed">
            Nothing queued yet.
          </p>
        )}
      </SectionCard>

      {/* Wishlist */}
      <SectionCard
        id="wishlist"
        title="Want list"
        subtitle="Teas you've marked as 'want' in your compass."
        bodyPadding={wishlistEntries.length === 0}
      >
        {wishlistEntries.length > 0 ? (
          <ul className="divide-y divide-tea-border -mx-4 md:-mx-5">
            {wishlistEntries.map((entry) => (
              <WishlistRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : (
          <p className="text-ui-12 text-tea-text-sec leading-relaxed px-4 md:px-5 pb-5">
            Nothing on your want list yet.
          </p>
        )}
      </SectionCard>

      {/* Tea circle */}
      <SectionCard
        id="circle"
        title="Tea circle"
        subtitle="Your connections and other members."
      >
        {connections.length > 0 ? (
          <ul className="divide-y divide-tea-border mb-4 -mx-4 md:-mx-5">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 md:px-5 py-3">
                <div>
                  <p className="text-ui-14 text-tea-text">{c.name}</p>
                  {c.username && (
                    <p className="text-ui-12 text-tea-text-dim mt-0.5">@{c.username}</p>
                  )}
                </div>
                <span className="label-caps text-tea-text-dim">
                  {membershipLabel(c.role)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mb-4">
            No connections yet.
          </p>
        )}

        <input
          type="text"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Find members"
          className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors"
        />

        {memberResults.length > 0 && (
          <ul className="mt-2 bg-tea-bg border border-tea-border rounded-md overflow-hidden divide-y divide-tea-border">
            {memberResults.map((m) => (
              <li
                key={m.id}
                className="px-3 py-2 text-ui-13 text-tea-text"
              >
                <span>{m.name}</span>
                {m.username && (
                  <span className="ml-2 text-ui-12 text-tea-text-dim">@{m.username}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Navigation */}
      <SectionCard title="More" bodyPadding={false}>
        <ul className="divide-y divide-tea-border">
          <li><NavRow label="Tea sessions" to="/events" /></li>
          <li><NavRow label="Tasting journal" to="/account/journal" /></li>
          <li><NavRow label="Collection" to="/account/collection" /></li>
          <li><NavRow label="Settings" to="/account/settings" /></li>
          <li>
            <NavRow
              label="Sign out"
              danger
              onClick={() => {
                auth.logout();
                navigate('/');
              }}
            />
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
