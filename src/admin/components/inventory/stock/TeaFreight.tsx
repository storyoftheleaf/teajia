import { useState } from 'react';
import { Button } from '../../../../components/shared/Button';
import type { ExchangeRate, Product } from '../../../types';
import { calculatePricing } from '../../../utils';
import { shippingRateUsdFor, shopRateInCurrency } from '../../../../lib/shippingRate';
import { FREIGHT_METHODS, FREIGHT_METHOD_WORD, freightDefaultFor, type FreightDefaults, type FreightMethod } from '../../../../lib/freightMethod';
import { TeaLine } from './TeaPage';

// How the tea travels home, on the open tea's Price part (Adrian, 2026-11-26):
// Shop rate, Suitcase, Airmail or Boat, each taking its shipping route's rate
// from Settings, or a rate typed for this tea alone. Every choice shows the
// price it gives before it is picked, so no price moves unseen.

type Choice = 'shop' | FreightMethod | 'own';

const usd = (value: number | null) => value === null ? null : `$${value.toFixed(2)}`;

export function TeaFreight({ product, defaults, rates, costRateToUsd, onSave, onOpenRoutes }: {
  product: Product;
  defaults: FreightDefaults;
  rates: ExchangeRate[];
  /** Units of the tea's cost currency per USD, or null when there is no rate. */
  costRateToUsd: number | null;
  onSave: (field: 'freightMethod' | 'shippingRatePerKg', value: unknown) => Promise<unknown> | unknown;
  onOpenRoutes: () => void;
}) {
  const ownRate = product.shippingRatePerKg != null;
  const [typing, setTyping] = useState(false);
  const current: Choice = ownRate || typing ? 'own' : product.freightMethod ?? 'shop';

  /** Freight a kilo in USD for a choice, before the tea's own rate. */
  const perKgUsd = (choice: Choice): number | null => choice === 'own'
    ? shippingRateUsdFor(product.shippingRatePerKg, costRateToUsd, freightDefaultFor(product.freightMethod, defaults))
    : freightDefaultFor(choice === 'shop' ? null : choice, defaults);
  /** What a gram would sell for on that choice, at cost and freight times 3. */
  const priceFor = (choice: Choice): number | null => {
    const freightUsd = perKgUsd(choice);
    const freight = freightUsd === null ? null : shopRateInCurrency(freightUsd, costRateToUsd);
    if (freight === null || product.costAmount == null || !(product.quantityPurchased > 0)) return null;
    const calc = calculatePricing(product.costAmount, freight, product.quantityPurchased, product.costCurrency || 'UNK', rates, false);
    return calc.suggestedRetailUSD > 0 ? calc.suggestedRetailUSD : null;
  };
  const fixed = product.fixedRetailPriceUSD != null;
  const label = (choice: Choice, word: string) => {
    const price = fixed ? null : usd(priceFor(choice));
    return price ? `${word}, ${price} a gram` : word;
  };

  const choose = async (choice: Choice) => {
    if (choice === 'own') { setTyping(true); return; }
    setTyping(false);
    if (ownRate) await onSave('shippingRatePerKg', null);
    await onSave('freightMethod', choice === 'shop' ? null : choice);
  };

  const method = product.freightMethod;
  const routeRated = method ? method in defaults.methodPerKgUsd : false;
  const note = current === 'own'
    ? 'This tea has its own rate, which wins over every route.'
    : current === 'shop'
      ? 'Following the shop rate.'
      : routeRated
        ? `On the ${FREIGHT_METHOD_WORD[method!]} route.`
        : `No ${FREIGHT_METHOD_WORD[method!]} rate yet, so the shop rate is used.`;

  return <>
    <TeaLine label="Freight">
      <div className="relative flex-1">
        <select aria-label="Freight" value={current} onChange={event => void choose(event.target.value as Choice)}
          className="w-full bg-transparent border-0 rounded-none py-1 px-0 pr-4 outline-none appearance-none cursor-pointer text-left text-admin-text focus-visible:ring-1 focus-visible:ring-tea-gold">
          <option value="shop" className="bg-tea-surface text-tea-text">{label('shop', 'Shop rate')}</option>
          {FREIGHT_METHODS.map(m => <option key={m} value={m} className="bg-tea-surface text-tea-text">{label(m, FREIGHT_METHOD_WORD[m])}</option>)}
          <option value="own" className="bg-tea-surface text-tea-text">Own rate</option>
        </select>
      </div>
      <span data-testid="tea-freight-rate" className="shrink-0 text-ui-12 text-admin-text-dim tabular-nums">
        {usd(perKgUsd(current)) ?? '—'} / kg
      </span>
    </TeaLine>
    {current === 'own' && <TeaLine label="Own rate">
      {/* Entered in USD a kilo, stored in the tea's own cost currency. A typed 0
          means this tea ships free. Disabled with no exchange rate to store it in. */}
      <input aria-label="Own freight, dollars a kilo" type="number" inputMode="decimal" min={0} step="0.01"
        disabled={costRateToUsd === null}
        defaultValue={ownRate ? (perKgUsd('own') ?? '') : ''}
        placeholder={usd(perKgUsd(method ?? 'shop'))?.slice(1) ?? ''}
        className="w-full bg-transparent border-0 py-1 px-0 outline-none text-right tabular-nums text-admin-text focus-visible:ring-1 focus-visible:ring-tea-gold"
        onBlur={event => {
          const raw = event.currentTarget.value.trim();
          if (costRateToUsd === null || raw === '') return;
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0) return;
          void onSave('shippingRatePerKg', value * costRateToUsd);
        }} />
      <span className="shrink-0 text-ui-12 text-admin-text-dim">$ / kg</span>
    </TeaLine>}
    <div className="tea-page-note">
      {note}{' '}
      {current === 'own' && <><Button variant="plain" type="button" className="tap-target text-tea-gold" onClick={() => void choose(method ?? 'shop')}>Clear it</Button>{' '}</>}
      <Button variant="plain" type="button" className="tap-target text-tea-gold" onClick={onOpenRoutes}>Shipping routes</Button>
    </div>
  </>;
}
