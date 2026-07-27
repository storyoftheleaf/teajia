import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type {
  NetworkCatalogProfile,
  WholesaleOrderDetail,
  WholesaleOrderStatus,
} from '../../types';

// ── Wholesale order draft: Surface 8 per docs/NETWORK_UI_BRIEF.md ──────────
//
// Two routes share this component:
//   /admin/network/wholesale/new       new draft
//   /admin/network/wholesale/:orderId  edit existing draft / view submitted+
//
// Reads as an invoice draft, not a shopping cart. Editorial register throughout.
// Sell bundle required.

// ─────────────────────────────────────────────────────────────────────────────
// Local draft item type
// ─────────────────────────────────────────────────────────────────────────────

interface DraftItem {
  /** Local-only key for list rendering. */
  key: string;
  /** Profile ID, used as display key and for deduplication. */
  profile_id: string;
  /**
   * Supplier's product_listing ID. Populated from:
   *   a) existing order items (getOrder response), or
   *   b) profile.id used as a stand-in when adding from the catalog picker.
   * TODO: The network catalog endpoint does not yet return the supplier's
   * listing_id (cl.id). Until it does, the profile_id is sent and the worker
   * resolves it via the `profile_id` path once that endpoint is extended.
   * For now, supplier_listing_id === profile_id is intentionally incorrect
   * and will be rejected by the worker; this is the known gap until the
   * catalog endpoint is extended to include cl.id.
   */
  supplier_listing_id: string;
  profile_name: string;
  origin_line: string | null;
  /** Wholesale price per gram in order currency (buyer's currency). */
  unit_price_amount: number;
  unit_price_currency: string;
  /** Retail reference in supplier's currency, for display only. */
  retail_amount: number | null;
  retail_currency: string | null;
  wholesale_margin_pct: number | null;
  trust_tier: string | null;
  grams: number;
  fx_unavailable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  decimals = 2,
): string {
  if (amount == null || !currency) return '';
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function joinParts(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

function statusLabel(status: WholesaleOrderStatus): string {
  const labels: Record<WholesaleOrderStatus, string> = {
    draft: 'DRAFT',
    submitted: 'SUBMITTED',
    replied: 'REPLIED',
    confirmed: 'CONFIRMED',
    shipped: 'SHIPPED',
    received: 'RECEIVED',
    cancelled: 'CANCELLED',
  };
  return labels[status] ?? status.toUpperCase();
}

const isDraftEditable = (status: WholesaleOrderStatus): boolean =>
  status === 'draft' || status === 'replied';

/** ISO 8601 → seconds since now. Positive = in past. */
function secondsSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return (Date.now() - d.getTime()) / 1000;
}

const TWENTY_FOUR_HOURS = 86_400;

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton lines
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonLines: React.FC = () => (
  <div className="animate-pulse space-y-3 mt-8 max-w-[640px] mx-auto px-4 md:px-8">
    {[72, 48, 100, 56, 80].map((w, i) => (
      <div
        key={i}
        className="h-4 bg-tea-surface rounded-[2px]"
        style={{ width: `${w}%` }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Catalog picker (inline, opens below "+ Add a tea")
// ─────────────────────────────────────────────────────────────────────────────

interface CatalogPickerProps {
  /** Picker hands back both the line item and the curator (supplier) of that profile,
   *  so the parent can lock supplier_account_id on first add. */
  onAdd: (item: DraftItem, supplier: { id: string; name: string }) => void;
  onClose: () => void;
  existingProfileIds: Set<string>;
  orderCurrency: string;
}

const CatalogPicker: React.FC<CatalogPickerProps> = ({
  onAdd,
  onClose,
  existingProfileIds,
  orderCurrency,
}) => {
  const [profiles, setProfiles] = useState<NetworkCatalogProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    (async () => {
      try {
        const res = await api.network.catalog();
        setProfiles(res.profiles);
      } catch {
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!profiles) return [];
    const q = query.trim().toLowerCase();
    return profiles.filter(p => {
      if (existingProfileIds.has(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.origin_region ?? '').toLowerCase().includes(q) ||
        (p.origin_country ?? '').toLowerCase().includes(q) ||
        (p.type ?? '').toLowerCase().includes(q)
      );
    });
  }, [profiles, query, existingProfileIds]);

  const handleAdd = (profile: NetworkCatalogProfile) => {
    const item: DraftItem = {
      key: `draft-${profile.id}-${Date.now()}`,
      profile_id: profile.id,
      // The catalog endpoint exposes the curator's listing_id directly.
      // If null (rare: profile without a curator listing), the worker rejects
      // the wholesale order on submit.
      supplier_listing_id: profile.curator_listing_id ?? '',
      profile_name: profile.name,
      origin_line: joinParts(
        profile.origin_region || profile.origin_country,
        profile.chinese_name,
        profile.varietal,
      ) || null,
      // Catalog endpoint returns per-gram prices; multiply for the per-100g display.
      unit_price_amount: profile.wholesale_price_per_gram_caller ?? 0,
      unit_price_currency: profile.wholesale_currency_caller || orderCurrency,
      retail_amount: profile.retail_price_per_gram_curator,
      retail_currency: profile.retail_currency,
      wholesale_margin_pct: profile.wholesale_margin_pct_for_caller,
      trust_tier: null, // not exposed by catalog endpoint; kept on DraftItem for forward compat
      grams: 100,
      fx_unavailable: profile.fx_unavailable ?? false,
    };
    onAdd(item, { id: profile.curator_account_id, name: profile.curator_account_name });
    // Keep picker open so buyer can add more teas in sequence.
  };

  return (
    <div className="border-t border-tea-border mt-4 pt-6">
      {/* Picker header */}
      <div className="flex items-baseline justify-between mb-4">
        <p className="font-body text-ui-14 text-tea-text-sec">
          Pick a tea to add.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-13"
        >
          Close
        </button>
      </div>

      {/* Search */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, origin, or type…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 py-1.5 mb-4 transition-colors placeholder:italic placeholder:text-tea-text-sec"
      />

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-tea-surface rounded-[2px]" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.6]">
          {profiles?.length === 0
            ? 'No teas available in the catalog right now.'
            : 'No matching teas. Try a different search.'}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="divide-y divide-tea-border">
          {filtered.map(profile => {
            // Disable when the curator has no active listing for this profile.
            // The worker requires supplier_listing_id and would 404 on submit.
            const noSupplierListing = !profile.curator_listing_id;
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => !noSupplierListing && handleAdd(profile)}
                  disabled={noSupplierListing}
                  className={`w-full text-left py-3 group ${noSupplierListing ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <div className={`font-display text-ui-16 leading-[1.2] ${noSupplierListing ? 'text-tea-text-dim' : 'text-tea-text group-hover:text-tea-gold transition-colors'}`}>
                    {profile.name}
                  </div>
                  <div className="font-body text-ui-12 text-tea-text-sec mt-0.5 leading-[1.4]">
                    {joinParts(profile.origin_region || profile.origin_country, profile.chinese_name, profile.varietal)}
                    {profile.wholesale_price_per_gram_caller != null ? (
                      <span className="font-mono ml-2 text-ui-11">
                        {formatMoney(profile.wholesale_price_per_gram_caller * 100, profile.wholesale_currency_caller, 2)}/100g
                      </span>
                    ) : null}
                    {noSupplierListing && (
                      <span className="italic ml-2">(supplier has no active listing)</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Line item row
// ─────────────────────────────────────────────────────────────────────────────

interface LineItemRowProps {
  item: DraftItem;
  editable: boolean;
  onGramsChange: (key: string, grams: number) => void;
  onRemove: (key: string) => void;
}

const LineItemRow: React.FC<LineItemRowProps> = ({
  item,
  editable,
  onGramsChange,
  onRemove,
}) => {
  const [localGrams, setLocalGrams] = useState(item.grams.toString());

  // Sync when parent resets
  useEffect(() => {
    setLocalGrams(item.grams.toString());
  }, [item.grams]);

  const handleBlur = () => {
    const n = parseFloat(localGrams);
    if (!isNaN(n) && n > 0) {
      onGramsChange(item.key, n);
    } else {
      setLocalGrams(item.grams.toString());
    }
  };

  const lineTotal = item.unit_price_amount > 0 && item.grams > 0
    ? (item.unit_price_amount / 100) * item.grams
    : null;

  return (
    <div className="py-6 border-b border-tea-border">
      {/* Tea name */}
      <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>
        {item.profile_name}
      </h3>

      {/* Origin line */}
      {item.origin_line && (
        <p className="font-body text-ui-14 text-tea-text-sec leading-[1.5] mb-4">
          {item.origin_line}
        </p>
      )}

      {/* Wholesale pricing block */}
      <div className="mb-4 space-y-1">
        {item.fx_unavailable ? (
          <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.5]">
            Wholesale shown in supplier currency only. AUD conversion paused.
          </p>
        ) : (
          <>
            {item.retail_amount != null && item.retail_currency && (
              <div className="flex items-baseline gap-3">
                <span className="font-body text-ui-13 text-tea-text-sec w-24 shrink-0">Wholesale</span>
                <span className="font-mono text-ui-13 text-tea-text-sec">
                  {item.retail_currency}&nbsp;
                  {(item.retail_amount / 100 * item.grams).toLocaleString(undefined, { maximumFractionDigits: 0 })}/100g
                  {item.wholesale_margin_pct != null
                    ? ` (${item.wholesale_margin_pct}%${item.trust_tier ? ` · ${item.trust_tier}` : ''})`
                    : null}
                </span>
              </div>
            )}
            {item.unit_price_amount > 0 && (
              <div className="flex items-baseline gap-3">
                <span className="font-body text-ui-13 text-tea-text-sec w-24 shrink-0 invisible" aria-hidden="true">
                  Wholesale
                </span>
                <span className="font-body italic text-ui-13 text-tea-text-sec">
                  {'≈ '}{formatMoney(item.unit_price_amount, item.unit_price_currency, 2)}/100g at today's FX
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quantity + line total */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="font-body text-ui-13 text-tea-text-sec w-24 shrink-0">Quantity</span>
          {editable ? (
            <label className="flex items-baseline gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={localGrams}
                onChange={e => setLocalGrams(e.target.value)}
                onBlur={handleBlur}
                aria-label={`Quantity in grams for ${item.profile_name}`}
                className="w-20 bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-mono text-ui-14 py-0.5 text-right transition-colors"
              />
              <span className="font-body text-ui-13 text-tea-text-sec">g</span>
            </label>
          ) : (
            <span className="font-mono text-ui-13 text-tea-text">
              {item.grams.toLocaleString()} g
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-3">
          <span className="font-body text-ui-13 text-tea-text-sec w-24 shrink-0">Line</span>
          <span className="font-mono text-ui-14 text-tea-text">
            {lineTotal != null
              ? formatMoney(lineTotal, item.unit_price_currency)
              : `${item.unit_price_currency} 0.00`}
          </span>
        </div>
      </div>

      {/* Remove */}
      {editable && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            className="font-body text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────

export const WholesaleOrderDraft: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();

  const { memberships, activeAccountId, platformRole } = useAppStore(
    useShallow(s => ({
      memberships: s.memberships,
      activeAccountId: s.activeAccountId,
      platformRole: s.platformRole,
    })),
  );

  // Bundle gate: Sell bundle required
  const hasSell = selectHasBundle({ memberships, activeAccountId, platformRole }, 'sell');

  // ── Load state ─────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(orderId !== 'new');
  const [loadError, setLoadError] = useState(false);

  // Order envelope
  const [orderDetail, setOrderDetail] = useState<WholesaleOrderDetail | null>(null);
  const [orderStatus, setOrderStatus] = useState<WholesaleOrderStatus>('draft');
  const [persistedOrderId, setPersistedOrderId] = useState<string | null>(
    orderId && orderId !== 'new' ? orderId : null,
  );

  // Editable fields
  const [items, setItems] = useState<DraftItem[]>([]);
  const [shippingAddress, setShippingAddress] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');

  // Derived supplier info from order detail
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [supplierAccountId, setSupplierAccountId] = useState<string | null>(null);
  const [orderCurrency, setOrderCurrency] = useState<string>('AUD');

  // UI state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveTime, setSaveTime] = useState<string | null>(null);
  const [submitConfirming, setSubmitConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // FX stale: more than 24h since last save / order created
  const fxStale = useMemo(() => {
    if (!orderDetail) return false;
    return secondsSince(orderDetail.order.updated_at) > TWENTY_FOUR_HOURS;
  }, [orderDetail]);

  // ── Load existing order ────────────────────────────────────────────────────

  const loadOrder = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const detail = await api.wholesale.getOrder(id);
      setOrderDetail(detail);
      setOrderStatus(detail.order.status);
      setPersistedOrderId(detail.order.id);
      setShippingAddress(detail.order.shipping_address ?? '');
      setBuyerNotes(detail.order.buyer_notes ?? '');
      setSupplierName(detail.supplier.name);
      setSupplierAccountId(detail.supplier.id);
      setOrderCurrency(detail.order.currency);

      // Map order items to draft items
      setItems(
        detail.items.map(it => ({
          key: it.id,
          profile_id: it.profile_id,
          supplier_listing_id: it.supplier_listing_id,
          profile_name: it.profile_name ?? 'Unknown tea',
          origin_line: null,
          unit_price_amount: it.unit_price_amount,
          unit_price_currency: it.unit_price_currency,
          retail_amount: null,
          retail_currency: null,
          wholesale_margin_pct: null,
          trust_tier: null,
          grams: it.grams,
          fx_unavailable: false,
        })),
      );
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderId && orderId !== 'new') {
      loadOrder(orderId);
    }
  }, [orderId, loadOrder]);

  // ── Derived totals ─────────────────────────────────────────────────────────

  const subtotal = useMemo(
    () =>
      items.reduce((sum, it) => {
        if (it.unit_price_amount <= 0 || it.grams <= 0) return sum;
        return sum + (it.unit_price_amount / 100) * it.grams;
      }, 0),
    [items],
  );

  const existingProfileIds = useMemo(
    () => new Set(items.map(it => it.profile_id)),
    [items],
  );

  // FX snapshot is intentionally null, the server doesn't return an explicit
  // rate on the order detail. The fallback prose below ("rates are locked when
  // you submit") covers what the partner needs to know without showing a half-
  // baked rate string. When the server starts returning the snapshot rate this
  // can populate.
  const fxSnapshot: string | null = null;

  // ── Validation ─────────────────────────────────────────────────────────────

  const hasZeroQty = items.some(it => it.grams <= 0);
  const canSubmit =
    items.length > 0 &&
    !hasZeroQty &&
    subtotal > 0 &&
    shippingAddress.trim().length > 0;

  const submitBlockReason = useMemo((): string | null => {
    if (items.length === 0) return 'Add at least one tea to submit.';
    if (hasZeroQty) return 'Set a quantity above zero for each tea.';
    if (subtotal <= 0) return 'Line totals must be greater than zero.';
    if (!shippingAddress.trim()) return 'A shipping address is required to submit.';
    return null;
  }, [items, hasZeroQty, subtotal, shippingAddress]);

  // ── Save draft ─────────────────────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    setSaveStatus('saving');
    setSubmitError(null);

    const body = {
      shipping_address: shippingAddress || null,
      buyer_notes: buyerNotes || null,
      items: items.map(it => ({
        supplier_listing_id: it.supplier_listing_id,
        grams: it.grams,
        unit_price_amount: it.unit_price_amount,
        unit_price_currency: it.unit_price_currency,
      })),
    };

    try {
      if (persistedOrderId) {
        await api.wholesale.updateOrder(persistedOrderId, body);
      } else {
        // New draft: requires a supplier. If none resolved yet, show error.
        if (!supplierAccountId) {
          setSaveStatus('error');
          return;
        }
        const res = await api.wholesale.createOrder({
          supplier_account_id: supplierAccountId,
          currency: orderCurrency,
          ...body,
        });
        setPersistedOrderId(res.order_id);
        // Canonicalize URL without reloading the page
        window.history.replaceState(
          null,
          '',
          `/admin/network/wholesale/${res.order_id}`,
        );
      }
      const now = new Date().toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSaveTime(now);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  }, [
    persistedOrderId,
    supplierAccountId,
    orderCurrency,
    shippingAddress,
    buyerNotes,
    items,
  ]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmitConfirm = async () => {
    if (!persistedOrderId) {
      setSubmitError('Save the draft first, then submit.');
      setSubmitConfirming(false);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Persist current edits before transitioning
      await api.wholesale.updateOrder(persistedOrderId, {
        shipping_address: shippingAddress || null,
        buyer_notes: buyerNotes || null,
        items: items.map(it => ({
          supplier_listing_id: it.supplier_listing_id,
          grams: it.grams,
          unit_price_amount: it.unit_price_amount,
          unit_price_currency: it.unit_price_currency,
        })),
      });
      await api.wholesale.transition(persistedOrderId, { to: 'submitted' });
      navigate(`/admin/network/wholesale/${persistedOrderId}/timeline`);
    } catch {
      setSubmitError(
        'Could not submit the order. Check your connection and try again.',
      );
      setSubmitConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Item mutations ─────────────────────────────────────────────────────────

  const handleAddItem = useCallback((item: DraftItem, supplier: { id: string; name: string }) => {
    setItems(prev => {
      // Deduplicate by profile_id
      if (prev.some(it => it.profile_id === item.profile_id)) return prev;
      return [...prev, item];
    });
    // Lock supplier on first item add for new drafts; ignore mismatched suppliers
    // (the picker only shows profiles from one curator at small network scale today).
    setSupplierAccountId(prev => prev ?? supplier.id);
    setSupplierName(prev => prev ?? supplier.name);
  }, []);

  const handleGramsChange = useCallback((key: string, grams: number) => {
    setItems(prev =>
      prev.map(it => (it.key === key ? { ...it, grams } : it)),
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setItems(prev => prev.filter(it => it.key !== key));
  }, []);

  // ── Bundle gate ────────────────────────────────────────────────────────────

  if (!hasSell) {
    return (
      <div className="px-4 md:px-8 pt-10 pb-nav-gap max-w-[640px] mx-auto">
        <p className="font-body italic text-ui-15 text-tea-text-sec leading-[1.7]">
          This page requires the Sell bundle. Ask your owner.
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return <SkeletonLines />;
  }

  // ── Load error ─────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="px-4 md:px-8 pt-10 pb-nav-gap max-w-[640px] mx-auto">
        <p className="font-body italic text-ui-15 text-tea-text-sec leading-[1.7]">
          Order not found or not yours.
        </p>
      </div>
    );
  }

  const isEditable = isDraftEditable(orderStatus);
  const isReadOnly = !isEditable;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 md:px-8 pt-8 pb-nav-gap-lg max-w-[640px] mx-auto">

      {/* Read-only: timeline link */}
      {isReadOnly && persistedOrderId && (
        <div className="mb-6">
          <a
            href={`/admin/network/wholesale/${persistedOrderId}/timeline`}
            className="font-body text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            onClick={e => {
              e.preventDefault();
              navigate(`/admin/network/wholesale/${persistedOrderId}/timeline`);
            }}
          >
            View timeline {'→'}
          </a>
        </div>
      )}

      {/* Supplier's reply note, shown when status is 'replied' */}
      {orderStatus === 'replied' && orderDetail?.order.supplier_notes && (
        <div className="mb-6 border-b border-tea-border pb-6">
          <p className="font-body italic text-ui-15 text-tea-text-sec leading-[1.7]">
            {supplierName ?? 'Adrian'} replied:{' '}
            &ldquo;{orderDetail.order.supplier_notes}&rdquo;
          </p>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}

      <header className="mb-8">
        {/* Status as heading */}
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-1`}>
          WHOLESALE ORDER{' '}
          <span className="text-tea-text-sec">{'·'}</span>{' '}
          {statusLabel(orderStatus)}
        </h1>

        {/* Temporal metadata */}
        <p className="font-body text-ui-12 text-tea-text-sec leading-[1.5] mb-4">
          {orderDetail?.order.created_at
            ? `Started ${formatDate(orderDetail.order.created_at)}`
            : 'New'}
          {orderDetail?.order.updated_at &&
            orderDetail.order.updated_at !== orderDetail.order.created_at
            ? ` · Last saved ${formatTime(orderDetail.order.updated_at)}`
            : null}
        </p>

        {/* People */}
        <div className="space-y-1.5">
          <div className="flex gap-6">
            <span className="font-body text-ui-14 text-tea-text-sec w-20 shrink-0">Supplier</span>
            <span className="font-body text-ui-14 text-tea-text">
              {supplierName ?? (
                <span className="italic text-tea-text-sec">Adrian · Teajia Bali</span>
              )}
            </span>
          </div>
          <div className="flex gap-6">
            <span className="font-body text-ui-14 text-tea-text-sec w-20 shrink-0">Buyer</span>
            <span className="font-body text-ui-14 text-tea-text">
              {orderDetail?.buyer.name ?? 'You'}
            </span>
          </div>
        </div>
      </header>

      {/* ── LINE ITEMS ──────────────────────────────────────────────────────── */}

      <section className="mb-8">
        {items.length === 0 && (
          <p className="font-body italic text-ui-15 text-tea-text-sec leading-[1.7] py-6 border-t border-b border-tea-border">
            No teas added yet.
          </p>
        )}

        {items.map(item => (
          <LineItemRow
            key={item.key}
            item={item}
            editable={isEditable}
            onGramsChange={handleGramsChange}
            onRemove={handleRemove}
          />
        ))}

        {/* Add a tea */}
        {isEditable && (
          <div className="pt-4">
            {!pickerOpen ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="font-body text-ui-14 text-tea-text-sec hover:text-tea-gold transition-colors group"
              >
                {'+ Add a tea'}
                <span className="inline-block transition-transform group-hover:translate-x-0.5 ml-0.5">
                  {'→'}
                </span>
              </button>
            ) : (
              <CatalogPicker
                onAdd={handleAddItem}
                onClose={() => setPickerOpen(false)}
                existingProfileIds={existingProfileIds}
                orderCurrency={orderCurrency}
              />
            )}
          </div>
        )}
      </section>

      {/* ── SHIPPING ────────────────────────────────────────────────────────── */}

      <section className="mb-8 border-t border-tea-border pt-6">
        <p
          className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-3`}
          aria-label="Shipping address section"
        >
          SHIPPING TO
        </p>

        {isEditable ? (
          <>
            <textarea
              value={shippingAddress}
              onChange={e => setShippingAddress(e.target.value)}
              rows={4}
              placeholder="Your delivery address"
              aria-label="Shipping address"
              className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-14 leading-[1.7] py-1 resize-none transition-colors placeholder:italic placeholder:text-tea-text-sec"
            />
          </>
        ) : (
          <p className="font-body text-ui-14 text-tea-text leading-[1.7] whitespace-pre-wrap">
            {shippingAddress || (
              <span className="italic text-tea-text-sec">No address provided.</span>
            )}
          </p>
        )}
      </section>

      {/* ── NOTE TO SUPPLIER ─────────────────────────────────────────────────── */}

      <section className="mb-8 border-t border-tea-border pt-6">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec mb-3`}>
          NOTE TO {(supplierName ?? 'ADRIAN').toUpperCase()}
        </p>

        {isEditable ? (
          <textarea
            value={buyerNotes}
            onChange={e => setBuyerNotes(e.target.value)}
            rows={5}
            placeholder="Anything Adrian should know? Timing, packaging, sample requests."
            aria-label="Note to supplier"
            className="w-full bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body italic text-ui-15 leading-[1.7] py-1 resize-none transition-colors placeholder:text-tea-text-sec"
          />
        ) : (
          buyerNotes ? (
            <p className="font-body italic text-ui-15 text-tea-text leading-[1.7]">
              &ldquo;{buyerNotes}&rdquo;
            </p>
          ) : (
            <p className="font-body italic text-ui-14 text-tea-text-sec">
              No note.
            </p>
          )
        )}
      </section>

      {/* ── TOTALS ──────────────────────────────────────────────────────────── */}

      <section className="mb-8 border-t border-tea-border pt-6">
        {/* FX stale warning */}
        {fxStale && isEditable && (
          <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.6] mb-4">
            Currency rate is from yesterday. Refresh to lock today's rate.{' '}
            <button
              type="button"
              onClick={() => persistedOrderId && loadOrder(persistedOrderId)}
              className="underline underline-offset-2 hover:text-tea-text transition-colors"
            >
              Refresh {'→'}
            </button>
          </p>
        )}

        {/* Subtotal */}
        <div className="flex justify-between items-baseline mb-2">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
            SUBTOTAL
          </span>
          <span className="font-mono text-ui-14 text-tea-text">
            {items.length > 0
              ? formatMoney(subtotal, orderCurrency)
              : '—'}
          </span>
        </div>

        {/* Shipping */}
        <div className="flex justify-between items-baseline mb-2">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
            SHIPPING
          </span>
          {orderDetail?.order.shipping_amount != null ? (
            <span className="font-mono text-ui-14 text-tea-text">
              {formatMoney(orderDetail.order.shipping_amount, orderCurrency)}
            </span>
          ) : (
            <span className="font-body italic text-ui-13 text-tea-text-sec">
              Estimated by{' '}
              {supplierName ?? 'Adrian'} on confirm
            </span>
          )}
        </div>

        {/* Hairline */}
        <div className="h-px bg-tea-border my-3" />

        {/* Total */}
        <div className="flex justify-between items-baseline mb-4">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>
            TOTAL
          </span>
          <span className="font-mono text-ui-14 text-tea-text">
            {orderDetail?.order.total_amount != null
              ? formatMoney(orderDetail.order.total_amount, orderCurrency)
              : items.length > 0
              ? `${formatMoney(subtotal, orderCurrency)} + shipping`
              : '—'}
          </span>
        </div>

        {/* FX snapshot prose */}
        {fxSnapshot && (
          <p className="font-body italic text-ui-11 text-tea-text-sec leading-[1.6]">
            {fxSnapshot}. This rate is locked when you submit. Adrian's
            confirmation keeps it.
          </p>
        )}
        {!fxSnapshot && items.length > 0 && (
          <p className="font-body italic text-ui-11 text-tea-text-sec leading-[1.6]">
            Currency snapshot: rates are locked when you submit. Adrian's
            confirmation keeps them.
          </p>
        )}
      </section>

      {/* ── FOOTER ACTIONS (editable states only) ─────────────────────────── */}

      {isEditable && (
        <>
          {/* Content footer area with inline feedback */}
          <div className="border-t border-tea-border pt-6 pb-32 md:pb-0">
            {/* Inline save feedback */}
            {saveStatus === 'saved' && saveTime && (
              <p className="font-body text-ui-12 text-tea-text-sec mb-4">
                Saved{' '}
                <span className="font-mono text-ui-11">{saveTime}</span>
              </p>
            )}
            {saveStatus === 'error' && (
              <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.6] mb-4">
                Couldn't reach the server. Your edits are held{' '}
                {'—'} try again.
              </p>
            )}

            {/* Submit inline confirmation */}
            {submitConfirming && (
              <div className="mb-4">
                <p className="font-body text-ui-14 text-tea-text leading-[1.6] mb-3">
                  Submit this order to{' '}
                  {supplierName ?? 'Adrian'} for{' '}
                  {formatMoney(subtotal, orderCurrency)} + shipping?
                </p>
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    onClick={() => setSubmitConfirming(false)}
                    disabled={submitting}
                    className="font-body text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitConfirm}
                    disabled={submitting}
                    className="font-body text-ui-14 text-tea-text hover:text-tea-gold transition-colors disabled:text-tea-text-sec group"
                  >
                    {submitting ? 'Submitting…' : 'Confirm'}
                    {!submitting && (
                      <span className="inline-block transition-transform group-hover:translate-x-0.5 ml-0.5">
                        {'→'}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Submit inline error */}
            {submitError && (
              <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.6] mb-4">
                {submitError}
              </p>
            )}

            {/* Submit block reason */}
            {!submitConfirming && !canSubmit && submitBlockReason && items.length > 0 && (
              <p className="font-body italic text-ui-13 text-tea-text-sec leading-[1.5] mb-4">
                {submitBlockReason}
              </p>
            )}

            {/* Main footer buttons: Save draft left, Submit right (non-sticky for reference) */}
            {!submitConfirming && (
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saveStatus === 'saving'}
                  className="font-body text-ui-14 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || saveStatus === 'saving'}
                  onClick={() => {
                    setSubmitError(null);
                    setSubmitConfirming(true);
                  }}
                  className="font-body text-ui-14 text-tea-text hover:text-tea-gold transition-colors disabled:text-tea-text-sec disabled:cursor-not-allowed group"
                >
                  Submit to {supplierName ?? 'Adrian'}
                  <span className="inline-block transition-transform group-hover:translate-x-0.5 ml-0.5">
                    {'→'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Sticky submit button footer, sticky to bottom of viewport on mobile */}
          <div className="sticky bottom-0 md:hidden bg-tea-bg border-t border-tea-border z-10 bottom-nav-gap flex items-center justify-end gap-4 px-4 py-4">
            <button
              type="button"
              disabled={!canSubmit || saveStatus === 'saving'}
              onClick={() => {
                setSubmitError(null);
                setSubmitConfirming(true);
              }}
              className="font-body text-ui-14 text-tea-text hover:text-tea-gold transition-colors disabled:text-tea-text-sec disabled:cursor-not-allowed group w-full"
            >
              Submit to {supplierName ?? 'Adrian'}
              <span className="inline-block transition-transform group-hover:translate-x-0.5 ml-0.5">
                {'→'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
