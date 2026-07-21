import React, { useEffect, useRef, useState, type ReactNode } from 'react';

interface ImportDeleteActionProps {
  busy: boolean;
  onDelete: () => Promise<void>;
  compact?: boolean;
  trailingActions?: ReactNode;
}

export const ImportDeleteAction: React.FC<ImportDeleteActionProps> = ({ busy, onDelete, compact = false, trailingActions }) => {
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (confirming) {
    return <div role="group" aria-label="Delete import confirmation" className={`space-y-3 rounded-md border border-tea-border bg-tea-surface ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-ui-12 text-tea-text">This import will be removed from your incomplete imports. Its saved record is retained for audit and recovery.</p>
      <div className="flex flex-wrap justify-between gap-3">
        <button ref={cancelRef} type="button" disabled={busy} onClick={() => { setConfirming(false); requestAnimationFrame(() => deleteRef.current?.focus()); }} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void onDelete()} className="tap-target min-h-11 text-ui-12 text-tea-gold hover:text-tea-gold-lt disabled:opacity-50">Delete import</button>
      </div>
    </div>;
  }

  const deleteButton = <button ref={deleteRef} type="button" disabled={busy} onClick={() => setConfirming(true)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Delete import</button>;
  return trailingActions ? <div className="flex flex-wrap justify-between gap-2 border-t border-tea-border pt-3">{deleteButton}<div className="flex flex-wrap gap-3">{trailingActions}</div></div> : deleteButton;
};
