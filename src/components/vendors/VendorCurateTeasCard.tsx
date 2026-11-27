import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { vendorLinks } from './vendorLinks';

/** The fields of a Curate record this card reads (GET /api/compass/entries?vendor_id=). */
export interface VendorCurateTea {
  id: string;
  name?: string | null;
  given_name?: string | null;
  chinese_name?: string | null;
  type?: string | null;
  year?: number | null;
  status?: string | null;
  draft_product_id?: string | null;
}

/** Curate statuses (CompassStatus in components/TeaCompass/types.ts) in plain words. */
const STATUS_WORDS: Record<string, string> = {
  noted: 'Noted', want: 'Wanted', pass: 'Passed', buying: 'Buying', incoming: 'On the way',
  in_stock: 'In stock', depleted: 'Finished', available_to_taste: 'To taste',
};
const statusWord = (status?: string | null) => status ? STATUS_WORDS[status] ?? status.replace(/_/g, ' ') : '';

/** Teas from this vendor that live in Curate: samples, quotes, teas not yet in Stock. Hidden when there are none. */
export function curateTeasToShow(entries: VendorCurateTea[] | undefined, stockedIds: Set<string>): VendorCurateTea[] {
  return (entries ?? []).filter(entry => entry?.id && !(entry.draft_product_id && stockedIds.has(entry.draft_product_id)));
}

/**
 * The vendor's teas in Curate, each opening its own record. Teas already
 * listed under Products supplied are left out so nothing shows twice.
 */
export const VendorCurateTeasCard: React.FC<{ vendorId: string; stockedIds: Set<string> }> = ({ vendorId, stockedIds }) => {
  const scope = usePrivateQueryScope();
  const { data } = useQuery<{ entries?: VendorCurateTea[] }>({
    queryKey: ['vendor-curate-teas', vendorId, ...scope.key],
    queryFn: () => api.compass.list({ vendor_id: vendorId }),
    enabled: !!vendorId && scope.ready,
    staleTime: 60_000,
  });
  const teas = curateTeasToShow(Array.isArray(data?.entries) ? data!.entries : [], stockedIds);
  if (!teas.length) return null;

  return (
    <section className="bg-tea-surface border border-tea-border rounded-xl p-5" data-testid="vendor-curate-teas">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="h3">In Curate</h3>
        <span className="label-caps text-tea-text-dim">{teas.length}</span>
      </div>
      <div className="border-t border-tea-border">
        {teas.map(tea => (
          <Link
            key={tea.id}
            to={vendorLinks.curateTea(tea.id)}
            className="flex items-center gap-3 py-3 border-b border-tea-border last:border-0 -mx-2 px-2 rounded-md transition-colors hover:bg-tea-accent-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-ui-13 text-tea-text truncate">{tea.given_name || tea.name || tea.chinese_name || 'A tea'}</p>
              <p className="label-caps text-tea-text-dim mt-0.5 truncate">{[tea.year, tea.type].filter(Boolean).join(' · ')}</p>
            </div>
            {tea.status && <span className="shrink-0 text-ui-12 text-tea-text-sec">{statusWord(tea.status)}</span>}
            <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-tea-text-dim" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
};
