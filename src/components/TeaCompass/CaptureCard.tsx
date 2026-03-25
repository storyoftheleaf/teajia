import React, { useCallback } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { Currency } from '../../admin/types';
import type { TeaType, TeaForm, Season, Storage, CompassStatus } from './types';
import { DEFAULT_GRAMS } from './types';
import { VendorStrip } from './VendorStrip';
import { TypeGrid } from './TypeGrid';
import { FormRow } from './FormRow';
import { DetailsRow } from './DetailsRow';
import { PriceGrams } from './PriceGrams';
import { NotesField } from './NotesField';
import { StatusActions } from './StatusActions';

interface CaptureCardProps {
  entryId: string;
}

export const CaptureCard: React.FC<CaptureCardProps> = ({ entryId }) => {
  const entry = useTeaCompassStore((s) => s.getEntry(entryId));
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const setLastCurrency = useTeaCompassStore((s) => s.setLastCurrency);
  const setLastVendor = useTeaCompassStore((s) => s.setLastVendor);

  const update = useCallback(
    (updates: Record<string, unknown>) => {
      updateEntry(entryId, updates);
    },
    [entryId, updateEntry]
  );

  if (!entry) return null;

  const isTeaware = entry.category === 'teaware';

  const handleTypeSelect = (type: TeaType) => {
    if (type === 'Teaware') {
      update({ type, category: 'teaware' });
    } else {
      update({ type, category: 'tea' });
    }
  };

  const handleFormSelect = (form: TeaForm) => {
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

  return (
    <div className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-4">
      {/* Vendor strip */}
      <VendorStrip
        vendorName={entry.vendorName}
        onVendorChange={handleVendorChange}
        onClear={handleVendorClear}
      />

      {/* Name input */}
      <input
        type="text"
        value={entry.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="What are you tasting?"
        className="w-full bg-transparent text-tea-text text-lg font-display placeholder:text-tea-text-dim border-none outline-none py-1"
      />

      {/* Chinese name */}
      <input
        type="text"
        value={entry.chineseName || ''}
        onChange={(e) => update({ chineseName: e.target.value || undefined })}
        placeholder="Chinese name (optional)"
        className="w-full bg-transparent text-tea-text-sec text-sm placeholder:text-tea-text-dim border-none outline-none"
      />

      {/* Type grid */}
      <TypeGrid selected={entry.type} onSelect={handleTypeSelect} />

      {/* Form row (hidden for teaware) */}
      {!isTeaware && (
        <FormRow selected={entry.form} onSelect={handleFormSelect} />
      )}

      {/* Details row (hidden for teaware) */}
      {!isTeaware && (
        <DetailsRow
          year={entry.year}
          season={entry.season}
          storage={entry.storage}
          originRegion={entry.originRegion}
          teaType={entry.type}
          onYearChange={(year) => update({ year })}
          onSeasonChange={(season) => update({ season })}
          onStorageChange={(storage) => update({ storage })}
          onRegionChange={(originRegion) => update({ originRegion })}
        />
      )}

      {/* Price + Grams */}
      <PriceGrams
        priceAmount={entry.priceAmount}
        priceCurrency={entry.priceCurrency}
        pricePerUnitGrams={entry.pricePerUnitGrams}
        form={entry.form}
        onPriceChange={(priceAmount) => update({ priceAmount })}
        onCurrencyChange={handleCurrencyChange}
        onGramsChange={(pricePerUnitGrams) => update({ pricePerUnitGrams })}
      />

      {/* Notes */}
      <NotesField
        notes={entry.notes}
        onNotesChange={(notes) => update({ notes })}
      />

      {/* Status actions */}
      <StatusActions
        status={entry.status}
        onStatusChange={(status: CompassStatus) => update({ status })}
      />
    </div>
  );
};

export default CaptureCard;
