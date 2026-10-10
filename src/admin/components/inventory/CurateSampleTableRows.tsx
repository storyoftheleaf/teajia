import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { fmtNum } from '../../../utils/formatNumber';
import { getThemeTextColor } from '../../themeUtils';
import { useRates } from '../../hooks/useAdminData';
import { rateToUsd } from '../../../lib/currency';
import type { SampleHolding } from './phone/PhoneSamplesList';
import { SampleDecideBar, QuoteField } from './phone/SampleDecide';
import { useLiveEntry, setSampleQuote } from './phone/sampleDecisions';
import { useTeaCompassStore } from '../../../lib/teaCompassStore';

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

  const liveEntries = useTeaCompassStore(s => s.entries);
  const [showRejected, setShowRejected] = useState(false);
  const decisionOf = (h: SampleHolding) => liveEntries.find(e => e.id === h.entry.id)?.decision ?? h.entry.decision;
  const rejectedCount = rows.filter(h => decisionOf(h) === 'passed_on').length;
  const visible = rows.filter(h => showRejected || decisionOf(h) !== 'passed_on');
  return (
    <>
      {visible.map(h => <SampleTableRow key={`curate-${h.entry.id}`} holding={h} colKeys={colKeys} rates={rates} />)}
      {rejectedCount > 0 && (
        <tr className="border-b border-tea-border">
          <td colSpan={colKeys.length} className="px-3 py-2">
            <button type="button" onClick={() => setShowRejected(v => !v)} aria-pressed={showRejected} className="text-ui-12 text-tea-text-sec hover:text-tea-text">
              {showRejected ? 'Hide rejected' : `Rejected ${rejectedCount}, show`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
};

const cellLabel = 'block font-sans text-ui-9 uppercase tracking-[0.1em] text-tea-text-dim leading-none mb-0.5';

/** One sample as a row of the Stock table: the same columns, its own meaning in each,
 *  labelled where a heading would mislead (Stock shows the quote, Retail the cost). */
const SampleTableRow: React.FC<{ holding: SampleHolding; colKeys: string[]; rates: Parameters<typeof rateToUsd>[0] }> = ({ holding: h, colKeys, rates }) => {
  const navigate = useNavigate();
  const e = h.entry;
  const live = useLiveEntry(String(e.id));
  const name = live?.name || e.name || e.chinese_name || 'Unnamed tea';
  // The vendor's quote: an amount for a number of grams, in the currency it was quoted in.
  // Unknown stays unknown (null); a typed 0 stays 0.
  const amount = live ? (live.priceAmount ?? null) : (e.price_amount == null ? null : Number(e.price_amount));
  const perGrams = live ? (live.pricePerUnitGrams ?? null) : (e.price_per_unit_grams == null ? null : Number(e.price_per_unit_grams));
  const currency = String(live?.priceCurrency ?? e.price_currency ?? '');
  const usdRate = currency ? rateToUsd(rates, currency) : null;
  // rateToUsd is units of that money per dollar, so dollars = amount / rate.
  const costPerGram = amount != null && perGrams && usdRate != null ? amount / usdRate / perGrams : null;
  const rejected = (live?.decision ?? e.decision) === 'passed_on';
  const open = () => navigate(`/admin/compass?entry=${encodeURIComponent(String(e.id))}`);
  const [error, setError] = useState('');
  const save = (field: 'amount' | 'grams') => (text: string) => { setError(''); setSampleQuote(String(e.id), field, text).catch(err => setError(err instanceof Error ? err.message : 'Could not save.')); };
  return (
    <>
    <tr data-testid="curate-sample-table-row" className={rejected ? 'opacity-60' : ''}>
      {colKeys.map(key => {
        switch (key) {
          case 'productName':
            return (
              <td key={key} className="px-3 pt-1.5 pb-2 align-top overflow-hidden">
                <button type="button" onClick={open} aria-label={`Open ${name} in Curate`}
                  className="block font-display text-ui-17 leading-tight truncate font-medium text-tea-text max-w-full text-left hover:text-tea-gold">{name}</button>
                <span className="font-sans text-ui-11 text-tea-text-dim leading-none truncate block" style={{ letterSpacing: '0.02em' }}>
                  {e.year && <span className="num opacity-80 mr-1">{e.year}</span>}
                  <span style={{ color: getThemeTextColor(String(live?.type ?? e.type ?? '')) }}>{live?.type ?? e.type ?? 'Tea'}</span>
                  <span> · sample{h.sample_grams == null ? <span className="text-tea-error"> not weighed</span> : ` ${whole(Number(h.sample_grams))} g left`}</span>
                </span>

              </td>
            );
          case 'type':
            return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-top pt-2 overflow-hidden">{live?.type ?? e.type ?? ''}</td>;
          case 'year':
            return <td key={key} className="px-3 py-1 text-ui-13 text-right num align-top pt-2 overflow-hidden text-tea-text-sec">{live?.year ?? e.year ?? '—'}</td>;
          case 'stockGrams':
          case 'costAmount':
            // For a sample the figure is the supplier's quote, an amount for a number
            // of grams, never shelf stock. Labelled, because the heading says Stock.
            return (
              <td key={key} className="px-3 py-1 text-ui-13 text-right num align-top pt-1.5 overflow-hidden text-tea-text whitespace-nowrap">
                <span className={cellLabel}>quote{currency ? ` · ${moneyMark(currency)}` : ''}</span>
                <span className="inline-flex items-baseline gap-0.5 justify-end">
                  <span className="inline-block"><QuoteField small value={amount} aria={`Cost of ${name}`} display={amount == null ? <span className="text-tea-text-dim">add</span> : whole(amount)} onSave={save('amount')} /></span>
                  <span className="font-sans text-ui-10 text-tea-text-dim">/</span>
                  <span className="inline-block"><QuoteField small value={perGrams} aria={`Grams that cost is for, ${name}`} display={perGrams == null ? <span className="text-tea-text-dim">g?</span> : <>{whole(perGrams)}<span className="font-sans text-ui-10 text-tea-text-dim">g</span></>} onSave={save('grams')} /></span>
                </span>
              </td>
            );
          case 'pricePerGramUSD':
          case 'costPerGramUSD':
            // The supplier's cost per gram, never a shop retail price: labelled so.
            return (
              <td key={key} className="px-3 py-1 text-ui-13 text-right num align-top pt-1.5 overflow-hidden text-tea-text-sec">
                <span className={cellLabel}>cost/g</span>
                {costPerGram == null ? '—' : <>${fmtNum(costPerGram)}</>}
              </td>
            );
          case 'originRegion':
            return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-top pt-2 overflow-hidden"><span className="truncate block">{e.origin_region || e.origin_country || ''}</span></td>;
          case 'form':
            return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-top pt-2 overflow-hidden truncate">{live?.form ?? e.form ?? ''}</td>;
          case 'vendor':
            return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-top pt-2 overflow-hidden truncate">{e.vendor_name || ''}</td>;
          default:
            return <td key={key} className="px-3 py-1 align-top" />;
        }
      })}
    </tr>
    <tr className="border-b border-tea-border">
      <td colSpan={colKeys.length} className="px-3 pb-2">
        <div className="max-w-[460px]"><SampleDecideBar holding={h} onTaste={open} compact /></div>
        {error && <p role="alert" className="mt-1 text-ui-12 text-tea-error">{error}</p>}
      </td>
    </tr>
    </>
  );
};
