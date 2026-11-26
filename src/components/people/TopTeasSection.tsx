import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { useAuth } from '../../hooks/useAuth';
import { useStepParam } from '../../hooks/useStepParam';
import { API_URL, authedFetch } from '../../lib/api';
import {
  isTopTeaSlot, TOP_TEA_NAME_LIMIT, TOP_TEA_NOTE_LIMIT, TOP_TEA_SLOTS, topTeaSlotLabel,
  type TopTeaPick, type TopTeaShopOption, type TopTeaSlot, type TopTeasResponse,
} from '../../lib/topTeas';
import { Button } from '../shared/Button';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { TeaCardTitle } from '../tea/TeaCard';
import { GroupHead } from './immersive';

const field = 'input-field min-h-tap px-3 py-2 text-ui-14';

export function TopTeasSection({ slug }: { slug: string }) {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useStepParam('top-tea');
  const [slot, part] = step.split('/');
  const endpoint = `${API_URL}/api/public/people/${encodeURIComponent(slug)}/top-teas`;
  const shelf = useQuery<TopTeasResponse>({
    queryKey: ['person-top-teas', slug, isAuthenticated ? user?.email : null],
    queryFn: async ({ signal }) => {
      if (isAuthenticated) return authedFetch(endpoint, {}, signal);
      const response = await fetch(endpoint, { signal });
      if (response.status === 404) return { can_edit: false, picks: [] };
      if (!response.ok) throw new Error('Could not load top teas.');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const data = shelf.data;
  if (!data || (!data.can_edit && !data.picks.length)) return null;
  const editing = data.can_edit && isTopTeaSlot(slot);
  return (
    <section className="px-6" aria-label="My top teas">
      <GroupHead label="My top teas" />
      {editing ? (
        <div className="mt-3 rounded-md border border-tea-border bg-tea-surface p-4">
          <TopTeaEditor key={slot} endpoint={endpoint} slot={slot} picks={data.picks}
            onSelectSlot={setStep} hasShopSelection={data.shop_link_slots?.includes(slot) === true}
            cropping={part === 'photo'} onCrop={open => setStep(open ? `${slot}/photo` : slot)}
            onCancel={() => setStep(null)} onSaved={async () => { await shelf.refetch(); setStep(null); }} />
        </div>
      ) : (
        <>
          {data.picks.length > 0 && (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {data.picks.map(pick => (
                <li key={pick.slot} className="flex min-w-0 gap-3 border-b border-tea-border py-3">
                  <img src={API_URL + pick.photo_path} alt="" loading="lazy" className="aspect-square w-16 shrink-0 self-start rounded-md object-cover" />
                  <div className="min-w-0">
                    <p className="text-ui-12 text-tea-text-sec">{topTeaSlotLabel(pick.slot)}</p>
                    <TeaCardTitle className="break-words">
                      {pick.shop_path ? <Link to={pick.shop_path} className="text-tea-gold underline decoration-tea-border underline-offset-4 hover:text-tea-gold-lt">{pick.name}</Link> : pick.name}
                    </TeaCardTitle>
                    {pick.note && <p className={`${T.body} mt-1 whitespace-pre-wrap break-words text-tea-text-sec`}>{pick.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data.can_edit && (
            <Button variant="secondary" className="mt-3" onClick={() => setStep(data.picks[0]?.slot ?? TOP_TEA_SLOTS[0])}>
              {data.picks.length ? 'Edit top teas' : 'Choose top teas'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function TopTeaPhotoCrop({ source, onDone }: { source: File | string; onDone: (photo: File | null) => void }) {
  const { editPhoto, photoEditor } = usePhotoEditor({ title: 'Frame this tea', centreFace: false });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void editPhoto(source).then(onDone);
  }, [editPhoto, source, onDone]);
  return photoEditor;
}

interface TopTeaEditorProps {
  endpoint: string;
  slot: TopTeaSlot;
  picks: TopTeaPick[];
  onSelectSlot: (slot: TopTeaSlot) => void;
  hasShopSelection: boolean;
  cropping: boolean;
  onCrop: (open: boolean) => void;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}

function TopTeaEditor({ endpoint, slot, picks, onSelectSlot, hasShopSelection, cropping, onCrop, onCancel, onSaved }: TopTeaEditorProps) {
  const pick = picks.find(item => item.slot === slot);
  const [name, setName] = useState(pick?.name ?? '');
  const [note, setNote] = useState(pick?.note ?? '');
  const [search, setSearch] = useState('');
  const [shopTea, setShopTea] = useState<TopTeaShopOption>();
  const [unlink, setUnlink] = useState(false);
  const linked = Boolean(shopTea || (hasShopSelection && !unlink));
  const [photo, setPhoto] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | string>();
  const [preview, setPreview] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const existingPhoto = pick ? API_URL + pick.photo_path : undefined;
  const currentPhoto = photo ?? existingPhoto;
  const photoSource = cropSource ?? currentPhoto;
  const query = search.trim();
  const shop = useQuery<{ teas: TopTeaShopOption[] }>({
    queryKey: ['person-top-tea-shop', endpoint, query],
    queryFn: ({ signal }) => authedFetch(`${endpoint}/shop?${new URLSearchParams({ q: query })}`, {}, signal),
    enabled: query.length >= 2,
    retry: false,
  });
  const options = (shop.data?.teas ?? []).filter(tea => slot === 'own' || slot === 'elsewhere' || tea.category === slot);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function editPhoto(source: File | string) {
    setCropSource(source);
    onCrop(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!photo && !existingPhoto) {
      setError('Add a photo of this tea.');
      picker.current?.click();
      return;
    }
    const body = new FormData();
    body.set('name', name);
    body.set('note', note);
    if (shopTea || unlink) body.set('product_id', shopTea?.id ?? '');
    if (photo) body.set('photo', photo);
    await write('PUT', body);
  }

  async function write(method: 'PUT' | 'DELETE', body?: FormData) {
    setSaving(true);
    setError('');
    try {
      await authedFetch(`${endpoint}/${slot}`, { method, body });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this change.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset className="min-w-0 space-y-3" disabled={saving}>
        <label className="block">
          <span className="label-field">Pick a category</span>
          <select className={field} value={slot} onChange={event => {
            if (isTopTeaSlot(event.target.value)) onSelectSlot(event.target.value);
          }}>
            {TOP_TEA_SLOTS.map(choice => (
              <option key={choice} value={choice}>{topTeaSlotLabel(choice)}{picks.some(pick => pick.slot === choice) ? ' (chosen)' : ''}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="label-field">Tea name</span>
            <input className={field} required value={name} readOnly={linked} maxLength={TOP_TEA_NAME_LIMIT}
              onChange={event => setName(event.target.value)} />
          </label>
          <label className="block min-w-0">
            <span className="label-field">Find a tea in the shop (optional)</span>
            <input className={field} type="search" value={search} maxLength={TOP_TEA_NAME_LIMIT}
              onChange={event => setSearch(event.target.value)} />
          </label>
        </div>
        {query.length >= 2 && (
          shop.isPending ? <p role="status" className="text-ui-13 text-tea-text-sec">Looking in the shop…</p>
            : shop.isError ? <p role="status" className="text-ui-13 text-tea-text-sec">Could not search the shop.</p>
              : options.length > 0 ? (
                <select aria-label="Matching shop teas" className={field} value=""
                  onChange={event => {
                    const selected = options.find(tea => tea.id === event.target.value);
                    if (!selected) return;
                    setShopTea(selected);
                    setName(selected.name);
                    setUnlink(false);
                    setSearch('');
                  }}>
                  <option value="">Choose a matching shop tea</option>
                  {options.map(tea => <option key={tea.id} value={tea.id}>{tea.name} · {tea.store_name}</option>)}
                </select>
              ) : <p role="status" className="text-ui-13 text-tea-text-sec">No matching shop teas for this slot.</p>
        )}
        {linked && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui-13 text-tea-text-sec">{shopTea || pick?.shop_path ? 'Linked to the shop' : 'Shop link unavailable'}</span>
            <Button type="button" variant="quiet" size="sm" onClick={() => { setShopTea(undefined); setUnlink(true); }}>Remove shop link</Button>
          </div>
        )}
        <label className="block">
          <span className="label-field">Your words (optional)</span>
          <textarea className={field} value={note} rows={2} maxLength={TOP_TEA_NOTE_LIMIT}
            onChange={event => setNote(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {(preview || existingPhoto) && (
            <img src={preview ?? existingPhoto} alt="Tea photo preview" className="aspect-square w-16 shrink-0 rounded-md object-cover" />
          )}
          <input ref={picker} type="file" accept="image/*,.heic,.heif" hidden onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) editPhoto(file);
          }} />
          <Button type="button" variant="secondary" onClick={() => picker.current?.click()}>
            {photo || existingPhoto ? 'Replace photo' : 'Add photo'}
          </Button>
          {currentPhoto && (
            <Button type="button" variant="quiet" onClick={() => editPhoto(currentPhoto)}>Reframe photo</Button>
          )}
        </div>
        {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="quiet" onClick={onCancel}>Cancel</Button>
          <div className="flex flex-wrap items-center gap-2">
            {pick && <Button type="button" variant="quiet" onClick={() => void write('DELETE')}>Remove pick</Button>}
            <Button type="submit" loading={saving}>Save pick</Button>
          </div>
        </div>
      </fieldset>
      {cropping && photoSource && <TopTeaPhotoCrop source={photoSource} onDone={file => {
        if (file) setPhoto(file);
        setCropSource(undefined);
        onCrop(false);
      }} />}
    </form>
  );
}
