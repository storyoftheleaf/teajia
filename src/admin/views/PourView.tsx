// The pour page (Adrian, 2026-11-27): pull a tea out, tap it, type the weight
// or skip it. The tea joins that day's sit and the grams come out of stock.
// Nothing is started first: the day's sit is made by its first pour, and it
// can be named, placed and sent afterwards. The worker side is
// worker/src/pourSit.ts.
//
// Steps live in the address (CLAUDE.md, "Back and forward"): `tea` is the
// number pad open on one tea, `sit` is the sit's own sheet. Day, kind, search
// and order refine in place.
import React, { useEffect, useMemo, useState } from 'react';
import { Delete, Share2 } from 'lucide-react';
import { API_URL, authedFetch } from '../../lib/api';
import { mediaUrl } from '../../lib/mediaUrl';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useStepParam } from '../../hooks/useStepParam';
import { useAdminBack } from '../hooks/useAdminBack';
import { BottomSheet } from '../../components/shared/BottomSheet';
import { Button } from '../../components/shared/Button';
import { addKey, gramsOf, kindsOf, localDay, matchesTea, namedKindsFrom, sitForDay, type NamedKind, type PourSit, type PourTea } from './pourPage';

type Place = { id: string; name: string };

const api = (path: string, init?: RequestInit) => authedFetch(`${API_URL}/api/admin/pour${path}`, { reportIncident: false, ...init });
const send = (method: string, path: string, body?: unknown) =>
  api(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const grams = (value: number | null) => (value === null ? '' : `${value} g`);

export default function PourView() {
  const today = useMemo(() => localDay(new Date()), []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [day, setDay] = useStepParam('day', today);
  const [kind, setKind] = useStepParam('kind');
  const [query, setQuery] = useStepParam('q');
  const [order, setOrder] = useStepParam('order', 'newest');
  const [teaId, setTeaId] = useStepParam('tea');
  const [sheet, setSheet] = useStepParam('sit');
  const back = useAdminBack('/admin/pour');

  const [teas, setTeas] = useState<PourTea[] | null>(null);
  const [sits, setSits] = useState<PourSit[]>([]);
  const [chosenSit, setChosenSit] = useState<string | null>(null);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api('/teas').then(result => { if (live) setTeas(result.teas); }, () => { if (live) setFailed('The shelf could not be read.'); });
    return () => { live = false; };
  }, []);
  // The kinds a family holds (Liu Bao inside Dark) come from the Wisdom Base, read after the shelf is showing.
  const [named, setNamed] = useState<NamedKind[]>([]);
  useEffect(() => {
    let live = true;
    void import('../../wisdom/reference/generatedPages').then(wisdom => {
      if (live) setNamed(namedKindsFrom(wisdom.GENERATED_TEA_REFERENCE_PAGES));
    }, () => undefined);
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    setChosenSit(null);
    api(`/sits?date=${encodeURIComponent(day)}`).then(result => { if (live) setSits(result.sits); }, () => { if (live) setSits([]); });
    return () => { live = false; };
  }, [day]);

  const daySits = sits.filter(sit => sit.date.slice(0, 10) === day);
  const sit = daySits.find(one => one.id === chosenSit) ?? sitForDay(sits, day);
  const keep = (next: PourSit | null) => {
    if (!next) return;
    setSits(current => (current.some(one => one.id === next.id) ? current.map(one => (one.id === next.id ? next : one)) : [next, ...current]));
    setChosenSit(next.id);
  };
  const guard = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try { await work(); } catch (reason) { setFailed(reason instanceof Error ? reason.message : 'That did not save. Try again.'); } finally { setBusy(false); }
  };

  const kinds = useMemo(() => kindsOf(teas ?? [], named), [teas, named]);
  const shown = useMemo(() => {
    const list = (teas ?? []).filter(tea => matchesTea(tea, kind, query, named));
    return order === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [teas, kind, query, order, named]);
  const tea = teaId === 'name' ? null : (teas ?? []).find(one => one.id === teaId) ?? null;
  const typedName = query.trim();

  const pour = (weight: number | null) => guard(async () => {
    const body = {
      date: day, timezone, sit_id: sit?.id, grams: weight,
      ...(tea ? { product_id: tea.id } : { name: typedName }),
    };
    const result = await send('POST', '', body);
    keep(result.sit);
    if (tea && weight !== null) {
      const left = result.sit.teas.find((one: { id: string }) => one.id === result.poured)?.stock_grams;
      setTeas(current => (current ?? []).map(one => (one.id === tea.id && typeof left === 'number' ? { ...one, stock_grams: left } : one)));
    }
    back();
  });
  const takeBack = (menuId: string) => guard(async () => {
    const result = await send('DELETE', `/${encodeURIComponent(menuId)}`);
    keep(result.sit);
    setTeas((await api('/teas')).teas);
  });
  const openSit = () => guard(async () => {
    if (!sit) keep((await send('POST', '/sits', { date: day, timezone })).sit);
    setSheet('open');
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 lg:px-8 pb-nav-gap">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-3">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className={TYPOGRAPHY_CLASSES.h1}>Pour</h1>
          <label className="flex items-center gap-2">
            <span className={TYPOGRAPHY_CLASSES.label}>Day</span>
            <input type="date" value={day} aria-label="Day of the sit" className="btn-field"
              onChange={event => setDay(event.target.value || today, { refine: true })} />
          </label>
        </header>

        <section aria-label="This sit" className="rounded-md border border-tea-border bg-tea-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} break-words`}>{sit ? sit.title : 'Nothing poured yet'}</h2>
              {daySits.length > 1 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {daySits.map(one => (
                    <Button key={one.id} type="button" variant="chip" aria-pressed={one.id === sit?.id}
                      onClick={() => setChosenSit(one.id)}>{one.title}</Button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" variant={sit?.teas.length ? 'primary' : 'secondary'} className="tap-target" disabled={busy}
              icon={<Share2 size={16} strokeWidth={1.75} aria-hidden />} onClick={openSit}>
              Send this sit
            </Button>
          </div>
          {sit && sit.teas.length > 0 && (
            <ol className="mt-3 flex flex-col divide-y divide-tea-border">
              {sit.teas.map((poured, index) => (
                <li key={poured.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className={`${TYPOGRAPHY_CLASSES.bodyLight} w-5 shrink-0 text-tea-text-sec`}>{index + 1}</span>
                  <span className={`${TYPOGRAPHY_CLASSES.body} min-w-0 flex-1 break-words`}>{poured.name}</span>
                  <span className={`${TYPOGRAPHY_CLASSES.mono} text-tea-text-sec`}>
                    {grams(poured.grams)}{poured.short ? ', more than the shelf held' : ''}
                  </span>
                  <Button type="button" variant="quiet" size="sm" className="tap-target" disabled={busy}
                    aria-label={`Take back ${poured.name}`} onClick={() => takeBack(poured.id)}>Take back</Button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {failed && <p role="alert" className={TYPOGRAPHY_CLASSES.body}>{failed}</p>}

        <div className="flex flex-col gap-2">
          <input type="search" value={query} placeholder="Find a tea" aria-label="Find a tea"
            className="btn-field w-full" onChange={event => setQuery(event.target.value, { refine: true })} />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Kind of tea">
            <Button type="button" variant="chip" className="tap-target" aria-pressed={!kind} onClick={() => setKind(null, { refine: true })}>All</Button>
            {kinds.map(one => (
              <Button key={one} type="button" variant="chip" className="tap-target" aria-pressed={kind === one}
                onClick={() => setKind(kind === one ? null : one, { refine: true })}>{one}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Order">
            <Button type="button" variant="chip" className="tap-target" aria-pressed={order !== 'name'} onClick={() => setOrder('newest', { refine: true })}>Newest first</Button>
            <Button type="button" variant="chip" className="tap-target" aria-pressed={order === 'name'} onClick={() => setOrder('name', { refine: true })}>A to Z</Button>
          </div>
        </div>

        {teas === null && !failed && <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Reading the shelf…</p>}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map(one => (
            <li key={one.id} className="min-w-0">
              <Button type="button" variant="plain" onClick={() => setTeaId(one.id)}
                className="flex h-full w-full flex-col overflow-hidden rounded-md border border-tea-border bg-tea-surface text-left transition-colors hover:border-tea-gold focus-visible:border-tea-gold active:bg-tea-elevated">
                {one.image_url && (
                  <img src={mediaUrl(one.image_url)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                )}
                <span className="flex flex-1 flex-col gap-0.5 p-2">
                  <span className={`${TYPOGRAPHY_CLASSES.h3} line-clamp-3 break-words`}>{one.name}</span>
                  {one.product_name && one.product_name !== one.name && (
                    <span className="line-clamp-2 break-words text-ui-11 text-tea-text-sec">{one.product_name}</span>
                  )}
                  <span className="text-ui-11 text-tea-text-sec">
                    {[one.year, one.sample ? 'sample' : null, `${one.stock_grams ?? 0} g`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
        {teas !== null && typedName && (
          <div>
            <Button type="button" variant="secondary" className="tap-target" onClick={() => setTeaId('name')}>
              Pour “{typedName}” by name
            </Button>
          </div>
        )}
      </div>

      <NumberPad open={Boolean(teaId) && (Boolean(tea) || (teaId === 'name' && Boolean(typedName)))}
        name={tea ? tea.name : typedName} shelf={tea ? `${tea.stock_grams ?? 0} g on the shelf` : undefined}
        busy={busy} onClose={back} onPour={pour} />
      {sit && (
        <SitSheet open={sheet === 'open'} sit={sit} busy={busy} onClose={back}
          onChange={change => guard(async () => keep((await send('PUT', `/sits/${encodeURIComponent(sit.id)}`, change)).sit))} />
      )}
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

function NumberPad({ open, name, shelf, busy, onClose, onPour }: {
  open: boolean; name: string; shelf?: string; busy: boolean; onClose: () => void; onPour: (grams: number | null) => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open, name]);
  const weight = gramsOf(typed);

  return (
    <BottomSheet open={open} onOpenChange={next => { if (!next) onClose(); }} title={name} description={shelf}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3 px-2 pt-1">
        <output aria-live="polite" aria-label="Weight in grams"
          className="flex h-16 items-baseline justify-center gap-2 rounded-md border border-tea-border bg-tea-surface">
          <span className="font-sans text-5xl tabular-nums leading-[4rem] text-tea-text">{typed || '0'}</span>
          <span className="font-sans text-xl text-tea-text-sec">g</span>
        </output>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map(key => (
            <Button key={key} type="button" variant="plain" aria-label={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              onClick={() => setTyped(current => addKey(current, key))}
              className="flex h-16 items-center justify-center rounded-md border border-tea-border bg-tea-surface font-sans text-3xl tabular-nums text-tea-text transition-colors hover:border-tea-gold active:bg-tea-elevated">
              {key === 'back' ? <Delete size={26} strokeWidth={1.5} aria-hidden /> : key}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onPour(null)}
            className="!h-16 !text-base">
            No weight
          </Button>
          <Button type="button" disabled={busy || weight === null} onClick={() => onPour(weight)}
            className="col-span-2 !h-16 !text-xl">
            Enter
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function SitSheet({ open, sit, busy, onClose, onChange }: {
  open: boolean; sit: PourSit; busy: boolean; onClose: () => void; onChange: (change: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(sit.title);
  const [note, setNote] = useState(sit.note ?? '');
  const [places, setPlaces] = useState<Place[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setTitle(sit.title); setNote(sit.note ?? ''); setCopied(false); }, [sit.id, sit.title, sit.note, open]);
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    authedFetch(`${API_URL}/api/admin/locations`, { reportIncident: false })
      .then(result => { if (live && Array.isArray(result)) setPlaces(result); }, () => undefined);
    return () => { live = false; };
  }, [open]);
  // A session invited ahead has no link of its own until its host asks for one.
  useEffect(() => { if (open && !sit.link) onChange({ link: true }); }, [open, sit.id, sit.link]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = sit.link ?? '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <BottomSheet open={open} onOpenChange={next => { if (!next) onClose(); }} title="Send this sit" large>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-2 pt-1">
        <label className="flex flex-col gap-1">
          <span className={TYPOGRAPHY_CLASSES.label}>Name</span>
          <input type="text" value={title} maxLength={120} className="btn-field w-full"
            onChange={event => setTitle(event.target.value)}
            onBlur={() => { if (title.trim() && title.trim() !== sit.title) onChange({ title: title.trim() }); }} />
        </label>

        <div className="flex flex-col gap-1">
          <span className={TYPOGRAPHY_CLASSES.label}>The way in</span>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="chip" className="tap-target" aria-pressed={!sit.place} disabled={busy}
              onClick={() => onChange({ place_id: null })}>None</Button>
            {places.map(place => (
              <Button key={place.id} type="button" variant="chip" className="tap-target" aria-pressed={sit.place?.id === place.id} disabled={busy}
                onClick={() => onChange({ place_id: place.id })}>{place.name}</Button>
            ))}
          </div>
          {sit.place && !sit.way_open && (
            <p className={TYPOGRAPHY_CLASSES.bodyLight}>The day is over, so the link no longer shows it.</p>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className={TYPOGRAPHY_CLASSES.label}>A note to your guests</span>
          <textarea value={note} rows={4} maxLength={4000}
            className="w-full rounded-md border border-tea-border bg-tea-surface p-2 font-serif text-base text-tea-text focus:border-tea-gold focus:outline-none"
            onChange={event => setNote(event.target.value)}
            onBlur={() => { if (note.trim() !== (sit.note ?? '')) onChange({ note: note.trim() }); }} />
        </label>

        <div className="flex flex-col gap-2 border-t border-tea-border pt-3">
          <p className={`${TYPOGRAPHY_CLASSES.mono} break-all text-tea-text-sec`}>{link}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {canShare && (
              <Button type="button" variant="secondary" className="tap-target" disabled={!link}
                onClick={() => { void navigator.share({ title: sit.title, url: link }).catch(() => undefined); }}>Share</Button>
            )}
            <Button type="button" className="tap-target" disabled={!link} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
