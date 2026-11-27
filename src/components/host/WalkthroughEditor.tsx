// The `way` part of /account/host/:id (Launch 2, slice H8:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// The host walks the way to their house once, a photograph and one line at
// each point that matters, and reuses it for every table there. Each
// photograph opens in the shared photo editor first (WayStepPhoto, through
// usePhotoEditor with freeShape) and is uploaded under venue-guide/, so it is
// served private. Who sees the way is decided by the worker, not here: a guest
// the host said yes to, until the session ends (sessionWalkthrough.ts).
import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Navigation, Trash2 } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { PART_QUERY, partView } from '../../lib/closedPart';
import { LoadFailed } from '../shared/LoadFailed';
import type { HostedTableWayAnswer, HostedTableWayInput, HostedWayPlace } from '../../lib/hostingApi';
import type { VenueGuide, VenueGuideStep } from '../../types/events';
import { Button } from '../shared/Button';
import { WayStepPhoto } from '../events/WayStepPhoto';
import { hostSmallText, hostText, type HostTablePartProps } from './hostTableParts';

const STEP_MAX = 280;
const NOTE_MAX = 500;
const MAX_STEPS = 20;

interface Draft {
  steps: VenueGuideStep[];
  /** One key per step, for this page only. */
  keys: string[];
  parking_notes: string;
  arrival_notes: string;
  lost_phone: string;
  /** Kept as it was: the shop's form can set it, this editor does not ask. */
  transit_notes: string;
  address: string;
  map_link: string;
}

let keySeed = 0;
const newKey = () => `step-${++keySeed}`;

const wayQueryKey = (id: string) => ['host-table-way', id] as const;

function draftFrom(guide: VenueGuide | null, address: string | null, mapLink: string | null): Draft {
  const steps = (guide?.steps ?? []).map(step => ({ description: step.description ?? '', image_url: step.image_url }));
  return {
    steps,
    keys: steps.map(newKey),
    parking_notes: guide?.parking_notes ?? '',
    arrival_notes: guide?.arrival_notes ?? '',
    lost_phone: guide?.lost_phone ?? '',
    transit_notes: guide?.transit_notes ?? '',
    address: address ?? '',
    map_link: mapLink ?? '',
  };
}

function inputFrom(draft: Draft): HostedTableWayInput {
  const steps = draft.steps
    .map(step => ({ description: step.description.trim(), ...(step.image_url ? { image_url: step.image_url } : {}) }))
    .filter(step => step.description || step.image_url);
  const guide: VenueGuide = { steps };
  for (const field of ['parking_notes', 'arrival_notes', 'lost_phone', 'transit_notes'] as const) {
    const line = draft[field].trim();
    if (line) guide[field] = line;
  }
  const empty = !steps.length && !guide.parking_notes && !guide.arrival_notes && !guide.lost_phone && !guide.transit_notes;
  return { address: draft.address.trim() || null, map_link: draft.map_link.trim() || null, venue_guide: empty ? null : guide };
}

const NO_WAY = { address: null, map_link: null, venue_guide: null, place_id: null };
/** An answer with every part present, whatever the server left out. */
function wayAnswer(answer: Partial<HostedTableWayAnswer> | null | undefined): HostedTableWayAnswer {
  return { way: { ...NO_WAY, ...(answer?.way ?? {}) }, places: Array.isArray(answer?.places) ? answer.places : [] };
}

const hasSteps = (place: HostedWayPlace) => Boolean(place.venue_guide?.steps?.length);

export function WalkthroughEditor({ tableId }: HostTablePartProps) {
  const way = useQuery({ queryKey: wayQueryKey(tableId), queryFn: async () => wayAnswer(await api.tables.way(tableId)), ...PART_QUERY });
  const view = partView(way);
  return (
    <section aria-labelledby="host-part-way" data-host-part="way" className="space-y-5">
      <h2 id="host-part-way" className={TYPOGRAPHY_CLASSES.h2}>The way in</h2>
      <p className={hostText}>Guests see this only after your yes, and only until the session ends. A guest can still take a screenshot.</p>
      {way.isPending && <p className={hostSmallText} role="status">Opening the way in…</p>}
      {view.state === 'failed' && <LoadFailed sentence="Could not open the way in just now." onRetry={view.retry} />}
      {way.data && <WayForm tableId={tableId} answer={way.data} />}
    </section>
  );
}

