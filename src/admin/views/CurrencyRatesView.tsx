import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// Platform tier: manage the exchange_rates table that drives every USD
// conversion in the worker (product cost normalisation, invoice display,
// wholesale order line totals). Per-row save model: each row tracks its own
// draft and shows Save when the rate diverges from the server value. USD is
// the base currency and is locked at 1.0.

interface RateRow {
  currency: string;
  rate_to_usd: number;
  last_updated: string | null;
  usage_count: number;
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

export const CurrencyRatesView: React.FC = () => {
  const platformRole = useAppStore(s => s.platformRole);
  const [rates, setRates] = useState<RateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.platform.listExchangeRates();
      setRates(data.rates);
    } catch (err: any) {
      setError(err?.message || 'Could not load exchange rates.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!platformRole) {
    return (
      <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
        <p className="text-tea-text-sec text-ui-14">This view is for platform tier only.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-6 pb-nav-gap max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Exchange rates</h1>
        <p className="label-caps text-tea-text-dim mt-1">USD base · per-currency rates</p>
        <p className="text-tea-text-sec text-ui-14 leading-[1.6] max-w-xl mt-4">
          USD is the base currency. Each rate is the number of foreign units that
          equal one US dollar (e.g. NT 32.3 means 32.3 NT per 1 USD). All product
          costs, invoice totals, and wholesale lines convert through this table.
        </p>
      </header>

      {error && (
        <div className="mb-6 text-ui-12 text-tea-error">{error}</div>
      )}

      {rates === null && !error && (
        <div className="text-tea-text-sec italic text-ui-14">Loading rates.</div>
      )}

      {rates !== null && (
        <div>
          <div className="label-caps text-tea-text-sec mb-4">
            Currencies
          </div>
          <div>
            {rates.map(row => (
              <RateRowView key={row.currency} row={row} onChange={load} />
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-tea-border">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                Add Currency
              </button>
            ) : (
              <AddRateForm
                onCancel={() => setAdding(false)}
                onSaved={async () => { setAdding(false); await load(); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface RateRowViewProps {
  row: RateRow;
  onChange: () => Promise<void> | void;
}

const RateRowView: React.FC<RateRowViewProps> = ({ row, onChange }) => {
  const [draft, setDraft] = useState(String(row.rate_to_usd));
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset the draft when the underlying server value updates.
  useEffect(() => { setDraft(String(row.rate_to_usd)); }, [row.rate_to_usd]);

  const isUSD = row.currency === 'USD';
  const inUse = row.usage_count > 0;
  const draftNumber = Number(draft);
  const dirty = !isUSD && Number.isFinite(draftNumber) && draftNumber > 0 && draftNumber !== row.rate_to_usd;

  const handleSave = async () => {
    if (!dirty || busy) return;
    setBusy('save');
    setError(null);
    try {
      await api.platform.updateExchangeRate(row.currency, draftNumber);
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy('delete');
    setError(null);
    try {
      await api.platform.deleteExchangeRate(row.currency);
      await onChange();
    } catch (err: any) {
      setError(err?.message || 'Could not delete.');
      setBusy(null);
    }
  };

  return (
    <div className="py-4 border-b border-tea-border last:border-b-0">
      <div className="flex items-baseline gap-4 flex-wrap">
        <div className="font-display text-ui-17 text-tea-text min-w-[80px]">
          {row.currency}
          {isUSD && (
            <span className="ml-2 label-caps text-tea-text-dim">Base</span>
          )}
        </div>

        <label className="flex items-baseline gap-2 text-ui-14">
          <span className="label-caps text-tea-text-sec">per 1 USD</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={isUSD || busy !== null}
            className="bg-transparent border-b border-tea-border focus:border-tea-gold outline-none text-tea-text font-body text-ui-15 py-1 w-28 transition-colors disabled:text-tea-text-sec"
            aria-label={`${row.currency} rate`}
          />
        </label>

        <div className="text-ui-12 text-tea-text-dim">
          {inUse ? `${row.usage_count} in use` : 'Unused'}
        </div>

        <div className="ml-auto flex items-baseline gap-5 text-ui-13">
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="text-tea-gold hover:text-tea-gold-lt transition-colors disabled:text-tea-text-sec"
            >
              {busy === 'save' ? 'Saving' : 'Save'}
            </button>
          )}
          {!isUSD && !confirmingDelete && (
            <button
              type="button"
              onClick={() => { setConfirmingDelete(true); setError(null); }}
              disabled={inUse || busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors disabled:text-tea-text-sec disabled:opacity-50 disabled:cursor-not-allowed"
              title={inUse ? 'In use; cannot delete' : 'Delete this currency'}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {row.last_updated && (
        <div className="mt-1 text-ui-12 text-tea-text-dim">
          Last updated {formatDate(row.last_updated)}
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-ui-13 text-tea-text-sec">
            Delete {row.currency}? This cannot be undone.
          </p>
          <div className="flex items-baseline gap-5 text-ui-13 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy !== null}
              className="text-tea-error hover:text-tea-error/80 transition-colors"
            >
              {busy === 'delete' ? 'Deleting' : 'Confirm delete'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-ui-12 text-tea-error">{error}</p>
      )}
    </div>
  );
};

interface AddRateFormProps {
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}

const AddRateForm: React.FC<AddRateFormProps> = ({ onCancel, onSaved }) => {
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const codeOk = /^[A-Za-z][A-Za-z0-9]*$/.test(currency.trim()) && currency.trim().length <= 12;
    const rateNum = Number(rate);
    return codeOk && Number.isFinite(rateNum) && rateNum > 0;
  }, [currency, rate]);

  const handleSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.platform.createExchangeRate({
        currency: currency.trim(),
        rate_to_usd: Number(rate),
      });
      await onSaved();
    } catch (err: any) {
      setError(err?.message || 'Could not add currency.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 max-w-md bg-tea-surface border border-tea-border rounded-xl p-5">
      <div className="label-caps text-tea-text-sec">
        New currency
      </div>
      <div>
        <label className="label-caps text-tea-text-sec mb-1.5 block">Code</label>
        <input
          type="text"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          placeholder="EUR, GBP"
          autoFocus
          maxLength={12}
          className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
        />
      </div>
      <div>
        <label className="label-caps text-tea-text-sec mb-1.5 block">Rate per 1 USD</label>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={rate}
          onChange={e => setRate(e.target.value)}
          placeholder="0.92"
          className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-2 py-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Adding' : 'Add Currency'}
        </button>
      </div>
      {error && (
        <p className="text-ui-12 text-tea-error">{error}</p>
      )}
    </div>
  );
};
