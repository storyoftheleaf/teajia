import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { TeaCompassEntry } from '../components/TeaCompass/types';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

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
  if (role === 'owner' || role === 'staff') return 'Teajia Team';
  return 'Member';
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-ui-10 font-bold uppercase tracking-[0.2em] text-tea-text-sec mb-4">
      {children}
    </h2>
  );
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
    <div className="shrink-0 w-40 bg-tea-surface rounded-md overflow-hidden">
      {photo ? (
        <img src={photo} alt={entry.name} className="w-full h-24 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-24 bg-tea-elevated flex items-center justify-center">
          <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">No photo</span>
        </div>
      )}
      <div className="p-2.5">
        <p className="text-ui-13 font-medium text-tea-text leading-tight line-clamp-2">{entry.name}</p>
        {entry.type && (
          <p className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-sec mt-0.5">{entry.type}</p>
        )}

        {open ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(VERDICT_LABELS) as VerdictValue[]).map((v) => (
              <button
                key={v}
                onClick={() => { setVerdict(v); setOpen(false); }}
                className={[
                  'text-ui-10 px-2 py-0.5 rounded-md transition-colors duration-100',
                  verdict === v
                    ? 'bg-tea-gold text-tea-bg'
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
            className="mt-2 text-ui-10 uppercase tracking-[0.12em] text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            {verdict ? VERDICT_LABELS[verdict] : 'Rate'}
          </button>
        )}
      </div>
    </div>
  );
}

function WishlistCard({ entry }: { entry: TeaCompassEntry }) {
  return (
    <div className="py-3 border-b border-tea-border last:border-b-0">
      <p className="text-ui-14 text-tea-text leading-snug">{entry.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {entry.type && (
          <span className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-sec">{entry.type}</span>
        )}
        {entry.type && entry.vendorName && (
          <span className="text-tea-text-dim text-ui-10">&middot;</span>
        )}
        {entry.vendorName && (
          <span className="text-ui-10 text-tea-text-dim">{entry.vendorName}</span>
        )}
      </div>
    </div>
  );
}

// ─── Stats card ──────────────────────────────────────────────────────────────

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
    <div className="flex-1 min-w-[88px] bg-tea-surface px-4 py-4 rounded-md text-center">
      <p className="text-2xl font-display text-tea-text">{value}</p>
      <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mt-1">{label}</p>
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
    'flex items-center justify-between py-4 border-b border-tea-border',
    'last:border-b-0 transition-colors duration-100',
    danger ? 'text-red-500 hover:text-red-400' : 'text-tea-text hover:text-tea-gold',
  ].join(' ');

  if (to) {
    return (
      <Link to={to} className={cls}>
        <span className="text-ui-14">{label}</span>
        <ChevronRight className="w-4 h-4 text-tea-text-dim shrink-0" />
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${cls} w-full text-left`}>
      <span className="text-ui-14">{label}</span>
      <ChevronRight className="w-4 h-4 text-tea-text-dim shrink-0" />
    </button>
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <p className="text-tea-text-sec text-sm">Sign in to access your personal center.</p>
        <button
          onClick={() => navigate('/signin')}
          className="text-sm text-tea-gold hover:text-tea-gold-lt transition-colors underline underline-offset-2"
        >
          Sign in
        </button>
      </div>
    );
  }

  const tier = membershipLabel(auth.user?.role);

  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-md mx-auto px-5 pt-6 pb-[calc(52px+env(safe-area-inset-bottom,0px))]">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-ui-11 uppercase tracking-[0.15em]">Back</span>
        </button>

        {/* Identity */}
        <div className="mb-8">
          <div className="inline-block text-ui-10 uppercase tracking-[0.2em] text-tea-gold bg-tea-gold/8 px-2.5 py-1 rounded-md mb-3">
            {tier}
          </div>
          <h1 className="font-display text-4xl text-tea-text leading-tight">
            {auth.user?.name ?? 'Your Center'}
          </h1>
          {auth.user?.username && (
            <p className="text-tea-text-dim text-sm mt-1">@{auth.user.username}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-2.5 mb-10">
          <StatCard label="Queue" value={queueCount} href="#queue" />
          <StatCard label="Want list" value={wishlistCount} href="#wishlist" />
          <StatCard label="Connections" value={connectionCount} />
        </div>

        {/* ── Tasting Queue ──────────────────────────────────────────────── */}
        <section id="queue" className="mb-10">
          <SectionHeading>Available to Taste</SectionHeading>

          {queueEntries.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
              {queueEntries.map((entry) => (
                <QueueCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-tea-text-dim leading-relaxed">
              Nothing queued yet. Teas shared with you or from purchases will appear here.
            </p>
          )}
        </section>

        {/* ── Wishlist ───────────────────────────────────────────────────── */}
        <section id="wishlist" className="mb-10">
          <SectionHeading>Want List</SectionHeading>

          {wishlistEntries.length > 0 ? (
            <div>
              {wishlistEntries.map((entry) => (
                <WishlistCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-tea-text-dim leading-relaxed">
              Teas you've marked as 'want' in your compass.
            </p>
          )}
        </section>

        {/* ── Tea Circle ─────────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeading>Tea Circle</SectionHeading>

          {connections.length > 0 ? (
            <div className="mb-5">
              {connections.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 border-b border-tea-border last:border-b-0">
                  <div>
                    <p className="text-ui-14 text-tea-text">{c.name}</p>
                    {c.username && (
                      <p className="text-ui-11 text-tea-text-dim mt-0.5">@{c.username}</p>
                    )}
                  </div>
                  <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim">
                    {membershipLabel(c.role)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-tea-text-dim leading-relaxed mb-5">
              No connections yet.
            </p>
          )}

          {/* Find members */}
          <div className="relative">
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Find members"
              className="w-full bg-tea-surface border border-tea-border px-4 py-3 text-tea-text text-sm rounded-md outline-none focus:border-tea-gold transition-colors placeholder-tea-text-dim"
            />
          </div>

          {memberResults.length > 0 && (
            <div className="mt-1 bg-tea-surface border border-tea-border rounded-md overflow-hidden">
              {memberResults.map((m) => (
                <div
                  key={m.id}
                  className="px-4 py-3 text-sm text-tea-text border-b border-tea-border last:border-b-0 hover:bg-tea-elevated transition-colors cursor-default"
                >
                  <span>{m.name}</span>
                  {m.username && (
                    <span className="ml-2 text-tea-text-dim text-ui-12">@{m.username}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeading>More</SectionHeading>

          <div>
            <NavRow label="Tea Sessions" to="/events" />
            <NavRow label="Tasting Journal" to="/account/journal" />
            <NavRow label="Collection" to="/account/collection" />
            <NavRow label="Settings" to="/account/settings" />
            <NavRow
              label="Sign out"
              danger
              onClick={() => {
                auth.logout();
                navigate('/');
              }}
            />
          </div>
        </section>

      </div>
    </div>
  );
}
