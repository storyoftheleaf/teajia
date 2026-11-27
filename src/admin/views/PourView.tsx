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
import { TYPOGRAPHY_CLASSES, getTeaLedgerTones } from '../../designTokens';
import { useTheme } from '../../context/ThemeContext';
import { useStepParam } from '../../hooks/useStepParam';
import { useAdminBack } from '../hooks/useAdminBack';
import { BottomSheet } from '../../components/shared/BottomSheet';
import { Button } from '../../components/shared/Button';
import { addKey, byPrice, gramsOf, kindCounts, localDay, pricePerGram, matchesTea, namedKindsFrom, sitForDay, type NamedKind, type PourSit, type PourTea } from './pourPage';

type Place = { id: string; name: string; space: boolean; sat: boolean };

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
  const { theme } = useTheme();
  const [order, setOrder] = useStepParam('order', 'price');
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

  const pouredTotal = Math.round((sit?.teas ?? []).reduce((sum, one) => sum + (one.grams ?? 0), 0) * 10) / 10;
  const kinds = useMemo(() => kindCounts(teas ?? [], named), [teas, named]);
  // The kinds are the first screen; a kind, or words in the search, opens the teas.
  const inside = Boolean(kind) || Boolean(query.trim());
  const shown = useMemo(() => {
    const list = (teas ?? []).filter(tea => matchesTea(tea, kind, query, named));
    if (order === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return order === 'newest' ? list : byPrice(list);
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
            <details className="mt-2">
              <summary className={`${TYPOGRAPHY_CLASSES.bodyLight} tap-target cursor-pointer text-tea-text-sec`}>
                {sit.teas.length} {sit.teas.length === 1 ? 'tea' : 'teas'} poured{pouredTotal > 0 ? `, ${pouredTotal} g` : ''}
              </summary>
            <ol className="mt-1 flex flex-col divide-y divide-tea-border">
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
            </details>
          )}
        </section>

        {failed && <p role="alert" className={TYPOGRAPHY_CLASSES.body}>{failed}</p>}

        <div className="flex flex-col gap-2">
          <input type="search" value={query} placeholder="Find a tea" aria-label="Find a tea"
            className="btn-field w-full" onChange={event => setQuery(event.target.value, { refine: true })} />
        </div>

        {teas === null && !failed && <p role="status" className={TYPOGRAPHY_CLASSES.bodyLight}>Reading the shelf…</p>}
        {!inside && (
          <ul className="-mx-3 grid grid-cols-2 gap-px border-y border-tea-border bg-tea-border sm:mx-0 sm:grid-cols-3 sm:border-x" aria-label="Kind of tea">
            {kinds.map(one => (
              <li key={one.kind} className="min-w-0 bg-tea-bg">
                <Button type="button" variant="plain" onClick={() => setKind(one.kind)}
                  style={{ backgroundImage: `linear-gradient(to bottom right, ${getTeaLedgerTones(one.kind, theme).wash}, transparent 70%)` }}
                  className="flex h-28 w-full flex-col justify-between p-3 text-left transition-colors active:bg-tea-elevated">
                  <span className="break-words font-display text-ui-24 leading-tight text-tea-text">{one.kind}</span>
                  <span className="text-ui-11 uppercase tracking-widest text-tea-text-sec">{one.count} {one.count === 1 ? 'tea' : 'teas'}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {inside && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button type="button" variant="quiet" size="sm" className="tap-target" onClick={() => (kind ? back() : setQuery('', { refine: true }))}>All kinds</Button>
                {kind && <h2 className={TYPOGRAPHY_CLASSES.h2}>{kind}</h2>}
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Order">
                <Button type="button" variant="chip" className="tap-target" aria-pressed={order !== 'name' && order !== 'newest'} onClick={() => setOrder('price', { refine: true })}>Price, low to high</Button>
                <Button type="button" variant="chip" className="tap-target" aria-pressed={order === 'newest'} onClick={() => setOrder('newest', { refine: true })}>Newest</Button>
                <Button type="button" variant="chip" className="tap-target" aria-pressed={order === 'name'} onClick={() => setOrder('name', { refine: true })}>A to Z</Button>
              </div>
            </div>
            <ul className="-mx-3 flex flex-col divide-y divide-tea-border border-y border-tea-border sm:mx-0">
              {shown.map(one => (
                <li key={one.id}>
                  <Button type="button" variant="plain" onClick={() => setTeaId(one.id)}
                    style={{ backgroundImage: `linear-gradient(to right, ${getTeaLedgerTones(one.type || kind, theme).wash}, transparent 38%)` }}
                    className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors active:bg-tea-elevated">
                    {one.image_url && (
                      <img src={mediaUrl(one.image_url)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 break-words font-display text-ui-20 leading-tight text-tea-text">{one.name}</span>
                      <span className="text-ui-11 text-tea-text-sec">
                        {[one.year, one.sample ? 'sample' : null, `${one.stock_grams ?? 0} g`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={`${TYPOGRAPHY_CLASSES.mono} shrink-0 text-tea-text`}>{pricePerGram(one)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
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
      <div className="-mx-2 flex flex-col sm:mx-auto sm:w-full sm:max-w-sm">
        <output aria-live="polite" aria-label="Weight in grams"
          className="flex h-20 items-baseline justify-end gap-2 px-6">
          <span className="font-sans text-6xl tabular-nums leading-[5rem] text-tea-text">{typed || '0'}</span>
          <span className="font-sans text-xl text-tea-text-sec">g</span>
        </output>
        <div className="grid grid-cols-3 gap-px border-y border-tea-border bg-tea-border">
          {KEYS.map(key => (
            <Button key={key} type="button" variant="plain" aria-label={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              onClick={() => setTyped(current => addKey(current, key))}
              className="flex h-20 items-center justify-center bg-tea-bg font-sans text-3xl tabular-nums text-tea-text transition-colors active:bg-tea-elevated">
              {key === 'back' ? <Delete size={26} strokeWidth={1.5} aria-hidden /> : key}
            </Button>
          ))}
          <Button type="button" variant="plain" disabled={busy} onClick={() => onPour(null)}
            className="flex h-20 items-center justify-center bg-tea-bg font-sans text-base text-tea-text-sec transition-colors active:bg-tea-elevated disabled:opacity-50">
            No weight
          </Button>
          <Button type="button" disabled={busy || weight === null} onClick={() => onPour(weight)}
            className="col-span-2 !h-20 !rounded-none !text-xl">
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
    api('/places').then(result => { if (live && Array.isArray(result?.places)) setPlaces(result.places); }, () => undefined);
    return () => { live = false; };
  }, [open]);
  // A session invited ahead has no link of its own until its host asks for one.
  useEffect(() => { if (open && !sit.link) onChange({ link: true }); }, [open, sit.id, sit.link]); // eslint-disable-line react-hooks/exhaustive-deps

  const spaces = places.filter(place => place.space);
  const others = places.filter(place => !place.space);
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

        <label className="flex flex-col gap-1">
          <span className={TYPOGRAPHY_CLASSES.label}>The way in</span>
          <select value={sit.place?.id ?? ''} disabled={busy} className="btn-field w-full"
            onChange={event => onChange({ place_id: event.target.value || null })}>
            <option value="">None</option>
            {spaces.length > 0 && (
              <optgroup label="Your tea spaces">
                {spaces.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Places you sit at">
                {others.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>

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
