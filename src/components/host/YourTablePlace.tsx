// Launch 4, slice K4, "Add your table"
// (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
//
// On the host's own page: name saved places as tea spaces (several since 2026-11-27), add one, or undo one.
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
import { SpacePourLink } from './PourLink';

const AREA_MAX = 80;
const fieldClass = 'btn-field block min-h-tap w-full min-w-0';

export function YourTablePlaceSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['your-table', user?.email] as const;
  const [step, setStep] = useStepParam('your-table');
  const answer = useQuery({ queryKey: key, queryFn: () => api.hosting.yourTable(), ...PART_QUERY });
  // The host's tables, as their page already reads them: a tea space pours into the one that sits there today.
  const tables = useQuery({ queryKey: ['host-tables-last', user?.email], queryFn: () => api.tables.list(), retry: false, staleTime: 0 });
  const view = partView(answer);
  const settle = (next: YourTableAnswer) => queryClient.setQueryData(key, next);
  const undo = useMutation({ mutationFn: (placeId: string) => api.hosting.undoYourTable(placeId), retry: false, onSuccess: settle });
  const show = useMutation({
    mutationFn: ({ placeId, shown }: { placeId: string; shown: boolean }) => api.hosting.showTeaSpace(placeId, shown),
    retry: false, onSuccess: settle,
  });

  const places = answer.data?.places ?? [];
  // A host may have several tea spaces (tea spaces, step 2, 2026-11-27).
  const spaces = places.filter(place => place.is_table);
  const others = places.filter(place => !place.is_table);
  const choosing = step === 'choose' && others.length > 0;
  const adding = step === 'add';
  // Not open on the worker yet: the part is not offered (A10-3).
  if (view.state === 'closed') return null;

  return (
    <section aria-labelledby="your-table-heading" className="mt-8 space-y-3 border-t border-tea-border pt-4" data-testid="your-table">
      <h2 id="your-table-heading" className={TYPOGRAPHY_CLASSES.h2}>Your tea space</h2>
      {answer.isPending && <p className={hostSmallText} role="status">Opening your places…</p>}
      {view.state === 'failed' && <LoadFailed sentence="Could not open your places just now." onRetry={view.retry} />}
      {answer.data && !choosing && !adding && (
        <div className="space-y-3">
          {spaces.length > 0 ? (
            <ul className="space-y-2" data-testid="your-table-chosen">
              {spaces.map(space => (
                <li key={space.id} className="space-y-1" data-testid="tea-space">
                  <p className={hostText}>{space.name} is your tea space.</p>
                  <p className={hostSmallText}>
                    People looking at your sessions there see only “{space.area_hint ?? 'your tea space'}”. The address and the way in stay with guests you say yes to.
                  </p>
                  {/* Tea spaces, step 3: off the tea spaces page until the host turns it on, and then by its area only. */}
                  <label className={`${hostSmallText} flex min-h-tap items-center gap-2`}>
                    <input type="checkbox" className="accent-tea-gold" checked={space.shown === true}
                      disabled={show.isPending} data-testid="tea-space-shown"
                      onChange={event => show.mutate({ placeId: space.id, shown: event.target.checked })} />
                    Show it on the tea spaces page, by its area only
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <SpacePourLink placeId={space.id} tables={tables.data?.tables} />
                    <Button type="button" variant="quiet" className="tap-target" disabled={undo.isPending} onClick={() => undo.mutate(space.id)}>
                      {undo.isPending && undo.variables === space.id ? 'Undoing…' : 'Undo'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={hostText}>
              {places.length
                ? 'Name one of your places as your tea space, or add a new one. It stays private: people see only the area you write.'
                : 'Add your tea space by its name and the area it is in. People see only the area you write.'}
            </p>
          )}
          {undo.isError && <p className={hostSmallText} role="alert">Could not undo. Try again in a moment.</p>}
          {show.isError && <p className={hostSmallText} role="alert">Could not change the tea spaces page. Try again in a moment.</p>}
          <div className="flex flex-wrap items-center gap-2">
            {others.length > 0 && (
              <Button type="button" variant="secondary" className="tap-target" onClick={() => setStep('choose')}>
                {spaces.length ? 'Choose another place' : 'Add your tea space'}
              </Button>
            )}
            <Button type="button" variant={others.length > 0 ? 'quiet' : 'secondary'} className="tap-target" onClick={() => setStep('add')} data-testid="tea-space-add">
              Add a new tea space
            </Button>
          </div>
        </div>
      )}
      {choosing && <ChooseTable key="choose" places={others} current={undefined} onDone={next => { settle(next); setStep(null); }} onCancel={() => setStep(null)} />}
      {adding && <AddTeaSpace onDone={next => { settle(next); setStep(null); }} onCancel={() => setStep(null)} />}
    </section>
  );
}

/** A new tea space: a name and the area, nothing more. The way in is added from a table's page, as before. */
function AddTeaSpace({ onDone, onCancel }: { onDone: (next: YourTableAnswer) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const add = useMutation({ mutationFn: api.hosting.addTeaSpace, retry: false, onSuccess: onDone });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (add.isPending) return;
    add.mutate({ name: name.trim(), area_hint: area.trim() });
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="tea-space-add-form">
      <label className={`${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`}>
        Its name
        <input type="text" className={fieldClass} maxLength={80} required value={name}
          placeholder="The garden room" onChange={event => setName(event.target.value)} />
      </label>
      <label className={`${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`}>
        The area people see
        <input type="text" className={fieldClass} maxLength={AREA_MAX} required value={area}
          placeholder="Ubud, near the market" aria-describedby="tea-space-area-help" onChange={event => setArea(event.target.value)} />
      </label>
      <p id="tea-space-area-help" className={hostSmallText}>Only the area, never the street or number. Guests you say yes to get the way in.</p>
      {add.isError && <p className={hostSmallText} role="alert">{(add.error as Error).message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={add.isPending || !name.trim() || !area.trim()}>
          {add.isPending ? 'Saving…' : 'Add this tea space'}
        </Button>
      </div>
    </form>
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
        <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Which place is your tea space</legend>
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
          {choose.isPending ? 'Saving…' : 'Make this my tea space'}
        </Button>
      </div>
    </form>
  );
}
