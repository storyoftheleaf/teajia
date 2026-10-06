import React, { useMemo } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TODAY_ACTION_LABEL, todayItems, type TodayAction } from './curateV2Model';
import { getTeaColor } from '../../designTokens';

interface TodayViewProps {
  onStartTable: () => void;
  onAct: (entryId: string, action: TodayAction) => void;
}

/**
 * Curate opens here: what is waiting, one line each, the one thing it needs
 * as a small word on the right. A tea that is only a name says "Add cost".
 */
export const TodayView: React.FC<TodayViewProps> = ({ onStartTable, onAct }) => {
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
      <Section title="Waiting" count={items.length} />
      {items.length === 0 && (
        <p className="px-4 py-4 text-ui-13 text-tea-text-sec">Nothing waiting. Start a table, or add a tea by name.</p>
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
