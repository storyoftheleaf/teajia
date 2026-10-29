import React, { useState } from 'react';
import type { LogisticsTrackingUpdate as LogisticsTrackingSnapshot } from '../../../lib/logisticsTrackingUpdate';
import { TYPOGRAPHY_CLASSES as T } from '../../../designTokens';
import { TrackingTask } from './TrackingTask';

const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const date = (value: string) => new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Reported facts from saved messages, never a claim of continuous courier tracking. */
export function LogisticsTrackingUpdate({ update, emptyLabel = 'No parcel update reported' }: { update?: LogisticsTrackingSnapshot | null; emptyLabel?: string }) {
  const [open, setOpen] = useState(false);
  if (!update) return <div className="logistics-reported-update text-tea-text-dim">{emptyLabel}</div>;
  return <>
    <div className="logistics-reported-update">
      <span className="min-w-0"><strong>{update.status}</strong>{update.location && <span className="text-tea-text-sec"> · {update.location}</span>}</span>
      <span className="logistics-report-time text-tea-text-dim" title={date(update.reported_at || update.recorded_at)}>{update.reported_at ? 'Reported' : 'Saved'} {shortDate(update.reported_at || update.recorded_at)}</span>
      <button type="button" className="tap-target purchase-tracking-button" onClick={() => setOpen(true)}>Updates</button>
    </div>
    <TrackingTask open={open} onClose={() => setOpen(false)} title="Tracking updates">
      <p className={`${T.accountMeta} text-tea-text-sec mb-3`}>Saved from the messages you give the agent. The reported date is when this happened; the saved date is when it was entered.</p>
      <ol className="logistics-report-history">{(update.history?.length ? update.history : [update]).map((event, index) => <li key={`${event.recorded_at}:${index}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className={T.label}>{event.status}{event.location ? ` · ${event.location}` : ''}</h3><span className="text-tea-text-dim">{event.reported_at ? 'Reported' : 'Saved'} {date(event.reported_at || event.recorded_at)}</span></div>
        {event.description && <p className="text-tea-text-sec">{event.description}</p>}
        <blockquote className="whitespace-pre-wrap break-words">{event.source_text}</blockquote>
        <span className="text-tea-text-dim">Saved {date(event.recorded_at)}</span>
      </li>)}</ol>
    </TrackingTask>
  </>;
}
