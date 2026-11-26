// Launch 5, M4: circles and series, on the host's own page (/account/host).
//
// A circle is a named table that meets again; a series is several sessions
// under one name. The host makes one, names it, and puts their own tables in
// it or takes them out. Making one is a step in the address (?circle=new), so
// back closes the form. Nothing here is sent to anyone, and nothing counts.
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAuth } from '../../hooks/useAuth';
import { useStepParam } from '../../hooks/useStepParam';
import { api } from '../../lib/api';
import { SERIES_NAME_MAX, type HostSeries, type SeriesKind } from '../../lib/circles';
import type { HostedTableSummary } from '../../lib/hostingApi';
import { hostSmallText, hostText, tableWhen } from './hostTableParts';

const fieldClass = 'btn-field block min-h-tap w-full min-w-0';
const labelClass = `${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`;

export const KIND_WORDS: Record<SeriesKind, string> = {
  circle: 'A circle: one table that meets again',
  series: 'A series: several sessions under one name',
};

export function HostCirclesSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const circlesKey = ['host-circles', user?.email] as const;
  const tablesKey = ['host-circle-tables', user?.email] as const;
  const [step, setStep] = useStepParam('circle');
  const circles = useQuery({ queryKey: circlesKey, queryFn: () => api.circles.list(), retry: false });
  const tables = useQuery({ queryKey: tablesKey, queryFn: () => api.tables.list(), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: circlesKey });

  const list = circles.data?.circles ?? [];
  const placed = new Set(list.flatMap(circle => circle.tables.map(table => table.id)));
  const loose = (tables.data?.tables ?? []).filter(table => !placed.has(table.id));

  return (
    <section aria-labelledby="host-circles-heading" className="mt-8 space-y-3 border-t border-tea-border pt-4" data-testid="host-circles">
      <h2 id="host-circles-heading" className={TYPOGRAPHY_CLASSES.h2}>Circles and series</h2>
      <p className={hostSmallText}>A circle is a table that meets again. A series is several sessions under one name.</p>
      {circles.isPending && <p className={hostSmallText} role="status">Opening your circles…</p>}
      {circles.isError && <p className={hostSmallText} role="alert">Could not open your circles. Reload to try again.</p>}
      {list.map(circle => (
        <CircleCard key={circle.id} circle={circle} loose={loose} onChanged={refresh} />
      ))}
      {step === 'new' ? (
        <MakeCircle onCancel={() => setStep(null)} onMade={() => { void refresh(); setStep(null); }} />
      ) : circles.data && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" className="tap-target" onClick={() => setStep('new')}>Make a circle or series</Button>
        </div>
      )}
    </section>
  );
}

function MakeCircle({ onCancel, onMade }: { onCancel: () => void; onMade: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SeriesKind>('circle');
  const make = useMutation({ mutationFn: api.circles.make, retry: false, onSuccess: onMade });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (make.isPending || !name.trim()) return;
    make.mutate({ name: name.trim(), kind });
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="host-circle-new">
      <label className={labelClass}>
        Name
        <input type="text" className={fieldClass} maxLength={SERIES_NAME_MAX} required value={name}
          placeholder="Thursday tea" onChange={event => setName(event.target.value)} />
      </label>
      <fieldset>
        <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>What it is</legend>
        {(['circle', 'series'] as const).map(value => (
          <label key={value} className={`${hostText} flex min-h-tap items-center gap-2`}>
            <input type="radio" name="host-circle-kind" value={value} checked={kind === value}
              onChange={() => setKind(value)} className="accent-tea-gold" />
            {KIND_WORDS[value]}
          </label>
        ))}
      </fieldset>
      {make.isError && <p className={hostSmallText} role="alert">{(make.error as Error).message || 'Could not save. Try again.'}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={make.isPending || !name.trim()}>
          {make.isPending ? 'Making it…' : 'Make it'}
        </Button>
      </div>
    </form>
  );
}

function CircleCard({ circle, loose, onChanged }: { circle: HostSeries; loose: HostedTableSummary[]; onChanged: () => void }) {
  const [choice, setChoice] = useState('');
  const place = useMutation({
    mutationFn: ({ tableId, circleId }: { tableId: string; circleId: string | null }) => api.circles.place(tableId, circleId),
    retry: false,
    onSuccess: () => { setChoice(''); onChanged(); },
  });
  const chosen = loose.some(table => table.id === choice) ? choice : '';

  return (
    <article className="space-y-2 rounded-md border border-tea-border bg-tea-surface p-3" data-testid="host-circle" aria-label={circle.name}>
      <h3 className={`${TYPOGRAPHY_CLASSES.h3} break-words`}>{circle.name}</h3>
      <p className={hostSmallText}>{circle.kind === 'series' ? 'Series' : 'Circle'}</p>
      {circle.tables.length > 0 ? (
        <ul className="space-y-2">
          {circle.tables.map(table => (
            <li key={table.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className={`${hostText} min-w-0 break-words`}>{table.title}, {tableWhen(table.event_date, table.timezone)}</span>
              <Button type="button" variant="quiet" className="tap-target" disabled={place.isPending}
                onClick={() => place.mutate({ tableId: table.id, circleId: null })}>Take out</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={hostSmallText}>No tables in it yet.</p>
      )}
      {loose.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${labelClass} flex-1`}>
            Put a table in
            <select className={fieldClass} value={chosen} onChange={event => setChoice(event.target.value)}>
              <option value="">Choose one of your tables</option>
              {loose.map(table => (
                <option key={table.id} value={table.id}>{table.title}, {tableWhen(table.event_date, table.timezone)}</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" className="tap-target" disabled={!chosen || place.isPending}
            onClick={() => place.mutate({ tableId: chosen, circleId: circle.id })}>Put it in</Button>
        </div>
      )}
      {place.isError && <p className={hostSmallText} role="alert">{(place.error as Error).message || 'Could not save. Try again.'}</p>}
    </article>
  );
}
