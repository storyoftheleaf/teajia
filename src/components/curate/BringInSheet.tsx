import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

/** What the tea is when it comes in. "sample" opens Source's Sample record
 *  (a received sample, never weighed); "bought" opens its Buy record. */
export type BringInKind = 'noted' | 'sample' | 'bought';

const KINDS: { kind: BringInKind; label: string; hint: string }[] = [
  { kind: 'noted', label: 'Just noting it', hint: 'Not bought, no sample yet' },
  { kind: 'sample', label: 'A sample is here', hint: 'Taste it when you like; it never has to be weighed' },
  { kind: 'bought', label: 'Bought it', hint: 'Ordered, on the way or here; the amount and cost go with it' },
];

/** The one way in for a tea, a sample or a list (step 2 of the intake plan,
 *  Adrian 2026-11-27). Asks "Sample, or bought?" once, then how it comes in.
 *  Stock's Add tea opens this same sheet, so every tea starts in the Library. */
export const BringInSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewTea: (kind: BringInKind) => void;
  onNewTeaware: (kind: BringInKind) => void;
  onImport: () => void;
  children?: React.ReactNode;
}> = ({ open, onOpenChange, onNewTea, onNewTeaware, onImport, children }) => {
  const [kind, setKind] = useState<BringInKind>('noted');
  const close = () => onOpenChange(false);
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Bring in" description="A tea, a sample or a list" large>
      <p className="px-3 pt-1 text-ui-11 uppercase tracking-[0.08em] text-tea-text-sec" id="bring-in-kind">Sample, or bought?</p>
      <div role="group" aria-labelledby="bring-in-kind" data-testid="bring-in-kind">
        {KINDS.map(option => (
          <SheetOption key={option.kind} label={option.label} hint={option.hint} selected={kind === option.kind} onSelect={() => setKind(option.kind)} />
        ))}
      </div>
      <p className="px-3 pt-3 text-ui-11 uppercase tracking-[0.08em] text-tea-text-sec">How it comes in</p>
      <SheetOption label="New tea" hint="Capture it by typing a name, talking, or a photo of the package" onSelect={() => { close(); onNewTea(kind); }} />
      <SheetOption label="New teaware" hint="Capture a piece and its provenance" onSelect={() => { close(); onNewTeaware(kind); }} />
      <SheetOption label="Several teas at once" hint="Talk them through, or paste a list; each one waits for you to confirm" onSelect={() => { close(); onImport(); }} />
      <SheetOption label="Import files" hint="A WeChat list, an invoice, a sheet or photos" onSelect={() => { close(); onImport(); }} />
      {children}
    </BottomSheet>
  );
};

/** Opens the answer to "Sample, or bought?" on the new capture once Source has
 *  drawn it: Sample opens the received-sample record, Bought the Buy record. */
export function usePendingCaptureAction(
  pending: React.MutableRefObject<BringInKind | null>,
  // Source draws a phone and a laptop form (one hidden); each opens its own.
  actions: React.MutableRefObject<{ openSample: () => void; toggleBuy: () => void } | null>[],
  sourcingEntryId: string | null,
) {
  const refs = useRef(actions);
  refs.current = actions;
  useEffect(() => {
    const kind = pending.current;
    if (!kind || !sourcingEntryId) return;
    if (kind === 'noted') { pending.current = null; return; }
    // Each form fills its ref as it draws (a new object each render), so try
    // each ref once, for a few frames.
    const opened = new Set<unknown>();
    let frame = 0;
    let tries = 0;
    const step = () => {
      for (const ref of refs.current) {
        const a = ref.current;
        if (!a || opened.has(ref)) continue;
        opened.add(ref);
        pending.current = null;
        if (kind === 'sample') a.openSample(); else a.toggleBuy();
      }
      if (opened.size < refs.current.length && ++tries < 30) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [pending, sourcingEntryId]);
}
