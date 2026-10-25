import React, { useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import { LibraryInlineValue } from './LibraryInlineValue';
import { GRAM_PRESETS, type TeaForm } from './types';
type QuoteUnit = 'Grams' | 'Jin' | 'Cake' | 'Brick' | 'Tuo';
const units: QuoteUnit[] = ['Grams', 'Jin', 'Cake', 'Brick', 'Tuo'];

/** A pack weight is evidence, not a quote basis, until the person confirms it. */
export function LibraryQuoteWeight({ title, weight, packWeight, form, readOnly, onSave }: {
  title: string; weight?: number | null; packWeight?: number | null; form?: TeaForm; readOnly?: boolean;
  onSave: (value: string, form?: 'Cake' | 'Brick' | 'Tuo') => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<QuoteUnit>('Grams');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const known = weight != null && weight > 0;
  const suggestion = packWeight != null && Number.isFinite(packWeight) && packWeight > 0 ? packWeight : null;
  const presets = unit === 'Jin' ? [500, 600] : unit === 'Grams' ? [75, 100, 150, 500, 1000] : GRAM_PRESETS[unit];
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!draft.trim() || !Number.isFinite(Number(draft)) || Number(draft) <= 0) { setError('Enter the total grams covered by this quote.'); return; }
    setBusy(true); setError('');
    try { await onSave(draft, unit === 'Cake' || unit === 'Brick' || unit === 'Tuo' ? unit : undefined); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save. Retry.'); }
    finally { setBusy(false); }
  };
  if (readOnly) return <LibraryInlineValue
    className={`text-ui-16 font-semibold text-tea-text ${!known ? 'library-unset' : ''}`}
    value={weight == null ? '' : String(weight)} display={known ? weight.toLocaleString() : 'Add'}
    label={`Edit quoted grams for ${title}`} numeric readOnly={readOnly} onSave={onSave} />;
  return <>
    <span className={`library-inline-value text-tea-text ${known ? 'font-semibold' : 'library-unset'}`}><button type="button" className="tap-target" aria-label={`${known ? 'Edit' : 'Confirm'} quoted grams for ${title}`} onClick={() => { setUnit(form === 'Cake' || form === 'Brick' || form === 'Tuo' ? form : 'Grams'); setDraft(known ? String(weight) : suggestion == null ? '' : String(suggestion)); setError(''); setOpen(true); }}>{known ? weight.toLocaleString() : 'Add'}</button></span>
    <BottomSheet open={open} onOpenChange={value => { if (!busy) setOpen(value); }} title="What does the quote cover?" description={title}>
      <form onSubmit={event => void confirm(event)} className="space-y-3 pb-4">
        <div className="library-weight-options" role="group" aria-label="Quote unit">
          {units.map(choice => <button key={choice} type="button" disabled={busy} aria-pressed={unit === choice} onClick={() => { setUnit(choice); setDraft(''); setError(''); }}>{choice}</button>)}
        </div>
        <div className="library-weight-presets" role="group" aria-label="Weight shortcuts">
          {presets.map(grams => <button key={grams} type="button" disabled={busy} aria-pressed={draft === String(grams)} onClick={() => { setDraft(String(grams)); setError(''); }}>{grams.toLocaleString()}g{grams === suggestion ? ' · recorded' : ''}</button>)}
          {suggestion != null && unit !== 'Jin' && !presets.includes(suggestion) && <button type="button" disabled={busy} onClick={() => setDraft(String(suggestion))}>Recorded · {suggestion.toLocaleString()}g</button>}
        </div>
        <label className="block text-ui-13 text-tea-text-sec">Total approximate grams covered by the quote
          <input aria-label="Approximate quoted grams" placeholder="Enter grams" inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} className="input-field w-full min-h-11 px-3 text-ui-16" />
        </label>
        <p className="text-ui-12 text-tea-text-dim">{unit === 'Jin' ? 'Choose 500g or 600g to match the supplier’s jin.' : unit === 'Grams' ? 'Type a total, or tap a weight above.' : `Choose the approximate weight of the ${unit.toLowerCase()}. For multiple pieces, enter their combined weight.`} Used for pricing, not received stock.</p>
        {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
        <div className="flex gap-2"><button type="button" className="tap-target min-h-11 flex-1 rounded-md border border-tea-border" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="submit" disabled={busy} className="tap-target min-h-11 flex-1 rounded-md cta-solid">{busy ? 'Saving…' : 'Confirm weight'}</button></div>
      </form>
    </BottomSheet>
  </>;
}
