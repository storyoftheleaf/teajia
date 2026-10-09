import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { fmtNum } from '../../../utils/formatNumber';
import { getThemeTextColor } from '../../themeUtils';
import type { SampleHolding } from './phone/PhoneSamplesList';

// Curate samples as rows of the laptop Stock table, under the same columns as a
// tea: the Samples view is one list, not a second screen. A sample is a Curate
// tea, not a shop product, so its name opens it in Curate (rename, tastings,
// weights all live there) and its grams sit in the Stock column, never added
// to saleable stock. Unweighed stays a dash, never zero.

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);

export const CurateSampleTableRows: React.FC<{
  colKeys: string[];
  search?: string;
  rowHeight?: number;
  onCount?: (n: number) => void;
}> = ({ colKeys, search = '', rowHeight, onCount }) => {
  const accountId = useAppStore(s => s.activeAccountId);
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
                          <span> · sample</span>
                        </span>
                      </div>
                    </td>
                  );
                case 'type':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-tea-text-sec align-middle overflow-hidden">{e.type || ''}</td>;
                case 'year':
                  return <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text-sec">{e.year || '—'}</td>;
                case 'stockGrams':
                  return (
                    <td key={key} className="px-3 py-1 text-ui-13 text-right num align-middle overflow-hidden text-tea-text">
                      {h.sample_grams == null ? <span className="text-tea-error" title="Not weighed">—</span> : whole(Number(h.sample_grams))}
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
