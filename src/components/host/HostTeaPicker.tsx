// The `teas` part of /account/host/:id (Launch 2, slice H6): a tea for the
// table. The host types a few letters; a tea of Teajia's shop is offered
// first, a tea of their own Tea Chest second, and the last row always adds
// what they typed, as written. A name alone is a complete entry.
//
// After a tea is added the host may give one line, "Where it is from", and a
// photograph (opened in the shared photo editor, freeShape). Both may stay
// empty for ever and nothing asks for them. No price, stock or cost here.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import type {
  HostedTableDetail, HostedTableTea, HostedTableTeaInput, HostedTableTeaMatch, HostedTableTeaSource,
} from '../../lib/hostingApi';
import { hostSmallText, hostTableQueryKey, hostText, type HostTablePartProps } from './hostTableParts';

const FROM_MAX = 200;
const SOURCE_WORDS: Record<HostedTableTeaSource, string | null> = {
  shop: 'From Teajia’s shop',
  chest: 'From your Tea Chest',
  name: null,
};

const inOrder = (teas: HostedTableTea[]) => [...teas].sort((a, b) => (a.brew_order ?? Infinity) - (b.brew_order ?? Infinity));
const sourceOf = (tea: HostedTableTea): HostedTableTeaSource => tea.source ?? 'name';
const asInput = (tea: HostedTableTea): HostedTableTeaInput => ({
  id: tea.id, source: sourceOf(tea), product_id: tea.product_id, name: tea.name ?? '', from: tea.from ?? null, photo_url: tea.photo_url ?? null,
});
const matchDetail = (match: HostedTableTeaMatch) => [match.year, match.type].filter(Boolean).join(' · ');

