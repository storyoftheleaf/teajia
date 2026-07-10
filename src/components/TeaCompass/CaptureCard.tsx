import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Droplets, Minus, Plus, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore, entryHasContent } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../../data/teaVarieties';
import type { TeaType, TeaForm, TeawareCategory, TeawareMaterial, TeawareEra, YixingClayType, VendorDetails, TeaCompassEntry } from './types';
import { DEFAULT_GRAMS, TEA_TYPES, TEA_FORMS, STORAGE_OPTIONS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, YIXING_CLAY_TYPES, MATERIAL_ORIGIN_DEFAULT, COMMON_REGIONS, generateTeaKey } from './types';
import { hasToken } from '../../lib/api';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { PricingRow } from './PricingRow';
import { NoteThread } from '../shared/NoteThread';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useSampleCartStore } from '../../samples/sampleCartStore';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { TastingSession } from '../tasting/TastingSession';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { parseTeaInput } from './InputParser';
import { PhotoCapture } from './PhotoCapture';
import type { ExtractedTeaData } from './PhotoCapture';
import { TeawarePhotos } from './TeawarePhotos';
import { DuplicateNudge } from './DuplicateNudge';
import { IntentBar } from './IntentBar';
import { CaptureContextChips } from './CaptureContextChips';
import { CaptureVerdictRow } from './CaptureVerdictRow';

type ParseableField = 'type' | 'form' | 'year' | 'season' | 'storage' | 'region';

// Currency options for teaware price input
const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'NT', label: 'NT' },
  { value: 'USD', label: 'USD' },
  { value: 'Yuan', label: '\u00A5' },
  { value: 'MYR', label: 'MYR' },
  { value: 'IDR', label: 'IDR' },
  { value: 'JPY', label: 'JPY' },
  { value: 'HKD', label: 'HKD' },
];

export interface CaptureCardActions {
  openTasting: () => void;
  toggleBuy: () => void;
}

interface CaptureCardProps {
  entryId: string;
  /** Called when user adds an item to the ledger, to switch to ledger tab */
  onSwitchToLedger?: () => void;
  /** Called when user commits/finalizes an entry */
  onCommit?: () => void;
  /** When set, shows a "← Library" back link at the top (navigated from Library via Edit) */
  onReturnToLibrary?: () => void;
  /** Start in collapsed (thin) mode */
  initialCollapsed?: boolean;
  /** Ref populated with action callbacks — used by parent to render pinned action bar */
  actionRef?: React.MutableRefObject<CaptureCardActions | null>;
  /** When provided, a small "Share" affordance renders next to the Done
   *  CTA so the user has share + commit colocated in the action area
   *  (rather than share floating up in the page header). */
  onShare?: () => void;
  /** Rapid batch-entry mode state, surfaced inside the Run chip's sheet */
  batchMode?: boolean;
  onToggleBatchMode?: () => void;
}

const EMPTY_TASTING: TastingData = {};

/** One-line descriptions shown next to each type in the picker, for beginners */
const TEA_TYPE_DESCRIPTIONS: Record<string, string> = {
  Green:  'Unoxidized · grassy, fresh, vegetal',
  White:  'Minimal processing · delicate, floral',
  Yellow: 'Rare, slow-dried · mellow, honeyed',
  Oolong: 'Partially oxidized · floral to roasted',
  Red:    'Fully oxidized (called "black" in West)',
  Dark:   'Aged & fermented heicha (non-puerh)',
  Sheng:  'Raw puerh · young or aged',
  Shou:   'Ripe puerh · fermented, earthy',
  Herbal: 'Flowers, roots & tisanes (no tea leaf)',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NT: 'NT$', USD: '$', Yuan: 'CN¥', MYR: 'RM', IDR: 'Rp', JPY: 'JP¥', HKD: 'HK$', UNK: '?',
};

/** Retail price preview: shows cost/g and projected retail/g using 3× formula */
function RetailPricePreview({
  costAmount, grams, currency, shippingRatePerKg, onShippingRateChange,
}: {
  costAmount: number;
  grams: number;
  currency: string;
  shippingRatePerKg: number;
  onShippingRateChange: (rate: number) => void;
}) {
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingInput, setShippingInput] = useState('');
  const sym = CURRENCY_SYMBOLS[currency] || currency;

  const costPerGram = costAmount / grams;
  const shippingPerGram = shippingRatePerKg / 1000;
  const retailPerGram = (costPerGram + shippingPerGram) * 3;

  const fmtGram = (v: number) => v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div className="flex items-center gap-2 px-1 text-ui-11 text-tea-text-dim">
      <span className="tabular-nums">{sym}{fmtGram(costPerGram)}/g cost</span>
      <span className="text-tea-border">→</span>
      <span className="tabular-nums text-tea-text-sec font-medium">≈ {sym}{fmtGram(retailPerGram)}/g retail</span>
      <span className="text-tea-border">·</span>
      {editingShipping ? (
        <span className="flex items-center gap-1">
          <span className="text-tea-text-dim">ship</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={shippingInput}
            onChange={(e) => setShippingInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(shippingInput);
              onShippingRateChange(isNaN(v) ? 0 : v);
              setEditingShipping(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                const v = parseFloat(shippingInput);
                onShippingRateChange(isNaN(v) ? 0 : v);
                setEditingShipping(false);
              }
            }}
            className="w-16 bg-tea-elevated text-tea-text text-ui-11 px-1.5 py-0.5 rounded border border-tea-border outline-none focus:border-tea-gold/40 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-tea-text-dim">/kg</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => { setShippingInput(shippingRatePerKg > 0 ? String(shippingRatePerKg) : ''); setEditingShipping(true); }}
          className="text-tea-text-dim hover:text-tea-text-sec transition-colors underline underline-offset-2 decoration-dashed"
        >
          {shippingRatePerKg > 0 ? `+${sym}${shippingRatePerKg}/kg ship` : 'add ship cost'}
        </button>
      )}
    </div>
  );
}

/** Get chip color for a tea type */
function getTypeChipStyle(type: TeaType): { bg: string; text: string } {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return { bg: `${color}20`, text: color };
}

/** The brand's editorial eyebrow — Cormorant italic small-caps in gold.
 *  Borrowed from the magazine card eyebrow so the section markers read in the
 *  same museum-caption register as the rest of the brand, not as form labels. */
const CAPTURE_EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  fontStyle: 'italic',
  fontWeight: 500,
  fontVariant: 'all-small-caps',
  letterSpacing: '0.08em',
  color: 'var(--tea-gold)',
};

/** Section eyebrow divider — warm gold hairline + small-caps gold label.
 *  `ornament` adds a single centered gold dot (use sparingly, once). */
const SectionDivider: React.FC<{ label: string; ornament?: boolean }> = ({ label, ornament }) => (
  <div className="flex items-center gap-3 pt-2">
    <div className={`relative flex-1 divider-warm${ornament ? ' divider-ornament' : ''}`} />
    <span style={CAPTURE_EYEBROW_STYLE} className="shrink-0">{label}</span>
    <div className="flex-1 divider-warm" />
  </div>
);

/** Inline status mark — Want/Buy/Sample/Taste tile inside the form.
 *  Text-only (no icons): a label plus one quiet helper line that says
 *  what the action does, so the four are legible on first encounter.
 *  Transparent bg at rest; gold-tint border + accent-sub when active. */
