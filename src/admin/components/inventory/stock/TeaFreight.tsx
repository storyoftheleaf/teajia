import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../../components/shared/Button';
import { api } from '../../../../lib/api';
import { rateToUsd } from '../../../../lib/currency';
import type { ExchangeRate, Product } from '../../../types';
import { calculatePricing } from '../../../utils';
import { shippingRateUsdFor, shopRateInCurrency } from '../../../../lib/shippingRate';
import { serviceQuotePerKgUsd, serviceRatesFromRows } from '../../../../lib/freightSource';
import { serviceRateLabel } from '../LogisticsServices';
import { TeaLine } from './TeaPage';
import { clearPriceLine, freightClearPreview } from './freightModel';

// How the tea travels home, on the open tea's Price part (Adrian, 2026-11-27).
// The tea only names the logistics service it ships by. The rates belong to the
// logistics companies and are edited in Logistics, never here: this part shows
// the freight that results and where it came from (src/lib/freightSource.ts).

const usd = (value: number | null | undefined) => value == null ? null : `$${value.toFixed(2)}`;

export function TeaFreight({ product, shopPerKgUsd, rates, costRateToUsd, onChoose, onClearOwnRate, onOpenLogistics }: {
  product: Product;
  shopPerKgUsd: number | null;
  rates: ExchangeRate[];
  /** Units of the tea's cost currency per USD, or null when there is no rate. */
  costRateToUsd: number | null;
  onChoose: (serviceId: string | null) => Promise<unknown> | unknown;
  /** Hands a tea that carries its own rate back to its service or the shop default. */
  onClearOwnRate?: () => Promise<unknown> | unknown;
  onOpenLogistics: () => void;
}) {
  const { data } = useQuery({ queryKey: ['logistics-tracking'], queryFn: () => api.logistics.tracking(), staleTime: 60_000 });
  const services = (data?.services ?? []).filter(service => service.active);
  const chosen = (data?.services ?? []).find(service => service.id === product.freightServiceId) ?? null;
  const quotes = serviceRatesFromRows(services, currency => rateToUsd(rates, currency));

  /** What a gram would sell for with this freight a kilo, at cost and freight times 3. */
  const priceAt = (perKgUsd: number | null): number | null => {
    const freight = perKgUsd === null ? null : shopRateInCurrency(perKgUsd, costRateToUsd);
    if (freight === null || product.costAmount == null || !(product.quantityPurchased > 0)) return null;
    const calc = calculatePricing(product.costAmount, freight, product.quantityPurchased, product.costCurrency || 'UNK', rates, false);
    return calc.suggestedRetailUSD > 0 ? calc.suggestedRetailUSD : null;
  };
  const showPrices = product.fixedRetailPriceUSD == null && product.shippingRatePerKg == null;
  const option = (word: string, perKgUsd: number | null) => {
    const price = showPrices ? usd(priceAt(perKgUsd)) : null;
    return price ? `${word}, ${price} a gram` : word;
  };

  const ownRate = product.shippingRatePerKg != null;
  const fallback = product.freightFallbackPerKgUsd !== undefined ? product.freightFallbackPerKgUsd : shopPerKgUsd;
  const shown = ownRate ? shippingRateUsdFor(product.shippingRatePerKg, costRateToUsd, fallback) : fallback;
  const name = chosen ? `${chosen.logistics_company_name} ${chosen.name}` : 'the service';
  const clearPreview = ownRate ? freightClearPreview(product, rates, fallback) : null;
  const note = ownRate ? 'This tea has its own freight rate, set before rates moved to Logistics, and it wins over any service.'
    : product.freightSource === 'shipment' ? `From its last ${name} shipment${product.freightDated ? `, ${product.freightDated.slice(0, 10)}` : ''}.`
    : product.freightSource === 'service' && chosen ? `From the ${name} quote, ${serviceRateLabel(chosen)}${chosen.basis === 'm3' ? ', through the packing estimate' : ''}.`
    : product.freightFellBack === 'fixed' ? `${name} is a fixed price a shipment, so the shop rate is used until a shipment's bill is confirmed.`
    : product.freightFellBack === 'gone' ? 'Its service is no longer active, so the shop rate is used.'
    : 'Following the shop rate.';

  return <>
    <TeaLine label="Travels by">
      <div className="relative flex-1">
        <select aria-label="Travels by" value={product.freightServiceId ?? ''} onChange={event => void onChoose(event.target.value || null)}
          className="w-full bg-transparent border-0 rounded-none py-1 px-0 pr-4 outline-none appearance-none cursor-pointer text-left text-admin-text focus-visible:ring-1 focus-visible:ring-tea-gold">
          <option value="" className="bg-tea-surface text-tea-text">{option('Shop rate', shopPerKgUsd)}</option>
          {services.map(service => {
            const quote = quotes[service.id] ? serviceQuotePerKgUsd(quotes[service.id], { id: product.id, form: product.form }, data?.packing_sizes) : null;
            return <option key={service.id} value={service.id} className="bg-tea-surface text-tea-text">
              {option(`${service.logistics_company_name} · ${service.name}`, quote ?? shopPerKgUsd)}
            </option>;
          })}
          {chosen && !chosen.active && <option value={chosen.id} className="bg-tea-surface text-tea-text">{chosen.logistics_company_name} · {chosen.name} (no longer active)</option>}
        </select>
      </div>
    </TeaLine>
    <TeaLine label="Freight">
      <span data-testid="tea-freight-rate" className="text-admin-text tabular-nums">{usd(shown) ?? '—'} / kg</span>
    </TeaLine>
    <div className="tea-page-note">
      {note}{' '}
      {ownRate && onClearOwnRate && clearPreview && <Button variant="plain" type="button" className="tap-target text-tea-gold" aria-label={`Clear this tea's rate: ${clearPriceLine(clearPreview)}`} onClick={() => void onClearOwnRate()}>
        <span data-testid="tea-freight-clear-preview" className="tabular-nums">{`Clear, ${clearPriceLine(clearPreview)}`}</span>
      </Button>}{' '}
      <Button variant="plain" type="button" className="tap-target text-tea-gold" onClick={onOpenLogistics}>Rates are set in Logistics</Button>
    </div>
  </>;
}
