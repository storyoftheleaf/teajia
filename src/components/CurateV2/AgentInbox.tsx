import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, hasToken, type CurateSuggestionGroup } from '../../lib/api';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { useAppStore } from '../../lib/store';
import { CURRENCY_LABELS } from './PricingRow';
import { Section } from './TodayView';
import { CurateRecordTools } from '../curate/CurateRecordTools';

const KEYS = {
  suggestions: ['curate', 'agent-suggestions'] as const,
  todos: ['curate', 'todos'] as const,
  arriving: ['curate', 'pending-receipts'] as const,
};

const hostOf = (url: string | null) => {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'That did not go through. Try again.');

/** A square tick, the size of a thumb. */
const Tick: React.FC<{ on: boolean; label: string; onClick: () => void; round?: boolean }> = ({ on, label, onClick, round }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
  >
    <span className={`flex h-5 w-5 items-center justify-center border ${round ? 'rounded-full' : 'rounded'} ${on ? 'border-tea-gold bg-tea-gold/15 text-tea-gold' : 'border-tea-text-dim text-transparent'}`}>
      <Check size={12} strokeWidth={2.5} />
    </span>
  </button>
);

/** One find from an agent: tick the teas to keep, the rest are dropped. */
const SuggestionGroup: React.FC<{ group: CurateSuggestionGroup }> = ({ group }) => {
  const queryClient = useQueryClient();
  const accountId = useAppStore((s) => s.activeAccountId);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const pick = useMutation({
    mutationFn: () => {
      const all = group.teas.map((t) => t.id);
      return api.compass.pickAgentSuggestions({ pick: all.filter((id) => kept.has(id)), drop: all.filter((id) => !kept.has(id)) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.suggestions });
      hydrateCompassEntries(accountId ?? undefined).catch(() => {});
    },
  });
  const toggle = (id: string) => setKept((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const rest = group.teas.length - kept.size;
  const commit = () => {
    if (kept.size === 0 && !window.confirm(`Drop all ${group.teas.length}?`)) return;
    pick.mutate();
  };
  const where = [group.found_by, group.vendor, hostOf(group.url)].filter(Boolean).join(' · ');

  return (
    <div className="border-b border-tea-border" data-testid="agent-suggestion-group">
      <div className="px-4 pt-3 text-ui-12 text-tea-text-dim">
        {where || 'Found by an agent'}
        {group.note && <span className="block text-tea-text-sec">{group.note}</span>}
      </div>
      {group.teas.map((t) => {
        const sym = t.price ? (CURRENCY_LABELS[t.price.currency as keyof typeof CURRENCY_LABELS] ?? `${t.price.currency} `) : '';
        return (
          <div key={t.id} className="curate-v2-row">
            <Tick on={kept.has(t.id)} label={`Keep ${t.name}`} onClick={() => toggle(t.id)} />
            <button type="button" onClick={() => toggle(t.id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
              <span className="curate-v2-name">{t.name}</span>
              {t.year != null && !t.name.includes(String(t.year)) && <span className="text-ui-12 text-tea-text-dim tabular-nums">{t.year}</span>}
              <span className="flex-1" />
              {t.price && (
                <span className="text-ui-13 text-tea-text-sec tabular-nums">
                  {sym}{Number(t.price.amount).toLocaleString()}
                  {t.price.per_grams ? <span className="ml-1 text-ui-12 text-tea-text-dim">/{t.price.per_grams} g</span> : null}
                </span>
              )}
            </button>
          </div>
        );
      })}
      <div className="grid gap-1 px-4 py-3">
        <button
          type="button"
          onClick={commit}
          disabled={pick.isPending}
          className={`${kept.size ? 'cta-solid' : 'border border-tea-border text-tea-text-sec'} min-h-11 rounded-md text-ui-13 font-semibold disabled:opacity-60`}
        >
          {kept.size === 0 ? 'Drop all' : rest === 0 ? `Keep all ${kept.size} as samples` : `Keep ${kept.size} as samples, drop ${rest}`}
        </button>
        {pick.isError && <p className="text-ui-12 text-tea-error">{errorText(pick.error)}</p>}
      </div>
    </div>
  );
};

/**
 * What agents left for Adrian, handled by hand: teas found to pick from,
 * to-dos to tick, and orders on their way to mark arrived. The same rows the
 * agents read and write, so either way of working sees the other's changes.
 */
export const AgentInbox: React.FC<{ onOpenTea: (entryId: string) => void }> = ({ onOpenTea }) => {
  const queryClient = useQueryClient();
  const signedIn = hasToken();
  const suggestions = useQuery({ queryKey: KEYS.suggestions, queryFn: () => api.compass.agentSuggestions(), enabled: signedIn, staleTime: 30_000 });
  const todos = useQuery({ queryKey: KEYS.todos, queryFn: () => api.compass.todos(), enabled: signedIn, staleTime: 30_000 });
  const arriving = useQuery({ queryKey: KEYS.arriving, queryFn: () => api.compass.pendingReceipts(), enabled: signedIn, staleTime: 30_000 });
  const [newTodo, setNewTodo] = useState('');
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const addTodo = useMutation({
    mutationFn: (text: string) => api.compass.addTodo({ text }),
    onSuccess: () => { setNewTodo(''); queryClient.invalidateQueries({ queryKey: KEYS.todos }); },
  });
  const tickTodo = useMutation({
    mutationFn: (id: string) => api.compass.todoDone(id),
    onMutate: (id) => setDoneIds((prev) => new Set(prev).add(id)),
    onError: (_e, id) => setDoneIds((prev) => { const next = new Set(prev); next.delete(id); return next; }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEYS.todos }),
  });
  const arrived = useMutation({
    mutationFn: (id: string) => api.compass.acceptReceiptProposal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.arriving }),
  });

  const groups = suggestions.data?.waiting ?? [];
  const found = groups.reduce((n, g) => n + g.teas.length, 0);
  const openTodos = (todos.data?.todos ?? []).filter((t) => !doneIds.has(t.id));
  const pending = arriving.data?.pending ?? [];

  if (!signedIn) return null;

  return (
    <>
      {found > 0 && (
        <section data-testid="agent-suggestions">
          <Section title="From your agent" count={found} />
          {groups.map((g) => <SuggestionGroup key={g.batch_id} group={g} />)}
        </section>
      )}

      <section data-testid="agent-todos">
        <Section title="To do" count={openTodos.length || undefined} />
        {openTodos.map((t) => {
          const about = [t.tea_name, t.vendor_name, t.from_agent && `from ${t.from_agent}`].filter(Boolean).join(' · ');
          return (
            <div key={t.id} className="curate-v2-row min-h-12 whitespace-normal py-2">
              <Tick round on={false} label={`Done: ${t.text}`} onClick={() => tickTodo.mutate(t.id)} />
              <button
                type="button"
                onClick={() => t.compass_entry_id && onOpenTea(t.compass_entry_id)}
                disabled={!t.compass_entry_id}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-ui-14 text-tea-text">{t.text}</span>
                {about && <span className="block truncate text-ui-12 text-tea-text-dim">{about}</span>}
              </button>
            </div>
          );
        })}
        <form
          className="curate-v2-row"
          onSubmit={(e) => { e.preventDefault(); const text = newTodo.trim(); if (text) addTodo.mutate(text); }}
        >
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a to-do"
            aria-label="Add a to-do"
            enterKeyHint="done"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-ui-14 text-tea-text outline-none placeholder:text-tea-text-dim"
          />
          {newTodo.trim() && <button type="submit" disabled={addTodo.isPending} className="tap-target text-ui-13 font-medium text-tea-gold">Add</button>}
        </form>
        {(addTodo.isError || tickTodo.isError) && <p className="px-4 py-2 text-ui-12 text-tea-error">{errorText(addTodo.error ?? tickTodo.error)}</p>}
      </section>

      {pending.length > 0 && (
        <section data-testid="agent-arriving">
          <Section title="Arriving" count={pending.length} />
          {pending.map((r) => (
            <div key={r.id}><div className="curate-v2-row">
              <button
                type="button"
                onClick={() => r.compass_entry_id && onOpenTea(r.compass_entry_id)}
                className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
              >
                <span className="curate-v2-name">{r.tea_name || r.product_name || 'A tea'}</span>
                <span className="text-ui-12 text-tea-text-dim tabular-nums">{r.quantity}{r.unit === 'g' ? ' g' : r.quantity === 1 ? ' piece' : ' pieces'}</span>
                {r.vendor_name && <span className="min-w-0 truncate text-ui-12 text-tea-text-dim">{r.vendor_name}</span>}
              </button>
              <button
                type="button"
                onClick={() => arrived.mutate(r.id)}
                disabled={arrived.isPending && arrived.variables === r.id}
                className="tap-target min-h-9 rounded-md border border-tea-border px-3 text-ui-12 font-medium text-tea-text hover:border-tea-gold"
              >
                Arrived
              </button>
            </div><details className="px-4 py-2"><summary className="min-h-11 cursor-pointer text-ui-12 text-tea-text-sec">Arrival files &amp; history</summary><CurateRecordTools entityType="arrival" entityId={r.id} /></details></div>
          ))}
          {arrived.isError && <p className="px-4 py-2 text-ui-12 text-tea-error">{errorText(arrived.error)}</p>}
        </section>
      )}
    </>
  );
};
