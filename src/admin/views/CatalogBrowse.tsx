import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { NetworkCatalogProfile } from '../../types';

// ── Carry-from-network catalog browse — Surface 1 per docs/NETWORK_UI_BRIEF.md ──
//
// "Carried successfully" notification strategy: localStorage flash message.
// On carry commit we write { id, name, ts } to localStorage key
// 'teajia_carried_flash'. InventoryView reads that key on mount, shows a
// one-time inline message, then clears it. This avoids query-param coupling
// to InventoryView (which already has many query params) and survives a
// hard navigate via Link/useNavigate without state loss.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return '';
  return `${currency} ${amount.toLocaleString()}`;
}

/** Comma-join non-empty strings. */
function joinParts(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="flex flex-col md:flex-row gap-0 border-b border-tea-border py-8 animate-pulse">
    {/* Photo placeholder */}
    <div className="w-full md:w-[280px] md:h-[280px] h-48 shrink-0 rounded-[4px] bg-tea-surface mb-4 md:mb-0 md:mr-8" />
    {/* Text */}
    <div className="flex-1 flex flex-col gap-3 py-1">
      <div className="h-6 w-2/3 bg-tea-surface rounded-[2px]" />
      <div className="h-4 w-1/2 bg-tea-surface rounded-[2px]" />
      <div className="h-px w-full bg-tea-border mt-2 mb-2" />
      <div className="h-4 w-2/5 bg-tea-surface rounded-[2px]" />
      <div className="h-4 w-2/5 bg-tea-surface rounded-[2px]" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Carry expansion form (inside drawer)
// ─────────────────────────────────────────────────────────────────────────────

interface CarryFormProps {
  profile: NetworkCatalogProfile;
  callerCurrency: string;
  onCarried: (listingId: string, profileName: string) => void;
  onCancel: () => void;
}

const CarryForm: React.FC<CarryFormProps> = ({ profile, callerCurrency, onCarried, onCancel }) => {
  // Suggested retail: derived from buyer's wholesale per gram (in their currency) + margin.
  // wholesale = retail × margin_pct/100, so retail = wholesale / (margin_pct/100).
  // Then ×100 for the per-100g display.
  const suggestedRetail = useMemo(() => {
    if (profile.wholesale_price_per_gram_caller == null || !profile.wholesale_margin_pct_for_caller) return null;
    const marginFraction = profile.wholesale_margin_pct_for_caller / 100;
    return Math.round((profile.wholesale_price_per_gram_caller / marginFraction) * 100);
  }, [profile.wholesale_price_per_gram_caller, profile.wholesale_margin_pct_for_caller]);

  const [stockGrams, setStockGrams] = useState('');
  const [retailPrice, setRetailPrice] = useState(suggestedRetail?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !busy && stockGrams.trim() !== '' && Number(stockGrams) > 0
    && retailPrice.trim() !== '' && Number(retailPrice) > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.network.carryProfile(profile.id, {
        initial_stock_grams: Number(stockGrams),
        initial_price_amount: Number(retailPrice),
        initial_price_currency: callerCurrency,
      });
      onCarried(result.listing_id, profile.name);
    } catch (err: any) {
      setError(err?.message || 'Could not carry this tea. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Stock field */}
      <div>
        <label className="flex items-baseline justify-between gap-4">
          <span className="text-tea-text-sec text-[13px] w-44 shrink-0">Stock to start with</span>
          <div className="flex items-baseline gap-2 flex-1">
            <input
              type="number"
              min="0"
              step="1"
              value={stockGrams}
              onChange={e => setStockGrams(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-24 bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-mono text-[14px] py-1 text-right transition-colors"
            />
            <span className="text-tea-text-sec text-[13px]">g</span>
          </div>
        </label>
      </div>

      {/* Retail price field */}
      <div>
        <label className="flex items-baseline justify-between gap-4">
          <span className="text-tea-text-sec text-[13px] w-44 shrink-0">Your retail price</span>
          <div className="flex items-baseline gap-2 flex-1">
            <span className="text-tea-text-sec text-[13px] font-mono shrink-0">{callerCurrency}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={retailPrice}
              onChange={e => setRetailPrice(e.target.value)}
              placeholder="0"
              className="w-24 bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-mono text-[14px] py-1 text-right transition-colors"
            />
            <span className="text-tea-text-sec text-[13px]">/100g</span>
          </div>
        </label>
        {/* Suggested price helper */}
        {suggestedRetail != null && (
          <p className="text-tea-text-sec italic text-[12px] leading-[1.6] mt-2 pl-0 md:pl-48">
            Suggested {callerCurrency} {suggestedRetail.toLocaleString()} — Adrian's{' '}
            {profile.retail_price_per_gram_curator != null && profile.retail_currency
              ? `${profile.retail_currency} ${(profile.retail_price_per_gram_curator * 100).toLocaleString()}/100g × FX`
              : 'retail × FX'}
          </p>
        )}
      </div>

      {error && (
        <p className="text-tea-text-sec italic text-[13px]">{error}</p>
      )}

      <div className="flex items-center justify-end gap-6 pt-1 text-[13px]">
        <button
          type="button"
          onClick={onCancel}
          className="text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="text-tea-text-sec hover:text-tea-gold transition-colors disabled:text-tea-text-dim disabled:cursor-not-allowed font-display tracking-[0.04em]"
        >
          {busy ? 'Carrying…' : 'Carry it'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Drawer / detail sheet
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerProps {
  profile: NetworkCatalogProfile;
  callerCurrency: string;
  onClose: () => void;
  onCarried: (listingId: string, profileName: string) => void;
}

const ProfileDrawer: React.FC<DrawerProps> = ({ profile, callerCurrency, onClose, onCarried }) => {
  const [carryMode, setCarryMode] = useState<'idle' | 'carry' | 'sample'>('idle');
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = profile.canonical_photos?.filter(Boolean) ?? [];

  const handleCarried = (listingId: string, name: string) => {
    onCarried(listingId, name);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-drawer bg-tea-bg/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer / sheet — full-screen on mobile, right-side panel on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} detail`}
        className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 md:w-[480px] z-modal bg-tea-surface flex flex-col overflow-hidden shadow-xl surface-warm"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-tea-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px] mb-4 block"
            aria-label="Close"
          >
            ← Back
          </button>
          <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{profile.name}</h2>
          {profile.curator_account_name && (
            <p className="text-tea-text-sec text-[11px] tracking-[0.04em] mt-1">
              Sourced from Teajia · curated by {profile.curator_account_name}
              {profile.originator_account_name && profile.originator_account_name !== profile.curator_account_name
                ? ` · originated by ${profile.originator_account_name}`
                : null}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 surface-warm-inset">
          {/* Photo carousel */}
          {photos.length > 0 && (
            <div className="mb-6">
              <div
                className="w-full aspect-square rounded-[4px] overflow-hidden"
                style={{ border: '1px solid var(--tea-border)' }}
              >
                <img
                  src={photos[photoIdx]}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {photos.length > 1 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {photos.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={`w-12 h-12 rounded-[2px] overflow-hidden border transition-colors ${i === photoIdx ? 'border-tea-gold' : 'border-tea-border hover:border-tea-gold/40'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="font-body text-[14px] leading-[1.6] text-tea-text-sec mb-4">
            {joinParts(profile.origin_region || profile.origin_country, profile.chinese_name, profile.varietal, profile.harvest_year)}
          </div>

          {/* Description */}
          {profile.description && (
            <p className="font-body text-[15px] leading-[1.7] text-tea-text mb-6">
              {profile.description}
            </p>
          )}

          {/* Flavor / mood tags live in tasting per Decision 23 — not exposed by the catalog endpoint. */}

          {/* Hairline */}
          <div className="h-px bg-tea-border my-4" />

          {/* Pricing block */}
          <div className="space-y-1 mb-6">
            {profile.retail_price_per_gram_curator != null && profile.retail_currency && (
              <div className="font-mono text-[13px] text-tea-text-sec">
                Adrian's retail · {formatMoney(profile.retail_price_per_gram_curator * 100, profile.retail_currency)}/100g
              </div>
            )}
            {profile.fx_unavailable ? (
              <div className="font-body italic text-[13px] text-tea-text-sec">
                Wholesale will calculate when prices reload
              </div>
            ) : (
              profile.wholesale_price_per_gram_caller != null && (
                <div className="font-mono text-[13px] text-tea-text-sec">
                  Your wholesale · {formatMoney(profile.wholesale_price_per_gram_caller * 100, profile.wholesale_currency_caller)}/100g
                  {' '}({profile.wholesale_margin_pct_for_caller}%)
                </div>
              )
            )}
          </div>

          {/* Carry expansion */}
          {carryMode === 'carry' && (
            <CarryForm
              profile={profile}
              callerCurrency={callerCurrency}
              onCarried={handleCarried}
              onCancel={() => setCarryMode('idle')}
            />
          )}

          {carryMode === 'sample' && (
            <CarryForm
              profile={profile}
              callerCurrency={callerCurrency}
              onCarried={handleCarried}
              onCancel={() => setCarryMode('idle')}
            />
          )}
        </div>

        {/* Sticky footer */}
        {carryMode === 'idle' && (
          <div className="px-6 py-4 border-t border-tea-border shrink-0 pb-nav-gap flex items-center gap-6">
            <button
              type="button"
              onClick={() => setCarryMode('carry')}
              className="text-tea-text hover:text-tea-gold transition-colors font-display text-[15px] tracking-[0.04em] group"
            >
              Carry this tea{' '}
              <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </button>
            <button
              type="button"
              onClick={() => setCarryMode('sample')}
              className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px]"
            >
              Carry as sample only
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Single catalog card
// ─────────────────────────────────────────────────────────────────────────────

interface CatalogCardProps {
  profile: NetworkCatalogProfile;
  onSelect: (profile: NetworkCatalogProfile) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ profile, onSelect, isHovered, onHover }) => {
  const photo = profile.canonical_photos?.[0];

  return (
    <article
      className="border-b border-tea-border py-8 cursor-pointer"
      onClick={() => onSelect(profile)}
      onMouseEnter={() => onHover(profile.id)}
      onMouseLeave={() => onHover(null)}
      tabIndex={0}
      role="button"
      aria-label={`View ${profile.name}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(profile); }}
    >
      <div className="flex flex-col md:flex-row gap-0 md:gap-8 items-start">
        {/* Photo */}
        <div
          className="w-full md:w-[280px] md:h-[280px] h-48 shrink-0 rounded-[4px] overflow-hidden mb-4 md:mb-0 bg-tea-surface"
          style={{ border: '1px solid var(--tea-border)' }}
        >
          {photo ? (
            <img
              src={photo}
              alt={profile.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-tea-text-dim text-[11px] tracking-[0.1em] uppercase">
              No photo
            </div>
          )}
        </div>

        {/* Text block */}
        <div className="flex-1 flex flex-col gap-1 min-w-0 py-1">
          {/* Name */}
          <h3
            className="font-display text-[24px] font-normal leading-[1.2] tracking-[0.01em] text-tea-text"
            style={{ fontWeight: 400 }}
          >
            {profile.name}
          </h3>

          {/* Origin / chinese / form */}
          {(profile.origin_region || profile.origin_country || profile.chinese_name || profile.varietal || profile.type) && (
            <p className="font-body text-[14px] leading-[1.6] text-tea-text-sec">
              {joinParts(profile.origin_region || profile.origin_country, profile.chinese_name, profile.varietal || profile.type)}
            </p>
          )}

          {/* Flavor tags live in tasting per Decision 23, not on the catalog endpoint. */}

          {/* Hairline */}
          <div className="h-px bg-tea-border my-3" />

          {/* Prices */}
          <div className="space-y-1">
            {profile.retail_price_per_gram_curator != null && profile.retail_currency && (
              <p className="num text-[13px] text-tea-text-sec">
                Adrian's retail · {formatMoney(profile.retail_price_per_gram_curator * 100, profile.retail_currency)}/100g
              </p>
            )}
            {profile.fx_unavailable ? (
              <p className="font-body italic text-[13px] text-tea-text-sec">
                Wholesale will calculate when prices reload
              </p>
            ) : (
              profile.wholesale_price_per_gram_caller != null && (
                <p className="num text-[13px] text-tea-text-sec">
                  Your wholesale · {formatMoney(profile.wholesale_price_per_gram_caller * 100, profile.wholesale_currency_caller)}/100g
                  {' '}({profile.wholesale_margin_pct_for_caller}%)
                </p>
              )
            )}
          </div>

          {/* Hairline */}
          <div className="h-px bg-tea-border my-3" />

          {/* CTA — bronze only on hover */}
          <div className="self-start">
            <span
              className={`font-body text-[14px] tracking-[0.02em] transition-colors group ${
                isHovered ? 'text-tea-gold' : 'text-tea-text-sec'
              }`}
            >
              Carry this tea{' '}
              <span className={`inline-block transition-transform ${isHovered ? 'translate-x-0.5' : ''}`}>
                →
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────

interface CatalogBrowseProps {
  /** When rendered inside the Network hub, drop the page-level top/bottom padding. */
  embedded?: boolean;
}

export const CatalogBrowse: React.FC<CatalogBrowseProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const outerClass = embedded
    ? 'px-4 md:px-8 max-w-3xl mx-auto'
    : 'px-4 md:px-8 pt-8 pb-nav-gap max-w-3xl mx-auto';
  const { memberships, activeAccountId, platformRole } = useAppStore(
    useShallow(s => ({
      memberships: s.memberships,
      activeAccountId: s.activeAccountId,
      platformRole: s.platformRole,
    })),
  );

  // Bundle gate — Catalog bundle required
  const hasCatalog = selectHasBundle({ memberships, activeAccountId, platformRole }, 'catalog');

  // Caller's display currency: first non-empty currency in membership or default AUD
  const callerCurrency = useMemo(() => {
    const membership = memberships.find(m => m.account_id === activeAccountId);
    // AccountMembership doesn't carry currency directly; default to AUD as the
    // brief uses AUD for the Australia example. A future improvement: store
    // account currency on the membership and read it here.
    return (membership as any)?.currency || 'AUD';
  }, [memberships, activeAccountId]);

  const [profiles, setProfiles] = useState<NetworkCatalogProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<NetworkCatalogProfile | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNetworkError(false);
    try {
      const res = await api.network.catalog();
      setProfiles(res.profiles);
    } catch {
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasCatalog) load();
  }, [hasCatalog, load]);

  // Distinct tea types for filter row
  const teaTypes = useMemo(() => {
    if (!profiles) return [];
    const seen = new Set<string>();
    for (const p of profiles) {
      if (p.type) seen.add(p.type);
    }
    return Array.from(seen).sort();
  }, [profiles]);

  // Filtered list
  const filtered = useMemo(() => {
    if (!profiles) return [];
    if (!activeFilter) return profiles;
    return profiles.filter(p => p.type === activeFilter);
  }, [profiles, activeFilter]);

  // ── Bundle gate ────────────────────────────────────────────────────────────
  if (!hasCatalog) {
    return (
      <div className={outerClass}>
        <p className="font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
          This destination requires the Catalog bundle. Ask your owner.
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={outerClass}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // ── Count sentence for heading ─────────────────────────────────────────────
  const countSentence = profiles != null
    ? `The Teajia catalog · ${profiles.length} ${profiles.length === 1 ? 'tea' : 'teas'} you don't yet carry`
    : 'The Teajia catalog';

  return (
    <div className={outerClass}>

      {/* Network error — stale data notice */}
      {networkError && (
        <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.6] mb-6">
          Couldn't reach the catalog. Showing the last known state.
        </p>
      )}

      {/* Page heading */}
      <header className="mb-6">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          {countSentence}
        </h1>
        <p className="font-body italic text-[17px] text-tea-text-sec leading-[1.4]">
          Pick what belongs in your house.
        </p>
      </header>

      {/* Filter row — comma-separated text-links */}
      {teaTypes.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-x-0 gap-y-1 font-body text-[14px]" aria-label="Filter by type">
          <button
            type="button"
            onClick={() => setActiveFilter(null)}
            className={`transition-colors mr-1 ${!activeFilter ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
          >
            All
          </button>
          {teaTypes.map((type, i) => (
            <span key={type}>
              <span className="text-tea-border mx-1" aria-hidden="true">,</span>
              <button
                type="button"
                onClick={() => setActiveFilter(type)}
                className={`transition-colors ${activeFilter === type ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
              >
                {type}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* Empty — carries everything */}
      {!networkError && profiles?.length === 0 && (
        <p className="font-body italic text-[16px] text-tea-text-sec leading-[1.7]">
          You carry everything Adrian curates. New harvests appear here as Adrian publishes them.
        </p>
      )}

      {/* Card list */}
      {filtered.map(profile => (
        <CatalogCard
          key={profile.id}
          profile={profile}
          onSelect={setSelectedProfile}
          isHovered={hoveredId === profile.id}
          onHover={setHoveredId}
        />
      ))}

      {/* Empty filtered state */}
      {profiles && profiles.length > 0 && filtered.length === 0 && (
        <p className="font-body italic text-[15px] text-tea-text-sec mt-6">
          No {activeFilter} teas in the catalog right now.
        </p>
      )}

      {/* Detail drawer */}
      {selectedProfile && (
        <ProfileDrawer
          profile={selectedProfile}
          callerCurrency={callerCurrency}
          onClose={() => setSelectedProfile(null)}
          onCarried={(listingId, name) => {
            // Write a localStorage flash message. InventoryView reads
            // 'teajia_carried_flash' on mount, shows it once, then clears it.
            try {
              localStorage.setItem(
                'teajia_carried_flash',
                JSON.stringify({ id: listingId, name, ts: Date.now() }),
              );
            } catch { /* storage blocked — flash won't show, not fatal */ }
            navigate('/admin/inventory');
          }}
        />
      )}
    </div>
  );
};
