import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Droplets, Minus, Plus, X } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { Currency } from '../../admin/types';
import type { TastingData } from '../../types';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';
import type { TeaType, TeaForm, Season, Storage, CompassStatus, TeawareCategory, TeawareMaterial, TeawareEra } from './types';
import { DEFAULT_GRAMS, TEAWARE_CATEGORIES, TEAWARE_MATERIALS, TEAWARE_ERAS } from './types';
import { VendorStrip } from './VendorStrip';
import { TypeGrid } from './TypeGrid';
import { FormRow } from './FormRow';
import { DetailsRow } from './DetailsRow';
import { PriceGrams } from './PriceGrams';
import { NotesField } from './NotesField';
import { StatusActions } from './StatusActions';
import { TastingFlow } from '../tasting/TastingFlow';
import { TastingProfileStrip } from '../tasting/TastingProfileStrip';
import { parseTeaInput } from './InputParser';

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
}

const EMPTY_TASTING: TastingData = {};

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);

  const [tastingOverlayOpen, setTastingOverlayOpen] = useState(false);
  const [localTasting, setLocalTasting] = useState<TastingData>(EMPTY_TASTING);

  // Parser state
  const userTapped = useRef<Set<ParseableField>>(new Set());
  const [parsedTokens, setParsedTokens] = useState<Partial<Record<ParseableField, string>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNameRef = useRef<string>('');

  const update = useCallback(
    (updates: Record<string, unknown>) => {
      updateEntry(entryId, updates);
    },
    [entryId, updateEntry]
  );

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

  if (!entry) return null;

  const isTeaware = entry.category === 'teaware';

  // Clear a parsed token: clears the field and prevents parser from re-filling
  const clearParsedToken = (field: ParseableField) => {
    const fieldMap: Record<ParseableField, string> = {
      type: 'type', form: 'form', year: 'year',
      season: 'season', storage: 'storage', region: 'originRegion',
    };
    updateEntry(entryId, { [fieldMap[field]]: undefined });
    userTapped.current.add(field);
    setParsedTokens((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const hasTokens = Object.keys(parsedTokens).length > 0;

  // Token label map for display
  const tokenLabels: Record<ParseableField, string> = {
    type: 'Type', form: 'Form', year: 'Year',
    season: 'Season', storage: 'Storage', region: 'Region',
  };

  const hasTasting = entry.tasting && Object.values(entry.tasting).some(
    (v) => Array.isArray(v) ? v.length > 0 : v != null
  );

  const handleTypeSelect = (type: TeaType) => {
    userTapped.current.add('type');
    update({ type });
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

  const handleVendorChange = () => {
    // Future: open vendor picker modal
    // For now, prompt-style set
    const name = window.prompt('Vendor name:', entry.vendorName || '');
    if (name !== null) {
      const trimmed = name.trim();
      update({ vendorName: trimmed || undefined, vendorId: undefined });
      setLastVendor(null, trimmed || null);
    }
  };

  const handleVendorClear = () => {
    update({ vendorName: undefined, vendorId: undefined });
    setLastVendor(null, null);
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

    return (
      <div className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-4">
        {/* 1. Photo area */}
        <div className="space-y-2">
          {entry.photos.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {entry.photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              ))}
              <button
                type="button"
                className="pill w-20 h-20 flex flex-col items-center justify-center shrink-0 rounded-lg"
              >
                <Camera size={18} className="text-tea-text-dim" />
                <span className="text-[10px] text-tea-text-dim mt-1">Add</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pill w-full py-8 flex flex-col items-center justify-center rounded-lg"
            >
              <Camera size={24} className="text-tea-text-dim mb-1.5" />
              <span className="text-xs text-tea-text-dim">Tap to add photos</span>
            </button>
          )}
        </div>

        {/* 2. Vendor strip */}
        <VendorStrip
          vendorName={entry.vendorName}
          onVendorChange={handleVendorChange}
          onClear={handleVendorClear}
        />

        {/* 3. Description / name */}
        <input
          type="text"
          value={entry.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="What is it?"
          className="w-full bg-transparent text-tea-text text-lg font-display placeholder:text-tea-text-dim border-none outline-none py-1"
        />

        {/* 4. Price (single number + currency, no grams) */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Price</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={entry.priceAmount ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              update({ priceAmount: val === '' ? undefined : Number(val) });
            }}
            className="w-full bg-tea-surface text-tea-text border border-tea-border rounded px-3 py-2 text-base num focus:outline-none focus:border-tea-gold transition-colors"
          />
          <div className="flex gap-1 flex-wrap">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleCurrencyChange(c.value)}
                className={entry.priceCurrency === c.value ? 'pill-active' : 'pill'}
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Quantity stepper */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Quantity</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update({ quantity: Math.max(1, (entry.quantity || 1) - 1) })}
              className="pill w-9 h-9 flex items-center justify-center rounded-lg"
            >
              <Minus size={16} />
            </button>
            <span className="text-tea-text text-lg font-medium tabular-nums min-w-[2ch] text-center">
              {entry.quantity || 1}
            </span>
            <button
              type="button"
              onClick={() => update({ quantity: (entry.quantity || 1) + 1 })}
              className="pill w-9 h-9 flex items-center justify-center rounded-lg"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* 6. Category row */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Category</label>
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

        {/* 7. Material row (contextual based on category) */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Material</label>
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

        {/* 8. Capacity (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Capacity (ml)</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 120"
            value={entry.capacityMl ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              update({ capacityMl: val === '' ? undefined : Number(val) });
            }}
            className="w-full bg-tea-surface text-tea-text border border-tea-border rounded px-3 py-2 text-base num focus:outline-none focus:border-tea-gold transition-colors"
          />
        </div>

        {/* 9. Era */}
        <div className="space-y-1.5">
          <label className="text-xs text-tea-text-dim uppercase tracking-wider">Era</label>
          <div className="flex gap-1.5 flex-wrap">
            {TEAWARE_ERAS.map((era) => (
              <button
                key={era}
                type="button"
                onClick={() => update({ era: entry.era === era ? undefined : era })}
                className={entry.era === era ? 'tag-selectable-active' : 'tag-selectable'}
              >
                {era}
              </button>
            ))}
          </div>
        </div>

        {/* 10. Notes */}
        <NotesField
          notes={entry.notes}
          onNotesChange={(notes) => update({ notes })}
        />

        {/* 11. Status — Want / Buy (no Pass) */}
        <StatusActions
          status={entry.status}
          onStatusChange={(status: CompassStatus) => update({ status })}
        />
      </div>
    );
  }

  // ── Tea card layout (original) ────────────────────────────────────────
  return (
    <div className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-4">
      {/* 1. Vendor strip — persistent at top */}
      <VendorStrip
        vendorName={entry.vendorName}
        onVendorChange={handleVendorChange}
        onClear={handleVendorClear}
      />

      {/* 2. Name input — primary, large */}
      <input
        type="text"
        value={entry.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="What are you tasting?"
        className="w-full bg-transparent text-tea-text text-lg font-display placeholder:text-tea-text-dim border-none outline-none py-1"
      />

      {/* 2b. Parsed token chips */}
      {hasTokens && (
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {(Object.entries(parsedTokens) as [ParseableField, string][]).map(([field, value]) => (
            <button
              key={field}
              type="button"
              onClick={() => clearParsedToken(field)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold text-[11px] tracking-wide"
            >
              <span>{value}</span>
              <X size={10} strokeWidth={2} className="opacity-60" />
            </button>
          ))}
        </div>
      )}

      {/* 3. Price + Grams — immediately after name */}
      <PriceGrams
        priceAmount={entry.priceAmount}
        priceCurrency={entry.priceCurrency}
        pricePerUnitGrams={entry.pricePerUnitGrams}
        form={entry.form}
        onPriceChange={(priceAmount) => update({ priceAmount })}
        onCurrencyChange={handleCurrencyChange}
        onGramsChange={(pricePerUnitGrams) => update({ pricePerUnitGrams })}
      />

      {/* 4. Notes — always visible, vendor stories go here */}
      <NotesField
        notes={entry.notes}
        onNotesChange={(notes) => update({ notes })}
      />

      {/* 4b. Tasting */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={openTastingOverlay}
          className="pill flex items-center gap-1.5 text-xs text-tea-text-sec"
        >
          <Droplets size={13} strokeWidth={1.5} />
          {hasTasting ? 'Edit tasting' : 'Record tasting'}
        </button>

        {hasTasting && entry.tasting && (
          <TastingProfileStrip
            value={entry.tasting}
            onRemove={handleTastingStripRemove}
          />
        )}
      </div>

      {/* 5. Type grid */}
      <TypeGrid selected={entry.type} onSelect={handleTypeSelect} />

      {/* 6. Form row */}
      <FormRow selected={entry.form} onSelect={handleFormSelect} />

      {/* 7. Details row — collapsible */}
      <DetailsRow
        year={entry.year}
        season={entry.season}
        storage={entry.storage}
        originRegion={entry.originRegion}
        teaType={entry.type}
        onYearChange={(year) => { userTapped.current.add('year'); update({ year }); }}
        onSeasonChange={(season) => { userTapped.current.add('season'); update({ season }); }}
        onStorageChange={(storage) => { userTapped.current.add('storage'); update({ storage }); }}
        onRegionChange={(originRegion) => { userTapped.current.add('region'); update({ originRegion }); }}
      />

      {/* 8. Chinese name — optional, de-emphasized */}
      <div className="pt-1">
        <label className="block text-[11px] text-tea-text-dim mb-0.5 tracking-wide">Chinese name (optional)</label>
        <input
          type="text"
          value={entry.chineseName || ''}
          onChange={(e) => update({ chineseName: e.target.value || undefined })}
          placeholder="e.g. 大紅袍"
          className="w-full bg-transparent text-tea-text-sec text-xs placeholder:text-tea-text-dim/50 border-none outline-none"
        />
      </div>

      {/* 9. Status — Want / Buy at the bottom */}
      <StatusActions
        status={entry.status}
        onStatusChange={(status: CompassStatus) => update({ status })}
      />

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
              <h2 className="text-tea-text text-sm font-display tracking-wide">Tasting</h2>
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
