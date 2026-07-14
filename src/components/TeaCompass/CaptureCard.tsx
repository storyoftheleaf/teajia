import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Droplets, Loader2, Minus, Plus, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore, entryHasContent } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { CurateReceiptProposal, InventoryPurposeValue, ReceiptAcquisitionKind, TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../../data/teaVarieties';
import type { TeaType, TeaForm, TeawareCategory, TeawareMaterial, TeawareEra, YixingClayType, VendorDetails, TeaCompassEntry } from './types';
import { entryIsSample } from './types';
import { DEFAULT_GRAMS, TEA_TYPES, TEA_FORMS, STORAGE_OPTIONS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, YIXING_CLAY_TYPES, MATERIAL_ORIGIN_DEFAULT, COMMON_REGIONS, generateTeaKey } from './types';
import { hasToken } from '../../lib/api';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { PricingRow } from './PricingRow';
import { NoteThread } from '../shared/NoteThread';
import { useLedgerStore } from '../../lib/ledgerStore';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { TastingSession } from '../tasting/TastingSession';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { parseTeaInput } from './InputParser';
import { PhotoCapture } from './PhotoCapture';
import type { ExtractedTeaData } from './PhotoCapture';
import { DuplicateNudge } from './DuplicateNudge';
import { IntentBar } from './IntentBar';
import { EncounterContext } from './EncounterContext';
import { DecisionControl } from './DecisionControl';
import { CaptureContextChips } from './CaptureContextChips';
import { CaptureActionFooter } from './CaptureActionFooter';

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
  /** Optional Share action rendered in the capture context/header cluster. */
  onShare?: () => void;
  purchasePickerId?: string;
  /** Opens the reviewed acquisition form when Library hands this entry off. */
  openPurchasePicker?: boolean;
  onBuyExpandedChange?: (expanded: boolean) => void;
  /** Rapid batch-entry mode state, surfaced inside the Run chip's sheet */
  batchMode?: boolean;
  onToggleBatchMode?: () => void;
}

const EMPTY_TASTING: TastingData = {};

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
    <div className="curate-support flex flex-wrap items-center gap-2 px-1 text-tea-text-dim">
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
            aria-label="Shipping cost per kilogram"
            value={shippingInput}
            onChange={(e) => setShippingInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(shippingInput);
              // Blur fires on pointer-down, before the intended next button's
              // click. Defer this parent update so the target is not replaced
              // between pointer-down and click (notably the adjacent Buy action).
              window.requestAnimationFrame(() => {
                onShippingRateChange(isNaN(v) ? 0 : v);
                setEditingShipping(false);
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                const v = parseFloat(shippingInput);
                onShippingRateChange(isNaN(v) ? 0 : v);
                setEditingShipping(false);
              }
            }}
            className="curate-primary min-h-11 w-16 bg-transparent text-tea-text px-1 py-0.5 border-0 border-b border-tea-border rounded-none outline-none focus:border-tea-gold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-tea-text-dim">/kg</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => { setShippingInput(shippingRatePerKg > 0 ? String(shippingRatePerKg) : ''); setEditingShipping(true); }}
          className="tap-target min-h-11 text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors underline underline-offset-2 decoration-dashed"
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

/** Quiet section eyebrow — replaces the retired gold hairline SectionDivider.
 *  Groups content by whitespace, not by a gold rule; used sparingly (Notes
 *  always; Profile only when tasting data exists) so gold stays scarce. */
const QuietEyebrow: React.FC<{ label: string }> = ({ label }) => (
  <h2 className="curate-section-title">{label}</h2>
);

