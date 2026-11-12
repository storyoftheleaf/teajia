import { CurateRecordTools } from '../curate/CurateRecordTools';
import { TeawareSheets } from '../curate/TeawareSheets';
import { CaptureFlowLayout } from '../curate/CaptureFlowLayout';
import { BUY_GRAM_CHIPS, samplePreset } from '../curate/samplePreset';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { StructuredTeaFields } from './StructuredTeaFields';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Droplets, Loader2, Minus, Plus, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore, entryHasContent } from '../../lib/teaCompassStore';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { ensureCompassEncounterSaved } from '../../lib/teaCompassSync';
import { useAppStore } from '../../lib/store';
import { useNotesStore } from '../../lib/notesStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { CurateReceiptProposal, InventoryPurposeValue, ReceiptAcquisitionKind, TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { TEA_TYPES, TEA_FORMS, STORAGE_STYLES, REGION_NAMES, countryForRegion } from '../../wisdom';
import type { TeaType, TeaForm, TeawareCategory, TeawareMaterial, TeawareEra, YixingClayType, VendorDetails, TeaCompassEntry } from './types';
import { entryIsSample } from './types';
import { acquisitionDraftLine, acquisitionUsesUnits } from './acquisitionPricing';
import { DEFAULT_GRAMS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, YIXING_CLAY_TYPES, MATERIAL_ORIGIN_DEFAULT, generateTeaKey } from './types';
import { hasToken } from '../../lib/api';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { PricingRow } from './PricingRow';
import { NoteThread } from '../shared/NoteThread';
import { useLedgerStore } from '../../lib/ledgerStore';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';
import { TastingSession } from '../tasting/TastingSession';
import { saveCurateTasting } from '../../lib/curateTastingSave';
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
import { curateShelfPreview, sameMoney } from './curatePricing';
import { layoutFromAddress, type CaptureFormLayout } from '../curate/captureFormLayout';

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
  /** 'flow': open the Buy panel as a sample (the parent's laptop action bar). */
  openSample: () => void;
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
  /** Ref populated with action callbacks, used by parent to render pinned action bar */
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
  /** Order and look of the Source form (see captureFormLayout.ts). When not
   *  given, `?form=flow` in the address selects 'flow'. */
  layout?: CaptureFormLayout;
}

const EMPTY_TASTING: TastingData = {};


const CURRENCY_SYMBOLS: Record<string, string> = {
  NT: 'NT$', USD: '$', Yuan: 'CN¥', MYR: 'RM', IDR: 'Rp', JPY: 'JP¥', HKD: 'HK$', UNK: '?',
};

/** Fills `originCountry` into `updates` from a chosen region via the wisdom
 *  base's `countryForRegion`, but only when the entry doesn't already carry
 *  one. Never overwrites a value already present, matching the "never
 *  overwrite a field the user tapped" pattern used elsewhere in this file. */
function fillOriginCountry(region: string | undefined, currentCountry: string | undefined, updates: Record<string, unknown>): void {
  if (!region || currentCountry) return;
  const country = countryForRegion(region);
  if (country) updates.originCountry = country;
}

/** Shelf price preview: what one gram cost, and what it would sell for.
 *  Priced by the shop's own rates, freight and markup (see curatePricing.ts),
 *  so the figure at the vendor's table is the figure the shelf will charge.
 *  Shelf price in USD, the admin's display unit, like every other admin price. */
function RetailPricePreview({
  costAmount, grams, currency, oneLine = false,
}: {
  costAmount: number;
  grams: number;
  currency: string;
  /** 'flow': one line, the shelf price the emphasised part, the same numbers. */
  oneLine?: boolean;
}) {
  const { data: rates } = useRates();
  const shopFreight = useShopFreightDefault();
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  const preview = curateShelfPreview({
    costAmount, grams, currency, rates, shopFreightPerKgUsd: shopFreight.perKgUsd,
  });

  const fmtGram = (v: number) => v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v).toString();

  if (!preview) {
    return (
      <div className="curate-support px-1 text-tea-text-dim" data-testid="curate-shelf-preview">
        No exchange rate for {sym} yet, so the shelf price can't be worked out.
      </div>
    );
  }

  if (oneLine) {
    return (
      <p className="curate-flow-cost curate-support text-tea-text-sec" data-testid="curate-shelf-preview">
        <span className="whitespace-nowrap tabular-nums">{sym}{fmtGram(preview.costPerGramSource)}/g</span>{' '}
        <span className="whitespace-nowrap"><span aria-hidden>→</span> <span className="tabular-nums font-medium text-tea-text">≈ ${preview.retailPerGramUsd.toFixed(2)}/g on the shelf</span></span>{' '}
        <span className="whitespace-nowrap"><span aria-hidden>·</span> <span className="tabular-nums">{sym}{fmtGram(preview.freightPerKgSource)}/kg freight</span></span>
      </p>
    );
  }

  return (
    <div className="curate-support flex flex-wrap items-center gap-x-2 px-1 text-tea-text-dim lg:gap-y-2" data-testid="curate-shelf-preview">
      <span className="tabular-nums">{sym}{fmtGram(preview.costPerGramSource)}/g cost</span>
      <span className="text-tea-border">→</span>
      <span className="tabular-nums text-tea-text-sec font-medium">≈ ${preview.retailPerGramUsd.toFixed(2)}/g on the shelf</span>
      <span className="text-tea-border">·</span>
      <span className="tabular-nums">with {sym}{fmtGram(preview.freightPerKgSource)}/kg freight</span>
    </div>
  );
}

/** Get chip color for a tea type */
function getTypeChipStyle(type: TeaType): { bg: string; text: string } {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return { bg: `${color}20`, text: color };
}

/** Quiet section eyebrow, replaces the retired gold hairline SectionDivider.
 *  Groups content by whitespace, not by a gold rule; used sparingly (Notes
 *  always; Profile only when tasting data exists) so gold stays scarce. */
const QuietEyebrow: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <h2 className={`curate-section-title ${className}`}>{label}</h2>
);

