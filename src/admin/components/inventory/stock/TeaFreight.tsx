import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serviceHref, shipmentHref, SHIPMENT_STATE_WORD, shipmentIsComing, teaShipments } from '../logisticsLinks';
import { JourneyChip } from '../ServiceJourneyCard';
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

  const onBoard = teaShipments(product.id, data);
  const due = (shipment: { eta: string | null; state: string }) => shipment.eta && shipment.state !== 'received' ? new Date(`${shipment.eta}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;
  const next = onBoard.find(({ shipment }) => shipmentIsComing(shipment) && shipment.eta);
  // One line on the tea page, and it is a link (Adrian, 2026-11-27): when it
  // arrives, what shipping adds to a gram, and by what. The detail lives with
  // the shipment or the service, not on the tea.
  const perGram = shown == null ? null : shown / 1000;
  const coming = next?.shipment ?? onBoard.find(({ shipment }) => shipmentIsComing(shipment))?.shipment ?? null;
  const target = coming ? shipmentHref(coming.id) : chosen ? serviceHref(chosen.id) : '/admin/purchase-orders';
  const summary = [
    coming ? (due(coming) ? `Arrives ${due(coming)}` : SHIPMENT_STATE_WORD[coming.state]) : null,
    perGram == null ? 'shipping cost unknown' : `$${perGram === 0 ? 0 : Number(perGram.toPrecision(2))}/g shipping`,
    chosen ? `${chosen.logistics_company_name} · ${chosen.name}` : ownRate ? 'its own rate' : 'shop default',
  ].filter(Boolean).join(' · ');
  return <TeaLine label="Shipping">
    <div className="flex min-w-0 flex-1 items-baseline justify-end gap-x-3">
      <Link data-testid="tea-shipping" className="tap-target min-w-0 max-w-full justify-start overflow-hidden text-admin-text tabular-nums hover:text-tea-gold-lt" title={summary} to={target}><span className="min-w-0 truncate">{summary}</span></Link>
      {ownRate && onClearOwnRate && clearPreview && <button type="button" className="tap-target shrink-0 text-ui-12 text-tea-gold" aria-label={`Clear this tea's rate: ${clearPriceLine(clearPreview)}`} onClick={() => void onClearOwnRate()}>
        <span data-testid="tea-freight-clear-preview" className="tabular-nums">{clearPreview.after == null ? "Clear" : `Clear → $${clearPreview.after.toFixed(2)}/g`}</span>
      </button>}
    </div>
  </TeaLine>;
}
