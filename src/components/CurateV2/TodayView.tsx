import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { api, hasToken, type CurateSuggestionGroup } from '../../lib/api';
import { TODAY_ACTION_LABEL, todayItems, type TodayAction } from './curateV2Model';
import { getTeaColor } from '../../designTokens';
import { AGENT_KEYS, AgentFindsSheet, errorText, useAgentLists } from './AgentInbox';
import { DriveLine } from './DriveLine';

interface TodayViewProps {
  onStartTable: () => void;
  onAct: (entryId: string, action: TodayAction) => void;
  onOpenTea: (entryId: string) => void;
  onOpenVendor: (vendor: { id?: string; name: string }) => void;
}

const isVendor = (tags: unknown) => {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\[\]"]+/) : [];
  return list.some((t) => String(t).trim().toLowerCase() === 'vendor');
};

const daysSince = (iso?: string) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(d) && d >= 0 ? d : null;
};

/**
 * Curate opens here, as drawn: what is waiting, one line each, the one thing it
 * needs as a small word on the right. An agent's finds, to-dos and vendors missing a
 * way to reach them come first, being few, then the teas, all in one list; what is on its way
 * follows, and Drive sits at the bottom.
 */
export const TodayView: React.FC<TodayViewProps> = ({ onStartTable, onAct, onOpenTea, onOpenVendor }) => {
  const queryClient = useQueryClient();
  const entries = useTeaCompassStore((s) => s.entries);
  const items = useMemo(() => todayItems(entries).slice(0, 40), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const { groups, todos, arriving } = useAgentLists();
  const [findOpen, setFindOpen] = useState<CurateSuggestionGroup | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [vendorGaps, setVendorGaps] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!hasToken()) return;
    api.customers.list()
      .then((res: any) => setVendorGaps(((res?.customers || res || []) as any[])
        .filter((c) => isVendor(c.tags) && !c.wechat && !c.whatsapp && !c.phone)
        .slice(0, 3)
        .map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  const tick = useMutation({
    mutationFn: (id: string) => api.compass.todoDone(id),
    onMutate: (id) => setDone((prev) => new Set(prev).add(id)),
    onError: (_e, id) => setDone((prev) => { const next = new Set(prev); next.delete(id); return next; }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: AGENT_KEYS.todos }),
  });
  const addTodo = useMutation({
    mutationFn: (text: string) => api.compass.addTodo({ text }),
    onSuccess: () => { setNewTodo(''); setAdding(false); queryClient.invalidateQueries({ queryKey: AGENT_KEYS.todos }); },
  });
  const arrived = useMutation({
    mutationFn: (id: string) => api.compass.acceptReceiptProposal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_KEYS.arriving }),
  });

  const openTodos = todos.filter((t) => !done.has(t.id));
  const onTheWay = entries.filter((e) => e.status === 'incoming' || e.status === 'buying').slice(0, 20);
  const waitingCount = groups.length + items.length + vendorGaps.length + openTodos.length;
  const wayCount = onTheWay.length + arriving.length;

  return (
    <div className="curate-v2 -mx-4">
      <Section title="Waiting" count={waitingCount} />
      {entries.length === 0 && groups.length === 0 && (
        // First time here: how a tea gets from a vendor's table to the shelf.
        <ol className="grid gap-0 px-4 pt-2">
          {[
            ['At the table', 'Open Table, type each tea’s name and price as the vendor says it, tap the cup to taste.'],
            ['Decide', 'Each tea waits here until you choose Pass, Sample or Buy. Compare a few in Teas.'],
            ['Order and shelve', 'Orders writes the message to the vendor. When a tea arrives, it goes on the shelf from here.'],
          ].map(([title, body], i) => (
            <li key={title} className="flex items-baseline gap-3 border-b border-tea-border py-3">
              <span className="font-display text-ui-20 text-tea-gold tabular-nums">{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-display text-ui-17 text-tea-text">{title}</span>
                <span className="block text-ui-13 text-tea-text-sec">{body}</span>
              </span>
            </li>
          ))}
          <li className="pt-3"><button type="button" onClick={onStartTable} className="cta-solid w-full rounded-md py-3 text-ui-13 font-semibold">Start a table</button></li>
        </ol>
      )}
      {waitingCount === 0 && entries.length > 0 && (
        <p className="px-4 py-4 text-ui-13 text-tea-text-sec">Nothing waiting. Open Table to taste, or ＋ Tea to add one.</p>
      )}

      {groups.map((g) => (
        <button key={g.batch_id} type="button" onClick={() => setFindOpen(g)} className="curate-v2-row w-full text-left" data-testid="today-agent-find">
          <span className="curate-v2-name">From {g.found_by || 'your agent'}</span>
          <span className="min-w-0 truncate text-ui-12 text-tea-text-dim">{[g.vendor, `${g.teas.length} found`].filter(Boolean).join(' · ')}</span>
          <span className="flex-1" />
          <span className="text-ui-12 font-medium text-tea-gold">Pick</span>
        </button>
      ))}

      {openTodos.map((t) => (
        <div key={t.id} className="curate-v2-row" data-testid="today-todo">
          <button
            type="button"
            onClick={() => t.compass_entry_id && onOpenTea(t.compass_entry_id)}
            disabled={!t.compass_entry_id}
            className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
          >
            <span className="curate-v2-name">{t.text}</span>
            {(t.tea_name || t.from_agent) && <span className="min-w-0 truncate text-ui-12 text-tea-text-dim">{t.tea_name || `from ${t.from_agent}`}</span>}
          </button>
          <button type="button" onClick={() => tick.mutate(t.id)} className="tap-target text-ui-12 text-tea-text-dim hover:text-tea-gold" aria-label={`Done: ${t.text}`}>Done</button>
        </div>
      ))}

      {vendorGaps.map((v) => (
        <button key={v.id} type="button" onClick={() => onOpenVendor(v)} className="curate-v2-row w-full text-left">
          <span className="curate-v2-name">{v.name}</span>
          <span className="text-ui-12 text-tea-text-dim">vendor</span>
          <span className="flex-1" />
          <span className="text-ui-12 font-medium text-tea-gold">Add WeChat</span>
        </button>
      ))}

      {items.map((item) => {
        const e = byId.get(item.entryId);
        const color = e?.type ? getTeaColor(e.type) : null;
        return (
          <button
            key={item.entryId}
            type="button"
            onClick={() => onAct(item.entryId, item.action)}
            className="curate-v2-row w-full text-left"
            style={color ? { backgroundImage: `linear-gradient(90deg, ${color}26, ${color}05 75%)` } : undefined}
          >
            <span className="curate-v2-name">{item.name}</span>
            {item.who && <span className="text-ui-12 text-tea-text-dim">{item.who}</span>}
            <span className="flex-1" />
            <span className="text-ui-12 font-medium text-tea-gold">{TODAY_ACTION_LABEL[item.action]}</span>
          </button>
        );
      })}

      {adding ? (
        <form className="curate-v2-row" onSubmit={(e) => { e.preventDefault(); const text = newTodo.trim(); if (text) addTodo.mutate(text); }}>
          <input
            autoFocus
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onBlur={() => { if (!newTodo.trim()) setAdding(false); }}
            placeholder="Ask Wang about the 2018…"
            aria-label="Add a to-do"
            enterKeyHint="done"
            className="min-w-0 flex-1 border-0 border-b border-tea-gold bg-transparent py-2 font-display text-ui-17 text-tea-text outline-none placeholder:text-tea-text-dim"
          />
          <button type="submit" disabled={addTodo.isPending} className="tap-target text-ui-13 font-medium text-tea-gold">Add</button>
        </form>
      ) : hasToken() && (
        <button type="button" onClick={() => setAdding(true)} className="curate-v2-row w-full text-left">
          <span className="text-ui-13 text-tea-text-dim">＋ A to-do</span>
        </button>
      )}
      {(tick.isError || addTodo.isError) && <p className="px-4 py-2 text-ui-12 text-tea-error">{errorText(tick.error ?? addTodo.error)}</p>}

      {wayCount > 0 && (
        <>
          <Section title="On the way" count={wayCount} />
          {onTheWay.map((e) => {
            const color = e.type ? getTeaColor(e.type) : null;
            const days = daysSince(e.updatedAt);
            return (
              <button key={e.id} type="button" onClick={() => onAct(e.id, 'decide')} className="curate-v2-row w-full text-left" style={color ? { backgroundImage: `linear-gradient(90deg, ${color}26, ${color}05 75%)` } : undefined}>
                <span className="curate-v2-name">{e.name || 'Untitled tea'}</span>
                {e.vendorName && <span className="text-ui-12 text-tea-text-dim">{e.vendorName}</span>}
                <span className="flex-1" />
                <span className="text-ui-13 font-medium text-tea-text-sec tabular-nums">{e.status === 'buying' ? 'ordering' : days != null ? `${days} ${days === 1 ? 'day' : 'days'}` : 'ordered'}</span>
              </button>
            );
          })}
          {arriving.map((r) => {
            const days = daysSince(r.created_at);
            return (
              <div key={r.id} className="curate-v2-row">
                <button type="button" onClick={() => r.compass_entry_id && onOpenTea(r.compass_entry_id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                  <span className="curate-v2-name">{r.tea_name || r.product_name || 'A tea'}</span>
                  <span className="min-w-0 truncate text-ui-12 text-tea-text-dim tabular-nums">
                    {[r.vendor_name, `${r.quantity}${r.unit === 'g' ? ' g' : r.quantity === 1 ? ' piece' : ' pieces'}`, days != null ? `${days} d` : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <button type="button" onClick={() => arrived.mutate(r.id)} disabled={arrived.isPending && arrived.variables === r.id} className="tap-target text-ui-12 font-medium text-tea-gold">Arrived</button>
              </div>
            );
          })}
          {arrived.isError && <p className="px-4 py-2 text-ui-12 text-tea-error">{errorText(arrived.error)}</p>}
        </>
      )}

      <div className="pt-6"><DriveLine /></div>
      <AgentFindsSheet group={findOpen} onClose={() => setFindOpen(null)} />
    </div>
  );
};

export const Section: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="flex items-baseline justify-between border-b border-tea-border px-4 pb-2 pt-4">
    <span className="font-display text-ui-20 text-tea-text">{title}</span>
    {count != null && <span className="text-ui-12 font-medium text-tea-text-dim tabular-nums">{count}</span>}
  </div>
);
