import React, { useEffect, useRef, useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { ApiError, api } from '../../../../lib/api';
import type { Product } from '../../../types';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeTextColor } from '../../../themeUtils';
import { isLow, isTeaware, isUnchecked, onHand, sellingPricePerGram } from './groupStock';
import { DEFAULT_TASTE_GRAMS } from './PhoneSamplesList';

// The tea's sheet on the phone Stock list. Every value on it is its own control:
// tap the name, the grams, the price, and type. Nothing here keeps a copy of a
// number. Field edits go through the same save the full tea page and the laptop
// table use (InventoryView's handleProductUpdate, one product row in D1), and
// stock goes through the stock ledger (api.stockMovements), so a change made here
// is the change everywhere: the list behind, the tea page, the shop.

// Three ways to change the shelf, said plainly: type what is there now (tap the
// number), take some out (−, then why), or put some in (+). Each one is a stock
// ledger movement, so the history and every screen agree with it.
type Way = 'count' | 'out' | 'in';
type OutWhy = 'sample_use' | 'gift' | 'waste';
const OUT_WHY: ReadonlyArray<readonly [OutWhy, string]> = [
  ['sample_use', 'Sampled'], ['gift', 'Gift'], ['waste', 'Waste'],
];

/** Whole numbers stay whole: 300 g, not 300.00 g. */
const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);

export interface PhoneTeaSheetProps {
  product: Product;
  onClose: () => void;
  onOpenEditor: (product: Product) => void;
  onOpenSource: (product: Product) => void;
  /** InventoryView's handleProductUpdate: optimistic, then persisted to the product row. */
  onUpdate: (id: string, field: keyof Product, value: unknown) => void;
  /** InventoryView's handleMovementRecorded: puts the ledger's new balance into the list. */
  onMovementRecorded: (productId: string, afterBalance: number, unit: 'g' | 'unit') => void;
}

/** A value that becomes its own input when tapped. Saves on Enter or leaving it, only if it changed. */
const TapField: React.FC<{
  value: string;
  label: string;
  display?: React.ReactNode;
  numeric?: boolean;
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
  onSave: (value: string) => void;
}> = ({ value, label, display, numeric, allowEmpty, className = '', inputClassName = '', onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const finish = () => {
    setEditing(false);
    if (cancelled.current) { cancelled.current = false; return; }
    const next = draft.trim();
    if (next === value.trim()) return;
    if (!next && !allowEmpty) return;
    onSave(next);
  };
  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        value={draft}
        inputMode={numeric ? 'decimal' : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
        }}
        className={`min-w-0 w-full bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-tea-text ${inputClassName}`}
      />
    );
  }
  return (
    <button type="button" aria-label={label} onClick={() => setEditing(true)} className={`min-w-0 text-left border-b border-dashed border-transparent hover:border-tea-border ${className}`}>
      {display ?? (value || '—')}
    </button>
  );
};

