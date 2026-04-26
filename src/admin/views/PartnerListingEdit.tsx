import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { useShallow } from 'zustand/react/shallow';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { ProfileSuggestableField, ProfileSuggestionFieldDraft } from '../../types';

// ── Partner listing edit — Surface 2 + Surface 5 per docs/NETWORK_UI_BRIEF.md ──
//
// "The card is the editor." Canonical fields are edited in-place on the same
// page that displays them. Footer buttons swap from empty helper text to
// editorial actions the moment any canonical field has a pending edit.
// No separate compose surface; no rationale field (Decision 25).

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ListingData {
  id: string;
  account_id: string;
  profile_id: string;
  stock_grams: number | null;
  fixed_retail_price_usd: number | null;
  store_note: string | null;
  listing_photos: string[];
  is_sample: boolean;
  status: string;
  created_at: string;
}

interface ProfileData {
  id: string;
  slug: string;
  name: string;
  chinese_name?: string | null;
  type?: string | null;
  form?: string | null;
  origin_country?: string | null;
  origin_region?: string | null;
  varietal?: string | null;
  harvest_year?: string | null;
  description?: string | null;
  lore?: string | null;
  processing_notes?: string | null;
  terroir?: string | null;
  mood?: string | null;
  experience?: string | null;
  image_url?: string | null;
  canonical_photos: string[];
  status: string;
  curated_by_account_id: string;
  curated_by_kind?: string | null;
  originated_by_account_id: string;
  curated_by_name?: string | null;
  // Adoption queue state — set when the originator has flagged this profile
  // for network-wide adoption. Decision lives in tea_profiles.
  adoption_decision?: 'pending' | 'adopted' | 'declined' | null;
  suggested_for_network_at?: string | null;
  adoption_decline_note?: string | null;
}

// One pending edit per field — indexed by field name
type PendingEdits = Partial<Record<ProfileSuggestableField, string>>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LONG_FIELDS = new Set<ProfileSuggestableField>([
  'description', 'lore', 'processing_notes', 'terroir', 'mood', 'experience',
]);

const FIELD_LABELS: Record<ProfileSuggestableField, string> = {
  name: 'Name',
  chinese_name: 'Chinese name',
  type: 'Type',
  form: 'Form',
  origin_country: 'Origin country',
  origin_region: 'Origin region',
  varietal: 'Varietal',
  harvest_year: 'Harvest year',
  description: 'Description',
  lore: 'Lore',
  processing_notes: 'Processing notes',
  terroir: 'Terroir',
  mood: 'Mood',
  experience: 'Experience',
  image_url: 'Primary image',
};

// Fields rendered in the canonical section, in order
const CANONICAL_FIELD_ORDER: ProfileSuggestableField[] = [
  'name',
  'chinese_name',
  'type',
  'form',
  'origin_country',
  'origin_region',
  'varietal',
  'harvest_year',
  'description',
  'lore',
  'processing_notes',
  'terroir',
  'mood',
  'experience',
  'image_url',
];

