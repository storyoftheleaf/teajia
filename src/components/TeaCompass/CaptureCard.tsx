import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Camera, Check, ChevronDown, Droplets, Minus, Plus, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../../data/teaVarieties';
import type { TeaType, TeaForm, TeawareCategory, TeawareMaterial, TeawareEra, VendorDetails, TeaCompassEntry } from './types';
import { DEFAULT_GRAMS, TEA_TYPES, TEA_FORMS, STORAGE_OPTIONS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, COMMON_REGIONS, generateTeaKey } from './types';
import { hasToken } from '../../lib/api';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { PriceGrams } from './PriceGrams';
import { NoteThread } from '../shared/NoteThread';
import { useLedgerStore } from '../../lib/ledgerStore';
import { TastingSession } from '../tasting/TastingSession';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { parseTeaInput } from './InputParser';
import { PhotoCapture } from './PhotoCapture';
import type { ExtractedTeaData } from './PhotoCapture';
import { TeawarePhotos } from './TeawarePhotos';
import { DuplicateNudge } from './DuplicateNudge';
import { IntentBar } from './IntentBar';

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
  NT: 'NT$', USD: '$', Yuan: '¥', MYR: 'RM', IDR: 'Rp', JPY: '¥', HKD: 'HK$', UNK: '?',
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

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit, onReturnToLibrary, initialCollapsed = false, actionRef }) => {
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

  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const transactions = useLedgerStore((s) => s.transactions);

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [tastingOverlayOpen, setTastingOverlayOpen] = useState(false);
  const [localTasting, setLocalTasting] = useState<TastingData>(EMPTY_TASTING);

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
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [formPopoverOpen, setFormPopoverOpen] = useState(false);
  const typePopoverRef = useRef<HTMLDivElement>(null);
  const formPopoverRef = useRef<HTMLDivElement>(null);
  // Teaware-specific popovers
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [eraPopoverOpen, setEraPopoverOpen] = useState(false);
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  const categoryPopoverRef = useRef<HTMLDivElement>(null);
  const eraPopoverRef = useRef<HTMLDivElement>(null);
  const materialPopoverRef = useRef<HTMLDivElement>(null);

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

  // Close popovers on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (typePopoverOpen && typePopoverRef.current && !typePopoverRef.current.contains(e.target as Node)) {
        setTypePopoverOpen(false);
      }
      if (formPopoverOpen && formPopoverRef.current && !formPopoverRef.current.contains(e.target as Node)) {
        setFormPopoverOpen(false);
      }
      if (categoryPopoverOpen && categoryPopoverRef.current && !categoryPopoverRef.current.contains(e.target as Node)) {
        setCategoryPopoverOpen(false);
      }
      if (eraPopoverOpen && eraPopoverRef.current && !eraPopoverRef.current.contains(e.target as Node)) {
        setEraPopoverOpen(false);
      }
      if (materialPopoverOpen && materialPopoverRef.current && !materialPopoverRef.current.contains(e.target as Node)) {
        setMaterialPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typePopoverOpen, formPopoverOpen, categoryPopoverOpen, eraPopoverOpen]);

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
    (_localUrl: string, serverUrl: string) => {
      // onPhotoTaken already added serverUrl; nothing extra to do here
      // (local preview is managed inside PhotoCapture component state)
      void serverUrl;
    },
    []
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
      <div className="bg-tea-surface rounded-2xl px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={entry.name}
            onChange={(e) => updateEntry(entryId, { name: e.target.value })}
            placeholder="What are you tasting?"
            className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none placeholder:text-tea-text-dim"
          />
          {entry.type && chipStyle && (
            <span
              className="shrink-0 text-ui-11 font-medium px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: chipStyle.bg, color: chipStyle.text }}
            >
              {entry.type}
            </span>
          )}
          <button
            type="button"
            onClick={() => { setTastingOverlayOpen(true); }}
            className={`shrink-0 p-2 rounded-xl transition-colors ${hasTastingC ? 'bg-tea-gold/10 text-tea-gold' : 'bg-tea-elevated text-tea-text-dim hover:text-tea-text'}`}
            title="Quick taste"
          >
            <Droplets size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="shrink-0 p-2 rounded-xl bg-tea-elevated text-tea-text-dim hover:text-tea-text transition-colors"
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
    setFormPopoverOpen(false);
  };

  const handleCurrencyChange = (currency: Currency) => {
    update({ priceCurrency: currency });
    setLastCurrency(currency);
  };

  const handleVendorSelect = (vendorId: string | undefined, vendorName: string) => {
    update({ vendorName, vendorId });
    setLastVendor(vendorId || null, vendorName);
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

    return (
      <div className="bg-tea-surface rounded-2xl px-4 py-3 space-y-2">

        {/* Row 1: Vendor + Camera */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
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
          <PhotoCapture
            onExtracted={handleExtracted}
            onPhotoTaken={handlePhotoTaken}
            onPhotoReplaced={handlePhotoReplaced}
            photos={entry.photos}
            onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
          />
        </div>

        {/* Row 2: Name + Category (mirrors Name + Type) */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={entry.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="What is it?"
            className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder:text-tea-text-dim"
          />
          <div className="relative shrink-0" ref={categoryPopoverRef}>
            <button
              type="button"
              onClick={() => { setCategoryPopoverOpen(!categoryPopoverOpen); setEraPopoverOpen(false); }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium bg-tea-elevated text-tea-text-sec border border-tea-border hover:bg-tea-gold/[0.1] hover:text-tea-text active:bg-tea-gold/[0.14] transition-colors whitespace-nowrap"
              style={entry.teawareCategory ? { backgroundColor: 'rgb(var(--tea-gold-rgb) / 0.12)', color: 'var(--tea-gold)' } : undefined}
            >
              <span>{entry.teawareCategory || 'Category'}</span>
              <ChevronDown size={14} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {categoryPopoverOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 z-20 bg-tea-surface rounded-xl p-2 shadow-lg border border-tea-border"
                >
                  <div className="grid grid-cols-2 gap-1.5" style={{ minWidth: '160px' }}>
                    {TEAWARE_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const updates: Record<string, unknown> = { teawareCategory: cat };
                          if (entry.teawareCategory !== cat) updates.material = undefined;
                          update(updates);
                          setCategoryPopoverOpen(false);
                        }}
                        className={`${entry.teawareCategory === cat ? 'tag-selectable-active' : 'tag-selectable'} py-2`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Row 3: Era + Material + Origin */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0" ref={eraPopoverRef}>
            <button
              type="button"
              onClick={() => { setEraPopoverOpen(!eraPopoverOpen); setCategoryPopoverOpen(false); setMaterialPopoverOpen(false); }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm bg-tea-gold/[0.06] border border-tea-border text-tea-text-dim hover:text-tea-text transition-colors tabular-nums"
              style={entry.era ? { color: 'var(--tea-text)' } : undefined}
            >
              <span>{entry.era || 'Era'}</span>
              <ChevronDown size={13} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {eraPopoverOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-xl p-2 shadow-lg border border-tea-border"
                >
                  <div className="flex flex-col gap-0.5" style={{ minWidth: '120px' }}>
                    {TEAWARE_ERAS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { update({ era: entry.era === e ? undefined : e }); setEraPopoverOpen(false); }}
                        className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${entry.era === e ? 'text-tea-gold bg-tea-gold/[0.08]' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/[0.05]'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative shrink-0" ref={materialPopoverRef}>
            <button
              type="button"
              onClick={() => { setMaterialPopoverOpen(!materialPopoverOpen); setEraPopoverOpen(false); setCategoryPopoverOpen(false); }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm bg-tea-gold/[0.06] border border-tea-border text-tea-text-dim hover:text-tea-text transition-colors"
              style={entry.material ? { color: 'var(--tea-text)' } : undefined}
            >
              <span>{entry.material || 'Material'}</span>
              <ChevronDown size={13} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {materialPopoverOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-xl p-2 shadow-lg border border-tea-border"
                >
                  <div className="flex flex-col gap-0.5" style={{ minWidth: '130px' }}>
                    {materials.map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => { update({ material: entry.material === mat ? undefined : mat }); setMaterialPopoverOpen(false); }}
                        className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${entry.material === mat ? 'text-tea-gold bg-tea-gold/[0.08]' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-gold/[0.05]'}`}
                      >
                        {mat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AutocompleteInput
            value={entry.originRegion || ''}
            onChange={(val) => update({ originRegion: val || undefined })}
            suggestions={availableRegions}
            placeholder="Origin"
            className="flex-1 min-w-0 bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder:text-tea-text-dim"
          />
        </div>

        <div className="border-t border-tea-border my-1" />

        {/* Row 4: Price + ml (mirrors Price + Grams) */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center bg-tea-gold/[0.06] rounded-xl border border-tea-border focus-within:border-tea-gold/40 transition-colors">
            <select
              value={entry.priceCurrency || 'NT'}
              onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
              className="bg-transparent text-tea-text-sec text-xs tabular-nums font-medium border-none outline-none cursor-pointer appearance-none shrink-0 pl-3 pr-1"
              style={{ backgroundImage: 'none' }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Price"
              value={entry.priceAmount ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                update({ priceAmount: val === '' ? undefined : Number(val) });
              }}
              className="flex-1 min-w-0 bg-transparent text-tea-text px-2 py-2 outline-none text-base tabular-nums placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ MozAppearance: 'textfield' } as React.CSSProperties}
            />
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="ml"
            value={entry.capacityMl ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              update({ capacityMl: val === '' ? undefined : Number(val) });
            }}
            className="w-20 shrink-0 bg-tea-gold/[0.06] text-tea-text rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none text-base tabular-nums text-right placeholder:text-tea-text-dim [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ MozAppearance: 'textfield' } as React.CSSProperties}
          />
        </div>

        {/* Row 5: Qty stepper */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => update({ quantity: Math.max(1, (entry.quantity || 1) - 1) })}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-tea-elevated border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <Minus size={12} />
          </button>
          <span className="text-tea-text text-sm font-medium tabular-nums min-w-[2ch] text-center">
            {entry.quantity || 1}
          </span>
          <button
            type="button"
            onClick={() => update({ quantity: (entry.quantity || 1) + 1 })}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-tea-elevated border border-tea-border text-tea-text-sec hover:text-tea-text transition-colors"
          >
            <Plus size={12} />
          </button>
          <span className="text-ui-11 text-tea-text-dim ml-1">qty</span>
        </div>

        <div className="border-t border-tea-border my-1" />

        {/* Notes */}
        <NoteThread
          compassEntryId={entry.id}
          teaKey={entry.teaKey ?? undefined}
          compact
        />

        {/* Done */}
        {hasTeawareName && (
          <button
            type="button"
            onClick={handleCommit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tea-gold/10 text-tea-gold text-sm font-semibold hover:bg-tea-gold/15 active:bg-tea-gold/20 transition-all"
          >
            <Check size={15} strokeWidth={2.5} />
            Done
          </button>
        )}
      </div>
    );
  }

  // ── Status helpers ────────────────────────
  const isWant = entry.status === 'want';
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
    <div className="bg-tea-surface rounded-2xl px-4 py-3 space-y-3">
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

      {/* ─── IDENTITY ─── */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
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
          <PhotoCapture
            onExtracted={handleExtracted}
            onPhotoTaken={handlePhotoTaken}
            onPhotoReplaced={handlePhotoReplaced}
            photos={entry.photos}
            onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
          />
        </div>

        <div className="flex items-center gap-2">
          <AutocompleteInput
            value={entry.name}
            onChange={(val) => update({ name: val })}
            suggestions={allNameSuggestions}
            placeholder="What are you tasting?"
            className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors min-w-0 placeholder:text-tea-text-dim"
            onSelect={handleNameAutocompleteSelect}
            itemData={{ ...varietyNameMap, ...productNameMap }}
            hintSuggestions={hintSuggestions}
          />
          <div className="relative shrink-0" ref={typePopoverRef}>
            <button
              type="button"
              onClick={() => { setTypePopoverOpen(!typePopoverOpen); setFormPopoverOpen(false); }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium bg-tea-elevated text-tea-text-sec border border-tea-border hover:bg-tea-gold/[0.1] hover:text-tea-text active:bg-tea-gold/[0.14] transition-colors"
              style={entry.type ? {
                backgroundColor: getTypeChipStyle(entry.type).bg,
                color: getTypeChipStyle(entry.type).text,
              } : undefined}
            >
              <span>{entry.type || 'Type'}</span>
              <ChevronDown size={14} strokeWidth={2} />
            </button>

            <AnimatePresence>
              {typePopoverOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 z-20 bg-tea-surface rounded-lg p-2 shadow-lg border border-tea-border"
                >
                  <div className="flex flex-col gap-0.5" style={{ minWidth: '240px' }}>
                    {TEA_TYPES.map((type) => {
                      const isSelected = entry.type === type;
                      const chipStyle = getTypeChipStyle(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleTypeSelect(type)}
                          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-tea-gold/10"
                          style={isSelected ? { backgroundColor: `${chipStyle.bg}` } : undefined}
                        >
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: chipStyle.text }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${isSelected ? 'text-tea-text' : 'text-tea-text-sec'}`}>
                              {type}
                            </span>
                            {TEA_TYPE_DESCRIPTIONS[type] && (
                              <span className="block text-ui-11 text-tea-text-sec leading-tight mt-0.5">
                                {TEA_TYPE_DESCRIPTIONS[type]}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>


        {/* Year + Region */}
        <div className="flex items-center gap-2">
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
            className="w-20 shrink-0 bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-2 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors tabular-nums text-center placeholder:text-tea-text-dim
                       [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ MozAppearance: 'textfield' } as React.CSSProperties}
          />
          <AutocompleteInput
            value={entry.originRegion || ''}
            onChange={(val) => { userTapped.current.add('region'); update({ originRegion: val || undefined }); }}
            suggestions={availableRegions}
            placeholder="Region"
            className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-xl px-3 py-2 border border-tea-border focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder:text-tea-text-dim"
          />
        </div>


        <div className="border-t border-tea-border" />

        <PriceGrams
          priceAmount={entry.priceAmount}
          priceCurrency={entry.priceCurrency}
          pricePerUnitGrams={entry.pricePerUnitGrams}
          form={entry.form}
          onPriceChange={(priceAmount) => update({ priceAmount })}
          onCurrencyChange={handleCurrencyChange}
          onGramsChange={(pricePerUnitGrams) => update({ pricePerUnitGrams })}
          onFormChange={handleFormSelect}
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


      {/* ─── Profile zone: quality bar + brewing + tag cloud ─── */}
      {hasTasting && entry.tasting && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-tea-border" />
            <span className="text-ui-11 text-tea-text-sec tracking-display uppercase shrink-0">Profile</span>
            <div className="flex-1 h-px bg-tea-border" />
          </div>
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
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-tea-border" />
        <span className="text-ui-11 text-tea-text-sec tracking-display uppercase shrink-0">Notes</span>
        <div className="flex-1 h-px bg-tea-border" />
      </div>
      <NoteThread
        compassEntryId={entry.id}
        teaKey={entry.teaKey ?? undefined}
        compact
        hideMic
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
              <div className="rounded-lg bg-tea-gold/[0.07] px-3 py-2.5 space-y-2">
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
                        className={`py-0.5 px-2 rounded text-ui-11 transition-colors ${
                          buyingQty === g ? 'bg-tea-gold/15 text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
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
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-tea-gold/15 text-tea-gold text-sm font-medium"
            >
              <Check size={16} />
              Added to Ledger
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
