import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { fmtNum } from '../../../utils/formatNumber';
import { getThemeTextColor } from '../../themeUtils';
import { useRates } from '../../hooks/useAdminData';
import { rateToUsd } from '../../../lib/currency';
import type { SampleHolding } from './phone/PhoneSamplesList';

// Curate samples as rows of the laptop Stock table, under the same columns as a
// tea: the Samples view is one list, not a second screen. A sample is a Curate
// tea, not a shop product, so its name opens it in Curate (rename, tastings,
// weights all live there) and its grams sit in the Stock column, never added
// to saleable stock. Unweighed stays a dash, never zero.

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);

/** A short mark for the money a quote is in, so it fits the Stock column. */
const SYMBOL: Record<string, string> = { yuan: '¥', cny: '¥', rmb: '¥', usd: '$', nt: 'NT$', twd: 'NT$', hkd: 'HK$', idr: 'Rp' };
const moneyMark = (c: unknown): string => SYMBOL[String(c || '').toLowerCase()] ?? String(c || '');

export const CurateSampleTableRows: React.FC<{
  colKeys: string[];
  search?: string;
  rowHeight?: number;
  onCount?: (n: number) => void;
}> = ({ colKeys, search = '', rowHeight, onCount }) => {
  const accountId = useAppStore(s => s.activeAccountId);
  const { data: rates = [] } = useRates();
  const navigate = useNavigate();
  const holdings = useQuery<SampleHolding[]>({
    queryKey: ['curate-samples-only', accountId],
    queryFn: () => api.curateWorkspace.holdings(true),
    enabled: !!accountId,
  });
  const all = holdings.data ?? [];
  useEffect(() => { onCount?.(all.length); }, [all.length, onCount]);
  const q = search.toLowerCase();
  const rows = all.filter(h => `${h.entry.name ?? ''} ${h.entry.chinese_name ?? ''} ${h.entry.vendor_name ?? ''}`.toLowerCase().includes(q));

  return (
    <>
      {rows.map(h => {
        const e = h.entry;
        const name = e.name || e.chinese_name || 'Unnamed tea';
        // The vendor's quote: an amount for a number of grams, in the currency it was quoted in.
        const amount = e.price_amount == null ? null : Number(e.price_amount);
        const perGrams = e.price_per_unit_grams == null ? null : Number(e.price_per_unit_grams);
        const usdRate = e.price_currency ? rateToUsd(rates, String(e.price_currency)) : null;
        // rateToUsd is units of that money per dollar, so dollars = amount / rate.
        const costPerGram = amount != null && perGrams && usdRate != null ? amount / usdRate / perGrams : null;
        const open = () => navigate(`/admin/compass?entry=${encodeURIComponent(String(e.id))}`);
        return (
          <tr key={`curate-${e.id}`} data-testid="curate-sample-table-row" onClick={open} className="border-b border-tea-border last:border-b-0 cursor-pointer select-none transition-colors hover:bg-tea-accent-sub" style={rowHeight ? { height: rowHeight } : undefined}>
            {colKeys.map(key => {
              switch (key) {
                case 'productName':
                  return (
                    <td key={key} className="px-3 pt-[3px] pb-[5px] align-middle overflow-hidden">
                      <div className="flex flex-col justify-center">
                        <button type="button" onClick={ev => { ev.stopPropagation(); open(); }} aria-label={`Open ${name} in Curate`}
                          className="font-display text-ui-17 leading-tight truncate font-medium text-tea-text self-start w-fit max-w-full text-left hover:text-tea-gold">{name}</button>
                        <span className="font-sans text-ui-11 text-tea-text-dim leading-none truncate block" style={{ letterSpacing: '0.02em' }}>
                          {e.year && <span className="num opacity-80 mr-1">{e.year}</span>}
                          <span style={{ color: getThemeTextColor(String(e.type || '')) }}>{e.type || 'Tea'}</span>
                          <span> · sample{h.sample_grams == null ? <span className="text-tea-error"> not weighed</span> : ` ${whole(Number(h.sample_grams))} g left`}</span>
                        </span>
                      </div>
                    </td>
                  );
                case 'type':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden">{e.type || ''}</td>;
                case 'year':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text-sec">{e.year || '—'}</td>;
                case 'stockGrams':
                  // For a sample the useful figure is the quote, what it costs for how
                  // many grams, not shelf stock. Its grams left sit under the name.
                  return (
                    <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text whitespace-nowrap" title="The quoted price, for this many grams">
                      {amount == null
                        ? <span className="text-tea-text-dim">—</span>
                        : <><span className="font-sans text-ui-10 text-tea-text-dim">{moneyMark(e.price_currency)}</span>{whole(amount)}{perGrams ? <span className="font-sans text-ui-10 text-tea-text-dim">/{whole(perGrams)}g</span> : null}</>}
                    </td>
                  );
                case 'originRegion':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden"><span className="truncate block">{e.origin_region || e.origin_country || ''}</span></td>;
                case 'form':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden truncate">{e.form || ''}</td>;
                case 'costAmount':
                  return (
                    <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text-sec whitespace-nowrap" title="The quoted price, for this many grams">
                      {amount == null ? '—' : <>{whole(amount)}<span className="ml-0.5 font-sans text-ui-10 text-tea-text-dim">{e.price_currency || ''}{perGrams ? ` / ${whole(perGrams)} g` : ''}</span></>}
                    </td>
                  );
                case 'pricePerGramUSD':
                case 'costPerGramUSD':
                  return (
                    <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text" title="What the sample's quote comes to per gram, in dollars">
                      {costPerGram == null ? '—' : <>{fmtNum(costPerGram)}<span className="ml-0.5 font-sans text-ui-10 text-tea-text-dim">/g</span></>}
                    </td>
                  );
                case 'vendor':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden truncate">{e.vendor_name || ''}</td>;
                default:
                  return <td key={key} className="px-3 py-1 align-middle" />;
              }
            })}
          </tr>
        );
      })}
    </>
  );
};
