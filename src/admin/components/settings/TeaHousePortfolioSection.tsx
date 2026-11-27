import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { mediaUrl } from '../../../lib/mediaUrl';
import { useAppStore } from '../../../lib/store';
import { TEA_HOUSES_TITLE, teaHousesOpen } from '../../../lib/teaHouses';
import { teaHousesApi } from '../../../lib/teaHousesApi';
import {
  TEA_HOUSE_PARTS, TEA_HOUSE_PART_LABELS, TEA_HOUSE_PART_PHOTOS, TEA_HOUSE_WORDS_MAX, teaHousePagePath,
  type TeaHouseContribution, type TeaHouseManage, type TeaHouseManageItem, type TeaHousePart,
} from '../../../lib/teaHousesContract';
import { useStepParam } from '../../../hooks/useStepParam';
import { usePhotoEditor } from '../../../components/shared/usePhotoEditor';
import { Button } from '../../../components/shared/Button';
import { useAdminBack } from '../../hooks/useAdminBack';
import { SpeakButton } from './SpeakButton';

/**
 * Tea houses, your part in them (Launch 4, K5 part two), in Settings, for the
 * platform owner alone. House by house, Adrian says which parts he did (the
 * room and its layout, the teaware, the tea menu, training those who pour, the
 * opening sessions, the sourcing since), one or two sentences each, typed or
 * said, with photographs; sets the order of the houses by hand; and marks a
 * house's page shown. Nothing is shown publicly until he does, and only while
 * the portfolio is open (src/lib/teaHouses.ts).
 *
 * Steps in the address: ?house=<account id> opens a house, &part=<part> opens
 * one part's words. Back walks out of each.
 */
const MANAGE_KEY = ['tea-houses', 'manage'] as const;
const SETTINGS = '/admin/account-settings';

