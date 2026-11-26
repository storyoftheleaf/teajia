import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../../lib/store';
import { teaTableOpen } from '../../../lib/teaTable';
import { teaTableApi } from '../../../lib/teaTableApi';
import { TEA_TABLE_HOLD_DAYS, type TeaTableManageItem } from '../../../lib/teaTableContract';
import { Chip, SectionHeading, TextAction, dayLabel, errorSentence } from './parts';

/**
 * The Tea Table in Manage, for the platform owner alone (K2). Every piece put
 * on the table, newest first, with the owner's two hands on it: hold it at the
 * top for a while, and hide it (and bring it back). This is the one place the
 * number of keeps is shown; the worker refuses the list to anyone else.
 */
const MANAGE_KEY = ['tea-table', 'manage'] as const;

function keepWords(keeps: number) {
  return keeps === 1 ? 'Kept by one person' : `Kept by ${keeps} people`;
}

function ManageRow({ item }: { item: TeaTableManageItem }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const settled = () => qc.invalidateQueries({ queryKey: ['tea-table'] });
  const hide = useMutation({
    mutationFn: () => { setError(null); return teaTableApi.manage.hide(item.kind, item.id, !item.hidden); },
    onSuccess: settled,
    onError: cause => setError(errorSentence(cause, 'Could not change that.')),
  });
  const hold = useMutation({
    mutationFn: () => { setError(null); return teaTableApi.hold(item.kind, item.id, item.held_until ? null : TEA_TABLE_HOLD_DAYS.usual); },
    onSuccess: settled,
    onError: cause => setError(errorSentence(cause, 'Could not change the hold.')),
  });
  const pending = hide.isPending || hold.isPending;
  return (
    <li className="border-b border-tea-border py-4 last:border-b-0" data-testid="tea-table-manage-row">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link to={item.path} className="tap-target min-w-0 break-words text-ui-13 font-medium text-tea-text hover:text-tea-gold">{item.title}</Link>
        <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">{item.kind === 'recap' ? 'Session' : 'Tasting'} · {dayLabel(item.at)}</span>
        {item.hidden && <Chip>Hidden</Chip>}
        {!item.hidden && !item.showing && <Chip>Off the table</Chip>}
        {item.held_until && <Chip>Held until {dayLabel(item.held_until)}</Chip>}
      </div>
      <p className="mt-1 text-ui-12 text-tea-text-sec">
        {[item.by, item.keeps > 0 ? keepWords(item.keeps) : 'Not kept yet'].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4">
        {item.showing && <TextAction onClick={() => hold.mutate()} disabled={pending}>
          {item.held_until ? 'Let it go' : `Hold at the top for ${TEA_TABLE_HOLD_DAYS.usual} days`}
        </TextAction>}
        <TextAction tone="quiet" onClick={() => hide.mutate()} disabled={pending}>{item.hidden ? 'Bring it back' : 'Hide it'}</TextAction>
      </div>
      {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
    </li>
  );
}

function OwnerManage() {
  const query = useQuery({ queryKey: MANAGE_KEY, queryFn: () => teaTableApi.manage.list(), staleTime: 0 });
  return (
    <section aria-labelledby="tea-table-manage-heading" className="mt-8" data-testid="tea-table-manage">
      <SectionHeading aside={<Link to="/tea-table" className="tap-target text-ui-12 text-tea-gold hover:text-tea-gold-lt">Open the Tea Table</Link>}>
        <span id="tea-table-manage-heading">The Tea Table</span>
      </SectionHeading>
      <p className="mt-1 text-ui-12 text-tea-text-sec">Only you see how many people kept a piece.</p>
      {query.isPending && <p role="status" className="py-4 text-ui-13 text-tea-text-sec">Opening the Tea Table…</p>}
      {query.isError && <p role="alert" className="py-4 text-ui-13 text-tea-text-sec">Could not open the Tea Table.</p>}
      {query.isSuccess && (query.data.items.length
        ? <ul>{query.data.items.map(item => <ManageRow key={`${item.kind}:${item.id}`} item={item} />)}</ul>
        : <p className="py-4 text-ui-13 text-tea-text-sec">Nothing has been put on the Tea Table yet.</p>)}
    </section>
  );
}

/** Shown only to the platform owner, and only while the Tea Table is open. */
export function TeaTableManage() {
  const platformRole = useAppStore(state => state.platformRole);
  if (!teaTableOpen() || platformRole !== 'platform_owner') return null;
  return <OwnerManage />;
}
