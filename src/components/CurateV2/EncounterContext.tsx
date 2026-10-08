import React, { useCallback, useEffect, useState } from 'react';
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
    <div className="curate-v2">
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)} className="curate-v2-line w-full text-left" data-curate-action>
        <span className="curate-v2-label">Visit</span>
        <span className={`flex-1 truncate text-right ${label ? 'font-display text-ui-17 text-tea-text' : 'font-mono text-ui-13 text-tea-gold'}`}>{label || 'add'}</span>
      </button>
      <JourneyVisitSheet open={open} onOpenChange={setOpen} journeyId={journeyId} visitId={visitId} onApply={onChange} onLoaded={onLoaded} />
    </div>
  );
};
