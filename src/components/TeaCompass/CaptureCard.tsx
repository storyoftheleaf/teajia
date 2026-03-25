import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronDown, Droplets, Minus, Plus, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import type { TeaType, TeaForm, Season, Storage, CompassStatus, TeawareCategory, TeawareMaterial, TeawareEra, VendorDetails, TeaCompassEntry } from './types';
import { DEFAULT_GRAMS, TEA_TYPES, TEA_FORMS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, COMMON_REGIONS } from './types';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
import { DetailsRow } from './DetailsRow';
import { PriceGrams } from './PriceGrams';
import { NotesField } from './NotesField';
import { StatusActions } from './StatusActions';
import { TastingFlow } from '../tasting/TastingFlow';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { parseTeaInput } from './InputParser';
import { PhotoCapture } from './PhotoCapture';
import type { ExtractedTeaData } from './PhotoCapture';
import { TeawarePhotos } from './TeawarePhotos';
import { DuplicateNudge } from './DuplicateNudge';

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

interface CaptureCardProps {
  entryId: string;
  /** Called when user adds an item to the ledger, to switch to ledger tab */
  onSwitchToLedger?: () => void;
}

const EMPTY_TASTING: TastingData = {};

/** Get chip color for a tea type */
function getTypeChipStyle(type: TeaType): { bg: string; text: string } {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return { bg: `${color}20`, text: color };
}

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const lastVendorId = useTeaCompassStore((s) => s.lastVendorId);
  const lastVendorName = useTeaCompassStore((s) => s.lastVendorName);

  const [tastingOverlayOpen, setTastingOverlayOpen] = useState(false);
  const [localTasting, setLocalTasting] = useState<TastingData>(EMPTY_TASTING);

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

  // Also include compass entry names in suggestions
  const allNameSuggestions = useMemo(() => {
    const compassNames = allEntries
      .filter((e) => e.id !== entryId && e.name.trim().length > 0)
      .map((e) => e.name);
    return [...new Set([...productNames, ...compassNames])];
  }, [productNames, allEntries, entryId]);

  // Build fuse index from other entries (exclude current)
  const fuseIndex = useMemo(() => {
    const others = allEntries.filter((e) => e.id !== entryId && e.name.trim().length > 0);
    return new Fuse(others, {
      keys: ['name'],
      threshold: 0.3,
      distance: 100,
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
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typePopoverOpen, formPopoverOpen]);

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

  // ── Guard: entry must exist (after all hooks) ─────────────────────────

  if (!entry) return null;

  const isTeaware = entry.category === 'teaware';
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

  const openTastingOverlay = () => {
    setLocalTasting(entry.tasting || EMPTY_TASTING);
    setTastingOverlayOpen(true);
  };

  const closeTastingOverlay = () => {
    // Persist local tasting data to the store
    update({ tasting: localTasting });
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

  // ── Teaware card layout ──────────────────────────────────────────────
  if (isTeaware) {
    const materials = TEAWARE_MATERIALS[entry.teawareCategory || ''] || TEAWARE_MATERIALS.default;
    const hasTeawareName = (entry.name || '').trim().length > 0;

    return (
      <div className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-3">
        {/* Panel 1: Identity — Photo + Name */}
        <div className="bg-tea-surface/40 rounded-lg p-3 space-y-3">
          <TeawarePhotos
            photos={entry.photos}
            onPhotosChange={handleTeawarePhotosChange}
          />

          <VendorStrip
            vendorName={entry.vendorName}
            vendorId={entry.vendorId}
            vendorDetails={entry.vendorDetails}
            onVendorSelect={handleVendorSelect}
            onClear={handleVendorClear}
            onDetailsChange={handleVendorDetailsChange}
          />

          <input
            type="text"
            value={entry.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="What is it?"
            className="w-full bg-tea-bg/50 text-tea-text text-lg rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors placeholder:text-tea-text-dim"
          />
        </div>

        {/* Panel 2: Price */}
        <div className="bg-tea-surface/40 rounded-lg p-3 space-y-1.5">
          <label className="text-[11px] text-tea-text-dim uppercase tracking-wider block mb-1.5">Price</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={entry.priceAmount ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              update({ priceAmount: val === '' ? undefined : Number(val) });
            }}
            className="w-full bg-tea-bg/50 text-tea-text rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors text-base tabular-nums"
          />
          <div className="flex gap-1 flex-wrap pt-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleCurrencyChange(c.value)}
                className={entry.priceCurrency === c.value ? 'pill-active' : 'pill'}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status — standalone, not in panel */}
        <StatusActions
          status={entry.status}
          onStatusChange={(status: CompassStatus) => update({ status })}
          entry={entry}
          onAddedToLedger={onSwitchToLedger}
        />

        {/* Layer 2: Category, Material, Notes (when name has content) */}
        <AnimatePresence>
          {hasTeawareName && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden space-y-3"
            >
              {/* Panel 3: Category & Material */}
              <div className="bg-tea-surface/40 rounded-lg p-3 space-y-3">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">Category</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TEAWARE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const updates: Record<string, unknown> = { teawareCategory: cat };
                        if (entry.teawareCategory !== cat) {
                          updates.material = undefined;
                        }
                        update(updates);
                      }}
                      className={entry.teawareCategory === cat ? 'tag-selectable-active' : 'tag-selectable'}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Material */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">Material</label>
                <div className="flex gap-1.5 flex-wrap">
                  {materials.map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => update({ material: mat })}
                      className={entry.material === mat ? 'tag-selectable-active' : 'tag-selectable'}
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>
              </div>

              {/* Panel 4: Notes */}
              <div className="bg-tea-surface/40 rounded-lg p-3">
              <NotesField
                notes={entry.notes}
                onNotesChange={(notes) => update({ notes })}
              />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layer 3: Collapsible details — Capacity, Era, Quantity */}
        {hasTeawareName && (
          <TeawareDetailsCollapsible
            capacityMl={entry.capacityMl}
            era={entry.era}
            quantity={entry.quantity}
            onCapacityChange={(capacityMl) => update({ capacityMl })}
            onEraChange={(era) => update({ era })}
            onQuantityChange={(quantity) => update({ quantity })}
          />
        )}
      </div>
    );
  }

  // ── Tea card layout — progressive disclosure ────────────────────────
  return (
    <div className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-3">
      {/* ─── LAYER 1: Always visible ─── */}

      {/* Panel 1: Identity — vendor + name + photo */}
      <div className="bg-tea-surface/40 rounded-lg p-3 space-y-3">
        <VendorStrip
          vendorName={entry.vendorName}
          vendorId={entry.vendorId}
          vendorDetails={entry.vendorDetails}
          onVendorSelect={handleVendorSelect}
          onClear={handleVendorClear}
          onDetailsChange={handleVendorDetailsChange}
        />

        <div className="flex items-center gap-2">
          <AutocompleteInput
            value={entry.name}
            onChange={(val) => update({ name: val })}
            suggestions={allNameSuggestions}
            placeholder="What are you tasting?"
            className="w-full bg-tea-bg/50 text-tea-text text-lg rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors min-w-0 placeholder:text-tea-text-sec/50"
            onSelect={handleNameAutocompleteSelect}
            itemData={productNameMap}
          />
          <PhotoCapture onExtracted={handleExtracted} onPhotoTaken={handlePhotoTaken} />
        </div>
      </div>

      {/* 2a. Duplicate nudge */}
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

      {/* 2b. Extraction confirmation */}
      <AnimatePresence>
        {extractionSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden -mt-2"
          >
            <p className="text-[11px] text-tea-gold tracking-wide truncate">
              {extractionSummary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel 2: Price & Grams */}
      <div className="bg-tea-surface/40 rounded-lg p-3">
        <PriceGrams
          priceAmount={entry.priceAmount}
          priceCurrency={entry.priceCurrency}
          pricePerUnitGrams={entry.pricePerUnitGrams}
          form={entry.form}
          onPriceChange={(priceAmount) => update({ priceAmount })}
          onCurrencyChange={handleCurrencyChange}
          onGramsChange={(pricePerUnitGrams) => update({ pricePerUnitGrams })}
        />
      </div>

      {/* Status — standalone, not in panel */}
      <StatusActions
        status={entry.status}
        onStatusChange={(status: CompassStatus) => update({ status })}
        entry={entry}
        onAddedToLedger={onSwitchToLedger}
      />

      {/* ─── LAYER 2: Reveals when name has content ─── */}
      <AnimatePresence>
        {hasName && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden space-y-3"
          >
            {/* Panel 3: Type & Form */}
            <div className="bg-tea-surface/40 rounded-lg p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type chip */}
              <div className="relative" ref={typePopoverRef}>
                <button
                  type="button"
                  onClick={() => { setTypePopoverOpen(!typePopoverOpen); setFormPopoverOpen(false); }}
                  className="pill"
                  style={entry.type ? {
                    backgroundColor: getTypeChipStyle(entry.type).bg,
                    color: getTypeChipStyle(entry.type).text,
                  } : undefined}
                >
                  {entry.type || 'Type'}
                </button>

                <AnimatePresence>
                  {typePopoverOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-lg p-2 shadow-lg border border-tea-border/30"
                    >
                      <div className="grid grid-cols-3 gap-1.5" style={{ minWidth: '200px' }}>
                        {TEA_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleTypeSelect(type)}
                            className={`${entry.type === type ? 'pill-active' : 'pill'} py-2`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Form chip */}
              <div className="relative" ref={formPopoverRef}>
                <button
                  type="button"
                  onClick={() => { setFormPopoverOpen(!formPopoverOpen); setTypePopoverOpen(false); }}
                  className={entry.form ? 'pill-active' : 'pill'}
                >
                  {entry.form ? `${entry.form}${entry.pricePerUnitGrams ? ` ${entry.pricePerUnitGrams}g` : ''}` : 'Form'}
                </button>

                <AnimatePresence>
                  {formPopoverOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-lg p-2 shadow-lg border border-tea-border/30"
                    >
                      <div className="grid grid-cols-3 gap-1.5" style={{ minWidth: '180px' }}>
                        {TEA_FORMS.map((form) => (
                          <button
                            key={form}
                            type="button"
                            onClick={() => handleFormSelect(form)}
                            className={`${entry.form === form ? 'pill-active' : 'pill'} py-2`}
                          >
                            {form}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </div>

            {/* Panel 4: Notes */}
            <div className="bg-tea-surface/40 rounded-lg p-3">
              <NotesField
                notes={entry.notes}
                onNotesChange={(notes) => update({ notes })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LAYER 3: Details collapsible ─── */}
      {hasName && (
        <DetailsRow
          year={entry.year}
          season={entry.season}
          storage={entry.storage}
          originRegion={entry.originRegion}
          teaType={entry.type}
          chineseName={entry.chineseName}
          tasting={entry.tasting}
          hasTasting={!!hasTasting}
          availableRegions={availableRegions}
          onYearChange={(year) => { userTapped.current.add('year'); update({ year }); }}
          onSeasonChange={(season) => { userTapped.current.add('season'); update({ season }); }}
          onStorageChange={(storage) => { userTapped.current.add('storage'); update({ storage }); }}
          onRegionChange={(originRegion) => { userTapped.current.add('region'); update({ originRegion }); }}
          onChineseNameChange={(chineseName) => update({ chineseName: chineseName || undefined })}
          onOpenTasting={openTastingOverlay}
          onTastingStripRemove={handleTastingStripRemove}
        />
      )}

      {/* ─── Tasting overlay ─── */}
      <AnimatePresence>
        {tastingOverlayOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-tea-bg flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-tea-border shrink-0">
              <h2 className="text-tea-text text-sm font-medium tracking-wide">Tasting</h2>
              <button
                type="button"
                onClick={closeTastingOverlay}
                className="pill text-xs text-tea-text-sec"
              >
                Done
              </button>
            </div>

            {/* TastingFlow body */}
            <div className="flex-1 overflow-y-auto">
              <TastingFlow
                mode="customer"
                value={localTasting}
                onChange={setLocalTasting}
                teaType={entry.type}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Teaware Details Collapsible (Layer 3 for teaware) ─── */

interface TeawareDetailsCollapsibleProps {
  capacityMl?: number;
  era?: TeawareEra;
  quantity?: number;
  onCapacityChange: (val: number | undefined) => void;
  onEraChange: (val: TeawareEra | undefined) => void;
  onQuantityChange: (val: number) => void;
}

const TeawareDetailsCollapsible: React.FC<TeawareDetailsCollapsibleProps> = ({
  capacityMl,
  era,
  quantity,
  onCapacityChange,
  onEraChange,
  onQuantityChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasValues = capacityMl || era || (quantity && quantity > 1);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors w-full py-1"
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ChevronDown size={14} />
        </motion.span>
        <span>Details</span>
        {!expanded && hasValues && (
          <span className="text-tea-text-dim ml-1">
            {[
              capacityMl ? `${capacityMl}ml` : null,
              era,
              quantity && quantity > 1 ? `\u00D7${quantity}` : null,
            ]
              .filter(Boolean)
              .join(' / ')}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              {/* Capacity */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">Capacity (ml)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 120"
                  value={capacityMl ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onCapacityChange(val === '' ? undefined : Number(val));
                  }}
                  className="w-24 bg-tea-bg/50 text-tea-text rounded-md px-3 py-2 border border-tea-border/30 focus:border-tea-gold/50 outline-none transition-colors text-sm tabular-nums"
                />
              </div>

              {/* Era */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">Era</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TEAWARE_ERAS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => onEraChange(era === e ? undefined : e)}
                      className={era === e ? 'tag-selectable-active' : 'tag-selectable'}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity stepper */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-tea-text-dim uppercase tracking-wider">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(Math.max(1, (quantity || 1) - 1))}
                    className="pill w-9 h-9 flex items-center justify-center rounded-lg"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-tea-text text-lg font-medium tabular-nums min-w-[2ch] text-center">
                    {quantity || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange((quantity || 1) + 1)}
                    className="pill w-9 h-9 flex items-center justify-center rounded-lg"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaptureCard;
