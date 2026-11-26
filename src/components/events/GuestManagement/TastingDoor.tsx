import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { api, hasToken } from '../../../lib/api';

// Launch 3, J8. On the day of a tasting, a confirmed guest sees one button that
// opens the tasting, one tea per screen in pouring order. Nothing else: no
// timer, prompt or notification, and a guest who never taps it is asked nothing.

const OPEN_PARAM = 'open';
const OPEN_VALUE = 'tasting';

function dayIn(timeZone: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

/** True when `now` falls on the session's own date, in the session's time zone. */
export function isSessionDay(eventDate: string, timeZone: string | undefined, now: Date = new Date()): boolean {
  if (!eventDate) return false;
  const zone = timeZone || 'Asia/Taipei';
  // A wall-clock date ("2026-12-01T18:00") is already in the session's zone; one with an offset is converted.
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(eventDate);
  const sessionDay = hasOffset ? dayIn(zone, new Date(eventDate)) : eventDate.slice(0, 10);
  return sessionDay === dayIn(zone, now);
}

interface TastingDoorProps {
  magicToken: string;
  eventDate: string;
  timezone?: string;
}

const TastingDoor: React.FC<TastingDoorProps> = ({ magicToken, eventDate, timezone }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const resumed = useRef(false);
  const today = isSessionDay(eventDate, timezone);

  async function open() {
    if (!hasToken()) {
      const back = `${location.pathname}?${OPEN_PARAM}=${OPEN_VALUE}`;
      navigate(`/signin?returnTo=${encodeURIComponent(back)}`);
      return;
    }
    setOpening(true);
    setFailed(null);
    try {
      const { session_id } = await api.rsvp.openTasting(magicToken);
      navigate(`/session/${encodeURIComponent(session_id)}`);
    } catch (error) {
      setFailed((error as Error)?.message || 'The tasting could not be opened.');
      setOpening(false);
    }
  }

  // Back from sign-in: finish the open the guest asked for, once, and drop the marker so Back does not reopen it.
  useEffect(() => {
    if (resumed.current || !today) return;
    const params = new URLSearchParams(location.search);
    if (params.get(OPEN_PARAM) !== OPEN_VALUE || !hasToken()) return;
    resumed.current = true;
    params.delete(OPEN_PARAM);
    const rest = params.toString();
    navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, location.search]);

  if (!today) return null;

  return (
    <div className="mb-10 flex flex-col items-center gap-2">
      <Button type="button" className="tap-target" onClick={() => void open()} disabled={opening} loading={opening}>
        Open the tasting
      </Button>
      {failed && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>{failed}</p>}
    </div>
  );
};

export default TastingDoor;
