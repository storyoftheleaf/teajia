import React, { useMemo } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TODAY_ACTION_LABEL, todayItems, type TodayAction } from './curateV2Model';
import { getTeaColor } from '../../designTokens';
import { AgentInbox } from './AgentInbox';

interface TodayViewProps {
  onStartTable: () => void;
  onAct: (entryId: string, action: TodayAction) => void;
  onOpenTea: (entryId: string) => void;
}

/**
 * Curate opens here: what is waiting, one line each, the one thing it needs
 * as a small word on the right. A tea that is only a name says "Add cost".
 */
export const TodayView: React.FC<TodayViewProps> = ({ onStartTable, onAct, onOpenTea }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const items = useMemo(() => todayItems(entries).slice(0, 40), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const onTheWay = useMemo(() => entries.filter((e) => e.status === 'incoming' || e.status === 'buying').slice(0, 20), [entries]);

  return (
    <div className="curate-v2 -mx-4">
      <div className="px-4 pb-3">
        <button type="button" onClick={onStartTable} className="cta-solid w-full rounded-md py-3 text-ui-13 font-semibold">
          Start a table
        </button>
      </div>
      <AgentInbox onOpenTea={onOpenTea} />
      <Section title="Waiting" count={items.length} />
      {items.length === 0 && entries.length > 0 && (
        <p className="px-4 py-4 text-ui-13 text-tea-text-sec">Nothing waiting. Start a table, or add a tea by name.</p>
      )}
      {entries.length === 0 && (
        // First time here: how a tea gets from a vendor's table to the shelf.
        <ol className="grid gap-0 px-4 pt-2">
          {[
            ['At the table', 'Start a table, type each tea\u2019s name and price as the vendor says it, tap the cup to taste.'],
            ['Decide', 'Each tea waits here until you choose Buy, Sample or Pass. Compare a few in Teas.'],
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
        </ol>
      )}
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
      {onTheWay.length > 0 && (
        <>
          <Section title="On the way" count={onTheWay.length} />
          {onTheWay.map((e) => (
            <button key={e.id} type="button" onClick={() => onAct(e.id, 'decide')} className="curate-v2-row w-full text-left">
              <span className="curate-v2-name">{e.name || 'Untitled tea'}</span>
              {e.vendorName && <span className="text-ui-12 text-tea-text-dim">{e.vendorName}</span>}
              <span className="flex-1" />
              <span className="text-ui-12 text-tea-text-sec">{e.status === 'buying' ? 'buying' : 'ordered'}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
};

export const Section: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
  <div className="flex items-baseline justify-between border-b border-tea-border px-4 pb-2 pt-4">
    <span className="font-display text-ui-20 text-tea-text">{title}</span>
    {count != null && <span className="text-ui-12 font-medium text-tea-text-dim tabular-nums">{count}</span>}
  </div>
);