function errorSentence(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function useSaved() {
  const qc = useQueryClient();
  return (data: TeaHouseManage) => {
    qc.setQueryData(MANAGE_KEY, data);
    qc.invalidateQueries({ queryKey: ['tea-houses'], predicate: query => query.queryKey[1] !== 'manage' });
  };
}

function Status({ house }: { house: TeaHouseManageItem }) {
  const words = !house.page || house.parts.length === 0
    ? 'Nothing said yet'
    : house.page.shown ? 'Page shown' : 'Page not shown';
  return <span className="text-ui-12 text-tea-text-sec">{words}</span>;
}

// ── One part ────────────────────────────────────────────────────────────────

function PartEditor({ house, part, saved, onDone }: {
  house: TeaHouseManageItem; part: TeaHousePart; saved: TeaHouseContribution | undefined; onDone: () => void;
}) {
  const [words, setWords] = useState(saved?.words ?? '');
  const [photographs, setPhotographs] = useState<string[]>(saved?.photographs ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { editPhoto, photoEditor } = usePhotoEditor();
  const settle = useSaved();

  const save = useMutation({
    mutationFn: () => teaHousesApi.manage.savePart(house.id, part, words.trim(), photographs),
    onSuccess: data => { settle(data); onDone(); },
    onError: cause => setError(errorSentence(cause, 'Could not save that.')),
  });
  const remove = useMutation({
    mutationFn: () => teaHousesApi.manage.removePart(house.id, part),
    onSuccess: data => { settle(data); onDone(); },
    onError: cause => setError(errorSentence(cause, 'Could not take that off.')),
  });

  const addPhotograph = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    const file = await editPhoto(picked, { title: TEA_HOUSE_PART_LABELS[part], freeShape: true });
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setPhotographs(list => [...list, url]);
    } catch (cause) {
      setError(errorSentence(cause, 'The photograph did not upload.'));
    } finally {
      setUploading(false);
    }
  };

  const busy = save.isPending || remove.isPending || uploading;
  const id = `part-words-${part}`;
  return (
    <div className="mt-3 space-y-3" data-testid="part-editor">
      <label htmlFor={id} className="block text-ui-12 text-tea-text-sec">In a sentence or two, what you did here</label>
      <textarea
        id={id}
        value={words}
        onChange={event => setWords(event.target.value)}
        maxLength={TEA_HOUSE_WORDS_MAX}
        rows={3}
        className="w-full rounded-md border border-tea-border bg-tea-bg p-3 text-ui-14 text-tea-text focus:border-tea-gold outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SpeakButton disabled={busy} onWords={said => setWords(current => (current.trim() ? `${current.trim()} ${said}` : said))} />
      </div>
      <div className="flex flex-wrap gap-2">
        {photographs.map(url => (
          <span key={url} className="relative">
            <img src={mediaUrl(url)} alt="" className="h-20 w-20 rounded-md object-cover bg-tea-elevated" />
            <Button
              variant="plain"
              type="button"
              aria-label="Take this photograph off"
              onClick={() => setPhotographs(list => list.filter(item => item !== url))}
              className="tap-target absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-tea-surface text-tea-text-sec hover:text-tea-text"
            >
              <X size={12} />
            </Button>
          </span>
        ))}
        {photographs.length < TEA_HOUSE_PART_PHOTOS && (
          <Button variant="secondary" size="sm" type="button" disabled={busy} loading={uploading} onClick={() => fileRef.current?.click()} icon={<ImagePlus size={12} />}>
            Add a photograph
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addPhotograph} />
      </div>
      {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="quiet" size="sm" type="button" onClick={onDone} disabled={busy}>Cancel</Button>
          {saved && (
            <Button variant="danger" size="sm" type="button" onClick={() => remove.mutate()} disabled={busy}>
              Not mine here
            </Button>
          )}
        </div>
        <Button variant="primary" size="sm" type="button" onClick={() => { setError(null); save.mutate(); }} disabled={busy || !words.trim()} loading={save.isPending}>
          Save
        </Button>
      </div>
      {photoEditor}
    </div>
  );
}

// ── One house ───────────────────────────────────────────────────────────────

function HouseForm({ house }: { house: TeaHouseManageItem }) {
  const back = useAdminBack(SETTINGS);
  const closePart = useAdminBack(`${SETTINGS}?house=${encodeURIComponent(house.id)}`);
  const [openPart, setOpenPart] = useStepParam('part');
  const [error, setError] = useState<string | null>(null);
  const settle = useSaved();
  const show = useMutation({
    mutationFn: (shown: boolean) => teaHousesApi.manage.show(house.id, shown),
    onSuccess: settle,
    onError: cause => setError(errorSentence(cause, 'Could not change that.')),
  });
  const shown = !!house.page?.shown;
  const said = house.parts.length > 0;

  return (
    <div data-testid="tea-house-form">
      <Button variant="quiet" size="sm" type="button" onClick={back}>All houses</Button>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-ui-16 font-medium text-tea-text break-words">{house.name}</h3>
        <Status house={house} />
      </div>
      {house.place && <p className="text-ui-12 text-tea-text-dim">{house.place}</p>}
      {!house.is_public && (
        <p className="mt-2 text-ui-12 text-tea-text-sec">This house's own page is not public, so its page here cannot be seen until it is.</p>
      )}

      <ul className="mt-4 border-t border-tea-border">
        {TEA_HOUSE_PARTS.map(part => {
          const saved = house.parts.find(item => item.part === part);
          const open = openPart === part;
          return (
            <li key={part} className="border-b border-tea-border py-3" data-testid={`part-${part}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ui-13 font-medium text-tea-text">{TEA_HOUSE_PART_LABELS[part]}</span>
                {!open && (
                  <Button variant="quiet" size="sm" type="button" onClick={() => setOpenPart(part)}>
                    {saved ? 'Change' : 'I did this here'}
                  </Button>
                )}
              </div>
              {!open && saved && (
                <>
                  <p className="mt-1 text-ui-13 text-tea-text-sec whitespace-pre-line break-words">{saved.words}</p>
                  {saved.photographs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {saved.photographs.map(url => <img key={url} src={mediaUrl(url)} alt="" className="h-12 w-12 rounded-md object-cover bg-tea-elevated" />)}
                    </div>
                  )}
                </>
              )}
              {open && <PartEditor house={house} part={part} saved={saved} onDone={closePart} />}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {shown && teaHousesOpen() && (
          <Link to={teaHousePagePath(house.slug)} className="tap-target text-ui-12 text-tea-gold hover:text-tea-gold-lt">Open the page</Link>
        )}
        {said
          ? (
            <Button variant={shown ? 'secondary' : 'primary'} size="sm" type="button" onClick={() => { setError(null); show.mutate(!shown); }} loading={show.isPending}>
              {shown ? 'Keep the page back' : 'Show the page'}
            </Button>
          )
          : <p className="text-ui-12 text-tea-text-sec">Say what you did here before its page is shown.</p>}
      </div>
      {error && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{error}</p>}
    </div>
  );
}

// ── The houses ──────────────────────────────────────────────────────────────

function HouseList({ houses, onOpen }: { houses: TeaHouseManageItem[]; onOpen: (id: string) => void }) {
  const settle = useSaved();
  const [error, setError] = useState<string | null>(null);
  const ordered = houses.filter(house => house.page);
  const others = houses.filter(house => !house.page);
  const order = useMutation({
    mutationFn: (ids: string[]) => teaHousesApi.manage.order(ids),
    onSuccess: settle,
    onError: cause => setError(errorSentence(cause, 'Could not change the order.')),
  });
  const move = (index: number, by: -1 | 1) => {
    const ids = ordered.map(house => house.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    setError(null);
    order.mutate(ids);
  };

  return (
    <div>
      {ordered.length > 0 && (
        <>
          <p className="text-ui-12 text-tea-text-sec">Your houses, in the order Work shows them.</p>
          <ol className="mt-2 border-t border-tea-border">
            {ordered.map((house, index) => (
              <li key={house.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-tea-border py-3" data-testid="portfolio-house">
                <div className="min-w-0">
                  <p className="text-ui-13 font-medium text-tea-text break-words">{house.name}</p>
                  <Status house={house} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="quiet" size="sm" type="button" disabled={index === 0 || order.isPending} onClick={() => move(index, -1)}>Up</Button>
                  <Button variant="quiet" size="sm" type="button" disabled={index === ordered.length - 1 || order.isPending} onClick={() => move(index, 1)}>Down</Button>
                  <Button variant="secondary" size="sm" type="button" onClick={() => onOpen(house.id)}>Open</Button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="mt-5 text-ui-12 text-tea-text-sec">Other houses</p>
          <ul className="mt-2 border-t border-tea-border">
            {others.map(house => (
              <li key={house.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-tea-border py-3">
                <div className="min-w-0">
                  <p className="text-ui-13 text-tea-text break-words">{house.name}</p>
                  {house.place && <p className="text-ui-12 text-tea-text-dim">{house.place}</p>}
                </div>
                <Button variant="quiet" size="sm" type="button" onClick={() => onOpen(house.id)}>Write about it</Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{error}</p>}
    </div>
  );
}

function OwnerSection() {
  const [houseId, setHouse] = useStepParam('house');
  const query = useQuery({ queryKey: MANAGE_KEY, queryFn: () => teaHousesApi.manage.list(), staleTime: 0 });
  const house = houseId ? query.data?.houses.find(item => item.id === houseId) : undefined;
  const sectionRef = useRef<HTMLElement>(null);
  // Opening a house (or arriving on one) brings the section into view: it sits low on Settings.
  useEffect(() => {
    if (houseId && query.isSuccess) sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [houseId, query.isSuccess]);
  return (
    <section ref={sectionRef} id="tea-houses" aria-labelledby="tea-houses-heading" className="mt-10 scroll-mt-6 bg-tea-surface rounded-xl border border-tea-border p-5" data-testid="tea-house-portfolio-manage">
      <h2 id="tea-houses-heading" className="label-caps text-tea-text-dim">{TEA_HOUSES_TITLE}: your part in them</h2>
      <p className="mt-1 mb-4 text-ui-12 text-tea-text-sec">
        A house's page shows only the parts you say were yours, in your words. Nobody sees it until you show it.
      </p>
      {query.isPending && <p role="status" className="text-ui-13 text-tea-text-sec">Opening the houses…</p>}
      {query.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Could not open the houses.</p>}
      {query.isSuccess && houseId && !house && <p className="text-ui-13 text-tea-text-sec">That house is not here.</p>}
      {query.isSuccess && house && <HouseForm key={house.id} house={house} />}
      {query.isSuccess && !houseId && <HouseList houses={query.data.houses} onOpen={id => setHouse(id)} />}
    </section>
  );
}

/** Shown only to the platform owner. Works while the public pages are closed, so the words can be ready first. */
export function TeaHousePortfolioSection() {
  const platformRole = useAppStore(state => state.platformRole);
  if (!teaHousesOpen() || platformRole !== 'platform_owner') return null;
  return <OwnerSection />;
}
