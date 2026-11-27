import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KNOW_THIS_TEA_HEADING, knowThisTeaOpen } from '../../../lib/knowThisTea';
import { knowThisTeaApi } from '../../../lib/knowThisTeaApi';
import { questionPath, type KnowThisTeaManageItem } from '../../../lib/knowThisTeaContract';
import { Chip, SectionHeading, TextAction, dayLabel, errorSentence } from './parts';

/**
 * "Does anyone know this tea?" in Manage (Launch 5, M8), for the platform
 * owner alone, under the Tea Table section: every question put on the table,
 * newest first, with the owner's hand on it, hide it and bring it back. What
 * people wrote to the asker is theirs alone and is not read here.
 */
const MANAGE_KEY = ['tea-table', 'questions', 'manage'] as const;

function QuestionRow({ item }: { item: KnowThisTeaManageItem }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const hide = useMutation({
    mutationFn: () => { setError(null); return knowThisTeaApi.manage.hide(item.id, !item.hidden); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tea-table'] }),
    onError: cause => setError(errorSentence(cause, 'Could not change that.')),
  });
  const taken = !item.hidden && !item.showing;
  return (
    <li className="border-b border-tea-border py-4 last:border-b-0" data-testid="know-this-tea-manage-row">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {item.showing
          ? <Link to={questionPath(item.id)} className="tap-target min-w-0 break-words text-ui-13 font-medium text-tea-text hover:text-tea-gold">{item.where_from}</Link>
          : <span className="min-w-0 break-words text-ui-13 font-medium text-tea-text">{item.where_from}</span>}
        <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-dim">Question · {dayLabel(item.at)}</span>
        {item.hidden && <Chip>Hidden</Chip>}
        {taken && <Chip>Taken off by its asker</Chip>}
        {item.named && <Chip>Named: {item.named}</Chip>}
      </div>
      <p className="mt-1 text-ui-12 text-tea-text-sec">Asked by {item.by}</p>
      {!taken && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          <TextAction tone="quiet" onClick={() => hide.mutate()} disabled={hide.isPending}>{item.hidden ? 'Bring it back' : 'Hide it'}</TextAction>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-ui-11 text-tea-text-sec">{error}</p>}
    </li>
  );
}

/** Shown inside the owner's Tea Table section, only while "Does anyone know this tea?" is open. */
export function KnowThisTeaManage() {
  const open = knowThisTeaOpen();
  const query = useQuery({ queryKey: MANAGE_KEY, queryFn: () => knowThisTeaApi.manage.list(), staleTime: 0, enabled: open });
  if (!open) return null;
  return (
    <section aria-labelledby="know-this-tea-manage-heading" className="mt-8" data-testid="know-this-tea-manage">
      <SectionHeading><span id="know-this-tea-manage-heading">{KNOW_THIS_TEA_HEADING}</span></SectionHeading>
      <p className="mt-1 text-ui-12 text-tea-text-sec">What people wrote to the one who asked is theirs alone, and is not shown here.</p>
      {query.isPending && <p role="status" className="py-4 text-ui-13 text-tea-text-sec">Opening the questions…</p>}
      {query.isError && <p role="alert" className="py-4 text-ui-13 text-tea-text-sec">Could not open the questions.</p>}
      {query.isSuccess && (query.data.items.length
        ? <ul>{query.data.items.map(item => <QuestionRow key={item.id} item={item} />)}</ul>
        : <p className="py-4 text-ui-13 text-tea-text-sec">Nobody has asked about a tea yet.</p>)}
    </section>
  );
}