function getProfileValue(
  profile: ProfileData,
  field: ProfileSuggestableField,
): string | null {
  return (profile as unknown as Record<string, unknown>)[field] as string | null ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const Skeleton: React.FC = () => (
  <div className="px-4 md:px-8 pt-8 pb-nav-gap max-w-2xl mx-auto space-y-4 animate-pulse">
    <div className="h-8 w-2/3 bg-tea-surface rounded-[2px]" />
    <div className="h-4 w-1/3 bg-tea-surface rounded-[2px]" />
    <div className="h-4 w-1/2 bg-tea-surface rounded-[2px]" />
    <div className="h-px bg-tea-border my-6" />
    <div className="h-5 w-1/4 bg-tea-surface rounded-[2px]" />
    <div className="h-4 w-full bg-tea-surface rounded-[2px]" />
    <div className="h-4 w-4/5 bg-tea-surface rounded-[2px]" />
    <div className="h-4 w-3/5 bg-tea-surface rounded-[2px]" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Canonical detail drawer (View Adrian's full canonical content)
// ─────────────────────────────────────────────────────────────────────────────

interface CanonicalDrawerProps {
  profile: ProfileData;
  onClose: () => void;
}

const CanonicalDrawer: React.FC<CanonicalDrawerProps> = ({ profile, onClose }) => {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = [
    ...(profile.image_url ? [profile.image_url] : []),
    ...(profile.canonical_photos ?? []),
  ].filter(Boolean);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-drawer bg-tea-bg/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} canonical content`}
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
          {profile.curated_by_name && (
            <p className="text-tea-text-sec text-[11px] tracking-[0.04em] mt-1">
              Sourced from Teajia · curated by {profile.curated_by_name}
            </p>
          )}
          <p className="text-tea-text-sec text-[12px] italic mt-1">Read-only view of all canonical content.</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6 surface-warm-inset">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="mb-6">
              <div
                className="w-full aspect-square rounded-[4px] overflow-hidden"
                style={{ border: '1px solid rgba(168,135,77,0.08)' }}
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
                      className={`w-12 h-12 rounded-[2px] overflow-hidden border transition-colors ${
                        i === photoIdx ? 'border-tea-gold' : 'border-tea-border hover:border-tea-gold/40'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All canonical fields */}
          {CANONICAL_FIELD_ORDER.map(field => {
            const val = getProfileValue(profile, field);
            if (!val) return null;
            if (field === 'image_url') return null; // shown via photos block above
            return (
              <div key={field} className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-tea-text-dim mb-1">
                  {FIELD_LABELS[field]}
                </p>
                <p className="font-body text-[15px] leading-[1.7] text-tea-text whitespace-pre-wrap">
                  {val}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Single canonical field — the card-as-editor model
// ─────────────────────────────────────────────────────────────────────────────

interface CanonicalFieldProps {
  field: ProfileSuggestableField;
  canonicalValue: string | null;
  pendingValue: string | undefined;
  onEdit: (field: ProfileSuggestableField, value: string) => void;
  onClearEdit: (field: ProfileSuggestableField) => void;
}

const CanonicalField: React.FC<CanonicalFieldProps> = ({
  field,
  canonicalValue,
  pendingValue,
  onEdit,
  onClearEdit,
}) => {
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isLong = LONG_FIELDS.has(field);
  const hasPending = pendingValue !== undefined && pendingValue !== canonicalValue;
  const displayValue = isActive
    ? (pendingValue ?? canonicalValue ?? '')
    : (pendingValue !== undefined ? pendingValue : (canonicalValue ?? ''));

  const activate = () => {
    setIsActive(true);
    // When activating, seed pendingValue with current canonical if not yet set
    if (pendingValue === undefined) {
      onEdit(field, canonicalValue ?? '');
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setIsActive(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClearEdit(field);
      setIsActive(false);
    }
  };

  const handleChange = (val: string) => {
    onEdit(field, val);
  };

  const isEmpty = !canonicalValue && pendingValue === undefined;

  return (
    <div className="group relative">
      <div className="flex items-start gap-2 mb-1">
        <p className="text-[11px] uppercase tracking-[0.1em] text-tea-text-dim leading-[1.6]">
          {FIELD_LABELS[field]}
        </p>
        {hasPending && (
          <span className="text-[11px] italic text-tea-gold leading-[1.6]">edited</span>
        )}
      </div>

      {isActive ? (
        isLong ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={displayValue}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={5}
            className="w-full bg-transparent font-body text-[15px] leading-[1.7] text-tea-text resize-none outline-none border-b border-tea-border focus:border-tea-gold/60 transition-colors py-1"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(168,135,77,0.15)' }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={displayValue}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent font-body text-[15px] leading-[1.7] text-tea-text outline-none border-b border-tea-border focus:border-tea-gold/60 transition-colors py-1"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(168,135,77,0.15)' }}
          />
        )
      ) : (
        <button
          type="button"
          onClick={activate}
          className="text-left w-full group/btn"
          title={`Edit ${FIELD_LABELS[field]}`}
        >
          {isEmpty ? (
            <span className="font-body text-[15px] leading-[1.7] italic text-tea-text-dim group-hover/btn:text-tea-text-sec transition-colors">
              Add a {FIELD_LABELS[field].toLowerCase()}
            </span>
          ) : (
            <span
              className={`font-body text-[15px] leading-[1.7] text-tea-text whitespace-pre-wrap text-left block
                group-hover/btn:underline group-hover/btn:decoration-tea-gold/30 group-hover/btn:cursor-text transition-colors
                ${hasPending ? 'underline decoration-tea-gold/40' : ''}`}
            >
              {displayValue || <span className="italic text-tea-text-dim">—</span>}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Listing-owned section — stock, price, note
// ─────────────────────────────────────────────────────────────────────────────

interface ListingFieldsProps {
  listing: ListingData;
  profile: ProfileData;
  callerCurrency: string;
}

// Inline save confirmation: "Saved · 14:32"
function useSaveConfirm() {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    setMsg(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return { msg, show };
}

const ListingFields: React.FC<ListingFieldsProps> = ({ listing, profile, callerCurrency }) => {
  const [stockValue, setStockValue] = useState(String(listing.stock_grams ?? ''));
  const [priceValue, setPriceValue] = useState(
    listing.fixed_retail_price_usd != null
      ? String(Math.round(listing.fixed_retail_price_usd))
      : ''
  );
  const [sampleAvail, setSampleAvail] = useState(listing.is_sample);
  const [storeNote, setStoreNote] = useState(listing.store_note ?? '');
  const { msg: saveMsg, show: showSave } = useSaveConfirm();

  // Inline autosave on blur. Only persists fields that genuinely changed
  // since the last successful save (initial value or last server-confirmed).
  // Errors surface as inline italic prose in the saveMsg slot — no toast.
  const lastSaved = useRef({
    stock: String(listing.stock_grams ?? ''),
    price: listing.fixed_retail_price_usd != null
      ? String(Math.round(listing.fixed_retail_price_usd))
      : '',
    sample: listing.is_sample,
    note: listing.store_note ?? '',
  });

  const persist = useCallback(async (patch: {
    stock_grams?: number;
    fixed_retail_price_usd?: number | null;
    store_note?: string | null;
    is_sample?: boolean;
  }) => {
    try {
      await api.network.updateListing(listing.id, patch);
      showSave('Saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      showSave(err?.message || "Couldn't save. Try again.");
    }
  }, [listing.id, showSave]);

  const saveStock = () => {
    if (stockValue === lastSaved.current.stock) return;
    const n = Number(stockValue);
    if (!isFinite(n) || n < 0) { showSave('Stock must be ≥ 0'); return; }
    lastSaved.current.stock = stockValue;
    void persist({ stock_grams: Math.floor(n) });
  };

  const savePrice = () => {
    if (priceValue === lastSaved.current.price) return;
    if (priceValue.trim() === '') {
      lastSaved.current.price = '';
      void persist({ fixed_retail_price_usd: null });
      return;
    }
    const n = Number(priceValue);
    if (!isFinite(n) || n < 0) { showSave('Price must be ≥ 0'); return; }
    lastSaved.current.price = priceValue;
    void persist({ fixed_retail_price_usd: n });
  };

  const saveSample = (next: boolean) => {
    if (next === lastSaved.current.sample) return;
    lastSaved.current.sample = next;
    setSampleAvail(next);
    void persist({ is_sample: next });
  };

  const saveNote = () => {
    if (storeNote === lastSaved.current.note) return;
    lastSaved.current.note = storeNote;
    void persist({ store_note: storeNote || null });
  };

  return (
    <div className="space-y-7">
      {/* Stock */}
      <div>
        <label className="flex items-baseline gap-4">
          <span className="text-tea-text-sec text-[13px] w-40 shrink-0">Stock</span>
          <div className="flex items-baseline gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={stockValue}
              onChange={e => setStockValue(e.target.value)}
              onBlur={saveStock}
              className="w-24 bg-transparent border-b border-tea-border focus:border-tea-gold/60 outline-none font-mono text-[14px] text-tea-text py-1 text-right transition-colors"
            />
            <span className="text-tea-text-sec text-[13px]">g</span>
          </div>
        </label>
        <div className="flex items-center gap-4 mt-3 pl-44">
          <span className="text-tea-text-sec text-[13px]">Sample available</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveSample(true)}
              className={`text-[13px] transition-colors ${sampleAvail ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              yes
            </button>
            <span className="text-tea-border text-[11px]">/</span>
            <button
              type="button"
              onClick={() => saveSample(false)}
              className={`text-[13px] transition-colors ${!sampleAvail ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
            >
              no
            </button>
          </div>
        </div>
      </div>

      {/* Retail price */}
      <div>
        <label className="flex items-baseline gap-4">
          <span className="text-tea-text-sec text-[13px] w-40 shrink-0">Your retail price</span>
          <div className="flex items-baseline gap-2">
            <span className="text-tea-text-sec text-[13px] font-mono shrink-0">{callerCurrency}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={priceValue}
              onChange={e => setPriceValue(e.target.value)}
              onBlur={savePrice}
              className="w-24 bg-transparent border-b border-tea-border focus:border-tea-gold/60 outline-none font-mono text-[14px] text-tea-text py-1 text-right transition-colors"
            />
            <span className="text-tea-text-sec text-[13px]">/100g</span>
          </div>
        </label>
        {/* Canonical retail context */}
        {profile.curated_by_name && (
          <p className="text-tea-text-sec italic text-[12px] leading-[1.6] mt-2 pl-44">
            {profile.curated_by_name}'s canonical retail is shown on the detail drawer above.
          </p>
        )}
      </div>

      {/* Store note */}
      <div>
        <p className="text-tea-text-sec text-[13px] mb-2">Your note on this tea</p>
        <textarea
          value={storeNote}
          onChange={e => setStoreNote(e.target.value)}
          rows={4}
          placeholder="Your voice on this tea. Shown above the canonical description on your storefront."
          className="w-full bg-transparent border border-tea-border focus:border-tea-gold/40 outline-none font-body text-[15px] leading-[1.7] text-tea-text px-3 py-2 rounded-[2px] resize-none transition-colors placeholder:text-tea-text-dim placeholder:italic"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-tea-text-dim italic text-[12px] leading-[1.6]">
            Your note shows above Adrian's canonical description on your storefront.
          </p>
          <button
            type="button"
            onClick={saveNote}
            className="text-[12px] text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Save note
          </button>
        </div>
      </div>

      {/* Photos */}
      <div>
        <p className="text-tea-text-sec text-[13px] mb-1">Your photos</p>
        {listing.listing_photos.length > 0 ? (
          <p className="text-tea-text-dim italic text-[13px]">
            {listing.listing_photos.length} photo{listing.listing_photos.length !== 1 ? 's' : ''} uploaded.
            Photo management coming in the next step.
          </p>
        ) : (
          <p className="text-tea-text-dim italic text-[13px]">
            No photos yet. Photo upload coming in the next step.
          </p>
        )}
      </div>

      {/* Autosave feedback */}
      {saveMsg && (
        <p className="text-tea-text-dim italic text-[12px] transition-opacity">{saveMsg}</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Network adoption block — only when caller originated the profile
// AND the curator is not yet the platform account.
// Per Step 6 of the rollout: a partner flags their tea for Adrian to consider.
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkAdoptionBlockProps {
  profileId: string;
  profileName: string;
  decision: 'pending' | 'adopted' | 'declined' | null;
  suggestedAt: string | null;
  declineNote: string | null;
  onSuggested: () => void | Promise<void>;
}

const NetworkAdoptionBlock: React.FC<NetworkAdoptionBlockProps> = ({
  profileId, profileName, decision, suggestedAt, declineNote, onSuggested,
}) => {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // If decision is 'pending', show a quiet pending notice — no action.
  if (decision === 'pending') {
    return (
      <div className="mb-8">
        <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7]">
          Suggested for the Teajia network on{' '}
          {suggestedAt ? new Date(suggestedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : 'recently'}.
          Awaiting Adrian's review.
        </p>
      </div>
    );
  }

  // If declined, show the note (if any) and offer re-suggestion.
  if (decision === 'declined') {
    return (
      <div className="mb-8">
        {declineNote && (
          <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7] mb-2">
            Adrian declined: "{declineNote}"
          </p>
        )}
        {!open ? (
          <button
            type="button"
            onClick={() => { setOpen(true); setError(null); }}
            className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors group"
          >
            Suggest for the network again{' '}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        ) : (
          <SuggestForm
            note={note} setNote={setNote}
            busy={busy} error={error}
            onCancel={() => { setOpen(false); setNote(''); setError(null); }}
            onSubmit={async () => {
              setBusy(true); setError(null);
              try {
                await api.network.suggestForNetwork(profileId, note.trim() || undefined);
                setOpen(false); setNote('');
                await onSuggested();
              } catch (err: any) {
                setError(err?.message || 'Could not send. Try again.');
              } finally { setBusy(false); }
            }}
          />
        )}
      </div>
    );
  }

  // Default: never suggested. Offer the suggestion action.
  return (
    <div className="mb-8">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setError(null); }}
          className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors group"
        >
          Suggest <span className="italic">{profileName}</span> for the Teajia network{' '}
          <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      ) : (
        <SuggestForm
          note={note} setNote={setNote}
          busy={busy} error={error}
          onCancel={() => { setOpen(false); setNote(''); setError(null); }}
          onSubmit={async () => {
            setBusy(true); setError(null);
            try {
              await api.network.suggestForNetwork(profileId, note.trim() || undefined);
              setOpen(false); setNote('');
              await onSuggested();
            } catch (err: any) {
              setError(err?.message || 'Could not send. Try again.');
            } finally { setBusy(false); }
          }}
        />
      )}
    </div>
  );
};

interface SuggestFormProps {
  note: string;
  setNote: (s: string) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}

const SuggestForm: React.FC<SuggestFormProps> = ({ note, setNote, busy, error, onCancel, onSubmit }) => (
  <div className="space-y-3">
    <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7]">
      Adrian reviews suggestions on his time. If adopted, this tea becomes
      visible in every partner's catalog browse, with you credited as the originator.
    </p>
    <textarea
      value={note}
      onChange={e => setNote(e.target.value.slice(0, 1000))}
      placeholder="Why does this tea belong in the network? (Optional)"
      rows={3}
      className="w-full px-3 py-2 bg-tea-bg border border-tea-border rounded-sm text-[14px] text-tea-text font-body placeholder:text-tea-text-dim placeholder:italic focus:outline-none focus:border-tea-gold/40"
      maxLength={1000}
    />
    <div className="flex items-center gap-4 text-[13px]">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="text-tea-text-sec hover:text-tea-text transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="text-tea-text-sec hover:text-tea-gold transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        {busy ? 'Sending…' : 'Send to Adrian →'}
      </button>
    </div>
    {error && (
      <p className="font-body italic text-[13px] text-tea-text-sec">{error}</p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export const PartnerListingEdit: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();

  const { memberships, activeAccountId, platformRole } = useAppStore(
    useShallow(s => ({
      memberships: s.memberships,
      activeAccountId: s.activeAccountId,
      platformRole: s.platformRole,
    })),
  );

  const hasCatalog = selectHasBundle({ memberships, activeAccountId, platformRole }, 'catalog');

  // Caller currency: first membership's currency or AUD
  const callerCurrency =
    ((memberships.find(m => m.account_id === activeAccountId) as any)?.currency) || 'AUD';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [listing, setListing] = useState<ListingData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!listingId) { setNotFound(true); setLoading(false); return; }
    setFetchError(null);
    try {
      const data = await api.network.getListing(listingId);
      setListing(data.listing);
      setProfile(data.profile);
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes('not found')) {
        setNotFound(true);
      } else {
        setFetchError(err?.message || "Couldn't load this listing. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (hasCatalog) load();
  }, [hasCatalog, load]);

  // ── Pending canonical edits ────────────────────────────────────────────────
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Confirm state for cancelling all pending edits
  const [confirmCancel, setConfirmCancel] = useState(false);
  const submitResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCount = Object.keys(pendingEdits).length;
  const hasEdits = pendingCount > 0;

  const handleFieldEdit = useCallback(
    (field: ProfileSuggestableField, value: string) => {
      setPendingEdits(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleFieldClear = useCallback(
    (field: ProfileSuggestableField) => {
      setPendingEdits(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const handleCancelAll = () => {
    if (pendingCount > 1) {
      setConfirmCancel(true);
    } else {
      setPendingEdits({});
      setConfirmCancel(false);
    }
  };

  const handleConfirmCancel = () => {
    setPendingEdits({});
    setConfirmCancel(false);
    setSubmitError(null);
  };

  const handleSubmitEdits = async () => {
    if (!profile || !hasEdits || submitBusy) return;
    setSubmitBusy(true);
    setSubmitError(null);

    // Build suggestion bundle — only fields where proposed_value != current canonical
    const drafts: ProfileSuggestionFieldDraft[] = [];
    for (const [field, proposedValue] of Object.entries(pendingEdits) as [ProfileSuggestableField, string][]) {
      const currentValue = getProfileValue(profile, field);
      if (proposedValue !== currentValue) {
        drafts.push({
          field_name: field,
          current_value: currentValue,
          proposed_value: proposedValue,
        });
      }
    }

    if (drafts.length === 0) {
      setSubmitBusy(false);
      return;
    }

    try {
      await api.network.suggestEdits(profile.id, drafts);
      // Clear pending edits + show success message
      setPendingEdits({});
      setSubmitResult('Sent to ' + (profile.curated_by_name ?? 'the curator') + ". They'll respond on their time.");
      if (submitResultTimerRef.current) clearTimeout(submitResultTimerRef.current);
      submitResultTimerRef.current = setTimeout(() => {
        setSubmitResult(null);
        // Refetch to get latest canonical
        load();
      }, 5000);
    } catch (err: any) {
      setSubmitError("Couldn't reach the server. Your edits are held. Try Save again.");
    } finally {
      setSubmitBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (submitResultTimerRef.current) clearTimeout(submitResultTimerRef.current);
    };
  }, []);

  // ── Canonical drawer ───────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Gates ─────────────────────────────────────────────────────────────────

  if (!hasCatalog) {
    return (
      <div className="px-4 md:px-8 pt-10 pb-nav-gap max-w-2xl mx-auto">
        <p className="font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
          This page requires the Catalog bundle. Ask your owner.
        </p>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  if (notFound || !listing || !profile) {
    return (
      <div className="px-4 md:px-8 pt-10 pb-nav-gap max-w-2xl mx-auto">
        <p className="font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
          This listing doesn't exist or isn't yours.
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="px-4 md:px-8 pt-10 pb-nav-gap max-w-2xl mx-auto">
        <p className="font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
          {fetchError}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-3 text-[13px] text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Try again →
        </button>
      </div>
    );
  }

  // Is the active account the curator of this profile? If so, hide suggestion machinery.
  const isCurator = profile.curated_by_account_id === activeAccountId;

  return (
    <div className="px-4 md:px-8 pt-8 pb-nav-gap-lg max-w-2xl mx-auto">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <header className="mb-8">
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/admin/inventory')}
          className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px] mb-5 flex items-center gap-1"
        >
          ← Inventory
        </button>

        {/* Tea name — wayfinder, not editable directly here */}
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          {profile.name}
        </h1>
        {profile.chinese_name && (
          <p className="font-body text-[15px] text-tea-text-sec mb-1">{profile.chinese_name}</p>
        )}

        {/* Attribution */}
        {profile.curated_by_name && (
          <p className="text-[11px] text-tea-text-dim tracking-[0.04em] mt-1">
            Sourced from Teajia · curated by {profile.curated_by_name}
          </p>
        )}

        {/* View full canonical content link */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mt-2 text-[12px] text-tea-text-sec hover:text-tea-gold transition-colors group"
        >
          View {profile.curated_by_name ?? 'curator'}'s full canonical content{' '}
          <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </header>

      {/* ── Curator notice — hides suggestion machinery ─────────────────────── */}
      {isCurator && (
        <div className="mb-8">
          <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7]">
            You curate this tea — edit it directly in your inventory.{' '}
            <button
              type="button"
              onClick={() => navigate('/admin/inventory')}
              className="text-tea-text-sec hover:text-tea-text underline transition-colors"
            >
              Back to inventory
            </button>
          </p>
        </div>
      )}

      {/* ── Network adoption — only when caller originated AND it's not yet canonical ─ */}
      {isCurator
        && profile.originated_by_account_id === activeAccountId
        && profile.curated_by_kind !== 'platform' && (
        <NetworkAdoptionBlock
          profileId={profile.id}
          profileName={profile.name}
          decision={profile.adoption_decision ?? null}
          suggestedAt={profile.suggested_for_network_at ?? null}
          declineNote={profile.adoption_decline_note ?? null}
          onSuggested={load}
        />
      )}

      {/* Hairline */}
      <div className="h-px bg-tea-border mb-8" />

      {/* ── Listing-owned section ─────────────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.1em] text-tea-text-dim mb-6">
          Your listing
        </p>
        <ListingFields listing={listing} profile={profile} callerCurrency={callerCurrency} />
      </section>

      {/* Hairline */}
      <div className="h-px bg-tea-border mb-8" />

      {/* ── Canonical section — card-as-editor ─────────────────────────────── */}
      {!isCurator && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] uppercase tracking-[0.1em] text-tea-text-dim">
              {profile.curated_by_name ? `${profile.curated_by_name}'s canonical` : 'Canonical content'}
            </p>
            {!hasEdits && (
              <p className="text-[12px] italic text-tea-text-dim">
                Tap any field to propose a change.
              </p>
            )}
          </div>
          <p className="font-body italic text-[13px] text-tea-text-dim leading-[1.6] mb-6">
            Changes you make here go to {profile.curated_by_name ?? 'the curator'}'s review queue.
            They accept or reject each field. The change is the argument — no explanation needed.
          </p>

          {/* Canonical image */}
          {profile.image_url && (
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.1em] text-tea-text-dim mb-1">
                {FIELD_LABELS['image_url']}
              </p>
              <CanonicalField
                field="image_url"
                canonicalValue={profile.image_url}
                pendingValue={pendingEdits['image_url']}
                onEdit={handleFieldEdit}
                onClearEdit={handleFieldClear}
              />
            </div>
          )}

          {/* Canonical photos strip */}
          {profile.canonical_photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {profile.canonical_photos.map((url, i) => (
                <div
                  key={url}
                  className="w-16 h-16 rounded-[2px] overflow-hidden shrink-0"
                  style={{ border: '1px solid rgba(168,135,77,0.08)' }}
                >
                  <img src={url} alt={`Canonical photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}

          {/* Canonical text fields */}
          <div className="space-y-6">
            {CANONICAL_FIELD_ORDER.filter(f => f !== 'image_url').map(field => (
              <CanonicalField
                key={field}
                field={field}
                canonicalValue={getProfileValue(profile, field)}
                pendingValue={pendingEdits[field]}
                onEdit={handleFieldEdit}
                onClearEdit={handleFieldClear}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Editorial footer — the footer button swap ─────────────────────── */}
      {!isCurator && (
        <footer className="pb-nav-gap">
          {/* Success message */}
          {submitResult && (
            <p className="font-body italic text-[13px] text-tea-text-sec leading-[1.6] mb-4">
              {submitResult}
            </p>
          )}

          {/* Network error on submit */}
          {submitError && (
            <p className="font-body italic text-[13px] text-tea-text-sec leading-[1.6] mb-4">
              {submitError}
            </p>
          )}

          {/* Cancel confirmation */}
          {confirmCancel && (
            <p className="font-body italic text-[13px] text-tea-text-sec leading-[1.6] mb-4">
              Discard {pendingCount} change{pendingCount !== 1 ? 's' : ''}?{' '}
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="text-tea-text-sec hover:text-tea-text underline transition-colors"
              >
                Confirm
              </button>
              {' '}
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="text-tea-text-sec hover:text-tea-text transition-colors"
              >
                Keep editing
              </button>
            </p>
          )}

          {hasEdits ? (
            /* Footer with pending edits — editorial action pair */
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleCancelAll}
                className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px]"
              >
                Cancel all
              </button>
              <button
                type="button"
                onClick={handleSubmitEdits}
                disabled={submitBusy}
                className="text-tea-text hover:text-tea-gold transition-colors font-display text-[15px] tracking-[0.04em] disabled:text-tea-text-dim disabled:cursor-not-allowed group"
              >
                {submitBusy ? 'Sending…' : 'Save proposed edits'}{' '}
                {!submitBusy && (
                  <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                )}
              </button>
            </div>
          ) : (
            /* Empty footer — quiet helper text */
            <p className="font-body italic text-[13px] text-tea-text-dim text-center leading-[1.6]">
              Edit any of {profile.curated_by_name ?? 'the curator'}'s content above to suggest a change.
            </p>
          )}
        </footer>
      )}

      {/* ── Canonical detail drawer ─────────────────────────────────────────── */}
      {drawerOpen && (
        <CanonicalDrawer profile={profile} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
};
