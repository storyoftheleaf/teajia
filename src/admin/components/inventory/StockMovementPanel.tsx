import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../../lib/api';
import type { Product } from '../../types';
import { StockLedgerPanel } from '../StockLedgerPanel';

type MovementType = 'receipt' | 'sample_use' | 'gift' | 'waste' | 'return' | 'recount' | 'transfer';

const ACTIONS: Array<{ value: MovementType; label: string }> = [
  { value: 'receipt', label: 'Receive' },
  { value: 'sample_use', label: 'Sample use' },
  { value: 'gift', label: 'Gift' },
  { value: 'waste', label: 'Waste' },
  { value: 'return', label: 'Return' },
  { value: 'recount', label: 'Recount' },
  { value: 'transfer', label: 'Transfer' },
];

const OUTWARD = new Set<MovementType>(['sample_use', 'gift', 'waste', 'transfer']);

export interface StockMovementPanelProps {
  product: Product;
  products: Product[];
  trigger?: HTMLElement | null;
  onClose: () => void;
  onRecorded: (afterBalance: number, unit: 'g' | 'unit') => void;
  initialMovementType?: MovementType;
}

export const StockMovementPanel: React.FC<StockMovementPanelProps> = ({
  product, products, trigger, onClose, onRecorded, initialMovementType = 'receipt',
}) => {
  const queryClient = useQueryClient();
  void products; // Transfers remain unavailable until holdings have an explicit relation.
  const movementUnit: 'g' | 'unit' = product.type === 'Teaware' ? 'unit' : 'g';
  const initialBalance = movementUnit === 'unit' ? Number(product.quantityUnits || 0) : Number(product.stockGrams || 0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [movementType, setMovementType] = useState<MovementType>(initialMovementType);
  const [quantity, setQuantity] = useState('');
  const [balance, setBalance] = useState(String(Math.round(initialBalance)));
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = currentBalance;
  const amount = Number(quantity);
  const next = movementType === 'recount'
    ? Number(balance)
    : current + (OUTWARD.has(movementType) ? -amount : amount);
  const invalidQuantity = movementType !== 'recount' && (!Number.isFinite(amount) || amount <= 0);
  const invalidBalance = movementType === 'recount' && (!Number.isFinite(next) || next < 0);
  const insufficient = OUTWARD.has(movementType) && Number.isFinite(amount) && amount > current;
  const transferUnavailable = movementType === 'transfer';
  const canSubmit = !saving && !invalidQuantity && !invalidBalance && !insufficient && !transferUnavailable;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [onClose, trigger]);

  const selectAction = (value: MovementType) => {
    setMovementType(value);
    setError('');
    if (value === 'recount') setBalance(String(Math.round(current)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.stockMovements.create(product.id, {
        movement_type: movementType,
        unit: movementUnit,
        expected_balance: current,
        idempotency_key: idempotencyKey,
        ...(movementType === 'recount' ? { balance: next } : { quantity: amount }),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reference.trim() ? { source_invoice_number: reference.trim() } : {}),
      });
      onRecorded(Number(result.after_balance), movementUnit);
      setCurrentBalance(Number(result.after_balance));
      await queryClient.invalidateQueries({ queryKey: ['stock_ledger', product.id] });
      setQuantity('');
      setNote('');
      setReference('');
      setBalance(String(result.after_balance));
      setIdempotencyKey(crypto.randomUUID());
    } catch (caught: any) {
      if (caught instanceof ApiError && caught.status === 409 && Number.isFinite(Number(caught.data?.current_balance))) {
        const latest = Number(caught.data?.current_balance);
        setCurrentBalance(latest);
        setIdempotencyKey(crypto.randomUUID());
        setError(`Stock changed to ${latest}${movementUnit === 'unit' ? ' units' : 'g'}. Review and retry.`);
      } else {
        setError(caught?.message || 'Movement could not be recorded. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const unit = product.type === 'Teaware' ? ' units' : 'g';

  return (
    <div className="fixed inset-0 z-modal flex items-stretch justify-end bg-tea-bg/70" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Change stock — ${product.productName || product.givenName}`}
        className="h-full w-full sm:max-w-[520px] bg-tea-elevated border-l border-tea-border flex flex-col overflow-hidden"
      >
        <header className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-tea-border">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close stock movement" className="tap-target text-tea-text-sec hover:text-tea-text transition-colors">
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-ui-17 text-tea-text">Change stock</h2>
            <p className="text-ui-12 text-tea-text-sec truncate">{product.givenName || product.productName} · {current}{unit}</p>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-nav-gap">
          <form onSubmit={submit} className="space-y-4">
            <div role="group" aria-label="Movement type" className="flex flex-wrap gap-2">
              {ACTIONS.map(action => (
                <button
                  key={action.value}
                  type="button"
                  aria-pressed={movementType === action.value}
                  onClick={() => selectAction(action.value)}
                  className={`tap-target rounded-md border px-3 py-2 text-ui-12 transition-colors ${movementType === action.value ? 'border-tea-gold bg-tea-accent-sub text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <label className="block text-ui-12 text-tea-text-sec">
              {movementType === 'recount' ? 'New balance' : 'Quantity'}
              <input
                aria-label={movementType === 'recount' ? 'New balance' : 'Quantity'}
                type="number"
                min="0"
                step="any"
                value={movementType === 'recount' ? balance : quantity}
                onChange={event => movementType === 'recount' ? setBalance(event.target.value) : setQuantity(event.target.value)}
                className="admin-input mt-1 w-full"
              />
            </label>

            {transferUnavailable && <p className="rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-12 text-tea-text-sec">Transfer is unavailable until holdings can be explicitly related. Matching tea type alone is not a safe destination.</p>}

            <div aria-live="polite" className="rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-14 text-tea-text tabular-nums">
              {Number.isFinite(next) ? `${current}${unit} → ${next}${unit}` : `${current}${unit} → —`}
            </div>
            {insufficient && <p className="text-ui-12 text-tea-error">Only {current}{unit} available</p>}

            <label className="block text-ui-12 text-tea-text-sec">
              Note
              <textarea aria-label="Movement note" value={note} onChange={event => setNote(event.target.value)} rows={2} className="admin-input mt-1 w-full resize-none" />
            </label>
            <label className="block text-ui-12 text-tea-text-sec">
              Reference
              <input aria-label="Movement reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="Invoice, message, or receipt" className="admin-input mt-1 w-full" />
            </label>

            {error && <div role="alert" className="rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-12 text-tea-error">{error}</div>}
            <div className="flex justify-between items-center border-t border-tea-border pt-3">
              <button type="button" onClick={onClose} className="tap-target text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button>
              <button type="submit" disabled={!canSubmit} className="tap-target rounded-md bg-tea-gold px-4 py-2 text-ui-13 text-tea-bg disabled:opacity-50 inline-flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Record movement
              </button>
            </div>
          </form>

          <div className="mt-6">
            <StockLedgerPanel productId={product.id} productName={product.givenName || product.productName} />
          </div>
        </div>
      </section>
    </div>
  );
};