export const PhoneTeaSheet: React.FC<PhoneTeaSheetProps> = ({
  product, onClose, onOpenEditor, onOpenSource, onUpdate, onMovementRecorded,
}) => {
  const ware = isTeaware(product);
  const unit: 'g' | 'unit' = ware ? 'unit' : 'g';
  const unitWord = ware ? 'pc' : 'g';
  const current = onHand(product);
  const [way, setWay] = useState<Way | null>(null);
  const [amount, setAmount] = useState('');
  const [why, setWhy] = useState<OutWhy>('sample_use');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const amountRef = useRef<HTMLInputElement>(null);

  // A different tea in the same sheet starts clean.
  useEffect(() => { setWay(null); setAmount(''); setError(''); }, [product.id]);
  useEffect(() => { if (way) { amountRef.current?.focus(); amountRef.current?.select(); } }, [way]);

  const openWay = (w: Way) => {
    setWay(w);
    setError('');
    // A sample is usually 5 g, so − opens on Sampled with 5 already typed.
    setAmount(w === 'count' ? String(Math.round(current)) : w === 'out' ? String(DEFAULT_TASTE_GRAMS) : '');
    if (w === 'out') setWhy('sample_use');
  };

  const typed = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(typed) && (way === 'count' ? typed >= 0 : typed > 0);
  const next = !way || !valid ? null : way === 'count' ? typed : current + (way === 'out' ? -typed : typed);
  const tooMuch = next != null && next < 0;

  const saveStock = async () => {
    if (!way || !valid || tooMuch || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.stockMovements.create(product.id, {
        movement_type: way === 'count' ? 'recount' : way === 'in' ? 'receipt' : why,
        unit,
        expected_balance: current,
        idempotency_key: idempotencyKey,
        ...(way === 'count' ? { balance: typed } : { quantity: typed }),
      });
      onMovementRecorded(product.id, Number(result.after_balance), unit);
      setIdempotencyKey(crypto.randomUUID());
      setWay(null);
      setAmount('');
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 409 && Number.isFinite(Number(caught.data?.current_balance))) {
        const latest = Number(caught.data?.current_balance);
        onMovementRecorded(product.id, latest, unit);
        setIdempotencyKey(crypto.randomUUID());
        setError(`Someone changed it meanwhile. It is ${whole(latest)} ${unitWord} now, check and save again.`);
      } else {
        setError(caught instanceof Error ? caught.message : 'Could not save. Try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const shopPrice = sellingPricePerGram(product);
  const costPerUnit = Number.isFinite(product.costPerGramUSD) ? product.costPerGramUSD : null;
  const counted = (() => {
    if (!product.stockVerifiedAt) return null;
    const d = new Date(product.stockVerifiedAt);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })();
  const given = (product.givenName || '').trim();
  const ownGiven = given && given.toLowerCase() !== 'unnamed' && given !== product.productName ? given : '';
  const shopOn = Boolean(product.isPublic);

  const cell = 'flex min-w-0 items-baseline justify-between gap-2 border-b border-tea-border pb-1';
  const term = 'shrink-0 text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim';
  const numVal = 'font-mono text-ui-14 tabular-nums text-tea-text text-right';

  return (
    <section
      aria-label={`${product.productName}, at a glance`}
      className="sheet-behind-nav fixed left-0 right-0 z-drawer rounded-t-xl bg-tea-surface px-5 pt-2"
    >
      <div aria-hidden="true" className="mx-auto mb-3 h-[3px] w-8 rounded-full bg-tea-elevated" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Close" className="-ml-2 -my-2 flex h-11 w-8 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text"><XIcon size={16} aria-hidden="true" /></button>
        <div className="min-w-0 flex-1">
          <TapField
            value={product.productName || ''}
            label={`Rename ${product.productName}`}
            className="block w-full truncate font-display text-ui-20 font-semibold leading-tight text-tea-text"
            inputClassName="font-display text-ui-20 font-semibold leading-tight"
            onSave={v => onUpdate(product.id, 'productName', v)}
          />
        </div>
        <button type="button" onClick={() => onOpenEditor(product)} className="shrink-0 text-ui-12 text-tea-gold">Full page ›</button>
      </div>
      <div className="ml-6 mt-0.5 flex items-center gap-1.5 text-ui-12 text-tea-text-sec min-w-0">
        <span className="shrink-0" style={ware ? undefined : { color: getThemeTextColor(product.type) }}>{product.type}</span>{/* color-data: the tea kind's own colour */}
        <span aria-hidden="true">·</span>
        <TapField
          value={ownGiven}
          label={`Your name for ${product.productName}`}
          allowEmpty
          display={ownGiven || <span className="text-tea-text-dim">add your name</span>}
          className="truncate"
          inputClassName="text-ui-12 w-28"
          onSave={v => onUpdate(product.id, 'givenName', v)}
        />
        {product.vendor ? <><span aria-hidden="true">·</span><button type="button" onClick={() => onOpenSource(product)} className="truncate text-tea-text-sec underline decoration-tea-border underline-offset-2">{product.vendor}</button></> : null}
      </div>

      <div className="mt-3 border-y border-tea-border py-2.5">
        <div className="flex items-center gap-2">
          <span className={term}>On the shelf</span>
          <button type="button" onClick={() => openWay('out')} aria-pressed={way === 'out'} aria-label={`Take some ${product.productName} out`}
            className={`tap-target ml-auto flex items-center justify-center w-9 h-9 rounded-full border text-ui-20 leading-none ${way === 'out' ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text-sec'}`}>−</button>
          <button
            type="button"
            onClick={() => openWay('count')}
            aria-pressed={way === 'count'}
            aria-label={`Type a new count for ${product.productName}`}
            className={`min-w-[72px] text-center font-mono text-ui-20 tabular-nums border-b border-dashed ${way === 'count' ? 'border-tea-gold' : 'border-tea-border'} ${isLow(product) ? 'text-tea-error' : 'text-tea-text'}`}
          >
            {ware && product.quantityUnits == null ? '—' : whole(current)}
            <span className="ml-0.5 font-sans text-ui-11 text-tea-text-dim">{unitWord}</span>
          </button>
          <button type="button" onClick={() => openWay('in')} aria-pressed={way === 'in'} aria-label={`Add some ${product.productName}`}
            className={`tap-target flex items-center justify-center w-9 h-9 rounded-full border text-ui-20 leading-none ${way === 'in' ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text-sec'}`}>+</button>
        </div>
        <p className={`mt-1 text-right text-ui-11 ${counted ? 'text-tea-text-sec' : 'text-tea-error'}`}>
          {counted ? `counted ${counted}` : isUnchecked(product) ? 'never counted, tap the number to count it' : ''}
        </p>
        {way && (
          <form onSubmit={e => { e.preventDefault(); void saveStock(); }} className="mt-2 grid gap-2">
            <div className="flex items-baseline gap-2 text-ui-13 text-tea-text-sec">
              <span className="shrink-0">{way === 'count' ? 'On the shelf now' : way === 'in' ? 'Added' : 'Took out'}</span>
              <input
                ref={amountRef}
                aria-label={way === 'count' ? 'What is on the shelf' : way === 'in' ? 'How much was added' : 'How much went out'}
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setWay(null); setError(''); } }}
                className="w-20 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-right font-mono text-ui-17 tabular-nums text-tea-text"
              />
              <span className="shrink-0">{unitWord}</span>
              <span className={`ml-auto min-w-0 truncate text-ui-12 ${tooMuch ? 'text-tea-error' : 'text-tea-text-sec'}`}>
                {tooMuch ? `only ${whole(current)} ${unitWord} there` : next != null && way !== 'count' ? `leaves ${whole(next)} ${unitWord}` : ''}
              </span>
            </div>
            {way === 'out' && (
              <div role="radiogroup" aria-label="Why it went out" className="flex items-center gap-4 text-ui-13">
                {OUT_WHY.map(([r, word]) => (
                  <button key={r} type="button" role="radio" aria-checked={why === r} onClick={() => setWhy(r)}
                    className={`py-1 ${why === r ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}>{word}</button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { setWay(null); setError(''); }} className="text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button>
              <button type="submit" disabled={!valid || tooMuch || saving} className="cta-solid rounded-full px-5 py-1.5 text-ui-13 disabled:opacity-50">
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </form>
        )}
        {error && <p role="alert" className="mt-1.5 text-ui-12 text-tea-error">{error}</p>}
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-3 mb-1">
        <div className={cell}>
          <dt className={term}>{ware ? '$ ea' : '$/g'}</dt>
          <dd className="min-w-0">
            <TapField
              value={product.fixedRetailPriceUSD != null ? String(product.fixedRetailPriceUSD) : ''}
              label={`Shop price per ${ware ? 'piece' : 'gram'} for ${product.productName}`}
              numeric
              allowEmpty
              display={shopPrice == null ? '—' : fmtNum(shopPrice)}
              className={numVal}
              inputClassName={`${numVal} w-14`}
              onSave={v => onUpdate(product.id, 'fixedRetailPriceUSD', v)}
            />
          </dd>
        </div>
        {/* What it cost, per gram and in dollars, beside what it sells for. The
            invoice itself (amount, currency, how much was bought) is edited on
            the full page, where those three sit together and mean something. */}
        <div className={cell}>
          <dt className={term}>{ware ? 'Cost ea' : 'Cost/g'}</dt>
          <dd className={numVal}>{costPerUnit == null ? '—' : fmtNum(costPerUnit)}</dd>
        </div>
        <div className={cell}>
          <dt className={term}>Shop</dt>
          <dd>
            <button
              type="button"
              role="switch"
              aria-checked={shopOn}
              aria-label={`Show ${product.productName} in the shop`}
              onClick={() => onUpdate(product.id, 'isPublic', !shopOn)}
              className={`text-ui-13 ${shopOn ? 'text-tea-text' : 'text-tea-text-dim'}`}
            >{shopOn ? 'shown' : 'hidden'}</button>
          </dd>
        </div>
      </dl>
    </section>
  );
};
