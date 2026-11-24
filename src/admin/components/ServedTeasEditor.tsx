import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { teaPurchaseQuote } from '../../lib/shopPurchase';
import { useAppStore } from '../../lib/store';
import { fetchStoreProducts } from '../../lib/storefrontApi';
import { useTeaMenu } from '../hooks/useEventData';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import {
  duplicateServedTea,
  readLegacyTeaNames,
  readServedTeas,
  servedTeaFromMenu,
  updateServedTeas,
  type ServedTea,
} from './ServedTeaLedger';

const sourceLabels: Record<ServedTea['source'], string> = {
  menu: 'Session menu',
  chest: 'Tea Chest',
  shop: 'Shop',
  session: 'This session',
};

const small = TYPOGRAPHY_CLASSES.bodyLight + ' text-tea-text-sec';
const field = 'input-field w-full text-ui-16';
type Source = Exclude<ServedTea['source'], 'session'>;

interface ServedTeasEditorProps {
  eventId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ServedTeasEditor({ eventId, value, onChange, disabled = false }: ServedTeasEditorProps) {
  const scope = usePrivateQueryScope();
  const scopeKey = JSON.stringify(scope.key);
  const [isOpen, setOpen] = useState(false);
  const heading = useId();
  const served = useMemo(() => readServedTeas(value), [value]);
  const legacyNames = useMemo(() => readLegacyTeaNames(value), [value]);
  useEffect(() => setOpen(false), [eventId, scopeKey]);

  const add = (candidates: ServedTea[]) => {
    const next = [...served];
    for (const candidate of candidates) {
      if (!next.some(current => duplicateServedTea(current, candidate))) next.push(candidate);
    }
    onChange(updateServedTeas(value, next));
    setOpen(false);
  };

  return (
    <section aria-labelledby={heading} className="rounded-md border border-tea-border bg-tea-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={heading} className={TYPOGRAPHY_CLASSES.h3}>Teas served</h3>
        <Button type="button" variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)} disabled={disabled || !scope.ready}>
          Add tea
        </Button>
      </div>
      {served.length > 0 && (
        <ul className="mt-2 divide-y divide-tea-border">
          {served.map(tea => (
            <li key={tea.id} className="flex min-w-0 items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="break-words text-tea-text">{tea.name}</p>
                <p className={small}>{sourceLabels[tea.source]}</p>
              </div>
              <Button type="button" variant="icon" size="sm" icon={<Trash2 size={14} />} className="tap-target shrink-0"
                aria-label={`Remove ${tea.name}`} disabled={disabled}
                onClick={() => onChange(updateServedTeas(value, served.filter(item => item.id !== tea.id)))} />
            </li>
          ))}
        </ul>
      )}
      {legacyNames.length > 0 && (
        <p className={`mt-2 ${small}`}>Earlier tea notes: {legacyNames.join(', ')}</p>
      )}
      {!served.length && !legacyNames.length && (
        <p className={`mt-2 ${small}`}>Choose what you poured from the menu, Tea Chest, or Shop.</p>
      )}
      {isOpen && scope.ready && (
        <ServedTeaPicker key={`${eventId}:${scopeKey}`} eventId={eventId} served={served} add={add} onClose={() => setOpen(false)} />
      )}
    </section>
  );
}

