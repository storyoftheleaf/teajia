import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LogisticsService } from '../../../lib/logisticsTypes';
import type { JourneyItem, JourneyStageKey, ServiceJourney } from './serviceJourney';

// One logistics service as a journey track (Adrian chose it, 2026-11-27):
// ordered, at the forwarder, on the way, arrived. A stage opens its items, and
// every item, tea included, is a link. Depth comes from close tones and space,
// never from lines.

const SHOWN_TEAS = 3;

export function JourneyChip({ item, onGo }: { item: JourneyItem; onGo?: () => void }) {
  return <Link className="journey-chip tap-target text-ui-13" to={item.href} onClick={onGo}>
    <span>{item.label}</span>{item.detail && <span className="text-tea-text-dim">{item.detail}</span>}
  </Link>;
}

export function ServiceJourneyCard({ service, journey, rate, busy, onEdit, onGo, children }: {
  service: LogisticsService;
  journey: ServiceJourney;
  rate: string;
  busy: boolean;
  onEdit: () => void;
  onGo: () => void;
  /** The editor, when this service is being edited. */
  children?: React.ReactNode;
}) {
  const [stage, setStage] = useState<JourneyStageKey | null>(journey.focus);
  const [allTeas, setAllTeas] = useState(false);
  const open = journey.stages.find(item => item.key === stage);
  const quiet = !journey.focus && !journey.teas.length;
  const teas = allTeas ? journey.teas : journey.teas.slice(0, SHOWN_TEAS);
  return <article className="journey-card" data-testid={`service-journey-${service.id}`} aria-label={`${service.logistics_company_name} ${service.name}`}>
    <header className="journey-head">
      <div className="min-w-0">
        <div className="text-ui-16 text-tea-text">{service.logistics_company_name}</div>
        <div className="text-ui-12 text-tea-text-dim">{service.name} by {service.mode === 'sea' ? 'boat' : 'air'}</div>
      </div>
      <div className="journey-rate">
        <div className="text-ui-16 text-tea-text tabular-nums">{rate}</div>
        {journey.lastBill && <div className="text-ui-12 text-tea-text-dim tabular-nums">last bill {journey.lastBill}</div>}
      </div>
      <button type="button" className="btn-quiet btn-sm" disabled={busy} onClick={onEdit}>Edit</button>
    </header>
    {quiet ? <p className="text-ui-12 text-tea-text-dim">Nothing on this route yet. Pick it on a tea, or when preparing a shipment.</p> : <>
      <div className="journey-track" role="group" aria-label={`${service.name} journey`}>
        {journey.stages.map(item => <button key={item.key} type="button" className="journey-stage" data-stage={item.key}
          aria-pressed={stage === item.key} data-empty={item.items.length === 0 || undefined}
          onClick={() => setStage(stage === item.key ? null : item.key)}>
          <span className="text-ui-12 text-tea-text-dim journey-stage-label">{item.label}</span>
          <span className="text-ui-20 text-tea-text tabular-nums">{item.items.length}</span>
          {item.items[0] && <span className="text-ui-12 text-tea-gold-lt journey-stage-first">{item.items[0].label}</span>}
        </button>)}
      </div>
      {open && open.items.length > 0 && <div className="journey-items" data-testid={`journey-items-${open.key}`}>
        {open.items.map(item => <JourneyChip key={item.key} item={item} onGo={onGo}/>)}
      </div>}
      {journey.teas.length > 0 && <div className="journey-items" aria-label={`Teas priced by ${service.name}`}>
        <span className="text-ui-12 text-tea-text-dim journey-items-label">Teas</span>
        {teas.map(item => <JourneyChip key={item.key} item={item} onGo={onGo}/>)}
        {journey.teas.length > SHOWN_TEAS && <button type="button" className="journey-more tap-target text-ui-12 text-tea-text-dim" onClick={() => setAllTeas(!allTeas)}>
          {allTeas ? 'Fewer teas' : `+ ${journey.teas.length - SHOWN_TEAS} teas`}
        </button>}
      </div>}
    </>}
    {children}
  </article>;
}
