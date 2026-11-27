// Launch 4, slice K4, "Add your table"
// (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
//
// On the host's own page: name one saved place as your table, or undo it.
// The place stays private. Guests looking at a session there see the area the
// host writes here, never the address or the way in. Choosing is a step in the
// address (?your-table=choose), so back closes the chooser.
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAuth } from '../../hooks/useAuth';
import { useStepParam } from '../../hooks/useStepParam';
import { api } from '../../lib/api';
import { PART_QUERY, partView } from '../../lib/closedPart';
import { LoadFailed } from '../shared/LoadFailed';
import type { YourTableAnswer, YourTablePlace } from '../../lib/hostingApi';
import { hostSmallText, hostText } from './hostTableParts';

const AREA_MAX = 80;
const fieldClass = 'btn-field block min-h-tap w-full min-w-0';

export function YourTablePlaceSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['your-table', user?.email] as const;
  const [step, setStep] = useStepParam('your-table');
  const answer = useQuery({ queryKey: key, queryFn: () => api.hosting.yourTable(), ...PART_QUERY });
  const view = partView(answer);
  const settle = (next: YourTableAnswer) => queryClient.setQueryData(key, next);
  const undo = useMutation({ mutationFn: api.hosting.undoYourTable, retry: false, onSuccess: settle });

  const places = answer.data?.places ?? [];
  const table = places.find(place => place.is_table);
  const choosing = step === 'choose' && places.length > 0;
  // Not open on the worker yet: the part is not offered (A10-3).
  if (view.state === 'closed') return null;

  return (
    <section aria-labelledby="your-table-heading" className="mt-8 space-y-3 border-t border-tea-border pt-4" data-testid="your-table">
      <h2 id="your-table-heading" className={TYPOGRAPHY_CLASSES.h2}>Where you serve</h2>
      {answer.isPending && <p className={hostSmallText} role="status">Opening your places…</p>}
      {view.state === 'failed' && <LoadFailed sentence="Could not open your places just now." onRetry={view.retry} />}
      {answer.data && !places.length && (
        <p className={hostText}>Keep the way in to a place from a table’s page, and you can name it as your table here.</p>
      )}
      {answer.data && places.length > 0 && !choosing && (
        table ? (
          <div className="space-y-2" data-testid="your-table-chosen">
            <p className={hostText}>{table.name} is your table.</p>
            <p className={hostSmallText}>
              People looking at your sessions there see only “{table.area_hint ?? 'your table'}”. The address and the way in stay with guests you say yes to.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" className="tap-target" disabled={undo.isPending} onClick={() => undo.mutate()}>
                {undo.isPending ? 'Undoing…' : 'Undo'}
              </Button>
              <Button type="button" variant="quiet" className="tap-target" onClick={() => setStep('choose')}>Choose another place</Button>
            </div>
            {undo.isError && <p className={hostSmallText} role="alert">Could not undo. Try again in a moment.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <p className={hostText}>Name one of your places as your table. It stays private: people see only the area you write.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" className="tap-target" onClick={() => setStep('choose')}>Add your table</Button>
            </div>
          </div>
        )
      )}
      {choosing && <ChooseTable key={table?.id ?? 'none'} places={places} current={table} onDone={next => { settle(next); setStep(null); }} onCancel={() => setStep(null)} />}
    </section>
  );
}

function ChooseTable({ places, current, onDone, onCancel }: {
  places: YourTablePlace[];
  current: YourTablePlace | undefined;
  onDone: (next: YourTableAnswer) => void;
  onCancel: () => void;
}) {
  const [placeId, setPlaceId] = useState(current?.id ?? places[0]?.id ?? '');
  const [area, setArea] = useState(current?.area_hint ?? places.find(place => place.id === (current?.id ?? places[0]?.id))?.area_hint ?? '');
  const choose = useMutation({ mutationFn: api.hosting.chooseYourTable, retry: false, onSuccess: onDone });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (choose.isPending) return;
    choose.mutate({ place_id: placeId, area_hint: area.trim() });
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="your-table-choose">
      <fieldset>
        <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Which place is your table</legend>
        {places.map(place => (
          <label key={place.id} className={`${hostText} flex min-h-tap items-center gap-2`}>
            <input type="radio" name="your-table-place" value={place.id} checked={placeId === place.id}
              onChange={() => { setPlaceId(place.id); setArea(place.area_hint ?? ''); }} className="accent-tea-gold" />
            {place.name}
          </label>
        ))}
      </fieldset>
      <label className={`${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`}>
        The area people see
        <input type="text" className={fieldClass} maxLength={AREA_MAX} required value={area}
          placeholder="Ubud, near the market" aria-describedby="your-table-area-help" onChange={event => setArea(event.target.value)} />
      </label>
      <p id="your-table-area-help" className={hostSmallText}>Only the area, never the street or number. Guests you say yes to get the way in.</p>
      {choose.isError && <p className={hostSmallText} role="alert">{(choose.error as Error).message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={choose.isPending || !placeId || !area.trim()}>
          {choose.isPending ? 'Saving…' : 'Make this my table'}
        </Button>
      </div>
    </form>
  );
}
