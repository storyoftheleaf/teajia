import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Trash2, MapPin, X, Loader2 } from 'lucide-react';
import { api, type CellarItem } from '../../lib/api';
import { useAppStore } from '../../lib/store';

// Stock spine step 4 — the personal cellar surface. A logged-in user records
// tea they personally own with a quantity, private by default, synced to their
// account (not localStorage). An item can optionally be REQUESTED for placement
// at a location the user belongs to — a curated, human-approved move, never a
// silent write. Selling is step 5; nothing here is for sale.

interface CellarViewProps {
  onBack: () => void;
}

const PLACEMENT_LABEL: Record<CellarItem['placementStatus'], string> = {
  private: 'Private',
  requested: 'Placement requested',
  placed: 'Placed at a location',
};

export const CellarView: React.FC<CellarViewProps> = () => {
  const qc = useQueryClient();
  const memberships = useAppStore(s => s.memberships);
  const activeAccount = useAppStore(s => s.activeAccount);

  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [adding, setAdding] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cellar'],
    queryFn: () => api.cellar.list(),
    staleTime: 1000 * 60,
  });
  const items = data?.items ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cellar'] });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; grams: number }) => api.cellar.create(payload),
    onSuccess: () => { setName(''); setGrams(''); setAdding(false); invalidate(); },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api.cellar.remove(id),
    onSuccess: invalidate,
  });
  const requestMut = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) => api.cellar.requestPlacement(id, accountId),
    onSuccess: () => { setPlacingId(null); invalidate(); },
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => api.cellar.cancelPlacement(id),
    onSuccess: invalidate,
  });

  const submitAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const g = Number(grams);
    createMut.mutate({ name: trimmed, grams: Number.isFinite(g) && g > 0 ? g : 0 });
  };

  const accountName = (id: string | null | undefined): string =>
    memberships.find(m => m.account_id === id)?.account_name
    ?? (activeAccount?.id === id ? activeAccount.name : null)
    ?? 'a location';

  return (
    <div className="px-6 pt-6 pb-6 space-y-5">
      <p className="text-ui-13 text-tea-text-sec leading-relaxed">
        Tea you personally own, kept private. Add what's on your shelf with a weight —
        only you can see it.
      </p>

      {/* Add form */}
      {adding ? (
        <div className="bg-tea-surface border border-tea-border rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tea name"
            autoFocus
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={grams}
              onChange={e => setGrams(e.target.value)}
              placeholder="grams"
              className="w-28 bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
            />
            <span className="text-ui-12 text-tea-text-dim">grams</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setAdding(false); setName(''); setGrams(''); }}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitAdd}
              disabled={!name.trim() || createMut.isPending}
              className="inline-flex items-center gap-1.5 bg-tea-gold text-tea-bg rounded-md px-3 py-1.5 text-ui-13 font-medium disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add to cellar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 border border-tea-border rounded-xl py-3 text-ui-13 text-tea-text-sec hover:text-tea-text hover:border-tea-gold transition-colors"
        >
          <Plus size={14} /> Add tea you own
        </button>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-tea-text-dim">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 text-tea-text-sec">
          <Package size={28} className="text-tea-text-dim mb-2" />
          <p className="text-ui-14">Your cellar is empty.</p>
        </div>
      ) : (
        <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          {items.map(item => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-ui-14 text-tea-text truncate">{item.name}</div>
                  <div className="text-ui-12 text-tea-text-dim mt-0.5">
                    {[item.type, item.origin, item.year].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-ui-13 text-tea-text-sec tabular-nums">{Math.round(item.grams)}g</span>
                  {item.placementStatus === 'private' && (
                    <button
                      onClick={() => removeMut.mutate(item.id)}
                      aria-label="Remove from cellar"
                      className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Placement (the move) */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`text-ui-10 px-1.5 py-0.5 rounded ${item.placementStatus === 'private' ? 'text-tea-text-dim' : 'text-tea-gold'}`}
                >
                  {PLACEMENT_LABEL[item.placementStatus]}
                  {item.placementStatus !== 'private' && item.placementAccountId
                    ? ` · ${accountName(item.placementAccountId)}`
                    : ''}
                </span>

                {item.placementStatus === 'private' && memberships.length > 0 && (
                  placingId === item.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) requestMut.mutate({ id: item.id, accountId: e.target.value });
                        }}
                        className="bg-tea-bg border border-tea-border rounded-md px-2 py-1 text-ui-12 text-tea-text focus:outline-none"
                      >
                        <option value="" disabled>Choose location…</option>
                        {memberships.map(m => (
                          <option key={m.account_id} value={m.account_id}>{m.account_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setPlacingId(null)}
                        aria-label="Cancel"
                        className="text-tea-text-sec hover:text-tea-text tap-target"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPlacingId(item.id)}
                      className="inline-flex items-center gap-1 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                    >
                      <MapPin size={12} /> Request placement
                    </button>
                  )
                )}

                {item.placementStatus === 'requested' && (
                  <button
                    onClick={() => cancelMut.mutate(item.id)}
                    className="text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Cancel request
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
