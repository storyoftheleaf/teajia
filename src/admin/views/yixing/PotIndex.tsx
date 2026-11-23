import { Button } from '../../../components/shared/Button';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, EMPTY, guidePath, KINDS, potPath, shapeEvidenceName, type Auth, type Board, type ChangeClay } from './data';
import { Thumbnail } from './Photos';

type Props = { board: Board; auth: Auth; onClay: ChangeClay; onRefresh: () => Promise<unknown> };

export function PotIndex({ board, auth, onClay, onRefresh }: Props) {
  const [params, setParams] = useSearchParams();
  const clayId = params.get('clay') || '';
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const { pots, decisions, reference } = board;
  const clays = reference.entries.filter(entry => entry.kind === 'clay');
  useEffect(() => { setSelection({}); setMessage(''); }, [clayId]);
  const group = clays.find(entry => entry.id === clayId);
  const rows = pots.map(pot => {
    const decision = decisions[pot.id] ?? EMPTY;
    const suggestions = clays.filter(entry => !decision.clay && pot.comparisonIds.includes(entry.id)
      && !decision.rejectedClays?.includes(entry.id));
    return { pot, decision, suggestions };
  });
  const needsEvidence = rows.filter(row => !row.decision.clay && !row.suggestions.length);
  const confirmed = rows.filter(row => row.decision.clay);
  let visible = rows;
  if (group) visible = rows.filter(row => row.suggestions.some(entry => entry.id === group.id));
  else if (clayId === 'evidence') visible = needsEvidence;
  else if (clayId === 'confirmed') visible = confirmed;
  const selected = visible.filter(({ pot, decision }) => selection[pot.id] === decision.revision);

  function changeGroup(value: string) {
    setParams(value ? { clay: value } : {});
  }

  async function apply(action: 'approve' | 'deny') {
    if (!group || saving || !selected.length) return;
    setSaving(true);
    setMessage('');
    let saved = 0;
    try {
      for (const { pot, decision } of selected) {
        if (!mounted.current) return;
        await onClay(pot.id, group.id, action, decision.revision);
        saved++;
      }
      if (mounted.current) setMessage(`${saved} ${saved === 1 ? 'decision' : 'decisions'} saved.`);
    } catch (error) {
      if (!mounted.current) return;
      const reason = error instanceof Error ? error.message : 'Unable to save this decision.';
      setMessage(`${saved} of ${selected.length} saves confirmed. ${reason}`);
      try { await onRefresh(); } catch { setMessage(`${reason} Reload the board to check saved decisions.`); }
    } finally {
      if (mounted.current) { setSelection({}); setSaving(false); }
    }
  }

  return <>
    <h1 className="type-page-title font-display">Teapot confirmations</h1>
    <div className="flex flex-wrap gap-3">
      <Link className={QUIET_LINK} to={guidePath()}>Yixing Wisdom</Link>
      <Link className={QUIET_LINK} to={BASE + '/photo-batch'}>Review photo replacements</Link>
    </div>
    <label className="my-3 block">Review by clay
      <select className="btn-field mt-1 block max-w-full" value={clayId} disabled={saving} onChange={e => changeGroup(e.target.value)}>
        <option value="">All pots ({pots.length})</option>
        {clays.map(entry => {
          const count = rows.filter(row => row.suggestions.some(suggestion => suggestion.id === entry.id)).length;
          return (count > 0 || group?.id === entry.id) && <option key={entry.id} value={entry.id}>{entry.name} suggestions ({count})</option>;
        })}
        <option value="evidence">Needs clay evidence ({needsEvidence.length})</option>
        <option value="confirmed">Confirmed clay ({confirmed.length})</option>
      </select>
    </label>
    {group && visible.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button variant="primary" type="button" disabled={saving || !selected.length} onClick={() => void apply('approve')}>Approve selected ({selected.length})</Button>
      <Button variant="secondary" type="button" disabled={saving || !selected.length} onClick={() => void apply('deny')}>Deny selected</Button>
    </div>}
    {(saving || message) && <p className="mb-2" role="status">{saving ? 'Saving decisions…' : message}</p>}
    {!visible.length && <p>No pots in this group.</p>}
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(({ pot, decision, suggestions }) => {
        const facts = KINDS.flatMap(kind => kind === 'shape' && decision.confirmedShape
          ? [shapeEvidenceName(decision.confirmedShape)]
          : reference.entries.filter(entry => entry.id === decision[kind] && entry.kind === kind).map(entry => entry.name));
        const status = suggestions.length ? 'Suggested · ' + suggestions.map(entry => entry.name).join(', ') : 'Needs clay evidence';
        return <li key={pot.id} className="flex min-w-0 items-center gap-2">
          {group && <label className="tap-target flex shrink-0 items-center justify-center">
            <input type="checkbox" aria-label={'Select ' + pot.name} disabled={saving}
              checked={selection[pot.id] === decision.revision} onChange={event => {
                const checked = event.target.checked;
                setSelection(previous => {
                  const next = { ...previous };
                  if (checked) next[pot.id] = decision.revision;
                  else delete next[pot.id];
                  return next;
                });
              }} />
          </label>}
          <Link to={potPath(pot.id)} className="flex min-w-0 items-center gap-2">
            <Thumbnail hash={pot.photos[0]?.sha256} auth={auth} />
            <span>{pot.name}<small className="block text-tea-text-dim">{group ? pot.clayLead?.note : (facts.join(' · ') || status)}</small></span>
          </Link>
        </li>;
      })}
    </ul>
  </>;
}