/** What the host has typed, settled for a moment, so the search is not asked on every key. */
function useSettled(value: string, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export function HostTeaPicker({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const teas = inOrder(detail.teas).filter(tea => tea.name);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const query = useSettled(typed.trim());
  const search = useQuery({
    queryKey: ['host-table-tea-search', tableId, query],
    queryFn: () => api.tables.teaSearch(tableId, query),
    enabled: query.length >= 2,
    retry: false,
    staleTime: 30_000,
  });
  const matches = query.length >= 2 && query === typed.trim() ? search.data?.matches ?? [] : [];

  async function save(next: HostedTableTeaInput[], done: string) {
    setBusy(true);
    setStatus('Saving…');
    try {
      const saved = await api.tables.saveTeas(tableId, next);
      queryClient.setQueryData<HostedTableDetail>(hostTableQueryKey(tableId), old => (old ? { ...old, teas: saved.teas } : old));
      setStatus(done);
      return true;
    } catch (error) {
      setStatus(error instanceof Error && error.message ? error.message : 'Could not save. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(tea: HostedTableTeaInput) {
    if (await save([...teas.map(asInput), tea], `Added ${tea.name}.`)) setTyped('');
  }

  const remove = (tea: HostedTableTea) => save(teas.filter(row => row.id !== tea.id).map(asInput), `Took off ${tea.name}.`);
  const change = (tea: HostedTableTea, patch: Partial<HostedTableTeaInput>) =>
    save(teas.map(row => (row.id === tea.id ? { ...asInput(row), ...patch } : asInput(row))), 'Saved.');

  const words = typed.trim();
  return (
    <section aria-labelledby="host-part-teas" data-host-part="teas" className="space-y-4">
      <h2 id="host-part-teas" className={TYPOGRAPHY_CLASSES.h2}>Teas</h2>
      {teas.length === 0
        ? <p className={hostText} data-host-teas-empty>No teas listed. That is fine.</p>
        : (
          <ol className="space-y-3" aria-label="Teas on the table, in pouring order" data-host-teas>
            {teas.map((tea, index) => (
              <TeaRow key={tea.id} tableId={tableId} tea={tea} position={index + 1} busy={busy}
                onRemove={() => void remove(tea)} onChange={patch => change(tea, patch)} />
            ))}
          </ol>
        )}

      <div className="space-y-2">
        <label htmlFor="host-tea-field" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Add a tea</label>
        <input id="host-tea-field" type="text" className="btn-field block min-h-tap w-full min-w-0" autoComplete="off"
          maxLength={240} value={typed} onChange={event => setTyped(event.target.value)}
          placeholder="A few letters of its name"
          onKeyDown={event => {
            if (event.key === 'Enter' && words && !busy) {
              event.preventDefault();
              void add({ source: 'name', name: words });
            }
          }} />
        {words && (
          <ul className="space-y-1" aria-label="Teas to add" data-host-tea-matches>
            {matches.map(match => (
              <li key={`${match.source}-${match.id}`}>
                <button type="button" className="btn-quiet tap-target flex w-full min-w-0 flex-wrap items-baseline justify-start gap-x-2 text-left"
                  disabled={busy} data-host-tea-match={match.source}
                  onClick={() => void add({ source: match.source, product_id: match.id, name: match.name })}>
                  <span className="text-tea-text">{match.name}</span>
                  {matchDetail(match) && <span className={hostSmallText}>{matchDetail(match)}</span>}
                  <span className={hostSmallText}>{SOURCE_WORDS[match.source]}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="btn-quiet tap-target flex w-full min-w-0 justify-start text-left break-words"
                disabled={busy} data-host-tea-match="name" onClick={() => void add({ source: 'name', name: words })}>
                Add &apos;{words}&apos; as written
              </button>
            </li>
          </ul>
        )}
      </div>
      {status && <p className={hostSmallText} role="status">{status}</p>}
    </section>
  );
}

function TeaRow({ tableId, tea, position, busy, onRemove, onChange }: {
  tableId: string; tea: HostedTableTea; position: number; busy: boolean;
  onRemove: () => void; onChange: (patch: Partial<HostedTableTeaInput>) => Promise<boolean>;
}) {
  const [from, setFrom] = useState(tea.from ?? '');
  const [photoStatus, setPhotoStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { editPhoto, photoEditor } = usePhotoEditor({ freeShape: true, title: 'Frame the photograph' });
  useEffect(() => setFrom(tea.from ?? ''), [tea.from]);
  const source = SOURCE_WORDS[sourceOf(tea)];
  const fromId = `host-tea-from-${tea.id}`;

  async function addPhoto(picked: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    const framed = await editPhoto(picked, { freeShape: true });
    if (!framed) return;
    setPhotoStatus('Adding the photograph…');
    try {
      const { url } = await api.tables.uploadTeaPhoto(tableId, framed);
      setPhotoStatus((await onChange({ photo_url: url })) ? '' : 'Could not add the photograph. Try again.');
    } catch {
      setPhotoStatus('Could not add the photograph. Try again.');
    }
  }

  return (
    <li className="space-y-2 rounded border border-tea-border bg-tea-surface p-3" data-host-tea={tea.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text break-words`}>
            <span className="text-tea-text-sec">{position}. </span>{tea.name}
          </p>
          {source && <p className={hostSmallText}>{source}</p>}
        </div>
        <Button type="button" size="sm" variant="secondary" className="tap-target" disabled={busy} onClick={onRemove}
          aria-label={`Take ${tea.name} off the table`}>Take off</Button>
      </div>
      {tea.photo_url && (
        <img src={tea.photo_url} alt={`Photograph of ${tea.name}`} className="max-h-64 w-auto max-w-full rounded border border-tea-border" loading="lazy" />
      )}
      <div className="space-y-1">
        <label htmlFor={fromId} className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Where it is from</label>
        <input id={fromId} type="text" className="btn-field block min-h-tap w-full min-w-0" maxLength={FROM_MAX}
          value={from} onChange={event => setFrom(event.target.value)}
          onBlur={() => { if (from.trim() !== (tea.from ?? '')) void onChange({ from: from.trim() || null }); }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" data-host-tea-photo-input={tea.id}
          onChange={event => void addPhoto(event.target.files?.[0])} />
        <button type="button" className="btn-quiet btn-sm tap-target" disabled={busy} onClick={() => fileRef.current?.click()}>
          {tea.photo_url ? 'Change the photograph' : 'Add a photograph'}
        </button>
        {tea.photo_url && (
          <button type="button" className="btn-quiet btn-sm tap-target" disabled={busy} onClick={() => void onChange({ photo_url: null })}>
            Take the photograph off
          </button>
        )}
      </div>
      {photoStatus && <p className={hostSmallText} role="status">{photoStatus}</p>}
      {photoEditor}
    </li>
  );
}
