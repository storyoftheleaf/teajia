import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, ChevronRight } from 'lucide-react';
import type { CurateJourney, CurateVisit } from './types';
import { JourneyVisitSheet } from './JourneyVisitSheet';
import { api } from '../../lib/api';

interface EncounterContextProps {
  journeyId?: string | null;
  visitId?: string | null;
  onChange: (journeyId: string | null, visitId: string | null) => void;
}

function journeyLabel(journey?: CurateJourney): string | null {
  if (!journey) return null;
  return [journey.name, journey.season && journey.year ? `${journey.season} ${journey.year}` : journey.year].filter(Boolean).join(', ');
}

export const EncounterContext: React.FC<EncounterContextProps> = ({ journeyId, visitId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [journeys, setJourneys] = useState<CurateJourney[]>([]);
  const [visits, setVisits] = useState<CurateVisit[]>([]);
  const onLoaded = useCallback((nextJourneys: CurateJourney[], nextVisits: CurateVisit[]) => {
    setJourneys(nextJourneys);
    setVisits(nextVisits);
  }, []);
  useEffect(() => {
    if (!journeyId && !visitId) return;
    let active = true;
    Promise.all([api.curateContext.listJourneys(), api.curateContext.listVisits()])
      .then(([journeyData, visitData]) => {
        if (active) onLoaded(journeyData.journeys, visitData.visits);
      })
      .catch(() => { /* IDs remain attached even when context labels are offline. */ });
    return () => { active = false; };
  }, [journeyId, visitId, onLoaded]);
  const journey = journeys.find(item => item.id === journeyId);
  const visit = visits.find(item => item.id === visitId);
  const label = [journeyLabel(journey), visit?.vendor_name || visit?.place].filter(Boolean).join(' · ');
  const ariaLabel = label ? `Edit context: ${label}` : 'Add journey or visit context';

  return (
    <>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)} className="curate-support tap-target flex min-h-11 w-full items-center gap-2 text-left text-tea-text-sec hover:text-tea-text" data-curate-action>
        <MapPin size={14} className="shrink-0 text-tea-gold" aria-hidden />
        <span className="flex-1 truncate">{label || 'Add journey or visit'}</span>
        <ChevronRight size={14} aria-hidden />
      </button>
      <JourneyVisitSheet open={open} onOpenChange={setOpen} journeyId={journeyId} visitId={visitId} onApply={onChange} onLoaded={onLoaded} />
    </>
  );
};
