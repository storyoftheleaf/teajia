import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check } from 'lucide-react';
import { api } from '../../lib/api';

export interface IntakeBatch {
  id: string;
  label: string;
  intake_date: string | null;
  vendor: string | null;
  note: string | null;
  item_count?: number;
}

/**
 * Picks (or creates) the intake batch that a stock arrival belongs to.
 * A batch is "a session of putting stock in": a shipment, an import, or a
 * round of logging old holdings. Stock added without a batch falls into the
 * account's "Unsorted" batch, so a tea is never batch-less.
 *
 * value === null is treated as "Unsorted" by the API (it resolves the default).
 */
export function BatchPicker({
  value,
  onChange,
  label = 'Intake batch',
}: {
  value: string | null;
  onChange: (batchId: string | null) => void;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState('');

  const { data } = useQuery<{ batches: IntakeBatch[] }>({
    queryKey: ['batches'],
    queryFn: () => api.batches.list(),
  });
  const batches = data?.batches ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api.batches.create({ label: newLabel.trim(), intake_date: newDate || null }),
    onSuccess: (created: IntakeBatch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      onChange(created.id);
      setCreating(false);
      setNewLabel('');
      setNewDate('');
    },
  });

  return (
    <div className="space-y-1.5">
      <label className="block text-ui-11 font-medium text-tea-text-sec uppercase tracking-wide">
        {label}
      </label>

      {!creating ? (
        <div className="flex items-center gap-2">
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="flex-1 px-3 py-2 rounded-md bg-tea-surface text-tea-text text-ui-14 border border-tea-border focus:border-tea-gold outline-none"
          >
            <option value="">Unsorted</option>
            {batches
              .filter((b) => b.label !== 'Unsorted')
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                  {b.intake_date ? ` · ${b.intake_date}` : ''}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md bg-tea-elevated text-tea-text-sec hover:text-tea-text text-ui-12 transition-colors tap-target"
          >
            <Plus size={13} /> New
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 rounded-md bg-tea-elevated">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. June 2026 order"
            className="w-full px-3 py-2 rounded-md bg-tea-surface text-tea-text text-ui-14 border border-tea-border focus:border-tea-gold outline-none"
          />
          <div className="space-y-1">
            <span className="block text-ui-11 text-tea-text-dim">
              Acquisition date (optional, leave blank for old stock you can't date)
            </span>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-tea-surface text-tea-text text-ui-14 border border-tea-border focus:border-tea-gold outline-none"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewLabel('');
                setNewDate('');
              }}
              className="text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!newLabel.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-ui-13 font-semibold disabled:opacity-50 transition-opacity"
            >
              <Check size={13} /> Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
