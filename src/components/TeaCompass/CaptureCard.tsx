import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Droplets, FlaskConical, Heart, Minus, Plus, ShoppingCart, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TEA_TYPE_COLORS } from '../../designTokens';
import type { Currency } from '../../admin/types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import type { TeaType, TeaForm, Season, Storage, CompassStatus, TeawareCategory, TeawareMaterial, TeawareEra, VendorDetails, TeaCompassEntry } from './types';
import { DEFAULT_GRAMS, TEA_TYPES, TEA_FORMS, SEASONS, STORAGE_OPTIONS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS, COMMON_REGIONS } from './types';
import { AutocompleteInput } from './AutocompleteInput';
import { api } from '../../lib/api';
import { VendorStrip } from './VendorStrip';
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
  /** Called when user commits/finalizes an entry */
  onCommit?: () => void;
}

const EMPTY_TASTING: TastingData = {};

/** Get chip color for a tea type */
function getTypeChipStyle(type: TeaType): { bg: string; text: string } {
  const color = TEA_TYPE_COLORS[type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
  return { bg: `${color}20`, text: color };
}

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId, onSwitchToLedger, onCommit }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
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

  const handleCommit = useCallback(() => {
    commitEntry(entryId);
    // Auto-start a new capture with the same vendor
    const cat = entry?.category || 'tea';
    const newId = startNewCapture(cat);
    setActiveEntry(newId);
    onCommit?.();
  }, [commitEntry, entryId, entry?.category, startNewCapture, setActiveEntry, onCommit]);

  // "Would buy" graduation: flip sample off, carry all data, move to acquisition
  const handleWouldBuyGraduation = useCallback(() => {
    update({ isSample: false, sampleWouldBuy: true, status: 'want' });
  }, [update]);

  // ── Guard: entry must exist (after all hooks) ─────────────────────────

  if (!entry) return null;

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
      <div className="bg-tea-surface rounded-lg p-3 space-y-4">
        {/* ─── IDENTITY ─── */}
        <div className="space-y-3">
          <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Identity</p>
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
            className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder:text-tea-text-dim"
          />
        </div>

        <div className="border-t border-tea-border/20" />

        {/* ─── ACQUISITION ─── */}
        <div className="space-y-3">
          <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Acquisition</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em] block mb-1.5">Price</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={entry.priceAmount ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ priceAmount: val === '' ? undefined : Number(val) });
                }}
                className="w-full bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums
                           [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ MozAppearance: 'textfield' } as React.CSSProperties}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em] block mb-1.5">Size (ml)</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 120"
                value={entry.capacityMl ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  update({ capacityMl: val === '' ? undefined : Number(val) });
                }}
                className="w-full bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base tabular-nums
                           [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ MozAppearance: 'textfield' } as React.CSSProperties}
              />
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleCurrencyChange(c.value)}
                className={`${entry.priceCurrency === c.value ? 'tag-selectable-active' : 'tag-selectable'} text-[11px]`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {/* Quantity */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Qty</label>
            <button
              type="button"
              onClick={() => update({ quantity: Math.max(1, (entry.quantity || 1) - 1) })}
              className="pill w-8 h-8 flex items-center justify-center rounded-lg"
            >
              <Minus size={14} />
            </button>
            <span className="text-tea-text text-base font-medium tabular-nums min-w-[2ch] text-center">
              {entry.quantity || 1}
            </span>
            <button
              type="button"
              onClick={() => update({ quantity: (entry.quantity || 1) + 1 })}
              className="pill w-8 h-8 flex items-center justify-center rounded-lg"
            >
              <Plus size={14} />
            </button>
          </div>
          <StatusActions
            status={entry.status}
            onStatusChange={(status: CompassStatus) => update({ status })}
            entry={entry}
            onAddedToLedger={onSwitchToLedger}
          />
        </div>

        <div className="border-t border-tea-border/20" />

        {/* ─── DETAILS ─── */}
        <div className="space-y-3">
          <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Details</p>
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {TEAWARE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    const updates: Record<string, unknown> = { teawareCategory: cat };
                    if (entry.teawareCategory !== cat) updates.material = undefined;
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
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">
              {entry.teawareCategory === 'Teapot' || entry.teawareCategory === 'Gaiwan' ? 'Clay / Material' : 'Material'}
            </label>
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
          {/* Era */}
          <div className="space-y-1.5">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Age / Era</label>
            <div className="flex gap-1.5 flex-wrap">
              {TEAWARE_ERAS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => update({ era: entry.era === e ? undefined : e })}
                  className={entry.era === e ? 'tag-selectable-active' : 'tag-selectable'}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {/* Origin */}
          <div className="space-y-1.5">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Origin</label>
            <AutocompleteInput
              value={entry.originRegion || ''}
              onChange={(val) => update({ originRegion: val || undefined })}
              suggestions={availableRegions}
              placeholder="e.g. Yixing, Jingdezhen..."
              className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors"
            />
          </div>
        </div>

        <div className="border-t border-tea-border/20" />

        {/* ─── NOTES ─── */}
        <NotesField
          notes={entry.notes}
          onNotesChange={(notes) => update({ notes })}
        />

        {/* Done */}
        {hasTeawareName && (
          <button
            type="button"
            onClick={handleCommit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                       bg-tea-gold/10 text-tea-gold text-sm font-semibold
                       hover:bg-tea-gold/15 active:bg-tea-gold/20
                       transition-all mt-1"
          >
            <Check size={15} strokeWidth={2.5} />
            Done
          </button>
        )}
      </div>
    );
  }

  // Verdict is positive (love or like)
  const isPositiveVerdict = entry.sampleVerdict === 'love' || entry.sampleVerdict === 'like';
  const isNegativeVerdict = entry.sampleVerdict === 'pass';

  // ── Tea card layout ────────────────────────
  return (
    <div className="bg-tea-surface rounded-lg p-3 space-y-4">
      {/* ─── IDENTITY ─── */}
      <div className="space-y-3">
        <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Identity</p>
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
            className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors min-w-0 placeholder:text-tea-text-dim"
            onSelect={handleNameAutocompleteSelect}
            itemData={productNameMap}
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
            className="w-20 shrink-0 bg-tea-gold/[0.06] text-tea-text text-base rounded-md px-2 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors tabular-nums text-center placeholder:text-tea-text-dim
                       [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ MozAppearance: 'textfield' } as React.CSSProperties}
          />
          <PhotoCapture onExtracted={handleExtracted} onPhotoTaken={handlePhotoTaken} />
        </div>

        {/* Type chip — part of identity */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative" ref={typePopoverRef}>
            <button
              type="button"
              onClick={() => { setTypePopoverOpen(!typePopoverOpen); setFormPopoverOpen(false); }}
              className="tag-selectable"
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
                        className={`${entry.type === type ? 'tag-selectable-active' : 'tag-selectable'} py-2`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
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
            <p className="text-[11px] text-tea-gold tracking-wide truncate">
              {extractionSummary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-tea-border/20" />

      {/* ─── MODE: Sample toggle + Status ─── */}
      <div className="space-y-3">
        <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Mode</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ isSample: !entry.isSample })}
            className={`pill text-xs flex items-center gap-1.5 ${isSample ? 'pill-active' : ''}`}
          >
            <FlaskConical size={13} strokeWidth={1.5} /> Sample
          </button>
          {!isSample && (
            <div className="flex items-center gap-1.5 text-[11px] text-tea-text-dim">
              {(['logged', 'want', 'buying', 'bought'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update({ status: s })}
                  className={`pill text-xs ${entry.status === s ? 'pill-active' : ''}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-tea-border/20" />

      {/* ═══ SAMPLE PATH ═══ */}
      {isSample && (
        <>
          <div className="space-y-3">
            <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Impression</p>

            {/* Notes first — quick capture for samples */}
            <NotesField
              notes={entry.notes}
              onNotesChange={(notes) => update({ notes })}
            />

            {/* Tasting — optional deeper capture */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={openTastingOverlay}
                className="tag-selectable flex items-center gap-1.5 text-xs"
              >
                <Droplets size={14} strokeWidth={1.5} />
                {hasTasting ? 'Edit tasting' : 'Record tasting'}
              </button>

              {hasTasting && entry.tasting && (
                <TastingProfileStrip
                  value={entry.tasting}
                  onRemove={handleTastingStripRemove}
                />
              )}
            </div>

            {/* Verdict */}
            <div className="space-y-1.5">
              <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Verdict</label>
              <div className="flex gap-1.5">
                {([['love', Heart], ['like', ThumbsUp], ['neutral', Minus], ['pass', ThumbsDown]] as const).map(([v, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update({ sampleVerdict: entry.sampleVerdict === v ? undefined : v })}
                    className={`pill text-xs flex items-center gap-1 ${entry.sampleVerdict === v ? 'pill-active' : ''}`}
                  >
                    <Icon size={12} strokeWidth={1.5} /> {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference price (optional, for samples) */}
            <div className="space-y-1.5">
              <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Reference price</label>
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
            </div>
          </div>

          {/* Verdict-driven actions */}
          <div className="space-y-2">
            {/* Positive verdict: "Would buy" graduates to acquisition */}
            {isPositiveVerdict && hasName && (
              <button
                type="button"
                onClick={handleWouldBuyGraduation}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                           bg-tea-gold/15 text-tea-gold text-sm font-semibold
                           hover:bg-tea-gold/20 active:bg-tea-gold/25
                           transition-all"
              >
                <ShoppingCart size={15} strokeWidth={2} />
                Would buy
              </button>
            )}

            {/* Negative verdict or no verdict: Done */}
            {hasName && (isNegativeVerdict || !isPositiveVerdict) && (
              <button
                type="button"
                onClick={handleCommit}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
                  isNegativeVerdict
                    ? 'bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/15 active:bg-tea-gold/20'
                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
                }`}
              >
                <Check size={15} strokeWidth={2.5} />
                Done
              </button>
            )}
          </div>
        </>
      )}

      {/* ═══ ACQUISITION PATH (direct or graduated from sample) ═══ */}
      {!isSample && (
        <>
          {/* ─── ACQUISITION ─── */}
          <div className="space-y-3">
            <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Acquisition</p>
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
            <StatusActions
              status={entry.status}
              onStatusChange={(status: CompassStatus) => update({ status })}
              entry={entry}
              onAddedToLedger={onSwitchToLedger}
            />
          </div>

          <div className="border-t border-tea-border/20" />

          {/* ─── TASTING & NOTES ─── */}
          <div className="space-y-3">
            <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Tasting & Notes</p>

            {/* Tasting button + strip (pre-filled if graduated from sample) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={openTastingOverlay}
                className="tag-selectable flex items-center gap-1.5 text-xs"
              >
                <Droplets size={14} strokeWidth={1.5} />
                {hasTasting ? 'Edit tasting' : 'Record tasting'}
              </button>

              {hasTasting && entry.tasting && (
                <TastingProfileStrip
                  value={entry.tasting}
                  onRemove={handleTastingStripRemove}
                />
              )}
            </div>

            <NotesField
              notes={entry.notes}
              onNotesChange={(notes) => update({ notes })}
            />
          </div>
        </>
      )}

      {/* ─── DETAILS (inline, shared) ─── */}
      <div className="border-t border-tea-border/20" />
      <div className="space-y-3">
        <p className="text-[10px] text-tea-text-dim uppercase tracking-[0.12em] font-medium">Details</p>

        {/* Region */}
        <div className="space-y-1">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Region</label>
          <AutocompleteInput
            value={entry.originRegion || ''}
            onChange={(val) => { userTapped.current.add('region'); update({ originRegion: val || undefined }); }}
            suggestions={availableRegions}
            placeholder="e.g. Alishan, Yiwu..."
            className="w-full bg-tea-gold/[0.06] text-tea-text rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors text-base"
          />
        </div>

        {/* Season */}
        <div className="space-y-1">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Season</label>
          <div className="flex gap-1.5 flex-wrap">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { userTapped.current.add('season'); update({ season: entry.season === s ? undefined : s }); }}
                className={entry.season === s ? 'tag-selectable-active' : 'tag-selectable'}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Storage (only for Sheng/Shou/Dark) */}
        {(entry.type === 'Sheng' || entry.type === 'Shou' || entry.type === 'Dark') && (
          <div className="space-y-1">
            <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Storage</label>
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
          </div>
        )}

        {/* Chinese name */}
        <div className="space-y-1">
          <label className="text-xs text-tea-text-sec uppercase tracking-[0.08em]">Chinese name</label>
          <input
            type="text"
            value={entry.chineseName || ''}
            onChange={(e) => update({ chineseName: e.target.value || undefined })}
            placeholder="e.g. &#32769;&#29677;&#31456;"
            className="w-full bg-tea-gold/[0.06] text-tea-text text-base rounded-md px-3 py-2 border border-tea-gold/10 focus:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg transition-colors placeholder:text-tea-text-dim"
          />
        </div>
      </div>

      {/* Done — acquisition path */}
      {!isSample && hasName && (
        <button
          type="button"
          onClick={handleCommit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                     bg-tea-gold/10 text-tea-gold text-sm font-semibold
                     hover:bg-tea-gold/15 active:bg-tea-gold/20
                     transition-all"
        >
          <Check size={15} strokeWidth={2.5} />
          Done
        </button>
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

export default CaptureCard;