/** Field label, sits directly above a typed input in the capture form.
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

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit, onReturnToLibrary, initialCollapsed = false, actionRef, onShare, purchasePickerId = `capture-purchase-picker-${entryId}`, openPurchasePicker = false, onBuyExpandedChange, batchMode, onToggleBatchMode, layout }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const lastVendorId = useTeaCompassStore((s) => s.lastVendorId);
  const lastVendorName = useTeaCompassStore((s) => s.lastVendorName);

  const getOrCreatePurchaseTransaction = useLedgerStore((s) => s.getOrCreatePurchaseTransaction);
  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const transactions = useLedgerStore((s) => s.transactions);
  const activeAccountId = useAppStore((state) => state.activeAccountId);

  // The note thread (NoteThread) stores notes in the notes store, not on the
  // entry. Subscribe to the count for this entry so the Done button's readiness
  // (entryHasContent, which reads that store) re-evaluates the moment a note is
  // added or removed, otherwise the button would stay disabled until some
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
  const flowLayout = (layout ?? layoutFromAddress()) === 'flow';
  // 'flow' only: a field or picker in a band sits straight on the card, with
  // its own word as the placeholder (no caption above it). See the 'flow'
  // rules in card-utilities.css.
  const flowCell = 'curate-flow-cell relative flex min-w-0 items-center gap-1 text-left';
  const flowValue = (set: boolean) => `curate-flow-value min-w-0 truncate ${set ? 'text-tea-text' : 'text-tea-text-dim'}`;
  // In 'flow' the Scan button sits at the end of the name row: this is the
  // element it is drawn into (PhotoCapture keeps owning the scanner).
  const [scanSlot, setScanSlot] = useState<HTMLElement | null>(null);
  // ...and the element the photo thumbnails are drawn into, under Photo / Taste.
  const [stripSlot, setStripSlot] = useState<HTMLElement | null>(null);
  // 'flow' only: the Buy panel opened by Buy or by Sample (Sample presets the
  // purpose and the smallest quantity, and the panel is headed "Sample").
  const [buyMode, setBuyMode] = useState<'buy' | 'sample'>('buy');
  const [receiptBusy, setReceiptBusy] = useState(false);
  useEffect(() => {
    if (!entry) return;
    setReceiptPurpose(entryIsSample(entry) ? 'sample' : (entry.category === 'teaware' ? 'personal' : 'working'));
    setReceiptAcquisition(entryIsSample(entry) ? 'free_sample' : 'purchase');
    const saved = transactions.flatMap(tx => tx.items).find(item => item.compassEntryId === entry.id && item.receiptProposal?.status === 'pending')?.receiptProposal;
    setReceiptProposal(saved ?? null);
    setJustAddedToLedger(Boolean(saved));
    setReceiptError('');
    let current = true;
    if (activeAccountId && hasToken()) void api.compass.listReceiptProposals({ status: 'pending', compass_entry_id: entry.id }).then(({ proposals }) => {
      if (!current || useAppStore.getState().activeAccountId !== activeAccountId) return;
      const pending = proposals[0];
      if (!pending) return;
      setReceiptProposal(pending); setJustAddedToLedger(true);
      setReceiptPurpose(pending.purpose); setReceiptAcquisition(pending.acquisition_kind);
      setBuyingQty(entry.category !== 'teaware' && acquisitionUsesUnits(entry) && pending.unit === 'g'
        ? pending.quantity / Number(entry.pricePerUnitGrams || 1) : pending.quantity);
    }).catch(() => { /* A retained purchase draft remains available during a failed read. */ });
    return () => { current = false; };
  }, [entry?.id, activeAccountId]);
  // The defaults also follow what the draft is: switching a capture to Teaware or
  // marking it a sample changes them, as it did before the purchase-draft read
  // above narrowed its own dependencies to the tea and the account (2026-10-28).
  // A purchase draft already saved for this tea keeps the purpose it was saved with.
  useEffect(() => {
    if (!entry || receiptProposal) return;
    setReceiptPurpose(entryIsSample(entry) ? 'sample' : (entry.category === 'teaware' ? 'personal' : 'working'));
    setReceiptAcquisition(entryIsSample(entry) ? 'free_sample' : 'purchase');
  }, [entry?.category, entry?.sampleState]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!entry || !openPurchasePicker) {
      consumedPurchaseHandoffRef.current = null;
      return;
    }
    if (consumedPurchaseHandoffRef.current === entry.id) return;
    consumedPurchaseHandoffRef.current = entry.id;
    const unitBased = acquisitionUsesUnits(entry);
    setBuyingQty(unitBased ? 1 : (entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100));
    setShowBuyPicker(true);
  }, [entry, openPurchasePicker]);

  useEffect(() => {
    if (!receiptProposal && !receiptError) return;
    const frame = requestAnimationFrame(() => document.getElementById(purchasePickerId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [receiptProposal?.id, receiptError, purchasePickerId]);

  // Sync price changes back to any matching draft ledger line items
  useEffect(() => {
    if (!entry) return;
    const { transactions, updateLineItem: updItem } = useLedgerStore.getState();
    for (const tx of transactions) {
      if (tx.status !== 'draft') continue;
      for (const item of tx.items) {
        if (item.compassEntryId !== entry.id) continue;
        // An amount in another money is never written into a line counted in
        // this one: the line keeps what was ordered.
        if (entry.priceAmount != null && !sameMoney(item.currency || tx.currency, entry.priceCurrency)) continue;
        const quoted = acquisitionDraftLine(entry, item.quantityGrams ?? item.quantityUnits ?? buyingQty);
        if (item.pricePerUnit !== quoted.pricePerUnit || item.priceIsPerGram !== quoted.priceIsPerGram || !!item.unpriced !== !!quoted.unpriced) {
          updItem(tx.id, item.id, { pricePerUnit: quoted.pricePerUnit, priceIsPerGram: quoted.priceIsPerGram, unpriced: quoted.unpriced });
        }
      }
    }
  }, [entry?.priceAmount, entry?.priceCurrency, entry?.pricePerUnitGrams, entry?.form, entry?.category, entry?.buyTotal, entry?.buyQuantityGrams, entry?.buyQuantityUnits]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Tea-side Type picker, opens as a Vaul bottom sheet. Form picker has
  // moved into PriceGrams which now manages its own sheet state.
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  // Teaware pickers, open as Vaul bottom sheets. State names kept from
  // the previous popover implementation to minimise churn elsewhere.
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  // Clay subtype picker, opens as a separate full-screen sheet after the
  // user picks Clay or Yixing in the Material sheet.
  const [claySheetOpen, setClaySheetOpen] = useState(false);
  // Era picker, opens as a Vaul bottom sheet next to the Origin field.
  const [eraSheetOpen, setEraSheetOpen] = useState(false);

  // Products from database, for autocomplete suggestions
  const productsRef = useRef<any[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productNameMap, setProductNameMap] = useState<Record<string, any>>({});
  const [availableRegions, setAvailableRegions] = useState<string[]>(REGION_NAMES);

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

        // Build region list: the wisdom base's 167 known places + DB regions, deduplicated
        const dbRegions = products
          .map((p: any) => p.origin_region || p.originRegion || '')
          .filter(Boolean);
        const allRegions = [...new Set([...REGION_NAMES, ...dbRegions])];
        setAvailableRegions(allRegions);
      } catch {
        // Offline or error: no DB suggestions, use the wisdom base's regions only
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

  // Hint suggestions shown on empty focus, first 8 primary variety names for selected type
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

  // (No outside-click handlers needed, every popover in this component
  // is now a Vaul bottom sheet which manages its own dismissal.)

  // Debounced input parser, runs when name changes
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
          fillOriginCountry(result.region, entry.originCountry, updates);
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

  // Debounced duplicate detection, runs on name changes
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

  // Handle photo extraction results, auto-fill empty fields only
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
        fillOriginCountry(data.region, entry.originCountry, updates);
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
      //   1) Initial capture finishes, oldUrl is a transient blob: URL that
      //      never made it into entry.photos, so map() is a safe no-op.
      //   2) In-app crop/rotate edit, oldUrl IS a real entry photo URL and
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
      // Came from Library, return there rather than starting a new capture
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

  // A local capture ID is not proof that the record reached the server.
  // Hydrated account ownership remains present while later edits are dirty.
  const isPersistedRecord = entry.synced || Boolean((entry as TeaCompassEntry & { account_id?: string }).account_id);
  const recordTools = isPersistedRecord ? <CurateRecordTools entityType="tea" entityId={entry.id} onChanged={() => {
    const account = useTeaCompassStore.getState().accountScopeId;
    if (account) void hydrateCompassEntries(account);
  }} /> : null;

  const shellClass = 'surface-warm relative mx-auto w-full max-w-3xl space-y-2 px-3 md:px-5';
  // The capture itself stays tightly bounded; the owning mobile scroll region
  // supplies bottom-nav clearance so that space is not painted as part of the
  // sourcing sheet.
  const mobileShellClass = `${shellClass} curate-source-sheet pt-0 pb-1.5 lg:py-3`;
  const sourceShellClass = 'curate-context-band curate-zone-context px-1';
  const fieldClass = 'curate-field field-recessed px-3 py-2.5';
  const tallFieldClass = 'curate-field field-recessed px-3 py-2.5';
  // On a phone the clusters sit closer so the whole form, Notes included, fits above
  // the floating bottom bar. The laptop keeps the cluster's own 10px padding.
  const phoneClusterPad = '!pt-1 !pb-1 lg:!py-2.5';
  const nameHeadlineClass = 'curate-primary min-h-11 rounded-none border-0 border-b border-tea-border bg-transparent px-1 py-2 font-medium placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none';

  // ── Tasting overlay opener, hoisted so actionRef can reference it ──────
  const openTastingOverlay = () => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    setTastingOverlayOpen(true);
  };

  const toggleBuyPicker = () => {
    if (flowLayout && buyMode === 'sample') {
      // The panel was opened by Sample: Buy turns it into a purchase panel.
      setBuyMode('buy');
      setReceiptPurpose('working');
      if (showBuyPicker) {
        const unitBasedNow = acquisitionUsesUnits(entry);
        setBuyingQty(unitBasedNow ? 1 : (entry.form ? (DEFAULT_GRAMS[entry.form] ?? 100) : 100));
        return;
      }
    }
    if (receiptProposal?.status === 'pending') {
      setJustAddedToLedger(false); setShowBuyPicker(true); return;
    }
    const unitBased = acquisitionUsesUnits(entry);
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

  // 'flow' only: Sample opens the same panel as Buy, as a sample: purpose
  // Sample, the smallest quantity, headed "Sample". Pressing it again closes it.
  const openSamplePicker = () => {
    if (showBuyPicker && buyMode === 'sample') { setShowBuyPicker(false); return; }
    const preset = samplePreset(acquisitionUsesUnits(entry));
    setBuyMode('sample');
    setReceiptPurpose(preset.purpose);
    setBuyingQty(preset.quantity);
    if (receiptProposal?.status === 'pending') setJustAddedToLedger(false);
    setShowBuyPicker(true);
    window.requestAnimationFrame(() => {
      document.getElementById(purchasePickerId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  // ── Populate actionRef for parent-rendered action bar ───────────────────
  if (actionRef) {
    actionRef.current = {
      openTasting: openTastingOverlay,
      toggleBuy: toggleBuyPicker,
      openSample: openSamplePicker,
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
            initialData={entry.tasting ?? entry.tastingHistory?.at(-1)?.data}
            onClose={() => setTastingOverlayOpen(false)}
            onAfterSave={(data: TastingData, verdict) => {
              setLocalTasting(data);
              saveCurateTasting(entryId, data, verdict, { history: 'none' });
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
      // Offline or no provider, leave the field as-is; the operator can retry.
    } finally {
      setGeneratingChinese(false);
    }
  };

  // Shared acquisition behavior must be available to both category branches.
  // Teaware is unit-based; compressed tea forms are unit-based as well.
  const unitBased = acquisitionUsesUnits(entry);
  const isInLedger = transactions.some(
    (tx) => tx.status === 'draft' && tx.items.some((item) => item.compassEntryId === entry.id)
  );
  const pricePerGram = entry.priceAmount && entry.pricePerUnitGrams && !unitBased
    ? entry.priceAmount / entry.pricePerUnitGrams
    : null;
  const totalPrice = pricePerGram ? buyingQty * pricePerGram : null;
  const buyStep = unitBased ? 1 : 25;

  const handleAddToLedger = async () => {
    if (receiptBusy) return;
    setReceiptBusy(true); setReceiptError('');
    const accountId = activeAccountId;
    try {
      const line = acquisitionDraftLine(entry, buyingQty, receiptAcquisition);
      const vendorName = entry.vendorName || 'Unknown Vendor';
      const txId = getOrCreatePurchaseTransaction(vendorName, entry.priceCurrency, entry.vendorId);
      const lineId = addLineItem(txId, line);
      setJustAddedToLedger(true);
      await ensureCompassEncounterSaved(entry.id);
      const changes = {
        purpose: receiptPurpose, quantity: entry.category !== 'teaware' && unitBased ? buyingQty * Number(line.unitWeightGrams) : buyingQty,
        unit: entry.category === 'teaware' ? 'unit' as const : 'g' as const,
        acquisition_kind: receiptAcquisition, product_name: entry.name || 'Unnamed',
        product_type: entry.category === 'teaware' ? 'Teaware' : entry.type,
      };
      if (!(changes.quantity > 0) || !Number.isFinite(changes.quantity)) throw new Error('Record the weight of each piece before receiving this tea.');
      const proposal = receiptAcquisition === 'purchase' ? null : receiptProposal?.status === 'pending'
        ? await api.compass.updateReceiptProposal(receiptProposal.id, changes)
        : await api.compass.proposeReceipt(entry.id, { ...changes, idempotency_key: `ledger:${txId}:${entry.id}` });
      if (useAppStore.getState().activeAccountId !== accountId) return;
      useLedgerStore.getState().updateLineItem(txId, lineId, { receiptProposal: proposal ?? undefined });
      setReceiptProposal(proposal); setShowBuyPicker(false);
    } catch (error) {
      if (useAppStore.getState().activeAccountId === accountId) setReceiptError(error instanceof Error ? error.message : 'Could not save the receipt proposal. Your purchase draft is kept on this device.');
    } finally { setReceiptBusy(false); }
  };

  const purchaseQueryClient = useQueryClient();
  const reviewReceipt = async (action: 'accept' | 'reject') => {
    if (!receiptProposal) return;
    setReceiptBusy(true);
    setReceiptError('');
    const accountId = activeAccountId;
    try {
      if (action === 'accept') {
        const result = await api.compass.acceptReceiptProposal(receiptProposal.id);
        if (useAppStore.getState().activeAccountId !== accountId) return;
        if (result.product_id) updateEntry(entry.id, { draftProductId: result.product_id });
      } else await api.compass.rejectReceiptProposal(receiptProposal.id);
      if (useAppStore.getState().activeAccountId !== accountId) return;
      void purchaseQueryClient.invalidateQueries({ queryKey: ['library-purchase-history'] });
      void purchaseQueryClient.invalidateQueries({ queryKey: ['library-purchase-receipts'] });
      for (const tx of useLedgerStore.getState().transactions) {
        for (const item of tx.items.filter(item => item.receiptProposal?.id === receiptProposal.id)) {
          useLedgerStore.getState().updateLineItem(tx.id, item.id, { receiptProposal: undefined });
        }
      }
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
            className="curate-action w-full rounded-md cta-solid px-3 font-semibold active:opacity-80"
          >
            {receiptBusy ? 'Saving…' : receiptProposal?.status === 'pending' ? 'Update receipt' : 'Add to Ledger'}
          </button>
        </div>
      )}

      {justAddedToLedger && (
        <div className="curate-support rounded-md bg-tea-accent-sub p-3">
          <div className="flex items-center gap-2 font-medium text-tea-gold">
            <Check size={16} />
            Added to Ledger
          </div>
          {!receiptProposal && receiptAcquisition === 'purchase' && <p className="mt-2 text-ui-12 text-tea-text-sec">Confirm this draft in Ledger. Inventory changes only after you accept its receipt.</p>}
          {receiptProposal && (
            <div className="mt-2 space-y-2 text-ui-12 text-tea-text-sec">
              <p>Review receipt: {receiptProposal.quantity} {receiptProposal.quantity === 1 ? 'unit' : 'units'} · {receiptProposal.purpose} · {receiptProposal.acquisition_kind.replace('_', ' ')}</p>
              <p>Inventory changes only after you accept this receipt.</p>
              <div className="flex justify-between gap-3 border-t border-tea-border pt-2">
                <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('reject')} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">Reject</button>
                <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('accept')} className="tap-target min-h-11 rounded-md cta-solid px-4 font-semibold">Accept into Inventory</button>
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

  // ── Pieces shared by both layouts ('classic' and 'flow') and both forms.
  // Each piece is the same element in either order: same handlers, test ids
  // and labels. Only where it sits changes.
  const decisionControl = (
        <DecisionControl value={entry.decision} onChange={(decision) => update({ decision })} />
  );
  const contextChips = (
          <CaptureContextChips
            category={entry.category}
            vendorName={entry.vendorName}
            vendorOpen={vendorOpen}
            onToggleVendor={() => setVendorOpen((v) => !v)}
            batchMode={batchMode}
            onToggleBatchMode={onToggleBatchMode}
            onShare={onShare}
          />
  );
  const vendorStripBlock = (
    <>
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
    </>
  );
  const encounterContext = (
              <EncounterContext journeyId={entry.journeyId} visitId={entry.visitId} onChange={(journeyId, visitId) => useTeaCompassStore.getState().setEncounterContext(entryId, journeyId, visitId)} />
  );
  const photoCapture = (
            <PhotoCapture
              onExtracted={handleExtracted}
              onPhotoTaken={handlePhotoTaken}
              onPhotoReplaced={handlePhotoReplaced}
              photos={entry.photos}
              onRemovePhoto={(i) => updateEntry(entryId, { photos: entry.photos.filter((_, idx) => idx !== i) })}
              variant="strip"
              {...(flowLayout ? { scanTarget: scanSlot, stripTarget: stripSlot } : {})}
            />
  );
  const noteThread = (part: 'all' | 'composer' | 'list') => (
        <NoteThread
          compassEntryId={entry.id}
          teaKey={entry.teaKey ?? undefined}
          compact
          hideTastingArtifacts
          sans
          part={part}
        />
  );
  const notesThread = (
    <>
        <FieldLabel>Notes</FieldLabel>
        {noteThread('all')}
    </>
  );
  const intentBar = (
          <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />
  );

  // 'flow' (curate/CaptureFlowLayout.tsx): the context chips as a Library supplier header.
  const supplierHeader = (
          <CaptureContextChips
            category={entry.category}
            vendorName={entry.vendorName}
            vendorOpen={vendorOpen}
            onToggleVendor={() => setVendorOpen((v) => !v)}
            batchMode={batchMode}
            onToggleBatchMode={onToggleBatchMode}
            onShare={onShare}
            variant="supplier"
            secondLine={encounterContext}
          />
  );

  // ── Teaware card layout ──────────────────────────────────────────────
  if (isTeaware) {
    const hasTeawareName = (entry.name || '').trim().length > 0;
    const isYixing = entry.material === 'Yixing'
      || (['Zhuni', 'Zisha', 'Duanni', 'Hongni'] as string[]).includes(entry.material || '');
    // Surface the legacy-stored clay name (from before Yixing rollup) as a subtype label.
    const legacyClay = (['Zhuni', 'Zisha', 'Duanni', 'Hongni'] as const).includes(entry.material as never)
      ? (entry.material as YixingClayType)
      : undefined;
    const effectiveClayType: YixingClayType | undefined = entry.clayType || legacyClay;

    const materialChipLabel = isYixing ? 'Yixing' : (entry.material || 'Material');
    const materialDisplayLabel = effectiveClayType ? `${materialChipLabel} · ${effectiveClayType}` : materialChipLabel;
    const supportsCapacity = (['Pot', 'Cup', 'Gaiwan', 'Fair Cup'] as TeawareCategory[]).includes(entry.teawareCategory as TeawareCategory);
    const categorySheetId = `teaware-category-${entry.id}`;
    const materialSheetId = `teaware-material-${entry.id}`;
    const eraSheetId = `teaware-era-${entry.id}`;

    const teawareNameInput = (
          <input
            type="text"
            value={entry.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Teaware name"
            className={`w-full ${nameHeadlineClass}`}
          />
    );
    const teawareCategoryButton = (
            <button
              type="button"
              onClick={() => setCategoryPopoverOpen(true)}
              className={flowLayout ? `${flowCell} flex-1` : 'curate-field curate-field-with-label relative flex min-w-0 items-center justify-between px-2 text-left'}
              aria-label={`Category: ${entry.teawareCategory || 'Choose'}`}
              aria-haspopup="dialog"
              aria-expanded={categoryPopoverOpen}
              aria-controls={categorySheetId}
            >
              {flowLayout ? (
                <span className={flowValue(!!entry.teawareCategory)}>{entry.teawareCategory || 'Category'}</span>
              ) : (
                <>
              <span className="curate-floating-label">Category</span>
              <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{entry.teawareCategory || 'Choose'}</span>
                </>
              )}
              <ChevronDown size={12} className={flowLayout ? 'shrink-0 text-tea-text-sec' : 'mt-1 shrink-0'} />
            </button>
    );
    const teawareMaterialButton = (
              <button
                type="button"
                onClick={() => {
                  setMaterialPopoverOpen(true);
                }}
                className={flowLayout ? `${flowCell} flex-1` : 'curate-field curate-field-with-label relative flex min-w-0 items-center justify-between px-2 text-left'}
                aria-label={`Material: ${materialDisplayLabel}`}
                aria-haspopup="dialog"
                aria-expanded={materialPopoverOpen || claySheetOpen}
                aria-controls={materialSheetId}
                data-curate-action
              >
                {flowLayout ? (
                  <span className={flowValue(!!entry.material)}>{materialDisplayLabel}</span>
                ) : (
                  <>
                <span className="curate-floating-label">Material</span>
                <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{materialDisplayLabel}</span>
                  </>
                )}
                <ChevronDown size={12} className={flowLayout ? 'shrink-0 text-tea-text-sec' : 'mt-1 shrink-0'} />
              </button>
    );
    const teawareClassificationRow = (
          <div className="grid grid-cols-2 gap-2" data-testid="curate-teaware-classification-row">
            {teawareCategoryButton}

              {teawareMaterialButton}
          </div>
    );
    const teawareOriginField = (
            <div className={flowLayout ? 'curate-flow-cell relative min-w-0 flex-1' : 'relative min-w-0 flex-1'}>
              {!flowLayout && <span className="curate-floating-label">Origin</span>}
              <AutocompleteInput
                value={entry.originRegion || ''}
                onChange={(val) => update({ originRegion: val || undefined })}
                suggestions={availableRegions}
                placeholder="Origin"
                className={flowLayout ? 'curate-flow-input w-full' : `curate-field-with-label w-full ${tallFieldClass}`}
                {...(flowLayout ? { ariaLabel: 'Origin' } : {})}
              />
            </div>
    );
    const teawareEraButton = (
            <button
              type="button"
              onClick={() => setEraSheetOpen(true)}
              className={flowLayout ? `${flowCell} shrink-0 justify-end tabular-nums` : 'curate-field curate-field-with-label relative flex w-20 shrink-0 items-center justify-between px-2 text-left tabular-nums'}
              aria-label={`Era: ${entry.era || 'Choose'}`}
              aria-haspopup="dialog"
              aria-expanded={eraSheetOpen}
              aria-controls={eraSheetId}
              data-curate-action
            >
              {flowLayout ? (
                <span className={flowValue(!!entry.era)}>{entry.era || 'Era'}</span>
              ) : (
                <>
              <span className="curate-floating-label">Era</span>
              <span className="curate-support min-w-0 truncate pt-1 font-medium text-tea-text">{entry.era || 'Choose'}</span>
                </>
              )}
              <ChevronDown size={12} className={flowLayout ? 'shrink-0 text-tea-text-sec' : 'mt-1 shrink-0'} />
            </button>
    );
    const teawareCapacityField = (
      <>
            {supportsCapacity && (
              <div className={flowLayout ? 'curate-flow-cell relative w-28 shrink-0' : 'relative w-20 shrink-0'}>
                {!flowLayout && <span className="curate-floating-label">Capacity</span>}
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Capacity (ml)"
                  value={entry.capacityMl ?? ''}
                  onChange={(event) => update({ capacityMl: event.target.value === '' ? undefined : Number(event.target.value) })}
                  placeholder={flowLayout ? 'Capacity' : 'ml'}
                  className={flowLayout ? 'curate-flow-input w-full pr-6 text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' : `curate-field-with-label w-full pl-2 pr-6 text-center tabular-nums ${fieldClass}`}
                />
                {entry.capacityMl != null && (
                  <span className={flowLayout ? 'curate-support pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec' : 'curate-support pointer-events-none absolute bottom-1.5 right-2 text-tea-text-dim'}>ml</span>
                )}
              </div>
            )}
      </>
    );
    const teawareProvenanceRow = (
          <div className="flex items-end gap-2" data-testid="curate-teaware-provenance-row">
            {teawareOriginField}
            {teawareEraButton}
            {teawareCapacityField}
          </div>
    );
    const teawareSheets = (
      <TeawareSheets
        entry={entry}
        update={update}
        isYixing={isYixing}
        effectiveClayType={effectiveClayType}
        categoryPopoverOpen={categoryPopoverOpen} setCategoryPopoverOpen={setCategoryPopoverOpen}
        materialPopoverOpen={materialPopoverOpen} setMaterialPopoverOpen={setMaterialPopoverOpen}
        claySheetOpen={claySheetOpen} setClaySheetOpen={setClaySheetOpen}
        eraSheetOpen={eraSheetOpen} setEraSheetOpen={setEraSheetOpen}
        categorySheetId={categorySheetId} materialSheetId={materialSheetId} eraSheetId={eraSheetId}
      />
    );
    const teawarePurchaseInner = (
      <>
        {!flowLayout && <QuietEyebrow label="Purchase" className="!mb-1 lg:!mb-1.5" />}
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
      </>
    );
    const teawarePurchaseCluster = (
        <section className={`curate-cluster curate-zone-purchase space-y-1 lg:space-y-1.5 ${phoneClusterPad}`} data-testid="curate-cluster-buying" data-zone="purchase">
        {teawarePurchaseInner}
        </section>
    );
    const teawareActionFooter = (primaryLast: boolean) => (
        <CaptureActionFooter
          primaryLast={primaryLast}
          className={primaryLast ? '' : 'curate-buy-actions curate-action-band border-t border-tea-border pt-1.5'}
          onBuy={toggleBuyPicker}
          onDone={handleCommit}
          doneEnabled={entryHasContent(entry)}
          buyExpanded={showBuyPicker}
          purchasePickerId={purchasePickerId}
        />
    );
    const teawareReceiptError = (
      <>
        {receiptError && !justAddedToLedger && <p role="alert" className="text-ui-12 text-tea-text-sec">{receiptError}</p>}
      </>
    );

    if (flowLayout) {
      return (
        <CaptureFlowLayout
          contextTestId="curate-teaware-context-band" bandTestId="curate-teaware-classification-row"
          typeName="" firstPhoto={(entry.photos || []).filter(Boolean)[0]} setScanSlot={setScanSlot} setStripSlot={setStripSlot}
          supplierHeader={supplierHeader} vendorStrip={vendorStripBlock} nameInput={teawareNameInput}
          band={<>{teawareCategoryButton}{teawareMaterialButton}{teawareEraButton}</>}
          subBand={<>{teawareOriginField}{teawareCapacityField}</>} subBandTestId="curate-teaware-provenance-row"
          purchase={teawarePurchaseInner} sheets={teawareSheets}
          photo={photoCapture} composer={noteThread('composer')} list={noteThread('list')} intent={intentBar} recordTools={recordTools}
          decision={decisionControl} actions={teawareActionFooter(true)} buyPanel={<>{teawareReceiptError}{renderTeawarePurchaseSection()}</>}
        />
      );
    }

    return (
      <div className={mobileShellClass} data-curate-source data-visual-layout="continuous-sheet">
        <div data-testid="curate-primary-workflow" className="space-y-0">
        {decisionControl}

        <div className={sourceShellClass} data-testid="curate-teaware-context-band" data-zone="context">
          {contextChips}

          {vendorStripBlock}

          <div className="flex min-w-0 items-center gap-1 border-t border-tea-border">
            <div className="min-w-0 flex-1">
              {encounterContext}
            </div>
            <div className="shrink-0">
            {photoCapture}
            </div>
          </div>
        </div>

        <section className={`curate-cluster curate-zone-identity space-y-1 lg:space-y-2 ${phoneClusterPad}`} data-testid="curate-cluster-identity" data-zone="identity">
          <QuietEyebrow label="Teaware" />
          {teawareNameInput}

          {teawareClassificationRow}

          {teawareProvenanceRow}

          {teawareSheets}
        </section>

        {teawarePurchaseCluster}

        {recordTools}

        <section className={`curate-cluster curate-zone-notes space-y-1 lg:space-y-1.5 ${phoneClusterPad}`} data-testid="curate-cluster-notes" data-zone="notes">
        {notesThread}
        <div className="curate-intent-inline">
          {intentBar}
        </div>
        {teawareActionFooter(false)}
        </section>
        {teawareReceiptError}
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
  // Tea name, the hero. Large display serif, still just a bottom hairline.
  // This is the ONE serif element in the capture form, everything else
  // below is font-sans so the form reads as one typographic system.
  // ── Tea card layout ────────────────────────
  const backToLibrary = (
    <>
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
    </>
  );
  const teaNameInput = (
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
  );
  const originField = (
          <div className={flowLayout ? 'curate-flow-cell relative min-w-0 flex-1' : 'relative min-w-0 flex-1'}>
            {!flowLayout && <span className="curate-floating-label">Origin</span>}
            <AutocompleteInput
              value={entry.originRegion || ''}
              onChange={(val) => {
                userTapped.current.add('region');
                const updates: Record<string, unknown> = { originRegion: val || undefined };
                if (val) fillOriginCountry(val, entry.originCountry, updates);
                update(updates);
              }}
              suggestions={availableRegions}
              placeholder={flowLayout ? 'Origin' : 'e.g. Yiwu'}
              className={flowLayout ? 'curate-flow-input w-full' : `curate-field-with-label w-full ${fieldClass}`}
              {...(flowLayout ? { ariaLabel: 'Origin' } : {})}
            />
          </div>
  );
  const yearField = (
          <div className={flowLayout ? 'curate-flow-cell relative w-[4.5rem] shrink-0' : 'relative w-20 shrink-0'}>
            {!flowLayout && <span className="curate-floating-label">Year</span>}
            <input
              data-testid="curate-year-control"
              type="number"
              inputMode="numeric"
              {...(flowLayout ? { 'aria-label': 'Year' } : {})}
              placeholder={flowLayout ? 'Year' : '2019'}
              value={entry.year ?? ''}
              onChange={(e) => {
                userTapped.current.add('year');
                const val = e.target.value;
                update({ year: val === '' ? undefined : Number(val) });
              }}
              className={flowLayout ? 'curate-flow-input w-full text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' : `curate-field-with-label w-full tabular-nums text-center ${fieldClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              style={{ MozAppearance: 'textfield' } as React.CSSProperties}
            />
          </div>
  );
  const originYearRow = (
        <div className="flex items-end gap-2">
          {originField}
          {yearField}
        </div>
  );
  const chineseNameField = (
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
  );
  const typeButton = (
          <button
            type="button"
            onClick={() => setTypePopoverOpen(true)}
            className={flowLayout ? `${flowCell} shrink-0` : 'curate-field curate-field-with-label relative flex w-20 shrink-0 items-center justify-between px-2 text-left'}
            style={entry.type ? { color: getTypeChipStyle(entry.type).text } : undefined}
            aria-label="Tea type"
            data-testid="curate-type-control"
          >
            {flowLayout ? (
              <span className={`curate-flow-value min-w-0 truncate ${entry.type ? 'text-current' : 'text-tea-text-dim'}`}>{entry.type || 'Type'}</span>
            ) : (
              <>
            <span className="curate-floating-label">Type</span>
            <span className="curate-support min-w-0 truncate pt-1 font-medium text-current">{entry.type || 'Choose'}</span>
              </>
            )}
            <ChevronDown size={12} className={flowLayout ? 'shrink-0 text-tea-text-sec' : 'mt-1 shrink-0'} />
          </button>
  );
  const chineseTypeRow = (
        <div className="flex items-end gap-2" data-testid="curate-chinese-type-row">
          {chineseNameField}
          {typeButton}
        </div>
  );
  const typeSheet = (
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
  );
  const teaPurchaseInner = (
    <>
        {!flowLayout && <QuietEyebrow label="Purchase" className="!mb-1 lg:!mb-1.5" />}
        <div className="space-y-1 lg:space-y-2">
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

          {/* Retail price preview, only for tea with cost + grams entered */}
          {entry.category === 'tea' && entry.priceAmount != null && entry.pricePerUnitGrams && !unitBased && (
            <RetailPricePreview
              costAmount={entry.priceAmount}
              grams={entry.pricePerUnitGrams}
              currency={entry.priceCurrency}
              {...(flowLayout ? { oneLine: true } : {})}
            />
          )}
        </div>
    </>
  );
  const teaPurchaseCluster = (
      <section className={`curate-cluster curate-zone-purchase space-y-1 lg:space-y-1.5 ${phoneClusterPad}`} data-testid="curate-cluster-buying" data-zone="purchase">
        {teaPurchaseInner}
      </section>
  );
  const teaDetailsWith = (leading?: React.ReactNode, bare?: boolean) => (
    <>
      {entry.category === 'tea' && <StructuredTeaFields entry={entry} onChange={update} tightTop leading={leading} bare={bare} />}
    </>
  );
  const duplicateNudge = (
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
  );
  const extractionConfirmation = (
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
  );
  const tasteButton = (flow: boolean) => (
            <button
              type="button"
              onClick={openTastingOverlay}
              {...(flow ? { 'aria-label': hasTasting ? 'Edit tasting profile' : 'Taste: add tasting profile', 'data-testid': 'curate-taste-button' } : {})}
              className={flow ? 'curate-action curate-compact-target w-full min-w-0' : 'curate-profile-entry curate-compact-target min-w-0 flex-1 justify-center border-b border-tea-border text-center text-tea-text transition-colors hover:text-tea-gold lg:w-full'}
              data-curate-action
            >
              {flow
                ? <span className="curate-compact-chrome w-full border border-tea-border bg-tea-surface text-tea-text-sec hover:text-tea-text" data-curate-compact-chrome>{hasTasting ? 'Edit tasting' : 'Taste'}</span>
                : <span className="curate-support">{hasTasting ? 'Edit tasting profile' : 'Add tasting profile'}</span>}
            </button>
  );
  const tasteEntryRow = (
          <div className="flex items-center gap-2 lg:block">
            <QuietEyebrow label="Taste" className="!mb-0 shrink-0 lg:!mb-3" />
            {tasteButton(false)}
          </div>
  );
  // The ten quality buttons, one set for both layouts ('flow' styles them in
  // card-utilities.css; 'classic' keeps its segment toggle look).
  const qualityButtons = (flow: boolean) => [1,2,3,4,5,6,7,8,9,10].map((v, i) => {
                const isSelected = entry.tasting?.quality === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleQualityChange(v)}
                    role="radio"
                    aria-checked={isSelected}
                    className={flow ? 'curate-support tabular-nums' : `curate-support tabular-nums flex-1 py-2.5 font-medium transition-all duration-150 min-h-[44px] relative z-[1] ${
                      isSelected ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                    }${i < 9 ? ' weight-seg-div' : ''}`}
                    data-curate-action
                    style={flow ? undefined : {
                      background: isSelected
                        ? 'radial-gradient(ellipse 120% 120% at 50% 50%, rgb(var(--tea-gold-rgb) / 0.14) 0%, rgb(var(--tea-gold-rgb) / 0.04) 70%)'
                        : 'transparent',
                    }}
                  >
                    {v}
                  </button>
                );
  });
  // 'flow': the quality scale as one slim row in the capture card, under
  // Photo and Taste (and the photos). Shown, and written, as in 'classic'.
  const qualityRow = hasTasting && entry.tasting ? (
    <div className="curate-flow-quality" data-testid="curate-quality-row">
      <span className="curate-support shrink-0 whitespace-nowrap text-tea-text-sec">
        Quality <span className="tabular-nums font-medium text-tea-text">{entry.tasting.quality != null ? `${entry.tasting.quality}/10` : '/10'}</span>
      </span>
      <div className="curate-flow-quality-scale" role="radiogroup" aria-label="Quality rating">
        {qualityButtons(true)}
      </div>
    </div>
  ) : null;
  const brewingAndWords = hasTasting && entry.tasting ? (
    <>
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
  ) : null;
  const tastingDetails = (
    <>
          {hasTasting && entry.tasting && (
            <>
          {/* Quality 1–10, same segment toggle as TastingSession */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="curate-support text-tea-text-sec" style={{ letterSpacing: '0.04em' }}>Quality</span>
              <span className="curate-support text-tea-gold tabular-nums font-medium">
                {entry.tasting.quality != null ? `${entry.tasting.quality}/10` : '/10'}
              </span>
            </div>
            <div className="tasting-segment-toggle" role="radiogroup" aria-label="Quality rating">
              {qualityButtons(false)}
            </div>
          </div>
          {brewingAndWords}
            </>
          )}
    </>
  );
  // 'flow': the brewing line and the tasting words stay with the saved notes.
  const tastingRest = hasTasting && entry.tasting ? brewingAndWords : null;
  const teaActionFooter = (primaryLast: boolean) => (
      <CaptureActionFooter
        primaryLast={primaryLast}
        className={primaryLast ? 'lg:hidden' : 'curate-buy-actions curate-action-band border-t border-tea-border pt-1 lg:hidden'}
        onBuy={toggleBuyPicker}
        onDone={handleCommit}
        onSample={primaryLast ? openSamplePicker : openTastingOverlay}
        doneEnabled={entryHasContent(entry)}
        buyExpanded={showBuyPicker}
        purchasePickerId={purchasePickerId}
      />
  );
  const storageSection = (
    <>
      {(entry.type === 'Sheng' || entry.type === 'Shou' || entry.type === 'Dark') && <section className="curate-section space-y-2">
          <QuietEyebrow label="Storage" />
          <div className="flex gap-1.5 flex-wrap">
            {STORAGE_STYLES.map((st) => (
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
    </>
  );
  const teaBuySection = (
      <section id={purchasePickerId} className={`${showBuyPicker || justAddedToLedger || isInLedger ? 'curate-section' : 'hidden'} space-y-2`}>
        <QuietEyebrow label={flowLayout && buyMode === 'sample' ? 'Sample' : 'Buy'} />
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

        {/* Buy quantity picker, expands upward from the sticky bar */}
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
                    {BUY_GRAM_CHIPS.map((g) => (
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
                  className="curate-action w-full rounded-md cta-solid px-3 font-semibold active:opacity-80"
                  data-curate-action
                >
                  {receiptBusy ? 'Saving…' : receiptProposal?.status === 'pending' ? 'Update receipt' : 'Add to Ledger'}
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
              {!receiptProposal && receiptAcquisition === 'purchase' && <p className="mt-2 text-ui-12 text-tea-text-sec">Confirm this draft in Ledger. Inventory changes only after you accept its receipt.</p>}
          {receiptProposal && (
                <div className="mt-2 space-y-2 text-ui-12 text-tea-text-sec">
                  <p>Review receipt: {receiptProposal.quantity}{receiptProposal.unit === 'g' ? 'g' : ` ${receiptProposal.quantity === 1 ? 'unit' : 'units'}`} · {receiptProposal.purpose} · {receiptProposal.acquisition_kind.replace('_', ' ')}</p>
                  <p className="text-tea-text-sec">Inventory changes only after you accept this receipt.</p>
                  <div className="flex justify-between gap-3 border-t border-tea-border pt-2">
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('reject')} className="tap-target min-h-11 text-tea-text-sec hover:text-tea-text">Reject</button>
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('accept')} className="tap-target min-h-11 rounded-md cta-solid px-4 font-semibold">Accept into Inventory</button>
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
  );
  const teaReceiptError = (
    <>
      {receiptError && !justAddedToLedger && <p role="alert" className="text-ui-12 text-tea-text-sec">{receiptError}</p>}
    </>
  );
  const tastingOverlay = (
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
            initialData={entry.tasting ?? entry.tastingHistory?.at(-1)?.data}
            onClose={closeTastingOverlay}
            onAfterSave={(data: TastingData, verdict) => {
              setLocalTasting(data);
              saveCurateTasting(entryId, data, verdict, { history: 'none' });
            }}
          />
        )}
      </AnimatePresence>
  );

  if (flowLayout) {
    return (
      <CaptureFlowLayout
        contextTestId="curate-context-band" bandTestId="curate-origin-type-year-row"
        typeName={entry.type || ''} firstPhoto={(entry.photos || []).filter(Boolean)[0]} setScanSlot={setScanSlot} setStripSlot={setStripSlot}
        backToLibrary={backToLibrary} supplierHeader={supplierHeader} vendorStrip={vendorStripBlock} nameInput={teaNameInput}
        band={<>{originField}{typeButton}{yearField}</>}
        purchase={teaPurchaseInner} sheets={typeSheet} afterIdentity={<>{duplicateNudge}{extractionConfirmation}</>}
        photo={photoCapture} taste={tasteButton(true)} quality={qualityRow} composer={noteThread('composer')} list={noteThread('list')} intent={intentBar} tasting={tastingRest}
        details={<>{teaDetailsWith(<div className="flex">{chineseNameField}</div>, true)}{storageSection}</>}
        recordTools={recordTools} decision={decisionControl} actions={teaActionFooter(true)} buyPanel={teaBuySection}
        outside={<>{teaReceiptError}{tastingOverlay}</>}
      />
    );
  }

  return (
    <div className={mobileShellClass} data-curate-source data-visual-layout="continuous-sheet">
      {backToLibrary}

      <div data-testid="curate-primary-workflow" className="space-y-0">
      {decisionControl}

      {/* Context chips row: Run + Vendor. Both stay sticky across a burst of
          captures (run via the session id, vendor via lastVendor seeding), so
          reopening the card mid-visit costs nothing. The old always-open
          "Select vendor" box collapses behind the Vendor chip. */}
      <div className={sourceShellClass} data-testid="curate-context-band" data-zone="context">
        {contextChips}

        {vendorStripBlock}

        <div className="flex min-w-0 items-center gap-1 border-t border-tea-border">
          <div className="min-w-0 flex-1">
            {encounterContext}
          </div>
          <div className="shrink-0">
          {photoCapture}
          </div>
        </div>
      </div>

      <section className={`curate-cluster curate-zone-identity space-y-1 lg:space-y-2 ${phoneClusterPad}`} data-testid="curate-cluster-identity" data-zone="identity">
        {teaNameInput}

        {originYearRow}

        {chineseTypeRow}

        {typeSheet}
      </section>

      {teaPurchaseCluster}

      {teaDetailsWith()}
      {recordTools}

      {duplicateNudge}

      {extractionConfirmation}


      {/* These sections render inline, always visible: Adrian uses them
          regularly (tasting profile, notes, intent, storage, sell price) and
          asked that they never sit behind a second tap. ─── */}

      {/* ─── Profile zone: quality bar + brewing + tag cloud ─── */}
      <section className={`curate-cluster curate-zone-taste space-y-1 lg:space-y-1.5 ${phoneClusterPad}`} data-testid="curate-cluster-tasting" data-zone="taste">
          {tasteEntryRow}
          {tastingDetails}
      {teaActionFooter(false)}
      {/* Notes and intent remain continuously available inside the same
          visually memorable Taste cluster rather than becoming two more
          full-weight sections. */}
      <div className="curate-zone-notes space-y-1 border-t border-tea-border pt-1 lg:space-y-1.5 lg:pt-2" data-testid="curate-notes-band" data-zone="notes">
        {notesThread}
        <div className="curate-intent-inline">
          {intentBar}
        </div>
      </div>
      </section>
      </div>

      {storageSection}


      {teaBuySection}

      {teaReceiptError}
      {/* ─── Tasting overlay ─── */}
      {tastingOverlay}

    </div>
  );
};

export default CaptureCard;
