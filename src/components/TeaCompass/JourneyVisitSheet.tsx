import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { CurateJourney, CurateVisit } from './types';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

interface JourneyVisitSheetProps {
  open: boolean;
  journeyId?: string | null;
  visitId?: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (journeyId: string | null, visitId: string | null) => void;
  onLoaded?: (journeys: CurateJourney[], visits: CurateVisit[]) => void;
}

export const JourneyVisitSheet: React.FC<JourneyVisitSheetProps> = ({
  open, journeyId, visitId, onOpenChange, onApply, onLoaded,
}) => {
  const [journeys, setJourneys] = useState<CurateJourney[]>([]);
  const [visits, setVisits] = useState<CurateVisit[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<string | null>(journeyId ?? null);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(visitId ?? null);

  useEffect(() => {
    if (!open) return;
    setSelectedJourney(journeyId ?? null);
    setSelectedVisit(visitId ?? null);
    let active = true;
    Promise.all([api.curateContext.listJourneys(), api.curateContext.listVisits()])
      .then(([journeyData, visitData]) => {
        if (!active) return;
        setJourneys(journeyData.journeys);
        setVisits(visitData.visits);
        onLoaded?.(journeyData.journeys, visitData.visits);
      })
      .catch(() => { /* Capture remains usable offline; context is optional. */ });
    return () => { active = false; };
  }, [open, journeyId, visitId, onLoaded]);

  const visibleVisits = useMemo(() => visits.filter(visit => !selectedJourney || !visit.journey_id || visit.journey_id === selectedJourney), [visits, selectedJourney]);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Journey & visit" description="Optional context for where this was encountered" large>
      <div className="space-y-5 px-1">
        <section aria-labelledby="journey-heading">
          <h3 id="journey-heading" className="px-3 mb-1 text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Journey</h3>
          {journeys.map(journey => (
            <SheetOption
              key={journey.id}
              label={[journey.name, journey.season && journey.year ? `${journey.season} ${journey.year}` : journey.year].filter(Boolean).join(', ')}
              selected={selectedJourney === journey.id}
              onSelect={() => { setSelectedJourney(journey.id); if (visits.find(v => v.id === selectedVisit)?.journey_id !== journey.id) setSelectedVisit(null); }}
            />
          ))}
        </section>
        <section aria-labelledby="visit-heading">
          <h3 id="visit-heading" className="px-3 mb-1 text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Visit</h3>
          {visibleVisits.map(visit => (
            <SheetOption key={visit.id} label={visit.vendor_name || visit.place || 'Visit'} hint={visit.place || undefined} selected={selectedVisit === visit.id} onSelect={() => { setSelectedVisit(visit.id); setSelectedJourney(visit.journey_id ?? null); }} />
          ))}
        </section>
        <div className="flex justify-between gap-3 px-3 pt-2">
          <button type="button" className="tap-target text-ui-14 text-tea-text-sec hover:text-tea-text" onClick={() => { onApply(null, null); onOpenChange(false); }}>Clear context</button>
          <button type="button" className="min-h-11 rounded-md bg-tea-gold px-5 text-ui-14 font-medium text-tea-bg hover:bg-tea-gold-lt" onClick={() => { onApply(selectedJourney, selectedVisit); onOpenChange(false); }}>Apply context</button>
        </div>
      </div>
    </BottomSheet>
  );
};
