import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeSlash, Plus, Trash } from '@phosphor-icons/react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { favoriteWriteFromTea, moveFavorite } from './profileDomain';
import type { FavoriteTea, FavoriteWrite, ProfileFavorite } from './types';

interface ProfileFavoritesEditorProps {
  favorites: ProfileFavorite[];
  availableTeas?: FavoriteTea[];
  onCreate: (favorite: FavoriteWrite) => Promise<void>;
  onUpdate: (teaProfileId: string, favorite: FavoriteWrite) => Promise<void>;
  onDelete: (teaProfileId: string) => Promise<void>;
  onReorder: (teaProfileIds: string[]) => Promise<void>;
}

const fieldClass = 'w-full rounded-md border border-tea-border bg-tea-surface px-3 py-2.5 text-ui-13 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30';

export function ProfileFavoritesEditor({ favorites, availableTeas = [], onCreate, onUpdate, onDelete, onReorder }: ProfileFavoritesEditorProps) {
  const [items, setItems] = useState(favorites);
  const [query, setQuery] = useState('');
  const [selectedTeaId, setSelectedTeaId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setItems([...favorites].sort((a, b) => a.position - b.position)), [favorites]);

  const choices = useMemo(() => {
    const existing = new Set(items.map(item => item.tea_profile_id));
    const needle = query.trim().toLocaleLowerCase();
    return availableTeas.filter(tea => (
      tea.is_public
      && Boolean(tea.public_path)
      && !existing.has(tea.id)
      && (!needle || [tea.name, tea.chinese_name, tea.type, tea.origin].some(value => value?.toLocaleLowerCase().includes(needle)))
    ));
  }, [availableTeas, items, query]);

  const commitMove = async (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const reordered = moveFavorite(items, from, to).map((item, index) => ({ ...item, position: index }));
    setItems(reordered);
    setBusyId('order');
    setError(null);
    try {
      await onReorder(reordered.map(item => item.tea_profile_id));
    } catch (cause) {
      setItems(items);
      setError(cause instanceof Error ? cause.message : 'The order could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  const updateLocal = (teaProfileId: string, patch: Partial<ProfileFavorite>) => {
    setItems(current => current.map(item => item.tea_profile_id === teaProfileId ? { ...item, ...patch } : item));
  };

  const saveItem = async (item: ProfileFavorite) => {
    setBusyId(item.tea_profile_id);
    setError(null);
    try {
      await onUpdate(item.tea_profile_id, {
        tea_profile_id: item.tea_profile_id,
        source_account_id: item.source_account_id,
        source_product_id: item.source_product_id,
        source_listing_id: item.source_listing_id,
        note: item.note,
        is_public: item.is_public,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The favorite could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    if (!selectedTeaId) return;
    const selectedTea = availableTeas.find(tea => tea.id === selectedTeaId);
    if (!selectedTea) return;
    setBusyId('new');
    setError(null);
    try {
      await onCreate(favoriteWriteFromTea(selectedTea));
      setSelectedTeaId('');
      setQuery('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tea could not be added.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: ProfileFavorite) => {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${item.tea.name} from your Tea Master favorites?`)) return;
    setBusyId(item.tea_profile_id);
    setError(null);
    try {
      await onDelete(item.tea_profile_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The favorite could not be removed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="favorites-editor-heading" className="space-y-6">
      <div>
        <h2 id="favorites-editor-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Public favorites</h2>
        <p className="mt-1 max-w-[64ch] text-ui-12 text-tea-text-dim">This is your public Tea Master collection, separate from teas privately saved to your account. Entries begin private until you share them.</p>
      </div>

      <div className="grid gap-3 border-y border-tea-border py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <label htmlFor="public-favorite-search">
          <span className={`${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`}>Find a tea</span>
          </label>
          <input
            id="public-favorite-search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="public-favorite-options"
            aria-expanded={choices.length > 0}
            value={query}
            onChange={event => { setQuery(event.target.value); setSelectedTeaId(''); }}
            className={fieldClass}
            placeholder="Search by name, type, or origin"
          />
          {choices.length > 0 && (
            <ul id="public-favorite-options" role="listbox" className="mt-2 divide-y divide-tea-border rounded-md border border-tea-border bg-tea-elevated">
              {choices.slice(0, 8).map(tea => (
                <li key={tea.id} role="option" aria-selected={selectedTeaId === tea.id}>
                  <button
                    type="button"
                    aria-label={`Choose ${tea.name}`}
                    onClick={() => { setSelectedTeaId(tea.id); setQuery(tea.name); }}
                    className="tap-target flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-3 text-left hover:bg-tea-accent-sub"
                  >
                    <span className="text-ui-14 text-tea-text">{tea.name}</span>
                    <span className="text-ui-12 text-tea-text-sec">{[tea.type, tea.origin].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={create} disabled={!selectedTeaId || busyId === 'new'} className="cta-solid tap-target self-end rounded-md px-4 py-2.5 text-ui-13 font-medium transition-transform active:scale-[0.98] disabled:opacity-50">
          <span className="inline-flex items-center gap-2"><Plus size={17} aria-hidden="true" /> Add</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec`}>No teas selected yet.</p>
          <p className="mt-2 text-ui-12 text-tea-text-dim">Add one above. It begins private so you can write the note before sharing it.</p>
        </div>
      ) : (
        <ol className="divide-y divide-tea-border border-y border-tea-border">
          {items.map((item, index) => (
            <li key={item.tea_profile_id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] md:items-start">
              <div className="min-w-0">
                <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>{item.tea.type || 'Tea'}</p>
                <h3 className={`${TYPOGRAPHY_CLASSES.h3} mt-1 truncate text-tea-text`}>{item.tea.name}</h3>
                <button
                  type="button"
                  onClick={() => updateLocal(item.tea_profile_id, { is_public: !item.is_public })}
                  className="tap-target mt-2 inline-flex items-center gap-2 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text"
                >
                  {item.is_public ? <Eye size={17} aria-hidden="true" /> : <EyeSlash size={17} aria-hidden="true" />}
                  {item.is_public ? 'Public on profile' : 'Private'}
                </button>
              </div>
              <label>
                <span className={`${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`}>Why I chose this</span>
                <textarea maxLength={280} rows={3} value={item.note ?? ''} onChange={event => updateLocal(item.tea_profile_id, { note: event.target.value || null })} className={fieldClass} />
              </label>
              <div className="flex items-center gap-1 md:flex-col">
                <button type="button" aria-label={`Move ${item.tea.name} up`} disabled={index === 0 || busyId === 'order'} onClick={() => commitMove(index, index - 1)} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowUp size={18} /></button>
                <button type="button" aria-label={`Move ${item.tea.name} down`} disabled={index === items.length - 1 || busyId === 'order'} onClick={() => commitMove(index, index + 1)} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-30"><ArrowDown size={18} /></button>
                <button type="button" aria-label={`Remove ${item.tea.name}`} onClick={() => remove(item)} className="tap-target text-tea-text-sec hover:text-tea-text"><Trash size={18} /></button>
                <button type="button" disabled={busyId === item.tea_profile_id} onClick={() => saveItem(item)} className="tap-target text-ui-12 text-tea-gold hover:text-tea-gold-lt disabled:opacity-50">Save</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
    </section>
  );
}
