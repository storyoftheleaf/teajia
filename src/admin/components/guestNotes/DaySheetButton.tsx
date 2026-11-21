import React, { useState } from 'react';
import { familyApi } from '../../../lib/familyApi';
import type { FamilySheetRange } from '../../../lib/familyContract';
import { TextAction, errorSentence } from './parts';

/**
 * Today's sheet: the day's notes and ratings as a CSV the shop saves. It is a
 * download made when the button is pressed, never a scheduled job. "Today" is
 * the shop's own local day, sent to the worker as two instants so the worker
 * needs no time zone.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function todayRange(now = new Date()): FamilySheetRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    day: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export function DaySheetButton() {
  const [state, setState] = useState<'idle' | 'working' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setState('working');
    setError(null);
    try {
      const range = todayRange();
      const blob = await familyApi.shop.sheet(range);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `teajia-notes-${range.day}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState('saved');
    } catch (cause) {
      setState('idle');
      setError(errorSentence(cause, 'Could not make the sheet.'));
    }
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <TextAction onClick={() => { void download(); }} disabled={state === 'working'}>
        {state === 'working' ? 'Making the sheet…' : "Download today's sheet"}
      </TextAction>
      {state === 'saved' && <span role="status" className="text-ui-11 text-tea-text-dim">Saved to your downloads.</span>}
      {error && <span role="alert" className="text-ui-11 text-tea-text-sec">{error}</span>}
    </div>
  );
}