const EntryMark: React.FC<{
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
}> = ({ label, hint, active, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={ariaLabel || label}
    className={`group relative flex flex-col items-start justify-center gap-0.5 min-h-[64px] px-3 py-2.5 rounded-md border text-left transition-colors ${
      active
        ? 'bg-tea-accent-sub border-tea-gold/30 text-tea-text'
        : 'bg-transparent border-tea-border text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
    }`}
  >
    <span className={`pointer-events-none font-display text-ui-15 ${active ? 'text-tea-text' : 'text-tea-text-sec'}`}>
      {label}
    </span>
    <span className="pointer-events-none text-ui-11 leading-snug text-tea-text-dim">
      {hint}
    </span>
  </button>
);

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit, onReturnToLibrary, initialCollapsed = false, actionRef, onShare, batchMode, onToggleBatchMode }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const shippingRatePerKg = useTeaCompassStore((s) => s.shippingRatePerKg);
  const setShippingRatePerKg = useTeaCompassStore((s) => s.setShippingRatePerKg);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const lastVendorId = useTeaCompassStore((s) => s.lastVendorId);
  const lastVendorName = useTeaCompassStore((s) => s.lastVendorName);
  const customEras = useTeaCompassStore((s) => s.customEras);
  const addCustomEra = useTeaCompassStore((s) => s.addCustomEra);

  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const transactions = useLedgerStore((s) => s.transactions);

  // Sample cart — used by the inline EntryMarks strip below the form so
  // Want/Buy/Sample/Taste are colocated with the entry rather than living
  // in a separate fixed action bar.
  const sampleCartHas = useSampleCartStore((s) => s.items.some((i) => i.id === entryId));
  const addSampleCartItem = useSampleCartStore((s) => s.addItem);
  const removeSampleCartItem = useSampleCartStore((s) => s.removeItem);

  // The note thread (NoteThread) stores notes in the notes store, not on the
  // entry. Subscribe to the count for this entry so the Done button's readiness
  // (entryHasContent, which reads that store) re-evaluates the moment a note is
  // added or removed — otherwise the button would stay disabled until some
  // other re-render happened.
  const threadNoteCount = useNotesStore(
    (s) => s.notes.filter((n) => !n.deleted && n.compassEntryId === entryId).length
  );
  void threadNoteCount;

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tastingOverlayOpen, setTastingOverlayOpen] = useState(false);
  const [localTasting, setLocalTasting] = useState<TastingData>(EMPTY_TASTING);

  // Vendor picker visibility. The chip in the context row is the trigger;
  // the VendorStrip itself stays collapsed until asked for (1b re-houses it
  // as a proper bottom sheet).
  const [vendorOpen, setVendorOpen] = useState(false);

  // Buying quantity picker state
  const [buyingQty, setBuyingQty] = useState(100);
  const [justAddedToLedger, setJustAddedToLedger] = useState(false);
  const [showBuyPicker, setShowBuyPicker] = useState(false);

  // Sync price changes back to any matching draft ledger line items
  useEffect(() => {
    if (!entry) return;
    const { transactions, updateLineItem: updItem } = useLedgerStore.getState();
    for (const tx of transactions) {
      if (tx.status !== 'draft') continue;
      for (const item of tx.items) {
        if (item.compassEntryId !== entry.id) continue;
        const newPrice = entry.priceAmount ?? 0;
        const unitBased = entry.category === 'teaware' || (['Cake','Brick','Tuo'] as string[]).includes(entry.form || '');
        const newIsPerGram = !unitBased && !!entry.pricePerUnitGrams;
        if (item.pricePerUnit !== newPrice || item.priceIsPerGram !== newIsPerGram) {
          updItem(tx.id, item.id, { pricePerUnit: newPrice, priceIsPerGram: newIsPerGram });
        }
      }
    }
  }, [entry?.priceAmount, entry?.pricePerUnitGrams, entry?.form, entry?.category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parser state
  const userTapped = useRef<Set<ParseableField>>(new Set());
  const [parsedTokens, setParsedTokens] = useState<Partial<Record<ParseableField, string>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNameRef = useRef<string>('');

  // Photo extraction confirmation
  const [extractionSummary, setExtractionSummary] = useState<string | null>(null);
  const extractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duplicate detection state
  const allEntries = useTeaCompassStore((s) => s.entries);
  const [duplicateMatch, setDuplicateMatch] = useState<TeaCompassEntry | null>(null);
  const [showDuplicateNudge, setShowDuplicateNudge] = useState(false);
  const duplicateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedDuplicateRef = useRef<string | null>(null);

  // Popover state for inline chip selectors
  // Tea-side Type picker — opens as a Vaul bottom sheet. Form picker has
  // moved into PriceGrams which now manages its own sheet state.
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  // Teaware pickers — open as Vaul bottom sheets. State names kept from
  // the previous popover implementation to minimise churn elsewhere.
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  // Clay subtype picker — opens as a separate full-screen sheet after the
  // user picks Clay or Yixing in the Material sheet.
  const [claySheetOpen, setClaySheetOpen] = useState(false);
  // Era picker — opens as a Vaul bottom sheet next to the Origin field.
  const [eraSheetOpen, setEraSheetOpen] = useState(false);
  // Vestigial — still used by some legacy code paths to track which panel
  // a popover is in. Bottom sheets don't need this; left for safety.
  const [materialPanel, setMaterialPanel] = useState<'main' | 'yixing'>('main');
  // Inside the era sheet: shows the "+ Add era" input row
  const [eraInputOpen, setEraInputOpen] = useState(false);
  const [eraInputValue, setEraInputValue] = useState('');
  const categoryPopoverRef = useRef<HTMLDivElement>(null);
  const eraPopoverRef = useRef<HTMLDivElement>(null);
  const materialPopoverRef = useRef<HTMLDivElement>(null);
  const eraInputRef = useRef<HTMLInputElement>(null);

  // Products from database — for autocomplete suggestions
  const productsRef = useRef<any[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productNameMap, setProductNameMap] = useState<Record<string, any>>({});
  const [availableRegions, setAvailableRegions] = useState<string[]>(COMMON_REGIONS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try authenticated list first (includes drafts, personal, non-public)
        // Fall back to public list if not logged in
        let data: any;
        try {
          data = await api.products.list();
        } catch {
          data = await api.products.listPublic();
        }
        const products = data.products || data || [];
        if (cancelled) return;
        productsRef.current = products;

        // Build name suggestions + map
        const nameMap: Record<string, any> = {};
        const names: string[] = [];
        for (const p of products) {
          const name = p.given_name || p.givenName || '';
          if (name && !nameMap[name]) {
            nameMap[name] = p;
            names.push(name);
          }
        }
        setProductNames(names);
        setProductNameMap(nameMap);

        // Build region list: COMMON_REGIONS + DB regions, deduplicated
        const dbRegions = products
          .map((p: any) => p.origin_region || p.originRegion || '')
          .filter(Boolean);
        const allRegions = [...new Set([...COMMON_REGIONS, ...dbRegions])];
        setAvailableRegions(allRegions);
      } catch {
        // Offline or error — no DB suggestions, use COMMON_REGIONS only
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Tea variety suggestions filtered by selected type (prepended so they appear first)
  const varietySuggestions = useMemo(() => {
    if (entry?.category !== 'tea' || entry?.type === 'Teaware') return [];
    return getTeaVarietySuggestions(entry?.type as Exclude<TeaType, 'Teaware'> | undefined);
  }, [entry?.category, entry?.type]);

  // Map variety names → { originRegion, chineseName } for auto-fill on selection
  const varietyNameMap = useMemo(() => {
    if (entry?.category !== 'tea' || entry?.type === 'Teaware') return {};
    return buildVarietyDataMap(entry?.type as Exclude<TeaType, 'Teaware'> | undefined);
  }, [entry?.category, entry?.type]);

  // Hint suggestions shown on empty focus — first 8 primary variety names for selected type
  const hintSuggestions = useMemo(() => {
    if (entry?.category !== 'tea' || !entry?.type || entry?.type === 'Teaware') return [];
    return getTeaVarietyNames(entry.type as Exclude<TeaType, 'Teaware'>).slice(0, 8);
  }, [entry?.category, entry?.type]);

  // Also include compass entry names in suggestions
  const allNameSuggestions = useMemo(() => {
    const compassNames = allEntries
      .filter((e) => e.id !== entryId && e.name.trim().length > 0)
      .map((e) => e.name);
    // Variety suggestions come first so they're prioritized in the list
    return [...new Set([...varietySuggestions, ...productNames, ...compassNames])];
  }, [varietySuggestions, productNames, allEntries, entryId]);

  // Build fuse index from other entries (exclude current)
  const fuseIndex = useMemo(() => {
    const others = allEntries.filter((e) => e.id !== entryId && e.name.trim().length > 0);
    return new Fuse(others, {
      keys: ['name'],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [allEntries, entryId]);

  const update = useCallback(
    (updates: Record<string, unknown>) => {
      updateEntry(entryId, updates);
    },
    [entryId, updateEntry]
  );

  // (No outside-click handlers needed — every popover in this component
  // is now a Vaul bottom sheet which manages its own dismissal.)

  // Debounced input parser — runs when name changes
  useEffect(() => {
    if (!entry) return;
    // Only re-parse when the name actually changed (not from other field updates)
    if (entry.name === prevNameRef.current) return;
    prevNameRef.current = entry.name;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!entry.name.trim()) {
        setParsedTokens({});
        return;
      }

      const result = parseTeaInput(entry.name);
      const tokens: Partial<Record<ParseableField, string>> = {};
      const updates: Record<string, unknown> = {};

      // Only auto-fill fields that are empty AND not user-tapped
      if (result.type) {
        if (!entry.type && !userTapped.current.has('type')) {
          updates.type = result.type;
          tokens.type = result.type;
        } else if (entry.type === result.type) {
          tokens.type = result.type;
        }
      }

      if (result.form) {
        if (!entry.form && !userTapped.current.has('form')) {
          updates.form = result.form;
          updates.pricePerUnitGrams = DEFAULT_GRAMS[result.form];
          tokens.form = result.form;
        } else if (entry.form === result.form) {
          tokens.form = result.form;
        }
      }

      if (result.year) {
        if (!entry.year && !userTapped.current.has('year')) {
          updates.year = result.year;
          tokens.year = String(result.year);
        } else if (entry.year === result.year) {
          tokens.year = String(result.year);
        }
      }

      if (result.season) {
        if (!entry.season && !userTapped.current.has('season')) {
          updates.season = result.season;
          tokens.season = result.season;
        } else if (entry.season === result.season) {
          tokens.season = result.season;
        }
      }

      if (result.storage) {
        if (!entry.storage && !userTapped.current.has('storage')) {
          updates.storage = result.storage;
          tokens.storage = result.storage;
        } else if (entry.storage === result.storage) {
          tokens.storage = result.storage;
        }
      }

      if (result.region) {
        if (!entry.originRegion && !userTapped.current.has('region')) {
          updates.originRegion = result.region;
          tokens.region = result.region;
        } else if (entry.originRegion === result.region) {
          tokens.region = result.region;
        }
      }

      setParsedTokens(tokens);
      if (Object.keys(updates).length > 0) {
        updateEntry(entryId, updates);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [entry?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced duplicate detection — runs on name changes
  useEffect(() => {
    if (!entry) return;
    if (duplicateDebounceRef.current) clearTimeout(duplicateDebounceRef.current);

    // Don't search if name is too short or only one entry exists
    if (entry.name.trim().length < 3 || allEntries.length <= 1) {
      setDuplicateMatch(null);
      setShowDuplicateNudge(false);
      return;
    }

    duplicateDebounceRef.current = setTimeout(() => {
      const results = fuseIndex.search(entry.name.trim());
      if (results.length > 0 && results[0].score != null && results[0].score < 0.3) {
        let best = results[0].item;
        // Prefer matches from the same vendor if vendor is set
        if (entry.vendorName) {
          const sameVendor = results.find(
            (r) => r.score != null && r.score < 0.3 && r.item.vendorName === entry.vendorName
          );
          if (sameVendor) best = sameVendor.item;
        }
        // Don't re-show if user already dismissed this specific match
        if (dismissedDuplicateRef.current === best.id) return;
        setDuplicateMatch(best);
        setShowDuplicateNudge(true);
      } else {
        setDuplicateMatch(null);
        setShowDuplicateNudge(false);
      }
    }, 1000);

    return () => {
      if (duplicateDebounceRef.current) clearTimeout(duplicateDebounceRef.current);
    };
  }, [entry?.name, entry?.vendorName, fuseIndex, allEntries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle photo extraction results — auto-fill empty fields only
  const handleExtracted = useCallback(
    (data: ExtractedTeaData) => {
      if (!entry) return;
      const updates: Record<string, unknown> = {};
      const summaryParts: string[] = [];

      if (data.chineseName && !entry.chineseName) {
        updates.chineseName = data.chineseName;
        summaryParts.push(data.chineseName);
      }
      if (data.name && !entry.name) {
        updates.name = data.name;
        summaryParts.push(data.name);
      } else if (data.chineseName) {
        // Already added above
      }
      if (data.type && !entry.type && !userTapped.current.has('type')) {
        updates.type = data.type;
        summaryParts.push(data.type);
      }
      if (data.form && !entry.form && !userTapped.current.has('form')) {
        updates.form = data.form;
        if (!entry.pricePerUnitGrams) {
          const formKey = data.form as keyof typeof DEFAULT_GRAMS;
          if (DEFAULT_GRAMS[formKey]) updates.pricePerUnitGrams = DEFAULT_GRAMS[formKey];
        }
        summaryParts.push(data.form);
      }
      if (data.year && !entry.year && !userTapped.current.has('year')) {
        updates.year = data.year;
        summaryParts.push(String(data.year));
      }
      if (data.season && !entry.season && !userTapped.current.has('season')) {
        updates.season = data.season;
        summaryParts.push(data.season);
      }
      if (data.region && !entry.originRegion && !userTapped.current.has('region')) {
        updates.originRegion = data.region;
        summaryParts.push(data.region);
      }
      if (data.price != null && !entry.priceAmount) {
        updates.priceAmount = data.price;
      }
      if (data.grams != null && !entry.pricePerUnitGrams) {
        updates.pricePerUnitGrams = data.grams;
      }
      if (data.extraNotes) {
        const existing = entry.notes?.trim();
        updates.notes = existing ? `${existing}\n${data.extraNotes}` : data.extraNotes;
      }

      if (Object.keys(updates).length > 0) {
        updateEntry(entryId, updates);
      }

      // Show confirmation summary
      if (summaryParts.length > 0) {
        if (extractionTimerRef.current) clearTimeout(extractionTimerRef.current);
        setExtractionSummary(`Found: ${summaryParts.join(' \u00B7 ')}`);
        extractionTimerRef.current = setTimeout(() => setExtractionSummary(null), 3000);
      }
    },
    [entry, entryId, updateEntry]
  );

  const handlePhotoTaken = useCallback(
    (url: string) => {
      if (!entry) return;
      updateEntry(entryId, { photos: [...entry.photos, url] });
    },
    [entry, entryId, updateEntry]
  );

  const handlePhotoReplaced = useCallback(
    (oldUrl: string, newUrl: string) => {
      // Two callers feed this:
      //   1) Initial capture finishes — oldUrl is a transient blob: URL that
      //      never made it into entry.photos, so map() is a safe no-op.
      //   2) In-app crop/rotate edit — oldUrl IS a real entry photo URL and
      //      we must swap it for newUrl so the thumbnail re-renders. Without
      //      this, the user sees their edits "save" but the strip keeps
      //      showing the stale image.
      if (!entry || oldUrl === newUrl) return;
      let changed = false;
      const updated = entry.photos.map((u) => {
        if (u === oldUrl) {
          changed = true;
          return newUrl;
        }
        return u;
      });
      if (changed) updateEntry(entryId, { photos: updated });
    },
    [entry, entryId, updateEntry]
  );

  // Handle teaware photos change
  const handleTeawarePhotosChange = useCallback(
    (photos: string[]) => {
      updateEntry(entryId, { photos });
    },
    [entryId, updateEntry]
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (extractionTimerRef.current) clearTimeout(extractionTimerRef.current);
      if (duplicateDebounceRef.current) clearTimeout(duplicateDebounceRef.current);
    };
  }, []);

  // Auto-derive teaKey when identity fields settle
  useEffect(() => {
    if (!entry || entry.category !== 'tea') return;
    if (!entry.name) return;
    const derived = generateTeaKey({ name: entry.name, type: entry.type, year: entry.year, originRegion: entry.originRegion });
    if (derived && derived !== entry.teaKey) {
      updateEntry(entryId, { teaKey: derived });
    }
  }, [entry?.name, entry?.type, entry?.year, entry?.originRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── All useCallback hooks must be above the guard ─────────────────────

  const handleBuyAgain = useCallback(
    (reorder: { name: string; type?: string; form?: string; priceAmount?: number; priceCurrency: string; pricePerUnitGrams?: number }) => {
      const newId = startNewCapture(reorder.type === 'Teaware' ? 'teaware' : 'tea');
      const updates: Record<string, unknown> = {
        name: reorder.name,
        status: 'buying',
        priceCurrency: reorder.priceCurrency,
      };
      if (reorder.type) updates.type = reorder.type;
      if (reorder.form) updates.form = reorder.form;
      if (reorder.priceAmount != null) updates.priceAmount = reorder.priceAmount;
      if (reorder.pricePerUnitGrams != null) updates.pricePerUnitGrams = reorder.pricePerUnitGrams;
      updateEntry(newId, updates);
      setActiveEntry(newId);
    },
    [startNewCapture, updateEntry, setActiveEntry]
  );

  const handleSameTea = useCallback(() => {
    if (!duplicateMatch) return;
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const existingNotes = duplicateMatch.notes?.trim();
    const retasteNote = `Retasted on ${now}`;
    updateEntry(duplicateMatch.id, {
      notes: existingNotes ? `${existingNotes}\n${retasteNote}` : retasteNote,
    });
    setShowDuplicateNudge(false);
    setDuplicateMatch(null);
  }, [duplicateMatch, updateEntry]);

  const handleDifferentTea = useCallback(() => {
    if (duplicateMatch) dismissedDuplicateRef.current = duplicateMatch.id;
    setShowDuplicateNudge(false);
    setDuplicateMatch(null);
  }, [duplicateMatch]);

  const handleDismissDuplicate = useCallback(() => {
    if (duplicateMatch) dismissedDuplicateRef.current = duplicateMatch.id;
    setShowDuplicateNudge(false);
    setDuplicateMatch(null);
  }, [duplicateMatch]);

  const handleCommit = useCallback(() => {
    commitEntry(entryId);
    if (onReturnToLibrary) {
      // Came from Library — return there rather than starting a new capture
      onReturnToLibrary();
    } else {
      // Normal flow — auto-start a new capture with the same vendor
      const cat = entry?.category || 'tea';
      const newId = startNewCapture(cat);
      setActiveEntry(newId);
      onCommit?.();
    }
  }, [commitEntry, entryId, entry?.category, startNewCapture, setActiveEntry, onCommit, onReturnToLibrary]);

  // ── Guard: entry must exist (after all hooks) ─────────────────────────

  if (!entry) return null;

  const shellClass = 'surface-warm relative px-4 md:px-6 max-w-3xl mx-auto w-full space-y-5';
  // Mobile shell flows the warm surface (gradient + grain) PAST the Done footer
  // and BEHIND the floating bottom-nav pill, rather than stopping short above
  // it. The earlier flat pb-6 ended the surface in a hard line that read as
  // "cut off early". The base is pb-nav-gap-lg (2rem + nav + safe-area); the
  // arbitrary override adds 30px more so there's a touch of extra scroll past
  // the end of the card. Both reset to a flat 2rem on lg+, where there is no
  // bottom nav. A slightly larger top buffer mirrors that breath up top so the
  // card opens and closes with the same softened rhythm.
  const mobileShellClass = `${shellClass} pt-3 pb-nav-verdict`;
  const sourceShellClass = 'px-0 py-1';
  const fieldClass = 'field-recessed bg-tea-surface border border-tea-border rounded-md px-3 py-2.5 text-base text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';
  // Tea name reads in the display serif, a step larger than the other
  // fields (17px keeps the iOS 16px anti-zoom floor).
  const nameFieldClass = 'field-recessed bg-tea-surface border border-tea-border rounded-md px-3 py-2.5 font-display text-ui-17 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';
  const tallFieldClass = 'field-recessed bg-tea-surface border border-tea-border rounded-md px-3 py-2.5 text-base text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';
  const selectClass = (selected: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm border border-tea-border transition-colors ${
      selected
        ? 'text-tea-text font-medium bg-tea-accent-sub'
        : 'text-tea-text-sec font-medium bg-tea-bg hover:bg-tea-accent-sub hover:text-tea-text'
    }`;

  // ── Tasting overlay opener — hoisted so actionRef can reference it ──────
  const openTastingOverlay = () => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    setTastingOverlayOpen(true);
  };

  // ── Populate actionRef for parent-rendered action bar ───────────────────
  const unitBasedForRef = entry.category === 'teaware' || (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
  if (actionRef) {
    actionRef.current = {
      openTasting: openTastingOverlay,
      toggleBuy: () => {
        const defaultQty = unitBasedForRef ? 1 : (entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100);
        if (!showBuyPicker) setBuyingQty(defaultQty);
        setShowBuyPicker((v) => !v);
      },
    };
  }

  // ── Thin / collapsed mode ─────────────────────────────────────────────────
  if (collapsed) {
    const chipStyle = entry.type ? getTypeChipStyle(entry.type) : null;
    const hasTastingC = entry.tasting && Object.values(entry.tasting).some(
      (v) => Array.isArray(v) ? v.length > 0 : v != null
    );
    return (
      <div className="bg-tea-surface border border-tea-border rounded-md px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={entry.name}
            onChange={(e) => updateEntry(entryId, { name: e.target.value })}
            placeholder="What are you tasting?"
            className={`flex-1 min-w-0 ${fieldClass}`}
          />
          {entry.type && chipStyle && (
            <span
              className="shrink-0 text-ui-11 font-medium px-2.5 py-1 rounded-md"
              style={{ backgroundColor: chipStyle.bg, color: chipStyle.text }}
            >
              {entry.type}
            </span>
          )}
          <button
            type="button"
            onClick={() => { setTastingOverlayOpen(true); }}
            className={`shrink-0 rounded-md border border-tea-border p-2 transition-colors ${
              hasTastingC ? 'bg-tea-accent-sub text-tea-gold' : 'bg-tea-bg text-tea-text-dim hover:bg-tea-accent-sub hover:text-tea-text'
            }`}
            title="Quick taste"
          >
            <Droplets size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="shrink-0 rounded-md border border-tea-border bg-tea-bg p-2 text-tea-text-dim transition-colors hover:text-tea-text"
            title="Expand"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {tastingOverlayOpen && (
          <TastingSession
            item={{
              id: entry.id,
              name: entry.name,
              type: entry.type,
              image: entry.photos?.[0],
              sourceType: 'compass',
              compassEntryId: entry.id,
              teaKey: entry.teaKey,
            }}
            initialData={entry.tasting ?? undefined}
            onClose={() => setTastingOverlayOpen(false)}
            onAfterSave={(data: TastingData) => {
              setLocalTasting(data);
              const existingHistory = entry.tastingHistory || [];
              const today = new Date().toDateString();
              const lastEntry = existingHistory[existingHistory.length - 1];
              const lastWasToday = lastEntry && new Date(lastEntry.date).toDateString() === today;
              const history = lastWasToday
                ? [...existingHistory.slice(0, -1), { data, date: new Date().toISOString() }]
                : [...existingHistory, { data, date: new Date().toISOString() }];
              updateEntry(entryId, { tasting: data, tastingHistory: history });
            }}
          />
        )}
      </div>
    );
  }

  const isTeaware = entry.category === 'teaware';
  const isSample = !!entry.isSample;
  const hasName = (entry.name || '').trim().length > 0;

  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );

  const handleTypeSelect = (type: TeaType) => {
    userTapped.current.add('type');
    update({ type });
    setTypePopoverOpen(false);
  };

  const handleFormSelect = (form: TeaForm) => {
    userTapped.current.add('form');
    const updates: Record<string, unknown> = { form };
    // Auto-fill default grams when form changes
    if (!entry.pricePerUnitGrams || entry.pricePerUnitGrams === DEFAULT_GRAMS[entry.form || 'Loose']) {
      updates.pricePerUnitGrams = DEFAULT_GRAMS[form];
    }
    update(updates);
  };

  const handleCurrencyChange = (currency: Currency) => {
    update({ priceCurrency: currency });
    setLastCurrency(currency);
  };

  const handleVendorSelect = (vendorId: string | undefined, vendorName: string) => {
    update({ vendorName, vendorId });
    setLastVendor(vendorId || null, vendorName);
    // Picked a vendor: fold the strip back down so the chip carries it.
    setVendorOpen(false);
  };

  const handleVendorClear = () => {
    update({ vendorName: undefined, vendorId: undefined, vendorDetails: undefined });
    setLastVendor(null, null);
  };

  const handleVendorDetailsChange = (details: VendorDetails) => {
    update({ vendorDetails: details });
  };

  // Feature 28: linked customer change handler
  const handleLinkedCustomerChange = (customerId: string | undefined) => {
    update({ linkedCustomerId: customerId });
  };

  const handleNameAutocompleteSelect = (product: any) => {
    if (!entry) return;
    const updates: Record<string, unknown> = {};
    const type = product.type || product.product_type;
    const form = product.form;
    const year = product.year;
    const region = product.origin_region || product.originRegion;
    const chineseName = product.chinese_name || product.chineseName;

    if (type && !entry.type) updates.type = type;
    if (form && !entry.form) {
      updates.form = form;
      if (!entry.pricePerUnitGrams && DEFAULT_GRAMS[form as keyof typeof DEFAULT_GRAMS]) {
        updates.pricePerUnitGrams = DEFAULT_GRAMS[form as keyof typeof DEFAULT_GRAMS];
      }
    }
    if (year && !entry.year) updates.year = year;
    if (region && !entry.originRegion) updates.originRegion = region;
    if (chineseName && !entry.chineseName) updates.chineseName = chineseName;

    if (Object.keys(updates).length > 0) {
      updateEntry(entryId, updates);
    }
  };

  /* ─── Tasting overlay handlers ─── */

  const closeTastingOverlay = () => {
    setTastingOverlayOpen(false);
  };

  const handleTastingStripRemove = (categoryId: TastingCategoryId, termId: string) => {
    if (!entry.tasting) return;
    const current = entry.tasting[categoryId];
    if (!Array.isArray(current)) return;
    const updated = current.filter((t) => t !== termId);
    const newTasting = { ...entry.tasting, [categoryId]: updated };
    update({ tasting: newTasting });
  };

  const handleQualityChange = (q: number) => {
    const newTasting: TastingData = { ...(entry.tasting ?? {}), quality: entry.tasting?.quality === q ? undefined : q };
    setLocalTasting(newTasting);
    update({ tasting: newTasting });
  };

  // ── Teaware card layout ──────────────────────────────────────────────
  if (isTeaware) {
    const materials = TEAWARE_MATERIALS[entry.teawareCategory || ''] || TEAWARE_MATERIALS.default;
    const hasTeawareName = (entry.name || '').trim().length > 0;
    const isYixing = entry.material === 'Yixing'
      || (['Zhuni', 'Zisha', 'Duanni', 'Hongni'] as string[]).includes(entry.material || '');
    // Surface the legacy-stored clay name (from before Yixing rollup) as a subtype label.
    const legacyClay = (['Zhuni', 'Zisha', 'Duanni', 'Hongni'] as const).includes(entry.material as never)
      ? (entry.material as YixingClayType)
      : undefined;
    const effectiveClayType: YixingClayType | undefined = entry.clayType || legacyClay;

    const handleMaterialPick = (mat: TeawareMaterial) => {
      // Both Yixing and generic Clay drill into the clay-subtype sheet so
      // the user can pick from the canonical clay names (Zhuni, Hongni, …)
      // regardless of vessel category. The material itself is committed
      // here so handleClayPick can read entry.material to know which one.
      if (mat === 'Yixing' || mat === 'Clay') {
        const updates: Record<string, unknown> = {
          material: mat,
          clayType: undefined,
        };
        const originDefault = MATERIAL_ORIGIN_DEFAULT[mat];
        if (originDefault && !entry.originRegion) {
          updates.originRegion = originDefault;
        }
        update(updates);
        // Hand off from the Material sheet → Clay sheet. Close-then-open
        // keeps Vaul's focus management from fighting two open sheets.
        setMaterialPopoverOpen(false);
        setTimeout(() => setClaySheetOpen(true), 220);
        return;
      }
      const same = entry.material === mat;
      const updates: Record<string, unknown> = {
        material: same ? undefined : mat,
        clayType: undefined,
      };
      const originDefault = MATERIAL_ORIGIN_DEFAULT[mat];
      if (!same && originDefault && !entry.originRegion) {
        updates.originRegion = originDefault;
      }
      update(updates);
      setMaterialPopoverOpen(false);
      setMaterialPanel('main');
    };

    const handleClayPick = (clay: YixingClayType) => {
      const sameClay = effectiveClayType === clay;
      // Preserve the parent material the user chose (Yixing vs generic Clay)
      // — if entry.material is anything else, default to Yixing for the
      // legacy rollup behaviour.
      const parentMaterial: TeawareMaterial = entry.material === 'Clay' ? 'Clay' : 'Yixing';
      const updates: Record<string, unknown> = {
        material: parentMaterial,
        clayType: sameClay ? undefined : clay,
      };
      if (parentMaterial === 'Yixing' && !entry.originRegion && MATERIAL_ORIGIN_DEFAULT.Yixing) {
        updates.originRegion = MATERIAL_ORIGIN_DEFAULT.Yixing;
      }
      update(updates);
      setClaySheetOpen(false);
      setMaterialPopoverOpen(false);
      setMaterialPanel('main');
    };

    const handleEraPick = (eraName: string) => {
      update({ era: entry.era === eraName ? undefined : eraName });
      setEraSheetOpen(false);
      setEraInputOpen(false);
      setEraInputValue('');
    };

    const commitCustomEra = () => {
      const trimmed = eraInputValue.trim();
      if (!trimmed) return;
      addCustomEra(trimmed);
      update({ era: trimmed });
      setEraInputValue('');
      setEraInputOpen(false);
      setEraSheetOpen(false);
    };

    const allEras: string[] = [...TEAWARE_ERAS, ...customEras.filter((e) => !TEAWARE_ERAS.includes(e))];
    const materialChipLabel = isYixing ? 'Yixing' : (entry.material || 'Material');

    return (
      <div className={mobileShellClass}>

        {/* Context chips row + photo hero: same header treatment as the tea
            variant so both forms open with one rhythm. The vendor picker
            collapses behind the Vendor chip. */}
        <div className={sourceShellClass}>
          <CaptureContextChips
            category={entry.category}
            vendorName={entry.vendorName}
            vendorOpen={vendorOpen}
            onToggleVendor={() => setVendorOpen((v) => !v)}
            batchMode={batchMode}
            onToggleBatchMode={onToggleBatchMode}
          />

          {vendorOpen && (
            <div className="mt-2.5">
              <VendorStrip
                vendorName={entry.vendorName}
                vendorId={entry.vendorId}
                vendorDetails={entry.vendorDetails}
                onVendorSelect={handleVendorSelect}
                onClear={handleVendorClear}
                onDetailsChange={handleVendorDetailsChange}
                linkedCustomerId={entry.linkedCustomerId}
                onLinkedCustomerChange={handleLinkedCustomerChange}
              />
            </div>
          )}

          <div className="mt-3">
            <PhotoCapture
              onExtracted={handleExtracted}
              onPhotoTaken={handlePhotoTaken}
              onPhotoReplaced={handlePhotoReplaced}
              photos={entry.photos}
              onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
              variant="hero"
            />
          </div>
        </div>

        {/* Row 3 — Name + Category chip on one line. Mirrors the tea
            variant's "Name + Type chip" pattern so both forms have the
            same primary-classifier rhythm: free-text identity on the
            left, single decisive picker on the right. */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={entry.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={
              entry.teawareCategory
                ? `${entry.teawareCategory} name (e.g., Shipiao, Shuiping…)`
                : 'Teaware name (e.g., Shipiao, Bing Lang…)'
            }
            className={`flex-1 min-w-0 ${fieldClass}`}
          />
          <button
            type="button"
            onClick={() => setCategoryPopoverOpen(true)}
            className={selectClass(!!entry.teawareCategory)}
          >
            <span>{entry.teawareCategory || 'Category'}</span>
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Row 4 — Material + Clay subtype. Category lifted up to the
            name row so this row holds only "what it's made of". The clay
            subtype, when set, replaces the orphan dot subtitle that used
            to live below Origin — it now sits next to its parent Material
            chip where it logically belongs. */}
        <div className="relative">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Material chip — drills into a Vaul bottom sheet. */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMaterialPopoverOpen(true);
                  setMaterialPanel(isYixing && !materialPopoverOpen ? 'yixing' : 'main');
                }}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm border border-tea-border transition-colors ${
                  entry.material
                    ? 'text-tea-text font-medium bg-tea-accent-sub'
                    : 'text-tea-text-sec font-medium bg-tea-bg hover:bg-tea-accent-sub hover:text-tea-text'
                }`}
              >
                <span>{materialChipLabel}</span>
                <ChevronDown size={13} />
              </button>
            </div>

            {/* Clay subtype chip — only when Material is Yixing or Clay
                AND a subtype is set. Tap re-opens the clay picker. */}
            {(isYixing || entry.material === 'Clay') && effectiveClayType && (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => setClaySheetOpen(true)}
                  className="tap-target inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium bg-tea-accent-sub text-tea-text border border-tea-gold/30 hover:bg-tea-accent-sub transition-colors"
                  aria-label={`Clay subtype: ${effectiveClayType} — tap to change`}
                >
                  <span
                    className="shrink-0 w-3 h-3 rounded-full border border-tea-border"
                    style={{ backgroundColor: YIXING_CLAY_TYPES.find((c) => c.name === effectiveClayType)?.swatch }}
                    aria-hidden
                  />
                  <span>{effectiveClayType}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      update({ material: entry.material === 'Clay' ? 'Clay' : 'Yixing', clayType: undefined });
                    }}
                    className="shrink-0 -mr-0.5 ml-0.5 text-tea-gold/70 hover:text-tea-gold transition-colors"
                    aria-label="Clear clay subtype"
                  >
                    <X size={11} />
                  </button>
                </button>
              </div>
            )}
          </div>

          {/* Row 5 — Provenance: Origin (where) + Era chip (when) on one
              line. Tapping the Era chip opens a Vaul sheet — same picker
              pattern as the clay subtype sheet, just without photos. */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <AutocompleteInput
                value={entry.originRegion || ''}
                onChange={(val) => update({ originRegion: val || undefined })}
                suggestions={availableRegions}
                placeholder="Origin"
                className={`w-full ${tallFieldClass}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setEraSheetOpen(true)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm border border-tea-border transition-colors tabular-nums ${
                entry.era
                  ? 'text-tea-text font-medium bg-tea-accent-sub'
                  : 'text-tea-text-sec font-medium bg-tea-bg hover:bg-tea-accent-sub hover:text-tea-text'
              }`}
            >
              <span>{entry.era || 'Era'}</span>
              <ChevronDown size={13} />
            </button>
          </div>

          {/* Category — opens as a bottom sheet (Vaul) so the picker has
              full thumb access at the bottom of the screen and never clips
              against narrow viewports the way the old anchored popover did. */}
          <BottomSheet
            open={categoryPopoverOpen}
            onOpenChange={setCategoryPopoverOpen}
            title="Category"
            description="What kind of teaware is this?"
          >
            <div className="flex flex-col gap-0.5 px-1">
              {TEAWARE_CATEGORIES.map((cat) => (
                <SheetOption
                  key={cat}
                  label={cat}
                  selected={entry.teawareCategory === cat}
                  onSelect={() => {
                    const updates: Record<string, unknown> = { teawareCategory: cat };
                    if (entry.teawareCategory !== cat) {
                      updates.material = undefined;
                      updates.clayType = undefined;
                    }
                    update(updates);
                    setCategoryPopoverOpen(false);
                  }}
                />
              ))}
            </div>
          </BottomSheet>

          {/* Era — bottom sheet. Includes "+ Add new era" affordance at the
              bottom for user-defined entries (Song Dynasty, etc.). */}
          <BottomSheet
            open={eraSheetOpen}
            onOpenChange={(open) => {
              setEraSheetOpen(open);
              if (!open) { setEraInputOpen(false); setEraInputValue(''); }
            }}
            title="Era"
            description="When was this piece made?"
          >
            <div className="flex flex-col gap-0.5 px-1">
              {allEras.map((eraName) => (
                <SheetOption
                  key={eraName}
                  label={eraName}
                  selected={entry.era === eraName}
                  onSelect={() => handleEraPick(eraName)}
                />
              ))}
              <div className="border-t border-tea-border my-2" />
              {eraInputOpen ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    ref={eraInputRef}
                    type="text"
                    value={eraInputValue}
                    autoFocus
                    onChange={(e) => setEraInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitCustomEra(); }
                      if (e.key === 'Escape') { setEraInputOpen(false); setEraInputValue(''); }
                    }}
                    placeholder="e.g. Song Dynasty"
                    className="flex-1 min-w-0 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim"
                  />
                  <button
                    type="button"
                    onClick={commitCustomEra}
                    disabled={!eraInputValue.trim()}
                    className="shrink-0 px-3 py-2 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-semibold disabled:opacity-40 transition-opacity"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEraInputOpen(true)}
                  className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-tea-gold hover:bg-tea-gold/[0.08] transition-colors"
                >
                  <Plus size={16} />
                  Add new era
                </button>
              )}
            </div>
          </BottomSheet>

          {/* Material — bottom sheet. Yixing and Clay both display a chevron
              and drill into the full-screen Clay sheet rendered below. */}
          <BottomSheet
            open={materialPopoverOpen}
            onOpenChange={setMaterialPopoverOpen}
            title="Material"
            description={entry.teawareCategory ? `For ${entry.teawareCategory}` : undefined}
          >
            <div className="flex flex-col gap-0.5 px-1">
              {materials.map((mat) => {
                const isSelected = entry.material === mat || (mat === 'Yixing' && isYixing);
                const hasSubtypes = mat === 'Yixing' || mat === 'Clay';
                return (
                  <SheetOption
                    key={mat}
                    label={mat}
                    selected={isSelected}
                    hasSubflow={hasSubtypes}
                    onSelect={() => handleMaterialPick(mat)}
                  />
                );
              })}
            </div>
          </BottomSheet>

          {/* Clay subtype — full-height sheet with photographic swatches.
              Falls back to a colour disk when no imageUrl is set yet. */}
          <BottomSheet
            open={claySheetOpen}
            onOpenChange={(open) => {
              setClaySheetOpen(open);
              if (!open) setMaterialPanel('main');
            }}
            title={entry.material === 'Clay' ? 'Clay subtype' : 'Yixing clay'}
            description="Pick the clay this piece is made from"
            large
          >
            <div className="grid grid-cols-2 gap-2.5 p-2">
              {YIXING_CLAY_TYPES.map((clay) => {
                const sel = effectiveClayType === clay.name;
                return (
                  <button
                    key={clay.name}
                    type="button"
                    onClick={() => handleClayPick(clay.name)}
                    aria-pressed={sel}
                    className={`group relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all duration-200 text-left ${
                      sel
                        ? 'border-tea-gold/60 bg-tea-gold/[0.10]'
                        : 'border-tea-border bg-tea-elevated/40 hover:border-tea-gold/40 hover:bg-tea-gold/[0.05]'
                    }`}
                    style={
                      sel
                        ? {
                            boxShadow:
                              'inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.2), 0 0 18px -4px rgb(var(--tea-gold-rgb) / 0.25)',
                          }
                        : undefined
                    }
                  >
                    {/* Swatch — image when provided, else a richly-shaded
                        circular disk with a soft inner highlight so the colour
                        reads as a fired clay surface, not a flat dot. */}
                    <div
                      className="relative w-full aspect-square rounded-xl overflow-hidden border border-tea-border shrink-0"
                      style={
                        clay.imageUrl
                          ? undefined
                          : {
                              background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${clay.swatch} 78%, white 22%), ${clay.swatch} 62%, color-mix(in srgb, ${clay.swatch} 70%, black 30%) 100%)`,
                            }
                      }
                    >
                      {clay.imageUrl && (
                        <img
                          src={clay.imageUrl}
                          alt={clay.label}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {sel && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-tea-gold flex items-center justify-center">
                          <Check size={12} strokeWidth={3} className="text-tea-bg" />
                        </span>
                      )}
                    </div>
                    <div className="w-full min-w-0">
                      <div
                        className={`text-base truncate ${sel ? 'text-tea-gold font-semibold' : 'text-tea-text font-medium'}`}
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {clay.label}
                      </div>
                      {clay.hint && (
                        <div className="text-ui-11 text-tea-text-sec truncate mt-0.5">{clay.hint}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </BottomSheet>
        </div>

        <div className="border-t border-tea-border" />

        {/* Pricing — shared with the tea variant via PricingRow. count
            mode here just means "1 ct, 2 ct…" instead of grams; no preset
            row beneath. Volume (ml) lives elsewhere when teaware
            dimensions earn their place. */}
        <PricingRow
          priceAmount={entry.priceAmount}
          priceCurrency={entry.priceCurrency || 'NT'}
          onPriceChange={(priceAmount) => update({ priceAmount })}
          onCurrencyChange={handleCurrencyChange}
          unit={{
            mode: 'count',
            quantity: entry.quantity || 1,
            onQuantityChange: (quantity) => update({ quantity }),
          }}
        />

        <div className="border-t border-tea-border" />

        {/* Notes — in-field mic dictates straight into the note; the footer Mic does whole-entry voice scan. */}
        <NoteThread
          compassEntryId={entry.id}
          teaKey={entry.teaKey ?? undefined}
          larger
        />

        {/* Teaware entry marks — only Want applies (Taste / Buy / Sample
            are tea concepts: no brewing session, no ml-based buy picker,
            no sample cart). Showing the irrelevant ones as disabled
            placeholders just looks broken — render only what's actionable. */}
        {(() => {
          const isWantTeaware = entry.status === 'want';
          return (
            <div className="lg:hidden">
              <EntryMark
                label={isWantTeaware ? 'Wanted' : 'Want'}
                hint={isWantTeaware ? 'On your wishlist' : 'Save to your wishlist'}
                active={isWantTeaware}
                onClick={() => update({ status: isWantTeaware ? 'noted' : 'want' })}
              />
            </div>
          );
        })()}

        {/* Action footer — Share + Done colocated. Same pattern as the
            tea variant so both forms have the share affordance in the
            commit area instead of the page header. */}
        {(() => {
          // Done is enabled whenever the entry holds anything worth keeping —
          // a name, a photo, notes, or tasting data — matching exactly what
          // commitEntry() will persist. Requiring a name blocked saving an
          // entry that already has notes/flavor/tags, which read as broken.
          const ready = entryHasContent(entry);
          return (
            <div className="flex items-center gap-2 mt-1">
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="tap-target shrink-0 inline-flex items-center px-3 py-2 rounded-md text-ui-12 text-tea-text-sec transition-colors hover:bg-tea-accent-sub hover:text-tea-text"
                  aria-label="Share this entry"
                  title="Share this entry"
                >
                  Share
                </button>
              )}
              <button
                type="button"
                onClick={handleCommit}
                disabled={!ready}
                className="flex-1 py-2.5 rounded-md bg-tea-gold text-tea-bg font-display font-semibold tracking-[0.06em] text-ui-14 transition-colors hover:bg-tea-gold/90 active:bg-tea-gold/80 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Done, commit this entry"
              >
                Done
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Status helpers ────────────────────────
  const isWant = entry.status === 'want';
  const isPass = entry.status === 'pass';
const unitBased = entry.category === 'teaware' || (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
  const isInLedger = transactions.some(
    (tx) => tx.status === 'draft' && tx.items.some((item) => item.compassEntryId === entry.id)
  );
  const pricePerGram = entry.priceAmount && entry.pricePerUnitGrams && !unitBased
    ? entry.priceAmount / entry.pricePerUnitGrams
    : null;
  const totalPrice = pricePerGram ? buyingQty * pricePerGram : null;
  const buyStep = unitBased ? 1 : 25;

  const handleAddToLedger = () => {
    const vendorName = entry.vendorName || 'Unknown Vendor';
    const currency = (entry.priceCurrency || 'NT') as Currency;
    const txId = getOrCreatePurchaseTransaction(vendorName, currency, entry.vendorId);
    addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: unitBased ? undefined : buyingQty,
      quantityUnits: unitBased ? buyingQty : undefined,
      unitWeightGrams: (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '')
        ? (DEFAULT_GRAMS[entry.form!] ?? 100)
        : undefined,
      pricePerUnit: entry.priceAmount ?? 0,
      priceIsPerGram: !unitBased && !!entry.pricePerUnitGrams,
      currency,
      compassEntryId: entry.id,
    });
    update({ status: 'in_stock' });
    setShowBuyPicker(false);
    setJustAddedToLedger(true);
    setTimeout(() => {
      setJustAddedToLedger(false);
      onSwitchToLedger?.();
    }, 800);
  };

  // ── Tea card layout ────────────────────────
  return (
    <div className={mobileShellClass}>
      {/* ← Library back link — shown when navigated from Library */}
      {onReturnToLibrary && (
        <button
          type="button"
          onClick={onReturnToLibrary}
          className="flex items-center gap-1.5 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors -mt-1 mb-1"
        >
          <ArrowLeft size={12} />
          Library
        </button>
      )}

      {/* Context chips row: Run + Vendor. Both stay sticky across a burst of
          captures (run via the session id, vendor via lastVendor seeding), so
          reopening the card mid-visit costs nothing. The old always-open
          "Select vendor" box collapses behind the Vendor chip. */}
      <div className={sourceShellClass}>
        <CaptureContextChips
          category={entry.category}
          vendorName={entry.vendorName}
          vendorOpen={vendorOpen}
          onToggleVendor={() => setVendorOpen((v) => !v)}
          batchMode={batchMode}
          onToggleBatchMode={onToggleBatchMode}
        />

        {vendorOpen && (
          <div className="mt-2.5">
            <VendorStrip
              vendorName={entry.vendorName}
              vendorId={entry.vendorId}
              vendorDetails={entry.vendorDetails}
              onVendorSelect={handleVendorSelect}
              onClear={handleVendorClear}
              onDetailsChange={handleVendorDetailsChange}
              linkedCustomerId={entry.linkedCustomerId}
              onLinkedCustomerChange={handleLinkedCustomerChange}
            />
          </div>
        )}

        {/* Photo hero: the camera tile is the dominant element. Capture,
            scan and camera-roll actions all live on the tile itself. */}
        <div className="mt-3">
          <PhotoCapture
            onExtracted={handleExtracted}
            onPhotoTaken={handlePhotoTaken}
            onPhotoReplaced={handlePhotoReplaced}
            photos={entry.photos}
            onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
            variant="hero"
          />
        </div>
        {/* Nudge a second angle once the first shot lands: a bag label plus
            the dry leaves (or brewed cup) makes a photo-only capture far more
            identifiable later. */}
        {entry.photos.length === 1 && (
          <p className="mt-1.5 text-ui-11 text-tea-text-dim">
            Add a second shot, the dry leaves or the brewed cup.
          </p>
        )}
      </div>

      {/* ─── IDENTITY ─── */}
      <SectionDivider label="Tea" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AutocompleteInput
            value={entry.name}
            onChange={(val) => update({ name: val })}
            suggestions={allNameSuggestions}
            placeholder={entry.type ? `${entry.type} name (e.g., Tieguanyin, Bingdao…)` : 'Tea name (e.g., Tieguanyin, Bingdao…)'}
            className={`w-full min-w-0 ${nameFieldClass}`}
            onSelect={handleNameAutocompleteSelect}
            itemData={{ ...varietyNameMap, ...productNameMap }}
            hintSuggestions={hintSuggestions}
          />
          <button
            type="button"
            onClick={() => setTypePopoverOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium bg-tea-surface text-tea-text-sec border border-tea-border hover:bg-tea-accent-sub hover:text-tea-text active:bg-tea-accent-sub transition-colors"
          >
            <span>{entry.type || 'Type'}</span>
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Chinese name: one quiet borderless input directly under the name,
            so the bilingual identity reads as a pair rather than a form row. */}
        <input
          type="text"
          value={entry.chineseName || ''}
          onChange={(e) => update({ chineseName: e.target.value || undefined })}
          placeholder="中文名 · Chinese name"
          className="w-full bg-transparent px-1 text-base text-tea-text placeholder:text-tea-text-dim focus:outline-none"
        />

        {/* Photo-first reassurance — when there's a photo or a source but no
            name yet, the entry is already complete enough to save. Signals the
            name is optional rather than a missing required field. */}
        {!entry.name.trim() && (entry.photos.length > 0 || !!entry.vendorName) && (
          <p className="flex items-center gap-1.5 text-ui-11 text-tea-gold/70">
            <Check size={11} strokeWidth={2.5} />
            Photo + source is enough — name optional.
          </p>
        )}

        {/* Type — bottom sheet. Each tea type carries a one-line description
            and a colour dot taken from the type chip palette so the picker
            doubles as a quick reference. */}
        <BottomSheet
          open={typePopoverOpen}
          onOpenChange={setTypePopoverOpen}
          title="Tea type"
          description="What kind of tea is this?"
        >
          <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-2">
            {TEA_TYPES.map((type) => {
              const chipStyle = getTypeChipStyle(type);
              const selected = entry.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className={`flex min-h-[76px] items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                      : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
                  }`}
                >
                  <span
                    className="mt-1 block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: chipStyle.text }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-ui-13 font-medium">{type}</span>
                    <span className="mt-1 block text-ui-11 leading-[1.35] text-tea-text-sec">
                      {TEA_TYPE_DESCRIPTIONS[type]}
                    </span>
                  </span>
                  {selected && <Check size={13} className="ml-auto mt-0.5 shrink-0 text-tea-gold" />}
                </button>
              );
            })}
          </div>
        </BottomSheet>


        {/* Region + Year (year sits to the right of origin) */}
        <div className="flex items-center gap-2">
          <AutocompleteInput
            value={entry.originRegion || ''}
            onChange={(val) => { userTapped.current.add('region'); update({ originRegion: val || undefined }); }}
            suggestions={availableRegions}
            placeholder="Origin"
            className={`w-full ${fieldClass}`}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Year"
            value={entry.year ?? ''}
            onChange={(e) => {
              userTapped.current.add('year');
              const val = e.target.value;
              update({ year: val === '' ? undefined : Number(val) });
            }}
            className={`w-20 shrink-0 tabular-nums text-center ${fieldClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            style={{ MozAppearance: 'textfield' } as React.CSSProperties}
          />
        </div>


        <SectionDivider label="Pricing" />

        <PricingRow
          priceAmount={entry.priceAmount}
          priceCurrency={entry.priceCurrency}
          onPriceChange={(priceAmount) => update({ priceAmount })}
          onCurrencyChange={handleCurrencyChange}
          unit={{
            mode: 'grams',
            pricePerUnitGrams: entry.pricePerUnitGrams,
            onGramsChange: (pricePerUnitGrams) => update({ pricePerUnitGrams }),
            form: entry.form,
            onFormChange: handleFormSelect,
          }}
        />

        {/* Retail price preview — only for tea with cost + grams entered */}
        {entry.category === 'tea' && entry.priceAmount && entry.pricePerUnitGrams && !unitBased && (
          <RetailPricePreview
            costAmount={entry.priceAmount}
            grams={entry.pricePerUnitGrams}
            currency={entry.priceCurrency}
            shippingRatePerKg={shippingRatePerKg}
            onShippingRateChange={setShippingRatePerKg}
          />
        )}
      </div>

      {/* Duplicate nudge */}
      <AnimatePresence>
        {showDuplicateNudge && duplicateMatch && (
          <DuplicateNudge
            matchedEntry={{
              id: duplicateMatch.id,
              name: duplicateMatch.name,
              vendorName: duplicateMatch.vendorName,
              createdAt: duplicateMatch.createdAt,
              type: duplicateMatch.type,
            }}
            onSameTea={handleSameTea}
            onDifferentTea={handleDifferentTea}
            onDismiss={handleDismissDuplicate}
          />
        )}
      </AnimatePresence>

      {/* Extraction confirmation */}
      <AnimatePresence>
        {extractionSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden -mt-2"
          >
            <p className="text-ui-11 text-tea-gold tracking-wide truncate">
              {extractionSummary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>


      {/* These sections render inline, always visible — Adrian uses them
          regularly (tasting profile, notes, intent, storage, sell price) and
          asked that they never sit behind a second tap. ─── */}

      {/* ─── Profile zone: quality bar + brewing + tag cloud ─── */}
      {hasTasting && entry.tasting && (
        <>
          <SectionDivider label="Profile" />
          <div className="space-y-2.5">
            {/* Quality 1–10 — same segment toggle as TastingSession */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-ui-11 text-tea-text-sec" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>Quality</span>
                <span className="text-ui-11 text-tea-gold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {entry.tasting.quality != null ? `${entry.tasting.quality}/10` : '/10'}
                </span>
              </div>
              <div className="tasting-segment-toggle" role="radiogroup" aria-label="Quality rating">
                {[1,2,3,4,5,6,7,8,9,10].map((v, i) => {
                  const isSelected = entry.tasting!.quality === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleQualityChange(v)}
                      role="radio"
                      aria-checked={isSelected}
                      className={`flex-1 py-2.5 text-ui-12 font-medium transition-all duration-150 min-h-[44px] relative z-[1] ${
                        isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                      }${i < 9 ? ' weight-seg-div' : ''}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: isSelected
                          ? 'radial-gradient(ellipse 120% 120% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.14) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                          : 'transparent',
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Brewing metadata */}
            {(entry.tasting.brewingVessel || entry.tasting.brewingTemp || entry.tasting.brewingTime) && (
              <div className="flex items-center gap-2 flex-wrap text-ui-11 text-tea-text-dim">
                {entry.tasting.brewingVessel && <span>{entry.tasting.brewingVessel}</span>}
                {entry.tasting.brewingTemp && <><span className="text-tea-border">·</span><span>{entry.tasting.brewingTemp}°C</span></>}
                {entry.tasting.brewingTime && <><span className="text-tea-border">·</span><span>{entry.tasting.brewingTime}</span></>}
              </div>
            )}
            {/* Tag cloud */}
            <TastingProfileStrip
              value={entry.tasting}
              onRemove={handleTastingStripRemove}
              variant="cloud"
            />
          </div>
        </>
      )}

      {/* ─── Notes zone ─── */}
      <SectionDivider label="Notes" ornament />
      <NoteThread
        compassEntryId={entry.id}
        teaKey={entry.teaKey ?? undefined}
        compact
        hideTastingArtifacts
      />

      <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />

      {/* Storage (only for Sheng/Shou/Dark) */}
      {(entry.type === 'Sheng' || entry.type === 'Shou' || entry.type === 'Dark') && (
        <>
          <div className="border-t border-tea-border" />
          <div className="flex gap-1.5 flex-wrap">
            {STORAGE_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => { userTapped.current.add('storage'); update({ storage: entry.storage === st ? undefined : st }); }}
                className={entry.storage === st ? 'tag-selectable-active' : 'tag-selectable'}
              >
                {st}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Sell price: intended retail per gram; flows through to inventory. */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-ui-12 text-tea-text-sec">Sell price</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={entry.sellPrice ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            update({ sellPrice: v === '' ? undefined : Number(v) });
          }}
          className={`w-24 text-right tabular-nums ${fieldClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <span className="shrink-0 text-ui-11 text-tea-text-dim">
          {CURRENCY_SYMBOLS[entry.priceCurrency] || entry.priceCurrency}/g
        </span>
      </div>

      {/* Share moved here from the old footer; the verdict row stays the
          decision surface. Desktop keeps its bar button. */}
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="lg:hidden tap-target inline-flex items-center px-1 py-1 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          Share this entry
        </button>
      )}

      {/* ─── Buy picker / ledger — shown below content when Buy is tapped ─── */}
      <div className="space-y-2">
        {/* Ledger link */}
        {isInLedger && (
          <button
            type="button"
            onClick={onSwitchToLedger}
            className="flex items-center gap-1.5 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            <BookOpen size={11} />
            View purchases in ledger
          </button>
        )}

        {/* Buy quantity picker — expands upward from the sticky bar */}
        <AnimatePresence>
          {showBuyPicker && !justAddedToLedger && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-tea-gold/[0.07] px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBuyingQty(Math.max(buyStep, buyingQty - buyStep))}
                      className="w-7 h-7 rounded-full bg-tea-surface/80 flex items-center justify-center text-tea-text-sec active:bg-tea-elevated transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="number"
                        value={buyingQty}
                        onChange={(e) => setBuyingQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-11 text-center text-tea-text text-sm font-semibold bg-transparent border-none outline-none"
                      />
                      <span className="text-tea-text-dim text-ui-11">
                        {unitBased ? (buyingQty === 1 ? 'unit' : 'units') : 'g'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBuyingQty(buyingQty + buyStep)}
                      className="w-7 h-7 rounded-full bg-tea-surface/80 flex items-center justify-center text-tea-text-sec active:bg-tea-elevated transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  {totalPrice != null ? (
                    <span className="text-tea-text-dim text-xs">
                      = <span className="text-tea-text-sec font-medium">{totalPrice.toFixed(0)}</span> {entry.priceCurrency || 'NT'}
                    </span>
                  ) : entry.priceAmount && unitBased ? (
                    <span className="text-tea-text-dim text-xs">
                      = <span className="text-tea-text-sec font-medium">{(buyingQty * entry.priceAmount).toFixed(0)}</span> {entry.priceCurrency || 'NT'}
                    </span>
                  ) : null}
                </div>

                {!unitBased && (
                  <div className="flex flex-wrap gap-1">
                    {[50, 100, 150, 250, 357, 500].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setBuyingQty(g)}
                        className={`py-0.5 px-2 rounded text-ui-10 tabular-nums transition-colors ${
                          buyingQty === g ? 'bg-tea-accent-sub text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'
                        }`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddToLedger}
                  className="w-full py-1.5 rounded-md bg-tea-gold text-tea-bg font-semibold text-ui-11 uppercase tracking-[0.08em] transition-opacity active:opacity-80"
                >
                  Add to Ledger
                </button>
              </div>
            </motion.div>
          )}

          {justAddedToLedger && (
            <motion.div
              key="added"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl bg-tea-gold/15 text-tea-gold text-sm font-medium"
            >
              <Check size={16} />
              Added to Ledger
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Verdict row: fixed above the bottom nav so a decision (or none,
          which saves as a plain capture) is one thumb-reach away. Buy left
          this footer deliberately; ordering happens in Runs later. Done is
          enabled by a photo OR a name, the promised saveable minimum. */}
      <CaptureVerdictRow
        tasted={!!hasTasting}
        onTasted={openTastingOverlay}
        want={isWant}
        onWant={() => update({ status: isWant ? 'noted' : 'want' })}
        pass={isPass}
        onPass={() => update({ status: isPass ? 'noted' : 'pass' })}
        bagged={sampleCartHas}
        onBagIt={() => {
          if (sampleCartHas) {
            removeSampleCartItem(entryId);
            update({ isSample: false });
          } else {
            addSampleCartItem({
              id: entryId,
              name: entry.name,
              chineseName: entry.chineseName,
              type: entry.type,
              vendorName: entry.vendorName,
              compassEntryId: entryId,
            });
            // Mark the entry itself so the library's Queue (which keys on
            // isSample) tracks it; the cart alone is invisible to Browse.
            update({ isSample: true });
          }
        }}
        doneEnabled={entry.photos.length > 0 || hasName}
        onDone={handleCommit}
      />

      {/* ─── Tasting overlay ─── */}
      <AnimatePresence>
        {tastingOverlayOpen && (
          <TastingSession
            item={{
              id: entry.id,
              name: entry.name,
              type: entry.type,
              image: entry.photos?.[0],
              sourceType: 'compass',
              compassEntryId: entry.id,
              teaKey: entry.teaKey,
            }}
            initialData={entry.tasting ?? undefined}
            onClose={closeTastingOverlay}
            onAfterSave={(data: TastingData) => {
              setLocalTasting(data);
              const existingHistory = entry.tastingHistory || [];
              const today = new Date().toDateString();
              const lastEntry = existingHistory[existingHistory.length - 1];
              const lastWasToday = lastEntry && new Date(lastEntry.date).toDateString() === today;
              const history = lastWasToday
                ? [...existingHistory.slice(0, -1), { data, date: new Date().toISOString() }]
                : [...existingHistory, { data, date: new Date().toISOString() }];
              update({ tasting: data, tastingHistory: history });
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default CaptureCard;
