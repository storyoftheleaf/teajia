import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teaTableOpen } from '../../lib/teaTable';
import { teaTableApi } from '../../lib/teaTableApi';
import { TEA_TABLE_HOLD_DAYS } from '../../lib/teaTableContract';
import { Button } from '../../components/shared/Button';

/**
 * The host's yes to the Tea Table for one published recap (K1's consent gate):
 * a recap is on the Tea Table only after its host puts it there, and the host
 * can take it off again. While it is on, the host may hold it at the top for a
 * few days. Nothing here counts anything.
 */
export function TeaTableRecapControl({ eventId }: { eventId: string }) {
  if (!teaTableOpen()) return null;
  return <RecapControl eventId={eventId} />;
}

function holdDay(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function RecapControl({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const key = ['tea-table', 'recap', eventId];
  const [error, setError] = useState('');
  const state = useQuery({ queryKey: key, queryFn: () => teaTableApi.recap.state(eventId), staleTime: 0 });
  const settle = (next: unknown) => { qc.setQueryData(key, next); return qc.invalidateQueries({ queryKey: ['tea-table'] }); };
  const put = useMutation({
    mutationFn: (on: boolean) => { setError(''); return teaTableApi.recap.put(eventId, on); },
    onSuccess: settle,
    onError: cause => setError(cause instanceof Error && cause.message ? cause.message : 'Could not change that.'),
  });
  const hold = useMutation({
    mutationFn: (days: number | null) => { setError(''); return teaTableApi.hold('recap', eventId, days); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tea-table'] }),
    onError: cause => setError(cause instanceof Error && cause.message ? cause.message : 'Could not change the hold.'),
  });
  const data = state.data;
  const busy = put.isPending || hold.isPending;
  return (
    <section aria-labelledby={`tea-table-recap-${eventId}`} className="rounded-md border border-tea-border bg-tea-surface p-4" data-testid="tea-table-recap-control">
      <h3 id={`tea-table-recap-${eventId}`} className="text-ui-14 font-medium text-tea-text">The Tea Table</h3>
      {state.isPending && <p role="status" className="mt-1 text-ui-12 text-tea-text-sec">Checking…</p>}
      {state.isError && <p role="alert" className="mt-1 text-ui-12 text-tea-text-sec">Could not check the Tea Table.</p>}
      {data && !data.eligible && !data.on_table && (
        <p className="mt-1 text-ui-12 text-tea-text-sec">Once this recap is published and shown publicly, you can put it on the Tea Table.</p>
      )}
      {data && data.eligible && !data.on_table && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ui-12 text-tea-text-sec">Put this session on the Tea Table, where people see what has been poured, newest first.</p>
          <Button type="button" variant="primary" size="sm" className="tap-target" disabled={busy} onClick={() => put.mutate(true)}>Put on the Tea Table</Button>
        </div>
      )}
      {data && data.on_table && (
        <div className="mt-2 space-y-2">
          <p className="text-ui-12 text-tea-text-sec">
            On the <Link to="/tea-table" className="text-tea-gold hover:text-tea-gold-lt">Tea Table</Link>.
            {data.held_until && ` Held at the top until ${holdDay(data.held_until)}.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="quiet" size="sm" className="tap-target" disabled={busy} onClick={() => put.mutate(false)}>Take it off</Button>
            {data.held_until
              ? <Button type="button" variant="secondary" size="sm" className="tap-target" disabled={busy} onClick={() => hold.mutate(null)}>Let it go</Button>
              : <Button type="button" variant="secondary" size="sm" className="tap-target" disabled={busy} onClick={() => hold.mutate(TEA_TABLE_HOLD_DAYS.usual)}>Hold at the top for {TEA_TABLE_HOLD_DAYS.usual} days</Button>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{error}</p>}
    </section>
  );
}
