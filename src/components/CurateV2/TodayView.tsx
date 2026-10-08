import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { api, hasToken, type CurateSuggestionGroup } from '../../lib/api';
import { TODAY_ACTION_LABEL, daysSince, todaySections, type TodayAction, type TodayItem } from './curateV2Model';
import { getTeaColor } from '../../designTokens';
import { AGENT_KEYS, AgentFindsSheet, errorText, useAgentLists } from './AgentInbox';
import { DriveLine } from './DriveLine';
import { useCommitAndPromote } from './useCommitAndPromote';
import { CurateRecordTools } from '../curate/CurateRecordTools';

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

const dayWord = (d: number) => (d === 0 ? 'today' : `${d} ${d === 1 ? 'day' : 'days'}`);

/** A tea's type colour as a faint wash across its row. */
const wash = (type: string | undefined | null) => {
  const color = type ? getTeaColor(type) : null;
  return color ? { backgroundImage: `linear-gradient(90deg, ${color}26, ${color}05 75%)` } : undefined;
};

/** The detail after a subject: Lora, small, still readable (secondary text, never dim). */
const Detail: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`min-w-0 truncate font-mono text-ui-12 text-tea-text-sec tabular-nums ${className}`}>{children}</span>
);

/** The one gold word on the right of a line. */
const Action: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="shrink-0 font-mono text-ui-13 text-tea-gold">{children}</span>
);

/** One kind of waiting thing on its own band: the page shows between bands. */
const Band: React.FC<{ id: string; title: string; count: number; children: React.ReactNode }> = ({ id, title, count, children }) => (
  <section className="mb-3 bg-tea-surface pb-1 [&>.curate-v2-row:last-child]:border-b-0" data-testid={`today-section-${id}`} aria-label={title}>
    <Section title={title} count={count} />
    {children}
  </section>
);

/**
 * Curate opens here, as drawn: sections, each a different kind of thing, each
 * on its own band with a heading and a count, and each line naming its subject
 * first with the one thing it needs as a gold word on the right. An empty
 * section is not shown. Drive sits at the bottom.
 */
