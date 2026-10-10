import { RecordTools } from './RecordTools';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { StructuredTeaFields } from './StructuredTeaFields';
import { CardHeading, CardLine, PickLine, SheetRow } from './CardParts';
import { TasteRows } from './TasteRows';
import { currencyForNewPrice, orderLinePrice, pieceWeightGrams, shownCurrency } from './curateV2Model';
import { draftOrderFor, orderLineMoney, sameMoney } from './orderBuy';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useTeaCompassStore, entryHasContent } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import type { Currency } from '../../admin/types';
import type { CurateReceiptProposal, InventoryPurposeValue, ReceiptAcquisitionKind, TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import { buildVarietyDataMap, getTeaVarietyNames, getTeaVarietySuggestions } from '../../data/teaVarieties';
import { TEA_TYPES, TEA_FORMS, STORAGE_STYLES, REGION_NAMES, countryForRegion } from '../../wisdom';
import type { TeaType, TeaForm, TeawareCategory, TeawareMaterial, TeawareEra, YixingClayType, VendorDetails, TeaCompassEntry } from './types';
import { entryIsSample } from './types';
import { DEFAULT_GRAMS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, YIXING_CLAY_TYPES, MATERIAL_ORIGIN_DEFAULT, generateTeaKey } from './types';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { PricingRow } from './PricingRow';
import { NoteThread } from '../shared/NoteThread';
import { useLedgerStore } from '../../lib/ledgerStore';
import { BottomSheet } from './CurateSheet';
import { TastingSession } from '../tasting/TastingSession';
import { parseTeaInput } from './InputParser';
import { PhotoCapture } from './PhotoCapture';
import type { ExtractedTeaData } from './PhotoCapture';
import { DuplicateNudge } from './DuplicateNudge';
import { IntentBar } from './IntentBar';
import { EncounterContext } from './EncounterContext';
import { DecisionControl } from './DecisionControl';
import { CaptureContextChips } from './CaptureContextChips';
import { CaptureActionFooter } from './CaptureActionFooter';
import { useSampleUse } from './sampleUse';
import { curateShelfPreview } from './curatePricing';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';

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
  /** Ref populated with action callbacks, used by parent to render pinned action bar */
  actionRef?: React.MutableRefObject<CaptureCardActions | null>;
  /** Optional Share action rendered in the capture context/header cluster. */
  onShare?: () => void;
  purchasePickerId?: string;
  /** Opens the reviewed acquisition form when Library hands this entry off. */
  openPurchasePicker?: boolean;
  onBuyExpandedChange?: (expanded: boolean) => void;
  /** The full tasting closed (saved or left). Lets the screen that opened the form for the tasting alone step back. */
  onTastingClosed?: () => void;
  /** Rapid batch-entry mode state, surfaced inside the Run chip's sheet */
  batchMode?: boolean;
  onToggleBatchMode?: () => void;
}