/** Field label — sits directly above a typed input in the capture form.
 *  Sentence case (not micro-caps) and text-tea-text-sec so it reads distinct
 *  from the QuietEyebrow zone headers above it: dim uppercase groups the zone,
 *  sec sentence-case names the field. Keeps a filled form legible after the
 *  placeholder disappears. */
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="curate-support mb-0.5 block font-medium"
    style={{ letterSpacing: '0.02em' }}
  >
    {children}
  </span>
);

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit, onReturnToLibrary, initialCollapsed = false, actionRef, onShare, purchasePickerId = `capture-purchase-picker-${entryId}`, openPurchasePicker = false, onBuyExpandedChange, batchMode, onToggleBatchMode }) => {
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

  // One-tap Chinese-name generation (the operator can't type hanzi).
  const [generatingChinese, setGeneratingChinese] = useState(false);

  // Buying quantity picker state
  const [buyingQty, setBuyingQty] = useState(100);
  const [justAddedToLedger, setJustAddedToLedger] = useState(false);
  const [showBuyPicker, setShowBuyPicker] = useState(false);
  const consumedPurchaseHandoffRef = useRef<string | null>(null);
  useEffect(() => onBuyExpandedChange?.(showBuyPicker), [onBuyExpandedChange, showBuyPicker]);
  const [receiptPurpose, setReceiptPurpose] = useState<InventoryPurposeValue>('working');
  const [receiptAcquisition, setReceiptAcquisition] = useState<ReceiptAcquisitionKind>('purchase');
  const [receiptProposal, setReceiptProposal] = useState<CurateReceiptProposal | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [receiptBusy, setReceiptBusy] = useState(false);
  useEffect(() => {
    if (!entry) return;
    setReceiptPurpose(entryIsSample(entry) ? 'sample' : (entry.category === 'teaware' ? 'personal' : 'working'));
    setReceiptAcquisition(entryIsSample(entry) ? 'free_sample' : 'purchase');
    setReceiptProposal(null);
    setReceiptError('');
  }, [entry?.id, entry?.category, entry?.sampleState]);
  useEffect(() => {
    if (!entry || !openPurchasePicker) {
      consumedPurchaseHandoffRef.current = null;
      return;
    }
    if (consumedPurchaseHandoffRef.current === entry.id) return;
    consumedPurchaseHandoffRef.current = entry.id;
    const unitBased = entry.category === 'teaware' || (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
    setBuyingQty(unitBased ? 1 : (entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100));
    setShowBuyPicker(true);
  }, [entry, openPurchasePicker]);

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
  // Inside the era sheet: shows the "+ Add era" input row
  const [eraInputOpen, setEraInputOpen] = useState(false);
  const [eraInputValue, setEraInputValue] = useState('');
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
      // The owning Curate shell alone chooses whether to resume another
      // partial entry or create the one replacement draft. Keeping that
      // decision here as well produced two blank drafts after Done.
      onCommit?.();
    }
  }, [commitEntry, entryId, onCommit, onReturnToLibrary]);

  // ── Guard: entry must exist (after all hooks) ─────────────────────────

  if (!entry) return null;

  const shellClass = 'surface-warm relative mx-auto w-full max-w-3xl space-y-2 px-3 md:px-5';
  // The capture itself stays tightly bounded; the owning mobile scroll region
  // supplies bottom-nav clearance so that space is not painted as part of the
  // sourcing sheet.
  const mobileShellClass = `${shellClass} curate-source-sheet py-1.5 lg:py-3`;
  const sourceShellClass = 'curate-context-band px-1';
  const fieldClass = 'curate-field field-recessed px-3 py-2.5';
  const tallFieldClass = 'curate-field field-recessed px-3 py-2.5';
  const nameHeadlineClass = 'curate-primary min-h-11 rounded-none border-0 border-b border-tea-border bg-transparent px-1 py-2 font-medium placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';

  // ── Tasting overlay opener — hoisted so actionRef can reference it ──────
  const openTastingOverlay = () => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    setTastingOverlayOpen(true);
  };

  const toggleBuyPicker = () => {
    const unitBased = entry.category === 'teaware' || (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
    const defaultQty = unitBased ? 1 : (entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100);
    if (!showBuyPicker) setBuyingQty(defaultQty);
    const opening = !showBuyPicker;
    setShowBuyPicker(opening);
    if (opening) {
      window.requestAnimationFrame(() => {
        document.getElementById(purchasePickerId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  // ── Populate actionRef for parent-rendered action bar ───────────────────
  if (actionRef) {
    actionRef.current = {
      openTasting: openTastingOverlay,
      toggleBuy: toggleBuyPicker,
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
              className="curate-support shrink-0 rounded-md px-2.5 py-1 font-medium"
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
  const isSample = entryIsSample(entry);
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

  // Ask the AI to fill the Chinese name from the tea's name + context. Known
  // teas fill on their own (variety map / autocomplete / label scan); this is
  // the fallback so the operator never has to type hanzi. Result is written to
  // the field for review, never committed silently.
  const handleGenerateChineseName = async () => {
    if (!entry.name?.trim() || generatingChinese) return;
    setGeneratingChinese(true);
    try {
      const res = await api.generateChineseName({
        name: entry.name.trim(),
        type: entry.type,
        originRegion: entry.originRegion,
        year: entry.year,
      });
      const cn = (res as { chineseName?: string })?.chineseName?.trim();
      if (cn) update({ chineseName: cn });
    } catch {
      // Offline or no provider — leave the field as-is; the operator can retry.
    } finally {
      setGeneratingChinese(false);
    }
  };

  // Shared acquisition behavior must be available to both category branches.
  // Teaware is unit-based; compressed tea forms are unit-based as well.
  const unitBased = entry.category === 'teaware' || (['Cake', 'Brick', 'Tuo'] as string[]).includes(entry.form || '');
  const isInLedger = transactions.some(
    (tx) => tx.status === 'draft' && tx.items.some((item) => item.compassEntryId === entry.id)
  );
  const pricePerGram = entry.priceAmount && entry.pricePerUnitGrams && !unitBased
    ? entry.priceAmount / entry.pricePerUnitGrams
    : null;
  const totalPrice = pricePerGram ? buyingQty * pricePerGram : null;
  const buyStep = unitBased ? 1 : 25;

  const handleAddToLedger = async () => {
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
    setReceiptBusy(true);
    setReceiptError('');
    try {
      const proposal = await api.compass.proposeReceipt(entry.id, {
        purpose: receiptPurpose,
        quantity: buyingQty,
        unit: unitBased ? 'unit' : 'g',
        acquisition_kind: receiptAcquisition,
        idempotency_key: `ledger:${txId}:${entry.id}`,
        product_name: entry.name || 'Unnamed',
        product_type: entry.category === 'teaware' ? 'Teaware' : entry.type,
      });
      setReceiptProposal(proposal);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Could not create the inventory receipt proposal.');
    } finally {
      setReceiptBusy(false);
    }
    setShowBuyPicker(false);
    setJustAddedToLedger(true);
  };

  const reviewReceipt = async (action: 'accept' | 'reject') => {
    if (!receiptProposal) return;
    setReceiptBusy(true);
    setReceiptError('');
    try {
      if (action === 'accept') await api.compass.acceptReceiptProposal(receiptProposal.id);
      else await api.compass.rejectReceiptProposal(receiptProposal.id);
      setReceiptProposal(null);
      setJustAddedToLedger(false);
      onSwitchToLedger?.();
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : `Could not ${action} this receipt.`);
    } finally {
      setReceiptBusy(false);
    }
  };

  const renderTeawarePurchaseSection = () => (
    <section
      id={purchasePickerId}
      className={`${showBuyPicker || justAddedToLedger || isInLedger ? 'curate-section' : 'hidden'} space-y-2`}
    >
      <QuietEyebrow label="Buy" />
      {isInLedger && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSwitchToLedger}
            className="curate-support tap-target flex min-h-11 items-center gap-1.5 text-tea-text-sec transition-colors hover:text-tea-text"
          >
            <BookOpen size={11} />
            View purchases in ledger
          </button>
        </div>
      )}

      {showBuyPicker && !justAddedToLedger && (
        <div className="space-y-2 rounded-md bg-tea-accent-sub px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBuyingQty(Math.max(1, buyingQty - 1))}
                className="curate-action tap-target h-11 w-11 rounded-md bg-tea-surface text-tea-text-sec active:bg-tea-elevated"
                aria-label="Decrease buying quantity"
              >
                <Minus size={12} />
              </button>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  aria-label="Purchase quantity"
                  value={buyingQty}
                  onChange={(event) => setBuyingQty(Math.max(1, Number.parseInt(event.target.value) || 1))}
                  className="curate-primary min-h-11 w-11 border-none bg-transparent text-center font-normal text-tea-text outline-none"
                />
                <span className="curate-support text-tea-text-dim">{buyingQty === 1 ? 'unit' : 'units'}</span>
              </div>
              <button
                type="button"
                onClick={() => setBuyingQty(buyingQty + 1)}
                className="curate-action tap-target h-11 w-11 rounded-md bg-tea-surface text-tea-text-sec active:bg-tea-elevated"
                aria-label="Increase buying quantity"
              >
                <Plus size={12} />
              </button>
            </div>
            {entry.priceAmount ? (
              <span className="curate-support text-tea-text-dim">
                = <span className="font-medium text-tea-text-sec">{(buyingQty * entry.priceAmount).toFixed(0)}</span> {entry.priceCurrency || 'NT'}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="curate-support text-tea-text-sec">
              <span className="mb-1 block">Inventory purpose</span>
              <select
                aria-label="Inventory purpose"
                value={receiptPurpose}
                onChange={(event) => setReceiptPurpose(event.target.value as InventoryPurposeValue)}
                className="curate-field w-full px-2"
              >
                <option value="working">Working</option>
                <option value="sample">Sample</option>
                <option value="personal">Personal</option>
              </select>
            </label>
            <label className="curate-support text-tea-text-sec">
              <span className="mb-1 block">Acquisition</span>
              <select
                aria-label="Acquisition"
                value={receiptAcquisition}
                onChange={(event) => setReceiptAcquisition(event.target.value as ReceiptAcquisitionKind)}
                className="curate-field w-full px-2"
              >
                <option value="purchase">Purchase</option>
                <option value="free_sample">Free sample</option>
                <option value="gift">Gift</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleAddToLedger}
            disabled={receiptBusy}
            className="curate-action w-full rounded-md bg-tea-gold px-3 font-semibold text-tea-bg active:opacity-80"
          >
            {receiptBusy ? 'Adding…' : 'Add to Ledger'}
          </button>
        </div>
      )}

      {justAddedToLedger && (
        <div className="curate-support rounded-md bg-tea-accent-sub p-3">
          <div className="flex items-center gap-2 font-medium text-tea-gold">
            <Check size={16} />
            Added to Ledger
          </div>
          {receiptProposal && (
            <div className="mt-2 space-y-2 text-ui-12 text-tea-text-sec">
              <p>Review receipt: {receiptProposal.quantity} {receiptProposal.quantity === 1 ? 'unit' : 'units'} · {receiptProposal.purpose} · {receiptProposal.acquisition_kind.replace('_', ' ')}</p>
              <p>Inventory changes only after you accept this receipt.</p>
              <div className="flex justify-between gap-3 border-t border-tea-border pt-2">
                <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('reject')} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">Reject</button>
                <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('accept')} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 font-semibold text-tea-bg">Accept into Inventory</button>
              </div>
            </div>
          )}
          {receiptError && (
            <div role="alert" className="mt-2 flex items-center justify-between gap-3 text-ui-12 text-tea-text-sec">
              <span>{receiptError}</span>
              {!receiptProposal && <button type="button" disabled={receiptBusy} onClick={handleAddToLedger} className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt">Retry receipt</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );

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
    const materialDisplayLabel = effectiveClayType ? `${materialChipLabel} · ${effectiveClayType}` : materialChipLabel;
    const supportsCapacity = (['Pot', 'Cup', 'Gaiwan', 'Fair Cup'] as TeawareCategory[]).includes(entry.teawareCategory as TeawareCategory);
    const categorySheetId = `teaware-category-${entry.id}`;
    const materialSheetId = `teaware-material-${entry.id}`;
    const eraSheetId = `teaware-era-${entry.id}`;

    return (
      <div className={mobileShellClass} data-curate-source data-visual-layout="continuous-sheet">
        <div data-testid="curate-primary-workflow" className="space-y-0">
        <DecisionControl value={entry.decision} onChange={(decision) => update({ decision })} />

        <div className={sourceShellClass} data-testid="curate-teaware-context-band">
          <CaptureContextChips
            category={entry.category}
            vendorName={entry.vendorName}
            vendorOpen={vendorOpen}
            onToggleVendor={() => setVendorOpen((v) => !v)}
            batchMode={batchMode}
            onToggleBatchMode={onToggleBatchMode}
            onShare={onShare}
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

          <div className="flex min-w-0 items-center gap-1 border-t border-tea-border">
            <div className="min-w-0 flex-1">
              <EncounterContext journeyId={entry.journeyId} visitId={entry.visitId} onChange={(journeyId, visitId) => useTeaCompassStore.getState().setEncounterContext(entryId, journeyId, visitId)} />
            </div>
            <div className="shrink-0">
            <PhotoCapture
              onExtracted={handleExtracted}
              onPhotoTaken={handlePhotoTaken}
              onPhotoReplaced={handlePhotoReplaced}
              photos={entry.photos}
              onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
              variant="strip"
            />
            </div>
          </div>
        </div>

        <section className="curate-cluster space-y-2" data-testid="curate-cluster-identity">
          <QuietEyebrow label="Teaware" />
          <input
            type="text"
            value={entry.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Teaware name"
            className={`w-full ${nameHeadlineClass}`}
          />

          <div className="grid grid-cols-2 gap-2" data-testid="curate-teaware-classification-row">
            <button
              type="button"
              onClick={() => setCategoryPopoverOpen(true)}
              className="curate-field curate-field-with-label relative flex min-w-0 items-center justify-between px-2 text-left"
              aria-label={`Category: ${entry.teawareCategory || 'Choose'}`}
              aria-haspopup="dialog"
              aria-expanded={categoryPopoverOpen}
              aria-controls={categorySheetId}
            >
              <span className="curate-floating-label">Category</span>
              <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{entry.teawareCategory || 'Choose'}</span>
              <ChevronDown size={12} className="mt-1 shrink-0" />
            </button>

              <button
                type="button"
                onClick={() => {
                  setMaterialPopoverOpen(true);
                }}
                className="curate-field curate-field-with-label relative flex min-w-0 items-center justify-between px-2 text-left"
                aria-label={`Material: ${materialDisplayLabel}`}
                aria-haspopup="dialog"
                aria-expanded={materialPopoverOpen || claySheetOpen}
                aria-controls={materialSheetId}
                data-curate-action
              >
                <span className="curate-floating-label">Material</span>
                <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{materialDisplayLabel}</span>
                <ChevronDown size={12} className="mt-1 shrink-0" />
              </button>
          </div>

          <div className="flex items-end gap-2" data-testid="curate-teaware-provenance-row">
            <div className="relative min-w-0 flex-1">
              <span className="curate-floating-label">Origin</span>
              <AutocompleteInput
                value={entry.originRegion || ''}
                onChange={(val) => update({ originRegion: val || undefined })}
                suggestions={availableRegions}
                placeholder="Origin"
                className={`curate-field-with-label w-full ${tallFieldClass}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setEraSheetOpen(true)}
              className="curate-field curate-field-with-label relative flex w-20 shrink-0 items-center justify-between px-2 text-left tabular-nums"
              aria-label={`Era: ${entry.era || 'Choose'}`}
              aria-haspopup="dialog"
              aria-expanded={eraSheetOpen}
              aria-controls={eraSheetId}
              data-curate-action
            >
              <span className="curate-floating-label">Era</span>
              <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{entry.era || 'Choose'}</span>
              <ChevronDown size={12} className="mt-1 shrink-0" />
            </button>
            {supportsCapacity && (
              <div className="relative w-20 shrink-0">
                <span className="curate-floating-label">Capacity</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Capacity (ml)"
                  value={entry.capacityMl ?? ''}
                  onChange={(event) => update({ capacityMl: event.target.value === '' ? undefined : Number(event.target.value) })}
                  placeholder="ml"
                  className={`curate-field-with-label w-full pl-2 pr-6 text-center tabular-nums ${fieldClass}`}
                />
                {entry.capacityMl != null && (
                  <span className="curate-support pointer-events-none absolute bottom-1.5 right-2 text-tea-text-dim">ml</span>
                )}
              </div>
            )}
          </div>

          {/* Category, material, clay and era sheets remain specialist
              subflows; the working canvas only carries their selected values. */}

          {/* Category — opens as a bottom sheet (Vaul) so the picker has
              full thumb access at the bottom of the screen and never clips
              against narrow viewports the way the old anchored popover did. */}
          <BottomSheet
            open={categoryPopoverOpen}
            onOpenChange={setCategoryPopoverOpen}
            title="Category"
            description="What kind of teaware is this?"
          >
            <div id={categorySheetId} className="flex flex-col gap-0.5 px-1">
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
            <div id={eraSheetId} className="flex flex-col gap-0.5 px-1">
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
                    className="min-h-11 flex-1 min-w-0 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim"
                  />
                  <button
                    type="button"
                    onClick={commitCustomEra}
                    disabled={!eraInputValue.trim()}
                    className="curate-action shrink-0 rounded-md bg-tea-gold px-3 font-medium text-tea-bg disabled:opacity-40"
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
            <div id={materialSheetId} className="flex flex-col gap-0.5 px-1">
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
            onOpenChange={setClaySheetOpen}
            title={entry.material === 'Clay' ? 'Clay subtype' : 'Yixing clay'}
            description="Pick the clay this piece is made from"
            large
          >
            <div className="space-y-2 p-2">
              <div className="grid grid-cols-2 gap-2.5">
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
                        className={`font-sans text-base truncate ${sel ? 'text-tea-gold font-medium' : 'text-tea-text font-medium'}`}
                      >
                        {clay.label}
                      </div>
                      {clay.hint && (
                        <div className="curate-support mt-0.5 truncate text-tea-text-sec">{clay.hint}</div>
                      )}
                    </div>
                  </button>
                );
              })}
              </div>
              {effectiveClayType && (
                <button
                  type="button"
                  onClick={() => {
                    update({ material: entry.material === 'Clay' ? 'Clay' : 'Yixing', clayType: undefined });
                    setClaySheetOpen(false);
                  }}
                  className="tap-target min-h-11 w-full text-ui-12 text-tea-text-sec hover:text-tea-text"
                >
                  Clear clay subtype
                </button>
              )}
            </div>
          </BottomSheet>
        </section>

        <section className="curate-cluster curate-cluster-soft space-y-1.5" data-testid="curate-cluster-buying">
        <QuietEyebrow label="Buy" />
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
        </section>

        <section className="curate-cluster space-y-1.5" data-testid="curate-cluster-notes">
        <FieldLabel>Notes</FieldLabel>
        <NoteThread
          compassEntryId={entry.id}
          teaKey={entry.teaKey ?? undefined}
          compact
          hideTastingArtifacts
          sans
        />
        <div className="curate-intent-inline">
          <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />
        </div>
        <CaptureActionFooter
          className="curate-buy-actions border-t border-tea-border pt-1.5"
          onBuy={toggleBuyPicker}
          onDone={handleCommit}
          doneEnabled={entryHasContent(entry)}
          buyExpanded={showBuyPicker}
          purchasePickerId={purchasePickerId}
        />
        </section>
        {renderTeawarePurchaseSection()}
      </div>
      </div>
    );
  }

  // Typed fields in the TEA layout share the ONE boxed, recessed field style
  // (`fieldClass`) with the teaware variant: a real surface + border so a
  // filled field never looks like a heading. Pickers (Type, Form, Storage)
  // stay chips, so "picked" reads differently from "typed" (the wayfinding
  // contrast the redesign relies on).
  // Tea name — the hero. Large display serif, still just a bottom hairline.
  // This is the ONE serif element in the capture form — everything else
  // below is font-sans so the form reads as one typographic system.
  // ── Tea card layout ────────────────────────
  return (
    <div className={mobileShellClass} data-curate-source data-visual-layout="continuous-sheet">
      {/* ← Library back link — shown when navigated from Library */}
      {onReturnToLibrary && (
        <button
          type="button"
          onClick={onReturnToLibrary}
          className="curate-support tap-target flex min-h-11 items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors -mt-1 mb-1"
        >
          <ArrowLeft size={12} />
          Library
        </button>
      )}

      <div data-testid="curate-primary-workflow" className="space-y-0">
      <DecisionControl value={entry.decision} onChange={(decision) => update({ decision })} />

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
          onShare={onShare}
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

        <div className="flex min-w-0 items-center gap-1 border-t border-tea-border">
          <div className="min-w-0 flex-1">
            <EncounterContext journeyId={entry.journeyId} visitId={entry.visitId} onChange={(journeyId, visitId) => useTeaCompassStore.getState().setEncounterContext(entryId, journeyId, visitId)} />
          </div>
          <div className="shrink-0">
          <PhotoCapture
            onExtracted={handleExtracted}
            onPhotoTaken={handlePhotoTaken}
            onPhotoReplaced={handlePhotoReplaced}
            photos={entry.photos}
            onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
            variant="strip"
          />
          </div>
        </div>
      </div>

      <section className="curate-cluster space-y-2" data-testid="curate-cluster-identity">
        <QuietEyebrow label="Tea" />
        <AutocompleteInput
          value={entry.name}
          onChange={(val) => update({ name: val })}
          suggestions={allNameSuggestions}
          placeholder="Tea name"
          className={`w-full ${nameHeadlineClass}`}
          onSelect={handleNameAutocompleteSelect}
          itemData={{ ...varietyNameMap, ...productNameMap }}
          hintSuggestions={hintSuggestions}
        />

        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="curate-floating-label">Origin</span>
            <AutocompleteInput
              value={entry.originRegion || ''}
              onChange={(val) => { userTapped.current.add('region'); update({ originRegion: val || undefined }); }}
              suggestions={availableRegions}
              placeholder="e.g. Yiwu"
              className={`curate-field-with-label w-full ${fieldClass}`}
            />
          </div>
          <div className="relative w-20 shrink-0">
            <span className="curate-floating-label">Year</span>
            <input
              data-testid="curate-year-control"
              type="number"
              inputMode="numeric"
              placeholder="2019"
              value={entry.year ?? ''}
              onChange={(e) => {
                userTapped.current.add('year');
                const val = e.target.value;
                update({ year: val === '' ? undefined : Number(val) });
              }}
              className={`curate-field-with-label w-full tabular-nums text-center ${fieldClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              style={{ MozAppearance: 'textfield' } as React.CSSProperties}
            />
          </div>
        </div>

        <div className="flex items-end gap-2" data-testid="curate-chinese-type-row">
          <div className="relative min-w-0 flex-1">
            <span className="curate-floating-label">Chinese name</span>
            <div>
              <input
                type="text"
                value={entry.chineseName || ''}
                onChange={(e) => update({ chineseName: e.target.value || undefined })}
                placeholder="中文名"
                className={`curate-field-with-label w-full pr-11 ${fieldClass}`}
              />
              <button
                type="button"
                onClick={handleGenerateChineseName}
                disabled={!entry.name?.trim() || generatingChinese}
                className="tap-target absolute inset-y-0 right-0 w-11 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-40"
                aria-label="Suggest Chinese name"
                title="Suggest Chinese name"
                data-testid="curate-chinese-suggest"
              >
                {generatingChinese ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTypePopoverOpen(true)}
            className="curate-field curate-field-with-label relative flex w-20 shrink-0 items-center justify-between px-2 text-left"
            style={entry.type ? { color: getTypeChipStyle(entry.type).text } : undefined}
            aria-label="Tea type"
            data-testid="curate-type-control"
          >
            <span className="curate-floating-label">Type</span>
            <span className="curate-support min-w-0 truncate pt-1 font-medium text-current">{entry.type || 'Choose'}</span>
            <ChevronDown size={12} className="mt-1 shrink-0" />
          </button>
        </div>

        <BottomSheet
          open={typePopoverOpen}
          onOpenChange={setTypePopoverOpen}
          title="Tea type"
          description="What kind of tea is this?"
        >
          <div className="grid grid-cols-2 gap-2 px-1">
            {TEA_TYPES.map((type) => {
              const chipStyle = getTypeChipStyle(type);
              const selected = entry.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className={`flex min-h-[52px] items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-tea-gold/30 bg-tea-accent-sub text-tea-text'
                      : 'border-tea-border bg-tea-bg text-tea-text-sec hover:bg-tea-accent-sub hover:text-tea-text'
                  }`}
                >
                  <span
                    className="block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: chipStyle.text }}
                    aria-hidden
                  />
                  <span className="curate-primary min-w-0 flex-1 truncate font-medium">{type}</span>
                  {selected && <Check size={13} className="shrink-0 text-tea-gold" />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </section>

      {/* ─── Pricing zone — cost, unit, retail preview tucked close beneath. ─── */}
      <section className="curate-cluster curate-cluster-soft space-y-1.5" data-testid="curate-cluster-buying">
        <QuietEyebrow label="Buy" />
        <div className="space-y-2">
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
      </section>

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
            <p className="curate-support text-tea-gold tracking-wide truncate">
              {extractionSummary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>


      {/* These sections render inline, always visible — Adrian uses them
          regularly (tasting profile, notes, intent, storage, sell price) and
          asked that they never sit behind a second tap. ─── */}

      {/* ─── Profile zone: quality bar + brewing + tag cloud ─── */}
      <section className="curate-cluster space-y-1.5" data-testid="curate-cluster-tasting">
          {!hasTasting && (
            <button
              type="button"
              onClick={openTastingOverlay}
              className="curate-compact-target w-full border-b border-tea-border text-left text-tea-text transition-colors hover:text-tea-gold"
              data-curate-action
            >
              <span className="curate-support">Add tasting profile</span>
            </button>
          )}
          {hasTasting && entry.tasting && (
            <>
          <QuietEyebrow label="Taste" />
          {/* Quality 1–10 — same segment toggle as TastingSession */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="curate-support text-tea-text-sec" style={{ letterSpacing: '0.04em' }}>Quality</span>
              <span className="curate-support text-tea-gold tabular-nums font-medium">
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
                    className={`curate-support tabular-nums flex-1 py-2.5 font-medium transition-all duration-150 min-h-[44px] relative z-[1] ${
                      isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                    }${i < 9 ? ' weight-seg-div' : ''}`}
                    data-curate-action
                    style={{
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
            <div className="curate-support flex items-center gap-2 flex-wrap text-tea-text-dim">
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
            </>
          )}
      <CaptureActionFooter
        className="curate-buy-actions border-t border-tea-border pt-1.5 lg:hidden"
        onBuy={toggleBuyPicker}
        onDone={handleCommit}
        onSample={openTastingOverlay}
        doneEnabled={entryHasContent(entry)}
        buyExpanded={showBuyPicker}
        purchasePickerId={purchasePickerId}
      />
      {/* Notes and intent remain continuously available inside the same
          visually memorable Taste cluster rather than becoming two more
          full-weight sections. */}
      <div className="space-y-1.5 border-t border-tea-border pt-2" data-testid="curate-notes-band">
        <FieldLabel>Notes</FieldLabel>
        <NoteThread
          compassEntryId={entry.id}
          teaKey={entry.teaKey ?? undefined}
          compact
          hideTastingArtifacts
          sans
        />
        <div className="curate-intent-inline">
          <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />
        </div>
      </div>
      </section>
      </div>

      {(entry.type === 'Sheng' || entry.type === 'Shou' || entry.type === 'Dark') && <section className="curate-section space-y-2">
          <QuietEyebrow label="Storage" />
          <div className="flex gap-1.5 flex-wrap">
            {STORAGE_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => { userTapped.current.add('storage'); update({ storage: entry.storage === st ? undefined : st }); }}
                className={`${entry.storage === st ? 'tag-selectable-active' : 'tag-selectable'} curate-support tap-target min-h-11`}
                data-curate-action
              >
                {st}
              </button>
            ))}
          </div>
      </section>}


      {/* ─── Buy picker / ledger — shown below content when Buy is tapped ─── */}
      <section id={purchasePickerId} className={`${showBuyPicker || justAddedToLedger || isInLedger ? 'curate-section' : 'hidden'} space-y-2`}>
        <QuietEyebrow label="Buy" />
        <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Ledger link */}
        {isInLedger && (
          <button
            type="button"
            onClick={onSwitchToLedger}
            className="curate-support tap-target flex min-h-11 items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <BookOpen size={11} />
            View purchases in ledger
          </button>
        )}
        </div>

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
                      className="curate-action tap-target h-11 w-11 rounded-md bg-tea-surface text-tea-text-sec active:bg-tea-elevated"
                      data-curate-action
                      aria-label="Decrease buying quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <div className="flex items-baseline gap-0.5">
                      <input
                        type="number"
                        aria-label="Purchase quantity"
                        value={buyingQty}
                        onChange={(e) => setBuyingQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="curate-primary min-h-11 w-11 text-center text-tea-text font-normal bg-transparent border-none outline-none"
                      />
                      <span className="curate-support text-tea-text-dim">
                        {unitBased ? (buyingQty === 1 ? 'unit' : 'units') : 'g'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBuyingQty(buyingQty + buyStep)}
                      className="curate-action tap-target h-11 w-11 rounded-md bg-tea-surface text-tea-text-sec active:bg-tea-elevated"
                      data-curate-action
                      aria-label="Increase buying quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  {totalPrice != null ? (
                    <span className="curate-support text-tea-text-dim">
                      = <span className="text-tea-text-sec font-medium">{totalPrice.toFixed(0)}</span> {entry.priceCurrency || 'NT'}
                    </span>
                  ) : entry.priceAmount && unitBased ? (
                    <span className="curate-support text-tea-text-dim">
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
                        className={`curate-support tap-target min-h-11 rounded px-2 tabular-nums transition-colors ${
                          buyingQty === g ? 'bg-tea-accent-sub text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'
                        }`}
                        data-curate-action
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="curate-support text-tea-text-sec">
                    <span className="mb-1 block">Inventory purpose</span>
                    <select
                      aria-label="Inventory purpose"
                      value={receiptPurpose}
                      onChange={(event) => setReceiptPurpose(event.target.value as InventoryPurposeValue)}
                      className="curate-field w-full px-2"
                    >
                      <option value="working">Working</option>
                      <option value="sample">Sample</option>
                      <option value="personal">Personal</option>
                    </select>
                  </label>
                  <label className="curate-support text-tea-text-sec">
                    <span className="mb-1 block">Acquisition</span>
                    <select
                      aria-label="Acquisition"
                      value={receiptAcquisition}
                      onChange={(event) => setReceiptAcquisition(event.target.value as ReceiptAcquisitionKind)}
                      className="curate-field w-full px-2"
                    >
                      <option value="purchase">Purchase</option>
                      <option value="free_sample">Free sample</option>
                      <option value="gift">Gift</option>
                      <option value="transfer">Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleAddToLedger}
                  disabled={receiptBusy}
                  className="curate-action w-full rounded-md bg-tea-gold px-3 font-semibold text-tea-bg active:opacity-80"
                  data-curate-action
                >
                  {receiptBusy ? 'Adding…' : 'Add to Ledger'}
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
              className="curate-support rounded-md bg-tea-gold/15 p-3"
            >
              <div className="flex items-center gap-2 text-tea-gold font-medium">
                <Check size={16} />
                Added to Ledger
              </div>
              {receiptProposal && (
                <div className="mt-2 space-y-2 text-ui-12 text-tea-text-sec">
                  <p>Review receipt: {receiptProposal.quantity}{receiptProposal.unit === 'g' ? 'g' : ` ${receiptProposal.quantity === 1 ? 'unit' : 'units'}`} · {receiptProposal.purpose} · {receiptProposal.acquisition_kind.replace('_', ' ')}</p>
                  <p className="text-tea-text-sec">Inventory changes only after you accept this receipt.</p>
                  <div className="flex justify-between gap-3 border-t border-tea-border pt-2">
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('reject')} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">Reject</button>
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('accept')} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 font-semibold text-tea-bg">Accept into Inventory</button>
                  </div>
                </div>
              )}
              {receiptError && (
                <div role="alert" className="mt-2 flex items-center justify-between gap-3 text-ui-12 text-tea-text-sec">
                  <span>{receiptError}</span>
                  {!receiptProposal && <button type="button" disabled={receiptBusy} onClick={handleAddToLedger} className="tap-target min-h-11 text-tea-gold hover:text-tea-gold-lt">Retry receipt</button>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

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