function WayForm({ tableId, answer }: { tableId: string; answer: HostedTableWayAnswer }) {
  const queryClient = useQueryClient();
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(answer.way.venue_guide, answer.way.address, answer.way.map_link));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const currentPlace = answer.places.find(place => place.id === answer.way.place_id);
  const [placeName, setPlaceName] = useState(currentPlace?.name ?? '');
  const reusable = answer.places.filter(hasSteps);

  useEffect(() => { if (currentPlace && !placeName) setPlaceName(currentPlace.name); }, [currentPlace?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  function change(next: Partial<Draft> | ((previous: Draft) => Partial<Draft>)) {
    setDraft(previous => ({ ...previous, ...(typeof next === 'function' ? next(previous) : next) }));
    setDirty(true);
    setNotice(null);
  }
  // Steps are changed by their own key, so a photograph that finishes
  // uploading after the steps were moved still lands on its own step.
  function changeStep(key: string, next: Partial<VenueGuideStep>) {
    change(previous => ({ steps: previous.steps.map((step, i) => (previous.keys[i] === key ? { ...step, ...next } : step)) }));
  }
  function moveStep(index: number, by: -1 | 1) {
    change(previous => {
      const steps = [...previous.steps];
      const keys = [...previous.keys];
      steps.splice(index + by, 0, ...steps.splice(index, 1));
      keys.splice(index + by, 0, ...keys.splice(index, 1));
      return { steps, keys };
    });
  }
  function removeStep(index: number) {
    change(previous => ({ steps: previous.steps.filter((_, i) => i !== index), keys: previous.keys.filter((_, i) => i !== index) }));
  }
  function addStep() {
    change(previous => ({ steps: [...previous.steps, { description: '' }], keys: [...previous.keys, newKey()] }));
  }

  const save = useMutation({
    mutationFn: async () => wayAnswer(await api.tables.saveWay(tableId, inputFrom(draft))),
    onSuccess: saved => {
      queryClient.setQueryData(wayQueryKey(tableId), saved);
      setDraft(draftFrom(saved.way.venue_guide, saved.way.address, saved.way.map_link));
      setDirty(false);
      setNotice('Saved.');
    },
  });
  const keep = useMutation({
    mutationFn: async (name: string) => {
      if (dirty) await api.tables.saveWay(tableId, inputFrom(draft));
      await api.tables.keepWay(tableId, name);
      return wayAnswer(await api.tables.way(tableId));
    },
    onSuccess: saved => {
      queryClient.setQueryData(wayQueryKey(tableId), saved);
      setDirty(false);
      setNotice(`Kept as ${placeName.trim()} for next time.`);
    },
  });

  function copyWayFrom(place: HostedWayPlace) {
    setDraft(draftFrom(place.venue_guide, place.address, place.map_link));
    setPlaceName(place.name);
    setDirty(true);
    setNotice(`Copied in the way to ${place.name}. Save to use it for this table.`);
  }

  const failure = (save.error ?? keep.error) as Error | null;
  const busy = save.isPending || keep.isPending;
  const mapsHref = draft.map_link.trim() || (draft.address.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.address.trim())}` : '');

  return (
    <div className="space-y-6">
      {reusable.length > 0 && (
        <div className="space-y-2" data-way-reuse>
          <h3 className={TYPOGRAPHY_CLASSES.h3}>A way you kept</h3>
          <div className="flex flex-wrap gap-2">
            {reusable.map(place => (
              <Button key={place.id} type="button" size="sm" variant="secondary" className="tap-target" onClick={() => copyWayFrom(place)}>
                Use the way to {place.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className={TYPOGRAPHY_CLASSES.h3}>Steps</h3>
        {draft.steps.length === 0 && (
          <p className={hostSmallText}>No steps yet. Add one for each point where a guest might wonder which way to go.</p>
        )}
        <ol className="space-y-4">
          {draft.steps.map((step, index) => {
            const n = index + 1;
            const key = draft.keys[index];
            const lineId = `${ids}-${key}`;
            return (
              <li key={key} className="space-y-2 rounded border border-tea-border bg-tea-surface p-3" data-way-step={n}>
                <label htmlFor={lineId} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Step {n}</label>
                <input id={lineId} type="text" className="btn-field block w-full min-w-0" maxLength={STEP_MAX}
                  value={step.description} placeholder="The blue gate after the warung"
                  onChange={event => changeStep(key, { description: event.target.value })} />
                <WayStepPhoto step={n} imageUrl={step.image_url}
                  upload={async file => (await api.tables.uploadWayPhoto(tableId, file)).url}
                  onChange={url => changeStep(key, { image_url: url || undefined })} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="icon" className="tap-target" aria-label={`Move step ${n} up`}
                    disabled={index === 0} onClick={() => moveStep(index, -1)} icon={<ArrowUp size={16} aria-hidden />} />
                  <Button type="button" variant="icon" className="tap-target" aria-label={`Move step ${n} down`}
                    disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)} icon={<ArrowDown size={16} aria-hidden />} />
                  <Button type="button" variant="icon" className="tap-target" aria-label={`Remove step ${n}`}
                    onClick={() => removeStep(index)} icon={<Trash2 size={16} aria-hidden />} />
                </div>
              </li>
            );
          })}
        </ol>
        {draft.steps.length < MAX_STEPS && (
          <Button type="button" size="sm" variant="secondary" className="tap-target"
            onClick={addStep}>
            Add a step
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <h3 className={TYPOGRAPHY_CLASSES.h3}>If it helps</h3>
        {([
          ['parking_notes', 'Where to park', 'Scooters by the wall'],
          ['arrival_notes', 'What to bring or wear', 'Something warm for the evening'],
          ['lost_phone', 'A number to call if lost', '+62 812 0000 0000'],
        ] as const).map(([field, label, placeholder]) => (
          <div key={field} className="space-y-1">
            <label htmlFor={`${ids}-${field}`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</label>
            <input id={`${ids}-${field}`} type={field === 'lost_phone' ? 'tel' : 'text'} className="btn-field block w-full min-w-0"
              maxLength={NOTE_MAX} placeholder={placeholder} value={draft[field]}
              onChange={event => change({ [field]: event.target.value } as Partial<Draft>)} />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className={TYPOGRAPHY_CLASSES.h3}>The address</h3>
        <p className={hostSmallText}>Shown only to guests you have said yes to</p>
        <div className="space-y-1">
          <label htmlFor={`${ids}-address`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Address</label>
          <input id={`${ids}-address`} type="text" className="btn-field block w-full min-w-0" maxLength={300}
            value={draft.address} onChange={event => change({ address: event.target.value })} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${ids}-map`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Map link</label>
          <input id={`${ids}-map`} type="url" inputMode="url" className="btn-field block w-full min-w-0" maxLength={1000}
            placeholder="https://maps.app.goo.gl/…" value={draft.map_link} onChange={event => change({ map_link: event.target.value })} />
        </div>
        {mapsHref && (
          <a className="btn-quiet btn-sm tap-target" href={mapsHref} target="_blank" rel="noopener noreferrer">
            <Navigation size={14} aria-hidden /> Check it on a map
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {notice && <p className={`${hostSmallText} mr-auto`} role="status">{notice}</p>}
        <Button type="button" className="tap-target" disabled={busy || !dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Save the way in
        </Button>
      </div>
      {failure && <p className={hostSmallText} role="alert">{failure.message || 'Could not save. Try again.'}</p>}

      <div className="space-y-2 border-t border-tea-border pt-4" data-way-keep>
        <h3 className={TYPOGRAPHY_CLASSES.h3}>Keep this for next time</h3>
        <p className={hostSmallText}>Name the place, and the next table there can use this way in.</p>
        <label htmlFor={`${ids}-place`} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Place name</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id={`${ids}-place`} type="text" className="btn-field block min-w-0 flex-1" maxLength={120}
            placeholder="Home" value={placeName} onChange={event => setPlaceName(event.target.value)} />
          <Button type="button" variant="secondary" className="tap-target" loading={keep.isPending}
            disabled={busy || !placeName.trim() || !draft.steps.some(step => step.description.trim() || step.image_url)}
            onClick={() => keep.mutate(placeName.trim())}>
            Keep this for next time
          </Button>
        </div>
      </div>
    </div>
  );
}