const EMPTY_TASTING: TastingData = {};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NT: 'NT$', USD: '$', Yuan: '¥', MYR: 'RM', IDR: 'Rp', JPY: 'JP¥', HKD: 'HK$', UNK: '?',
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
  costAmount, grams, currency,
}: {
  costAmount: number;
  grams: number;
  currency: string;
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
      <CardLine label="Shelf" testId="curate-shelf-preview">
        <span className="min-w-0 flex-1 text-right font-mono text-ui-13 text-tea-text-sec">No exchange rate for {sym} yet, so the shelf price can't be worked out.</span>
      </CardLine>
    );
  }

  return (
    <CardLine label="Shelf" testId="curate-shelf-preview" className="flex-wrap py-2">
      <span className="flex min-w-0 flex-1 flex-col items-end gap-0.5 text-right">
        <span className="font-mono text-ui-15 font-medium tabular-nums text-tea-gold">≈ ${preview.retailPerGramUsd.toFixed(2)} / g</span>
        <span className="font-mono text-ui-12 tabular-nums text-tea-text-sec">{sym}{fmtGram(preview.costPerGramSource)}/g cost · {sym}{fmtGram(preview.freightPerKgSource)}/kg freight</span>
      </span>
    </CardLine>
  );
}

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit, onReturnToLibrary, actionRef, onShare, purchasePickerId = `capture-purchase-picker-${entryId}`, openPurchasePicker = false, onBuyExpandedChange, onTastingClosed, batchMode, onToggleBatchMode }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const tableCurrency = useTeaCompassStore((s) => s.lastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const lastVendorId = useTeaCompassStore((s) => s.lastVendorId);
  const lastVendorName = useTeaCompassStore((s) => s.lastVendorName);
  const customEras = useTeaCompassStore((s) => s.customEras);
  const addCustomEra = useTeaCompassStore((s) => s.addCustomEra);

  const addLineItem = useLedgerStore((s) => s.addLineItem);
  const transactions = useLedgerStore((s) => s.transactions);

  // The note thread (NoteThread) stores notes in the notes store, not on the
  // entry. Subscribe to the count for this entry so the Done button's readiness
  // (entryHasContent, which reads that store) re-evaluates the moment a note is
  // added or removed, otherwise the button would stay disabled until some
  // other re-render happened.
  const threadNoteCount = useNotesStore(
    (s) => s.notes.filter((n) => !n.deleted && n.compassEntryId === entryId).length
  );
  void threadNoteCount;

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
        // An amount in another money is never written into an order that is
        // counted in this one: the line keeps what was ordered.
        if (entry.priceAmount != null && !sameMoney(tx.currency, entry.priceCurrency)) continue;
        const { pricePerUnit: newPrice, priceIsPerGram: newIsPerGram } = orderLinePrice(entry);
        const blank = entry.priceAmount == null;
        if (item.pricePerUnit !== newPrice || item.priceIsPerGram !== newIsPerGram || !!item.unpriced !== blank) {
          updItem(tx.id, item.id, { pricePerUnit: newPrice, priceIsPerGram: newIsPerGram, unpriced: blank ? true : undefined });
        }
      }
    }
  }, [entry?.priceAmount, entry?.priceCurrency, entry?.pricePerUnitGrams, entry?.form, entry?.category]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Inside the era sheet: shows the "+ Add era" input row
  const [eraInputOpen, setEraInputOpen] = useState(false);
  const [eraInputValue, setEraInputValue] = useState('');
  const eraInputRef = useRef<HTMLInputElement>(null);

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
        // The label said which money; it beats a currency nobody chose.
        if (data.currency && !(entry.touchedFields ?? []).includes('priceCurrency')) {
          updates.priceCurrency = data.currency as Currency;
        }
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
      // The photos the tea has NOW: a second photo that finished uploading
      // first must not be written over by this one's older copy of the list.
      const current = useTeaCompassStore.getState().getEntry(entryId);
      if (!current) return;
      if (current.photos.includes(url)) return;
      updateEntry(entryId, { photos: [...current.photos, url] });
    },
    [entryId, updateEntry]
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
      const current = useTeaCompassStore.getState().getEntry(entryId);
      if (!current || oldUrl === newUrl) return;
      let changed = false;
      const updated = current.photos.map((u) => {
        if (u === oldUrl) {
          changed = true;
          return newUrl;
        }
        return u;
      });
      if (changed) updateEntry(entryId, { photos: updated });
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

  // "Same tea, new price?" Copy what was known about the earlier capture into
  // this one's EMPTY fields, never over anything already typed here.
  const handleCopyDetails = useCallback(() => {
    if (!duplicateMatch || !entry) return;
    const updates: Partial<TeaCompassEntry> = {};
    const fill = <K extends keyof TeaCompassEntry>(key: K) => {
      if ((entry[key] == null || entry[key] === '') && duplicateMatch[key] != null && duplicateMatch[key] !== '') {
        (updates as Record<string, unknown>)[key as string] = duplicateMatch[key];
      }
    };
    (['type', 'form', 'year', 'season', 'storage', 'originRegion', 'originCountry', 'chineseName', 'pricePerUnitGrams', 'vendorId', 'vendorName'] as const).forEach(fill);
    if (entry.priceAmount == null && duplicateMatch.priceAmount != null) {
      updates.priceAmount = duplicateMatch.priceAmount;
      updates.priceCurrency = duplicateMatch.priceCurrency;
    }
    if (Object.keys(updates).length) update(updates);
    dismissedDuplicateRef.current = duplicateMatch.id;
    setShowDuplicateNudge(false);
    setDuplicateMatch(null);
  }, [duplicateMatch, entry, update]);

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
  const recordTools = isPersistedRecord ? <RecordTools entityType="tea" entityId={entry.id} onChanged={() => {
    const account = useTeaCompassStore.getState().accountScopeId;
    if (account) void hydrateCompassEntries(account);
  }} /> : null;

  // The card runs edge to edge inside the tea screen, as TeaFace does; the
  // screen's own gutter is given back so the dividers reach both sides.
  const mobileShellClass = 'curate-v2 -mx-4 lg:mx-0';

  // ── Tasting overlay opener, hoisted so actionRef can reference it ──────
  const openTastingOverlay = () => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    // A tasting that began in the fast sheet carries on as the same tasting.
    useSampleUse.getState().begin(entry.id);
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

  // The money beside the price. A tea with no price whose currency was never
  // picked shows the open table's money (else Yuan), not a stamped 'NT'; it is
  // stored only when a price is typed next to it.
  const shownMoney = shownCurrency(entry, tableCurrency);
  const handlePriceChange = (priceAmount: number | undefined) => {
    const currency = priceAmount != null ? currencyForNewPrice(entry, tableCurrency) : undefined;
    update(currency ? { priceAmount, priceCurrency: currency } : { priceAmount });
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

  const togglePass = () => update({ decision: entry.decision === 'passed_on' ? null : 'passed_on' });

  // Who, where and the photo: shared by the tea and teaware cards.
  const contextBand = (
    <>
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
        <div className="border-b border-tea-border px-4 py-3">
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

      <EncounterContext journeyId={entry.journeyId} visitId={entry.visitId} onChange={(journeyId, visitId) => useTeaCompassStore.getState().setEncounterContext(entryId, journeyId, visitId)} />
      <CardLine label="Photo" className="py-2">
        <div className="min-w-0 flex-1">
          <PhotoCapture
            onExtracted={handleExtracted}
            onPhotoTaken={handlePhotoTaken}
            onPhotoReplaced={handlePhotoReplaced}
            photos={entry.photos}
            onRemovePhoto={(i) => updateEntry(entryId, { photos: (useTeaCompassStore.getState().getEntry(entryId)?.photos ?? entry.photos).filter((_, idx) => idx !== i) })}
            variant="strip"
          />
        </div>
      </CardLine>
    </>
  );

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
    void useSampleUse.getState().finish(entry.id);
    onTastingClosed?.();
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
    // The same drafts the tea screen's Buy uses: one per vendor and money, and
    // a tea with no vendor waits on "No vendor yet", where it cannot be
    // confirmed until someone is named.
    const txId = draftOrderFor(
      { name: entry.vendorName ?? '', id: entry.vendorId },
      entry.priceAmount != null ? (entry.priceCurrency || undefined) as Currency | undefined : undefined,
      (useTeaCompassStore.getState().lastCurrency || 'Yuan') as Currency,
    );
    const orderCurrency = (useLedgerStore.getState().transactions.find((t) => t.id === txId)?.currency ?? 'Yuan') as Currency;
    addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: unitBased ? undefined : buyingQty,
      quantityUnits: unitBased ? buyingQty : undefined,
      unitWeightGrams: pieceWeightGrams(entry) ?? undefined,
      ...orderLineMoney(entry, orderCurrency),
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

  // One buy picker for tea and teaware: the amount, what it comes to, why it is
  // coming in, and the single action that puts it on the order.
  const renderBuySection = () => {
    const showing = showBuyPicker || justAddedToLedger || isInLedger;
    const total = totalPrice != null ? totalPrice : (entry.priceAmount && unitBased ? buyingQty * entry.priceAmount : null);
    return (
      <section id={purchasePickerId} className={`${showing ? 'curate-v2' : 'hidden'}`} data-testid="curate-buy-section">
        <CardHeading title="Buy" />
        {isInLedger && (
          <div className="flex justify-end px-4 pt-1">
            <button type="button" onClick={onSwitchToLedger} className="curate-v2-word tap-target min-h-11">
              View purchases in ledger
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {showBuyPicker && !justAddedToLedger && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="curate-v2-line">
                <span className="curate-v2-label">Amount</span>
                <span className="flex flex-1 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBuyingQty(Math.max(buyStep, buyingQty - buyStep))}
                    className="curate-v2-frame is-tall"
                    data-curate-action
                    aria-label="Decrease buying quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    aria-label="Purchase quantity"
                    value={buyingQty}
                    onChange={(e) => setBuyingQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="curate-v2-field !w-16 !flex-none !text-center tabular-nums"
                  />
                  <span className="min-w-8 font-mono text-ui-13 text-tea-text-sec">{unitBased ? (buyingQty === 1 ? 'unit' : 'units') : 'g'}</span>
                  <button
                    type="button"
                    onClick={() => setBuyingQty(buyingQty + buyStep)}
                    className="curate-v2-frame is-tall"
                    data-curate-action
                    aria-label="Increase buying quantity"
                  >
                    +
                  </button>
                </span>
              </div>

              {total != null && (
                <div className="curate-v2-line">
                  <span className="curate-v2-label">Comes to</span>
                  <span className="flex-1 text-right font-mono text-ui-15 tabular-nums text-tea-gold">{CURRENCY_SYMBOLS[entry.priceCurrency || 'Yuan'] ?? ''}{Math.round(total).toLocaleString()}</span>
                </div>
              )}

              {!unitBased && (
                <div className="curate-v2-line flex-wrap gap-y-2 py-2" role="group" aria-label="Usual amounts">
                  <span className="curate-v2-label">Usual</span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                    {[50, 100, 150, 250, 357, 500].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setBuyingQty(g)}
                        aria-pressed={buyingQty === g}
                        className={`curate-v2-frame is-tall tabular-nums ${buyingQty === g ? 'is-on' : ''}`}
                        data-curate-action
                      >
                        {g} g
                      </button>
                    ))}
                  </span>
                </div>
              )}

              <label className="curate-v2-line">
                <span className="curate-v2-label">Inventory purpose</span>
                <select
                  aria-label="Inventory purpose"
                  value={receiptPurpose}
                  onChange={(event) => setReceiptPurpose(event.target.value as InventoryPurposeValue)}
                  className="curate-v2-select flex-1"
                >
                  <option value="working">Working</option>
                  <option value="sample">Sample</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              <label className="curate-v2-line">
                <span className="curate-v2-label">Acquisition</span>
                <select
                  aria-label="Acquisition"
                  value={receiptAcquisition}
                  onChange={(event) => setReceiptAcquisition(event.target.value as ReceiptAcquisitionKind)}
                  className="curate-v2-select flex-1"
                >
                  <option value="purchase">Purchase</option>
                  <option value="free_sample">Free sample</option>
                  <option value="gift">Gift</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <div className="px-4 pt-3">
                <button
                  type="button"
                  onClick={handleAddToLedger}
                  disabled={receiptBusy}
                  className="curate-v2-frame is-on is-tall is-wide uppercase tracking-[0.16em]"
                  data-curate-action
                >
                  {receiptBusy ? 'Adding…' : 'Add to order'}
                </button>
              </div>
            </motion.div>
          )}

          {justAddedToLedger && (
            <motion.div key="added" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-3">
              <p className="font-mono text-ui-13 text-tea-gold">Added to Ledger</p>
              {receiptProposal && (
                <div className="mt-2 space-y-2 text-ui-13 text-tea-text-sec">
                  <p className="font-mono">Review receipt: {receiptProposal.quantity}{receiptProposal.unit === 'g' ? 'g' : ` ${receiptProposal.quantity === 1 ? 'unit' : 'units'}`} · {receiptProposal.purpose} · {receiptProposal.acquisition_kind.replace('_', ' ')}</p>
                  <p className="font-body italic">Inventory changes only after you accept this receipt.</p>
                  <div className="flex items-center justify-between gap-3 border-t border-tea-border pt-2">
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('reject')} className="curate-v2-word tap-target min-h-11 text-tea-text-sec">Reject</button>
                    <button type="button" disabled={receiptBusy} onClick={() => reviewReceipt('accept')} className="curate-v2-frame is-on is-tall tap-target">Accept into Inventory</button>
                  </div>
                </div>
              )}
              {receiptError && (
                <div role="alert" className="mt-2 flex items-center justify-between gap-3 text-ui-13 text-tea-text-sec">
                  <span>{receiptError}</span>
                  {!receiptProposal && <button type="button" disabled={receiptBusy} onClick={handleAddToLedger} className="curate-v2-word tap-target min-h-11">Retry receipt</button>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    );
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
        const sameParent = entry.material === mat || (mat === 'Yixing' && isYixing);
        const updates: Record<string, unknown> = {
          material: mat,
          // Reopening the active material is navigation, not a destructive
          // change. Keep its selected clay until the user clears or replaces it.
          clayType: sameParent ? effectiveClayType : undefined,
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
      //, if entry.material is anything else, default to Yixing for the
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
      <div className={mobileShellClass} data-visual-layout="continuous-sheet">
        <div data-testid="curate-primary-workflow">
          <div className="border-b border-tea-border px-4 pb-1 pt-3">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Teaware name"
              aria-label="Teaware name"
              className="curate-v2-namefield"
            />
          </div>

          <section data-testid="curate-cluster-identity" data-zone="identity">
            <PickLine
              label="Category"
              value={entry.teawareCategory}
              onClick={() => setCategoryPopoverOpen(true)}
              ariaLabel={`Category: ${entry.teawareCategory || 'Choose'}`}
              ariaExpanded={categoryPopoverOpen}
              ariaControls={categorySheetId}
              testId="curate-teaware-category"
            />
            <PickLine
              label="Material"
              value={entry.material ? materialDisplayLabel : undefined}
              onClick={() => setMaterialPopoverOpen(true)}
              ariaLabel={`Material: ${materialDisplayLabel}`}
              ariaExpanded={materialPopoverOpen || claySheetOpen}
              ariaControls={materialSheetId}
            />
            <div className="curate-v2-line" data-testid="curate-teaware-provenance-row">
              <span className="curate-v2-label">Origin</span>
              <AutocompleteInput
                value={entry.originRegion || ''}
                onChange={(val) => update({ originRegion: val || undefined })}
                suggestions={availableRegions}
                placeholder="Origin"
                className="curate-v2-field is-name"
              />
            </div>
            <PickLine
              label="Era"
              value={entry.era}
              onClick={() => setEraSheetOpen(true)}
              ariaLabel={`Era: ${entry.era || 'Choose'}`}
              ariaExpanded={eraSheetOpen}
              ariaControls={eraSheetId}
            />
            {supportsCapacity && (
              <label className="curate-v2-line">
                <span className="curate-v2-label">Capacity</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Capacity (ml)"
                  value={entry.capacityMl ?? ''}
                  onChange={(event) => update({ capacityMl: event.target.value === '' ? undefined : Number(event.target.value) })}
                  placeholder="ml"
                  className="curate-v2-field tabular-nums"
                />
                {entry.capacityMl != null && <span className="font-mono text-ui-13 text-tea-text-sec" aria-hidden>ml</span>}
              </label>
            )}

            {/* Category, material, clay and era sheets remain specialist
                subflows; the card only carries their chosen values. */}
            <BottomSheet
              open={categoryPopoverOpen}
              onOpenChange={setCategoryPopoverOpen}
              title="Category"
              description="What kind of teaware is this?"
            >
              <div id={categorySheetId} className="curate-v2 flex flex-col">
                {TEAWARE_CATEGORIES.map((cat) => (
                  <SheetRow
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

            <BottomSheet
              open={eraSheetOpen}
              onOpenChange={(open) => {
                setEraSheetOpen(open);
                if (!open) { setEraInputOpen(false); setEraInputValue(''); }
              }}
              title="Era"
              description="When was this piece made?"
            >
              <div id={eraSheetId} className="curate-v2 flex flex-col">
                {allEras.map((eraName) => (
                  <SheetRow
                    key={eraName}
                    label={eraName}
                    selected={entry.era === eraName}
                    onSelect={() => handleEraPick(eraName)}
                  />
                ))}
                {eraInputOpen ? (
                  <div className="curate-v2-line">
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
                      className="curate-v2-field is-name"
                      style={{ textAlign: 'left' }}
                    />
                    <button
                      type="button"
                      onClick={commitCustomEra}
                      disabled={!eraInputValue.trim()}
                      className="curate-v2-frame is-on is-tall shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEraInputOpen(true)} className="curate-v2-sheetrow text-tea-gold">
                    <span>Add new era</span>
                  </button>
                )}
              </div>
            </BottomSheet>

            <BottomSheet
              open={materialPopoverOpen}
              onOpenChange={setMaterialPopoverOpen}
              title="Material"
              description={entry.teawareCategory ? `For ${entry.teawareCategory}` : undefined}
            >
              <div id={materialSheetId} className="curate-v2 flex flex-col">
                {materials.map((mat) => {
                  const isSelected = entry.material === mat || (mat === 'Yixing' && isYixing);
                  const hasSubtypes = mat === 'Yixing' || mat === 'Clay';
                  return (
                    <SheetRow
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

            <BottomSheet
              open={claySheetOpen}
              onOpenChange={setClaySheetOpen}
              title={entry.material === 'Clay' ? 'Clay subtype' : 'Yixing clay'}
              description="Pick the clay this piece is made from"
              large
            >
              <div className="curate-v2 space-y-2 p-2">
                <div className="grid grid-cols-2 gap-2.5">
                  {YIXING_CLAY_TYPES.map((clay) => {
                    const sel = effectiveClayType === clay.name;
                    return (
                      <button
                        key={clay.name}
                        type="button"
                        onClick={() => handleClayPick(clay.name)}
                        aria-pressed={sel}
                        className={`flex flex-col items-start gap-2 rounded-[3px] border p-3 text-left transition-colors ${
                          sel ? 'border-tea-gold' : 'border-tea-border hover:border-tea-gold'
                        }`}
                      >
                        <div
                          className="relative aspect-square w-full shrink-0 overflow-hidden rounded-[3px] border border-tea-border"
                          style={
                            clay.imageUrl
                              ? undefined
                              : {
                                  background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${clay.swatch} 78%, white 22%), ${clay.swatch} 62%, color-mix(in srgb, ${clay.swatch} 70%, black 30%) 100%)`,
                                }
                          }
                        >
                          {clay.imageUrl && (
                            <img src={clay.imageUrl} alt={clay.label} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="w-full min-w-0">
                          <div className={`truncate font-display text-ui-20 ${sel ? 'text-tea-gold' : 'text-tea-text'}`}>{clay.label}</div>
                          {clay.hint && <div className="mt-0.5 truncate font-mono text-ui-11 text-tea-text-sec">{clay.hint}</div>}
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
                    className="curate-v2-word tap-target min-h-11 w-full text-tea-text-sec"
                  >
                    Clear clay subtype
                  </button>
                )}
              </div>
            </BottomSheet>
          </section>

          <CardHeading title="Purchase" />
          <section data-testid="curate-cluster-buying" data-zone="purchase">
            <PricingRow
              priceAmount={entry.priceAmount}
              priceCurrency={shownMoney}
              onPriceChange={handlePriceChange}
              onCurrencyChange={handleCurrencyChange}
              unit={{
                mode: 'count',
                quantity: entry.quantity || 1,
                onQuantityChange: (quantity) => update({ quantity }),
              }}
            />
          </section>

          <CardHeading title="Where" />
          <div data-testid="curate-teaware-context-band" data-zone="context">
            {contextBand}
          </div>

          <div className="pt-4">
            <DecisionControl value={entry.decision} onChange={(decision) => update({ decision })} />
          </div>

          {recordTools}

          <CardHeading title="Notes" />
          <section className="curate-v2-notes px-4 pt-3" data-testid="curate-cluster-notes" data-zone="notes">
            <NoteThread
              compassEntryId={entry.id}
              teaKey={entry.teaKey ?? undefined}
              compact
              hideTastingArtifacts
            />
          </section>
          <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />
          <CaptureActionFooter
            onBuy={toggleBuyPicker}
            onDone={handleCommit}
            onPass={togglePass}
            passed={entry.decision === 'passed_on'}
            doneEnabled={entryHasContent(entry)}
            buyExpanded={showBuyPicker}
            purchasePickerId={purchasePickerId}
          />
          {renderBuySection()}
        </div>
      </div>
    );
  }

  // ── Tea card layout ────────────────────────
  // TeaFace with every field open: the name large, then one line per field,
  // Lora capitals on the left and the value on the right.
  return (
    <div className={mobileShellClass} data-visual-layout="continuous-sheet">
      {/* ← Library back link, shown when navigated from Library */}
      {onReturnToLibrary && (
        <button type="button" onClick={onReturnToLibrary} className="curate-v2-word tap-target flex min-h-11 items-center px-4 text-tea-text-sec hover:text-tea-text">
          ← Library
        </button>
      )}

      <div data-testid="curate-primary-workflow">
        <section data-testid="curate-cluster-identity" data-zone="identity">
          <div className="border-b border-tea-border px-4 pb-1 pt-3">
            <AutocompleteInput
              value={entry.name}
              onChange={(val) => update({ name: val })}
              suggestions={allNameSuggestions}
              placeholder="Tea name"
              className="curate-v2-namefield"
              onSelect={handleNameAutocompleteSelect}
              itemData={{ ...varietyNameMap, ...productNameMap }}
              hintSuggestions={hintSuggestions}
            />
          </div>

          <div className="curate-v2-line">
            <span className="curate-v2-label">Origin</span>
            <AutocompleteInput
              value={entry.originRegion || ''}
              onChange={(val) => {
                userTapped.current.add('region');
                const updates: Record<string, unknown> = { originRegion: val || undefined };
                if (val) fillOriginCountry(val, entry.originCountry, updates);
                update(updates);
              }}
              suggestions={availableRegions}
              placeholder="e.g. Yiwu"
              className="curate-v2-field is-name"
            />
          </div>
          <label className="curate-v2-line">
            <span className="curate-v2-label">Year</span>
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
              className="curate-v2-field tabular-nums"
            />
          </label>
          <div className="curate-v2-line" data-testid="curate-chinese-type-row">
            <span className="curate-v2-label">Chinese</span>
            <input
              type="text"
              value={entry.chineseName || ''}
              onChange={(e) => update({ chineseName: e.target.value || undefined })}
              placeholder="中文名"
              aria-label="Chinese name"
              className="curate-v2-field is-hanzi"
            />
            <button
              type="button"
              onClick={handleGenerateChineseName}
              disabled={!entry.name?.trim() || generatingChinese}
              className="curate-v2-word tap-target shrink-0"
              aria-label="Suggest Chinese name"
              title="Suggest Chinese name"
              data-testid="curate-chinese-suggest"
            >
              {generatingChinese ? '…' : 'suggest'}
            </button>
          </div>
          <PickLine
            label="Type"
            value={entry.type}
            onClick={() => setTypePopoverOpen(true)}
            ariaLabel="Tea type"
            testId="curate-type-control"
          />

          <BottomSheet
            open={typePopoverOpen}
            onOpenChange={setTypePopoverOpen}
            title="Tea type"
            description="What kind of tea is this?"
          >
            <div className="curate-v2 grid grid-cols-2 gap-2 px-2">
              {TEA_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  aria-pressed={entry.type === type}
                  className="curate-v2-choice"
                >
                  <span className="min-w-0 flex-1 truncate">{type}</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        </section>

        <CardHeading title="Purchase" />
        <section data-testid="curate-cluster-buying" data-zone="purchase">
          <PricingRow
            priceAmount={entry.priceAmount}
            priceCurrency={shownMoney}
            onPriceChange={handlePriceChange}
            onCurrencyChange={handleCurrencyChange}
            unit={{
              mode: 'grams',
              pricePerUnitGrams: entry.pricePerUnitGrams,
              onGramsChange: (pricePerUnitGrams) => update({ pricePerUnitGrams }),
              form: entry.form,
              onFormChange: handleFormSelect,
            }}
          />

          {/* Shelf price preview, only for tea with cost + grams entered */}
          {entry.category === 'tea' && entry.priceAmount && entry.pricePerUnitGrams && !unitBased && (
            <RetailPricePreview
              costAmount={entry.priceAmount}
              grams={entry.pricePerUnitGrams}
              currency={shownMoney}
            />
          )}
        </section>

        {entry.category === 'tea' && <StructuredTeaFields entry={entry} onChange={update} />}

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
              onCopyDetails={handleCopyDetails}
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
              className="overflow-hidden"
            >
              <p className="truncate px-4 pt-2 font-mono text-ui-13 text-tea-gold">{extractionSummary}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <CardHeading title="Where" />
        <div data-testid="curate-context-band" data-zone="context">
          {contextBand}
        </div>

        <div className="pt-4">
          <DecisionControl value={entry.decision} onChange={(decision) => update({ decision })} />
        </div>

        {recordTools}

        <CardHeading title="Taste" testId="curate-cluster-tasting" />
        <section data-zone="taste">
          {!hasTasting && (
            <button type="button" onClick={openTastingOverlay} className="curate-v2-line w-full text-left" data-curate-action>
              <span className="curate-v2-label">Profile</span>
              <span className="flex-1 text-right font-mono text-ui-13 text-tea-gold">Add tasting profile</span>
            </button>
          )}
          {hasTasting && entry.tasting && (
            <>
              <div className="curate-v2-line flex-wrap gap-y-2 py-3">
                <span className="curate-v2-label">Quality</span>
                <span className="flex-1 text-right font-mono text-ui-15 tabular-nums text-tea-gold">
                  {entry.tasting.quality != null ? `${entry.tasting.quality} / 10` : '/ 10'}
                </span>
                <div className="grid w-full grid-cols-5 gap-2" role="radiogroup" aria-label="Quality rating">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
                    const isSelected = entry.tasting!.quality === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleQualityChange(v)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`curate-v2-frame is-tall tabular-nums ${isSelected ? 'is-on' : ''}`}
                        data-curate-action
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(entry.tasting.brewingVessel || entry.tasting.brewingTemp || entry.tasting.brewingTime) && (
                <div className="curate-v2-line">
                  <span className="curate-v2-label">Brewed</span>
                  <span className="flex-1 truncate text-right font-mono text-ui-13 text-tea-text-sec">
                    {[entry.tasting.brewingVessel, entry.tasting.brewingTemp ? `${entry.tasting.brewingTemp}°C` : null, entry.tasting.brewingTime].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
              <TasteRows value={entry.tasting} onRemove={handleTastingStripRemove} />
            </>
          )}
        </section>

        <CaptureActionFooter
          className="lg:hidden"
          onBuy={toggleBuyPicker}
          onDone={handleCommit}
          onSample={openTastingOverlay}
          onPass={togglePass}
          passed={entry.decision === 'passed_on'}
          doneEnabled={entryHasContent(entry)}
          buyExpanded={showBuyPicker}
          purchasePickerId={purchasePickerId}
        />

        <CardHeading title="Notes" testId="curate-notes-band" />
        <section className="curate-v2-notes px-4 pt-3" data-zone="notes">
          <NoteThread
            compassEntryId={entry.id}
            teaKey={entry.teaKey ?? undefined}
            compact
            hideTastingArtifacts
          />
        </section>
        <IntentBar entry={entry} onApply={(updates) => update(updates as Record<string, unknown>)} />
      </div>

      {(entry.type === 'Sheng' || entry.type === 'Shou' || entry.type === 'Dark') && (
        <section className="curate-v2">
          <CardHeading title="Storage" />
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {STORAGE_STYLES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => { userTapped.current.add('storage'); update({ storage: entry.storage === st ? undefined : st }); }}
                aria-pressed={entry.storage === st}
                className="curate-v2-frame is-tall"
                data-curate-action
              >
                {st}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── Buy picker / ledger, shown below content when Buy is tapped ─── */}
      {renderBuySection()}

      {/* ─── Tasting overlay ─── */}
      <AnimatePresence>
        {tastingOverlayOpen && (
          <TastingSession
            className="curate-v2"
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
              useSampleUse.getState().markAnswered(entry.id);
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