export const TodayView: React.FC<TodayViewProps> = ({ onStartTable, onAct, onOpenTea, onOpenVendor }) => {
  const queryClient = useQueryClient();
  const entries = useTeaCompassStore((s) => s.entries);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const sections = useMemo(() => todaySections(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const { groups, todos, arriving } = useAgentLists();
  const { createInventoryRecord } = useCommitAndPromote();
  const [findOpen, setFindOpen] = useState<CurateSuggestionGroup | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [vendorGaps, setVendorGaps] = useState<Array<{ id: string; name: string }>>([]);
  const [shelving, setShelving] = useState<string | null>(null);
  const [shelfError, setShelfError] = useState<string | null>(null);
  const signedIn = hasToken();

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
    mutationFn: (r: { id: string; compass_entry_id?: string | null }) => api.compass.acceptReceiptProposal(r.id),
    // Accepting the receipt also puts the tea itself on its way to the shelf.
    onSuccess: (_res, r) => {
      if (r.compass_entry_id) updateEntry(r.compass_entry_id, { status: 'in_stock' });
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.arriving });
    },
  });

  /** It is here: the tea now waits under "To shelve". */
  const markArrived = (entryId: string) => updateEntry(entryId, { status: 'in_stock' });

  /** Put an arrived tea on the shop shelf; the line leaves Today once it is linked. */
  const shelve = async (entryId: string) => {
    setShelving(entryId);
    setShelfError(null);
    const result = await createInventoryRecord(entryId);
    setShelving(null);
    if (result.promotionError) setShelfError(result.retryQueued ? 'The shelf could not be reached. It will try again.' : result.promotionError);
  };

  const openTodos = todos.filter((t) => !done.has(t.id));
  // A tea with a pending receipt proposal is one line, not two: the proposal
  // row wins (its Arrived accepts the receipt AND shelves the tea).
  const proposed = useMemo(() => new Set(arriving.map((r) => r.compass_entry_id).filter(Boolean) as string[]), [arriving]);
  const onTheWay = useMemo(() => sections.onTheWay.filter((w) => !proposed.has(w.entryId)), [sections.onTheWay, proposed]);
  const wayCount = onTheWay.length + arriving.length;
  const waitingCount = groups.length + openTodos.length + sections.decide.length + sections.cost.length
    + vendorGaps.length + wayCount + sections.shelve.length;

  const teaLine = (item: TodayItem) => {
    const e = byId.get(item.entryId);
    return (
      <button key={item.entryId} type="button" onClick={() => onAct(item.entryId, item.action)} className="curate-v2-row w-full text-left" style={wash(e?.type)}>
        <span className="curate-v2-name">{item.name}</span>
        {item.who && <Detail>{item.who}</Detail>}
        <span className="flex-1" />
        <Action>{TODAY_ACTION_LABEL[item.action]}</Action>
      </button>
    );
  };

  return (
    <div className="curate-v2 -mx-4">
      {entries.length === 0 && groups.length === 0 && (
        // First time here: how a tea gets from a vendor's table to the shelf.
        <ol className="grid gap-0 px-4 pt-2">
          {[
            ['At the table', 'Open Table, type each tea’s name and price as the vendor says it, tap Taste on a row.'],
            ['Decide', 'Each tea waits here until you choose Pass, Sample or Buy. Compare a few in Teas.'],
            ['Order and shelve', 'Orders writes the message to the vendor. When a tea arrives, it goes on the shelf from here.'],
          ].map(([title, body], i) => (
            <li key={title} className="flex items-baseline gap-3 border-b border-tea-border py-3">
              <span className="font-display text-ui-20 text-tea-gold tabular-nums">{i + 1}</span>
              <span className="min-w-0">
                <span className="block font-display text-ui-17 text-tea-text">{title}</span>
                <span className="block font-body text-ui-14 leading-relaxed text-tea-text-sec">{body}</span>
              </span>
            </li>
          ))}
          <li className="pt-3"><button type="button" onClick={onStartTable} className="curate-v2-frame is-on is-tall is-wide uppercase tracking-[0.16em]">Start a table</button></li>
        </ol>
      )}
      {waitingCount === 0 && entries.length > 0 && (
        <p className="px-4 py-4 font-body text-ui-14 text-tea-text-sec">Nothing waiting. Open Table to taste, or + Tea to add one.</p>
      )}

      {groups.length > 0 && (
        <Band id="agent" title="From your agent" count={groups.length}>
          {groups.map((g) => (
            <button key={g.batch_id} type="button" onClick={() => setFindOpen(g)} className="curate-v2-row w-full text-left" data-testid="today-agent-find">
              <span className="curate-v2-name">{g.found_by || 'Your agent'}</span>
              <Detail>{[g.vendor, `${g.teas.length} ${g.teas.length === 1 ? 'tea' : 'teas'}`].filter(Boolean).join(' · ')}</Detail>
              <span className="flex-1" />
              <Action>Pick</Action>
            </button>
          ))}
        </Band>
      )}

      {(openTodos.length > 0 || signedIn) && (
        <Band id="todo" title="To do" count={openTodos.length}>
          {openTodos.map((t) => {
            const subject = t.tea_name || t.vendor_name || '';
            return (
              <div key={t.id} className="curate-v2-row !whitespace-normal" data-testid="today-todo">
                <button
                  type="button"
                  onClick={() => t.compass_entry_id && onOpenTea(t.compass_entry_id)}
                  disabled={!t.compass_entry_id}
                  className="grid min-w-0 flex-1 gap-0.5 text-left"
                >
                  <span className="curate-v2-name !whitespace-normal">{subject || t.text}</span>
                  {(subject || t.from_agent) && (
                    <span className="line-clamp-2 font-mono text-ui-12 text-tea-text-sec">{subject ? t.text : `from ${t.from_agent}`}</span>
                  )}
                </button>
                <button type="button" onClick={() => tick.mutate(t.id)} className="tap-target shrink-0 justify-end font-mono text-ui-13 text-tea-gold" aria-label={`Done: ${t.text}`}>Done</button>
              </div>
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
                className="min-w-0 flex-1 border-0 border-b border-tea-border focus:border-tea-gold bg-transparent py-2 font-display text-ui-17 text-tea-text outline-none placeholder:text-tea-text-sec"
              />
              <button type="submit" disabled={addTodo.isPending} className="curate-v2-word tap-target justify-end">Add</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="curate-v2-row w-full text-left">
              <span className="font-mono text-ui-13 text-tea-text-sec">+ A to-do</span>
            </button>
          )}
          {(tick.isError || addTodo.isError) && <p className="px-4 py-2 font-mono text-ui-12 text-tea-error">{errorText(tick.error ?? addTodo.error)}</p>}
        </Band>
      )}

      {sections.decide.length > 0 && (
        <Band id="decide" title="To decide" count={sections.decide.length}>{sections.decide.map(teaLine)}</Band>
      )}

      {sections.cost.length > 0 && (
        <Band id="cost" title="Needs a cost" count={sections.cost.length}>{sections.cost.map(teaLine)}</Band>
      )}

      {vendorGaps.length > 0 && (
        <Band id="vendors" title="Vendors to reach" count={vendorGaps.length}>
          {vendorGaps.map((v) => (
            <button key={v.id} type="button" onClick={() => onOpenVendor(v)} className="curate-v2-row w-full text-left">
              <span className="curate-v2-name">{v.name}</span>
              <Detail>no way to reach them yet</Detail>
              <span className="flex-1" />
              <Action>Add WeChat</Action>
            </button>
          ))}
        </Band>
      )}

      {wayCount > 0 && (
        <Band id="way" title="On the way" count={wayCount}>
          {onTheWay.map((w) => {
            const e = byId.get(w.entryId);
            return (
              <div key={w.entryId} className="curate-v2-row" style={wash(e?.type)} data-testid="today-on-the-way">
                <button type="button" onClick={() => onOpenTea(w.entryId)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                  <span className="curate-v2-name">{w.name}</span>
                  <Detail>{[w.vendor, w.ordering ? 'ordering' : w.days != null ? dayWord(w.days) : 'ordered'].filter(Boolean).join(' · ')}</Detail>
                </button>
                <button type="button" onClick={() => markArrived(w.entryId)} className="tap-target shrink-0 justify-end font-mono text-ui-13 text-tea-gold" aria-label={`Arrived: ${w.name}`}>Arrived</button>
              </div>
            );
          })}
          {arriving.map((r) => {
            const days = daysSince(r.created_at);
            return (
              <div key={r.id}><div className="curate-v2-row">
                <button type="button" onClick={() => r.compass_entry_id && onOpenTea(r.compass_entry_id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                  <span className="curate-v2-name">{r.tea_name || r.product_name || 'A tea'}</span>
                  <Detail>
                    {[r.vendor_name, `${r.quantity}${r.unit === 'g' ? ' g' : r.quantity === 1 ? ' piece' : ' pieces'}`, days != null ? dayWord(days) : null].filter(Boolean).join(' · ')}
                  </Detail>
                </button>
                <button type="button" onClick={() => arrived.mutate(r)} disabled={arrived.isPending && arrived.variables?.id === r.id} className="tap-target shrink-0 justify-end font-mono text-ui-13 text-tea-gold" aria-label={`Arrived: ${r.tea_name || r.product_name || 'a tea'}`}>Arrived</button>
              </div><details className="px-4 py-2"><summary className="min-h-11 cursor-pointer font-mono text-ui-13 text-tea-text-sec">Arrival files &amp; history</summary><CurateRecordTools entityType="arrival" entityId={r.id} /></details></div>
            );
          })}
          {arrived.isError && <p className="px-4 py-2 text-ui-12 text-tea-error">{errorText(arrived.error)}</p>}
        </Band>
      )}

      {sections.shelve.length > 0 && (
        <Band id="shelve" title="To shelve" count={sections.shelve.length}>
          {sections.shelve.map((item) => {
            const e = byId.get(item.entryId);
            return (
              <div key={item.entryId} className="curate-v2-row" style={wash(e?.type)} data-testid="today-to-shelve">
                <button type="button" onClick={() => onOpenTea(item.entryId)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                  <span className="curate-v2-name">{item.name}</span>
                  <Detail>{[e?.vendorName?.trim(), 'arrived'].filter(Boolean).join(' · ')}</Detail>
                </button>
                <button type="button" onClick={() => void shelve(item.entryId)} disabled={shelving === item.entryId} className="tap-target shrink-0 justify-end font-mono text-ui-13 text-tea-gold disabled:opacity-60" aria-label={`Shelf: ${item.name}`}>
                  {shelving === item.entryId ? '…' : 'Shelf'}
                </button>
              </div>
            );
          })}
          {shelfError && <p className="px-4 py-2 text-ui-12 text-tea-error" role="alert">{shelfError}</p>}
        </Band>
      )}

      <div className="pt-3"><DriveLine /></div>
      <AgentFindsSheet group={findOpen} onClose={() => setFindOpen(null)} />
    </div>
  );
};

/** A section as the shop draws one: the word large, a two-digit count, a gold hairline. */
export const Section: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="px-4 pt-7 first:pt-3">
    <div className="flex items-baseline justify-between pb-2.5">
      <h2 className="font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text">{title}</h2>
      {count != null && <span className="text-ui-11 text-tea-text-sec tabular-nums">{String(count).padStart(2, '0')}</span>}
    </div>
    <div className="h-px bg-tea-gold/20" aria-hidden="true" />
  </div>
);
