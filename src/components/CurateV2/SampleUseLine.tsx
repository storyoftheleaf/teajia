import React, { useEffect, useState } from 'react';
import { gramsToUse, useSampleUse, whole } from './sampleUse';

/**
 * "Uses 5 g of the 10 g sample": one quiet row in the tasting sheet, shown only
 * when the tea has a received, weighed portion in hand. The number is the
 * grams this tasting will use up; it can be changed, never above what is left.
 */
export const SampleUseLine: React.FC<{ entryId: string }> = ({ entryId }) => {
  const portion = useSampleUse((s) => (s.opening?.entryId === entryId ? s.opening.portion : null));
  const setTyped = useSampleUse((s) => s.setTyped);
  const left = portion?.grams ?? 0;
  const [text, setText] = useState('');
  useEffect(() => { setText(portion ? whole(gramsToUse(portion, '')) : ''); }, [portion?.id, portion?.grams]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!portion) return null;

  const change = (raw: string) => {
    // Digits and one point; never more than is left.
    let next = raw.replace(/[^0-9.]/g, '');
    const firstPoint = next.indexOf('.');
    if (firstPoint >= 0) next = next.slice(0, firstPoint + 1) + next.slice(firstPoint + 1).replace(/\./g, '');
    if (next !== '' && Number(next) > left) next = whole(left);
    setText(next);
    setTyped(next);
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-1 border-b border-tea-border px-4 py-2.5 font-body text-ui-13 text-tea-text-sec" data-testid="sample-use-line">
      <span>Uses</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={() => { if (text === '' || text === '.') { setText(whole(gramsToUse(portion, ''))); setTyped(''); } }}
        aria-label="Grams of the sample this tasting uses"
        className="tap-target w-12 rounded-[3px] border border-tea-border bg-transparent px-1 text-center font-body tabular-nums text-tea-text focus:border-tea-gold focus:outline-none"
      />
      <span>g of the {whole(left)} g sample</span>
    </div>
  );
};

/**
 * When the shop would not take the grams, say so where the work is, in plain
 * words, and offer to try again. Nothing here claims the sample was used up.
 */
export const SampleUseNotice: React.FC = () => {
  const failure = useSampleUse((s) => s.failure);
  const sending = useSampleUse((s) => s.sending);
  const retry = useSampleUse((s) => s.retry);
  const dismiss = useSampleUse((s) => s.dismissFailure);
  if (!failure) return null;
  return (
    <div
      role="alert"
      data-testid="sample-use-failure"
      className="fixed left-0 right-0 z-20 bottom-nav flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-tea-border bg-tea-bg px-4 py-1.5 text-center text-ui-12 text-tea-error"
    >
      <p className="font-body">{failure.teaName}: {failure.message}</p>
      <span className="inline-flex items-center gap-2">
        <button type="button" disabled={sending} onClick={() => void retry()} className="tap-target text-tea-text-sec hover:text-tea-text disabled:opacity-50">Try again</button>
        <button type="button" onClick={dismiss} className="tap-target text-tea-text-sec hover:text-tea-text">Leave it</button>
      </span>
    </div>
  );
};