function ServedTeaPicker({ eventId, served, add, onClose }: {
  eventId: string;
  served: ServedTea[];
  add: (teas: ServedTea[]) => void;
  onClose: () => void;
}) {
  const scope = usePrivateQueryScope();
  const queryClient = useQueryClient();
  const [accountId] = scope.key;
  const activeAccount = useAppStore(state => state.activeAccount);
  const memberSlug = useAppStore(state => state.memberships.find(item => item.account_id === accountId)?.slug);
  const activeSlug = activeAccount?.id === accountId ? activeAccount.slug : memberSlug;
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [keepInChest, setKeepInChest] = useState(false);
  const nameId = useId();
  const menu = useTeaMenu(eventId);
  const chest = useQuery({
    queryKey: ['session-picker-tea-chest', ...scope.key],
    queryFn: () => api.cellar.list(),
    enabled: scope.ready,
    staleTime: 0,
  });
  const shop = useQuery({
    queryKey: ['session-picker-shop', ...scope.key, activeSlug],
    queryFn: async () => {
      const slug = activeSlug ?? (await api.accounts.get(accountId)).slug;
      return { slug, teas: (await fetchStoreProducts(slug)).filter(tea => tea.category === 'tea' && tea.name.trim() && teaPurchaseQuote(tea)) };
    },
    enabled: scope.ready,
  });
  const keep = useMutation({
    mutationFn: (teaName: string) => api.cellar.create({ name: teaName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session-picker-tea-chest', ...scope.key] });
      void queryClient.invalidateQueries({ queryKey: ['cellar'] });
    },
  });
  const buildFromMenu = (item: Parameters<typeof servedTeaFromMenu>[0]) => servedTeaFromMenu(item, shop.data?.slug ?? activeSlug);
  const menuTeas = (menu.data ?? []).flatMap(item => buildFromMenu(item) ?? []);
  const groups = [
    { source: 'menu', rows: menuTeas, loading: menu.isPending, failed: menu.isError },
    {
      source: 'chest', loading: chest.isPending, failed: chest.isError,
      rows: (chest.data?.items ?? []).map(tea => ({ id: '', source: 'chest', source_id: tea.id, name: tea.name } as const)),
    },
    {
      source: 'shop', loading: shop.isPending, failed: shop.isError,
      rows: (shop.data?.teas ?? []).map(tea => ({
        id: '', source: 'shop', source_id: tea.id, name: tea.name, product_id: tea.id, shop_slug: shop.data?.slug,
      } as const)),
    },
  ] satisfies { source: Source; rows: ServedTea[]; loading: boolean; failed: boolean }[];

  const addSingle = (tea: ServedTea) => add([{ ...tea, id: tea.id || crypto.randomUUID() }]);
  function addNamed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const teaName = name.trim();
    if (!teaName || keep.isPending) return;
    if (!keepInChest) return addSingle({ id: '', name: teaName, source: 'session' });

    const old = chest.data?.items.find(item => item.name.toLowerCase() === teaName.toLowerCase());
    if (old) return addSingle({ id: '', name: old.name, source: 'chest', source_id: old.id });
    // Per-call callbacks stop on unmount, so a late response cannot append to
    // a different event or a different signed-in user's session.
    keep.mutate(teaName, {
      onSuccess: ({ item }) => addSingle({ id: '', name: item.name, source: 'chest', source_id: item.id }),
    });
  }

  const needle = search.trim().toLowerCase();
  return (
    <Modal isOpen onClose={onClose} title="Add tea" className="pb-nav" initialFocus="container">
      <div className="space-y-4 p-4 sm:p-6">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          aria-label="Search session menu, Tea Chest, and Shop" placeholder="Search teas" className={field} />
        {groups.map(({ source, rows, loading, failed }) => {
          const matches = rows.filter(tea => tea.name.toLowerCase().includes(needle));
          const found = source === 'menu' ? matches : matches.slice(0, needle ? 8 : 3);
          return (
            <section aria-label={sourceLabels[source]} key={source}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className={TYPOGRAPHY_CLASSES.h3}>{sourceLabels[source]}</h4>
                {source === 'menu' && rows.some(tea => !served.some(item => duplicateServedTea(item, tea))) && (
                  <Button type="button" variant="quiet" size="sm" disabled={keep.isPending} onClick={() => add(rows)}>Use session menu</Button>
                )}
              </div>
              {loading && <p role="status" className={small}>Loading teas…</p>}
              {failed && <p role="status" className={small}>This list could not be loaded.</p>}
              {!loading && !failed && !found.length && <p className={small}>{needle ? 'No matching teas.' : 'No teas here yet.'}</p>}
              {found.length > 0 && (
                <ul className="divide-y divide-tea-border">
                  {found.map(tea => {
                    const added = served.some(item => duplicateServedTea(item, tea));
                    return (
                      <li key={tea.id || tea.source_id} className="flex min-w-0 items-center justify-between gap-2 py-2">
                        <p className="min-w-0 break-words text-tea-text">{tea.name}</p>
                        <Button type="button" variant="secondary" size="sm" disabled={added || keep.isPending}
                          aria-label={`Add ${tea.name}`} onClick={() => addSingle(tea)}>
                          {added ? 'Added' : 'Add'}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {matches.length > found.length && (
                <p className={small}>{needle ? 'Refine your search to see more.' : 'Search to find more teas.'}</p>
              )}
            </section>
          );
        })}
        <form className="space-y-2 border-t border-tea-border pt-3" onSubmit={addNamed}>
          <label htmlFor={nameId} className={TYPOGRAPHY_CLASSES.h3}>Add by name</label>
          <input id={nameId} value={name} maxLength={120} onChange={event => setName(event.target.value)}
            className={field} placeholder="Tea name" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className={`inline-flex min-h-tap items-center gap-2 ${small}`}>
              <input type="checkbox" checked={keepInChest} disabled={chest.isPending || chest.isError}
                onChange={event => setKeepInChest(event.target.checked)} />
              Keep in Tea Chest
            </label>
            <Button type="submit" variant="secondary" size="sm" loading={keep.isPending} disabled={!name.trim()}>Add named tea</Button>
          </div>
          {keep.isError && <p role="alert" className={small}>Could not keep this tea. Try again.</p>}
        </form>
      </div>
    </Modal>
  );
}
