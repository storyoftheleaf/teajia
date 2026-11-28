import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/shared/Button';
import { api } from '../../../lib/api';
import type { StockPlacesSplit } from '../../../lib/stockPlacesApi';

/**
 * Where a tea's stock is kept: the shop's one number, split privately between
 * its own places (worker/src/stockPlaces.ts). Lives in the stock panel. The
 * total is not changed here: whatever is not given a place reads as "not
 * placed yet", and a split larger than the total is refused.
 */
export const stockPlacesKey = (productId: string) => ['stock_places', productId] as const;

export const StockPlacesSection: React.FC<{ productId: string; total: number; unit: 'g' | 'unit' }> = ({ productId, total, unit }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: stockPlacesKey(productId),
    queryFn: () => api.stockPlaces.forProduct(productId),
  });
  const split: StockPlacesSplit | undefined = data?.stock_places;
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [editingNames, setEditingNames] = useState(false);
  const [newPlace, setNewPlace] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const word = unit === 'unit' ? ' pieces' : 'g';

  // A total that moved (a movement recorded above) reads the split again.
  useEffect(() => { if (split && split.total !== total) void refetch(); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!split) return;
    setAmounts(Object.fromEntries(split.places.map(place => [place.id, String(place.amount)])));
    setNames(Object.fromEntries(split.places.map(place => [place.id, place.name])));
  }, [split]);

  const typed = useMemo(() => (split?.places ?? []).map(place => ({ place_id: place.id, amount: Number(amounts[place.id] ?? place.amount) })), [split, amounts]);
  const placed = typed.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const base = split?.total ?? total;
  const notPlaced = Math.round((base - placed) * 1000) / 1000;
  const invalid = typed.some(row => !Number.isFinite(row.amount) || row.amount < 0 || (unit === 'unit' && !Number.isInteger(row.amount)));
  const changed = (split?.places ?? []).some(place => Number(amounts[place.id]) !== place.amount);
  const over = notPlaced < 0;

  const done = async (next?: StockPlacesSplit) => {
    if (next) queryClient.setQueryData(stockPlacesKey(productId), { product_id: productId, stock_places: next });
    else await refetch();
  };

  const run = async (work: () => Promise<void>) => {
    setSaving(true); setError('');
    try { await work(); }
    catch (caught: any) {
      setError(caught?.data?.current_balance != null
        ? `Stock changed to ${caught.data.current_balance}${word}. Check the split again.`
        : caught?.message || 'That could not be saved.');
      await refetch();
    } finally { setSaving(false); }
  };

  const saveSplit = () => run(async () => {
    const result = await api.stockPlaces.setForProduct(productId, { amounts: typed, expected_total: base });
    await done(result.stock_places);
  });

  const addPlace = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newPlace.trim();
    if (!name) return;
    void run(async () => {
      await api.stockPlaces.create(name);
      setNewPlace('');
      await queryClient.invalidateQueries({ queryKey: ['stock_places'] });
      await done();
    });
  };

  const saveNames = () => run(async () => {
    for (const place of split?.places ?? []) {
      const name = (names[place.id] ?? '').trim();
      if (name && name !== place.name) await api.stockPlaces.update(place.id, { name });
    }
    setEditingNames(false);
    await queryClient.invalidateQueries({ queryKey: ['stock_places'] });
  });

  const retire = (placeId: string) => run(async () => {
    await api.stockPlaces.update(placeId, { archived: true });
    await queryClient.invalidateQueries({ queryKey: ['stock_places'] });
  });

  return (
    <section aria-label="Where it is kept" className="border-t border-tea-border pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-ui-12 text-tea-text-sec">Where it is kept</h3>
        {!!split?.places.length && (
          <Button variant="plain" type="button" onClick={() => setEditingNames(value => !value)} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text">
            {editingNames ? 'Done with names' : 'Edit names'}
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="py-3 text-tea-text-sec"><Loader2 className="animate-spin inline" size={14} /></div>
      ) : isError ? (
        <p role="alert" className="py-2 text-ui-12 text-tea-text-sec">The places could not be loaded. <Button variant="plain" type="button" onClick={() => void refetch()} className="tap-target underline">Try again</Button></p>
      ) : (
        <div className="mt-2 space-y-2">
          {split?.places.map(place => (
            <div key={place.id} className="flex flex-wrap items-center gap-2">
              {editingNames ? (
                <>
                  <input aria-label={`Name of ${place.name}`} value={names[place.id] ?? ''} onChange={event => setNames(current => ({ ...current, [place.id]: event.target.value }))} className="admin-input min-w-0 flex-1" />
                  <Button variant="plain" type="button" disabled={saving} onClick={() => void retire(place.id)} className="tap-target text-ui-12 text-tea-text-sec hover:text-tea-text">Remove</Button>
                </>
              ) : (
                <>
                  <label htmlFor={`place-${place.id}`} className="min-w-0 flex-1 text-ui-13 text-tea-text">{place.name}</label>
                  <span className="inline-flex items-center gap-1">
                    <input
                      id={`place-${place.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={unit === 'unit' ? 1 : 'any'}
                      value={amounts[place.id] ?? ''}
                      onChange={event => setAmounts(current => ({ ...current, [place.id]: event.target.value }))}
                      className="admin-input w-24 text-right tabular-nums"
                    />
                    <span className="text-ui-12 text-tea-text-sec">{word.trim()}</span>
                  </span>
                </>
              )}
            </div>
          ))}
          {!!split?.places.length && !editingNames && (
            <p aria-live="polite" className={`flex justify-between text-ui-12 ${over ? 'text-tea-error' : 'text-tea-text-sec'}`}>
              <span>{over ? `More than the ${base}${word} in stock` : 'Not placed yet'}</span>
              <span className="tabular-nums">{over ? `${-notPlaced}${word} over` : `${notPlaced}${word}`}</span>
            </p>
          )}
          {editingNames ? (
            <div className="flex justify-end">
              <Button type="button" loading={saving} onClick={() => void saveNames()} className="tap-target">Save names</Button>
            </div>
          ) : changed && (
            <div className="flex justify-end">
              <Button type="button" loading={saving} disabled={invalid || over} onClick={() => void saveSplit()} className="tap-target">Save where it is</Button>
            </div>
          )}
          {!editingNames && (
            <form onSubmit={addPlace} className="flex flex-wrap items-center gap-2">
              <input aria-label="New place" value={newPlace} onChange={event => setNewPlace(event.target.value)} placeholder="Add a place, e.g. studio" maxLength={60} className="admin-input min-w-0 flex-1" />
              <Button variant="plain" type="submit" disabled={saving || !newPlace.trim()} aria-label="Add place" className="tap-target inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
                <Plus size={14} aria-hidden="true" /> Add
              </Button>
            </form>
          )}
          {error && <p role="alert" className="text-ui-12 text-tea-error">{error}</p>}
        </div>
      )}
    </section>
  );
};
