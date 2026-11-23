import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { hasToken } from '../../lib/api';
import type { TastingData } from '../../types';
import { TastingExperienceField } from './YourImpression';

interface QuickTastingNoteProps {
  note: string;
  verdict?: TastingData['impression'] | null;
  wouldBuy: boolean;
  onChange: (note: string) => void;
  onSave: () => void;
  onFullTasting: () => void;
  canSave: boolean;
  saving?: boolean;
  saveFailed?: boolean;
}

export function QuickTastingNote({ note, verdict, wouldBuy, onChange, onSave, onFullTasting, canSave, saving, saveFailed }: QuickTastingNoteProps) {
  return (
    <>
      <TastingExperienceField verdict={verdict} wouldBuy={wouldBuy} value={note} onChange={onChange} />
      <p className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-[var(--space-2)]`}>
        {hasToken()
          ? 'Saved to your private tasting journal.'
          : 'Your guest journal is stored in this browser.'}
      </p>
      <div className="mt-[var(--space-3)] flex flex-wrap justify-between gap-[var(--space-2)]">
        <button type="button" className="btn-secondary" onClick={onFullTasting} disabled={saving}>Full tasting</button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : 'Save for me'}
        </button>
      </div>
      {saveFailed && <p role="alert" className={TYPOGRAPHY_CLASSES.bodyLight}>Could not save your note. Try again.</p>}
    </>
  );
}

export function QuickTastingNoteSaved({ name, synced, onDone, journal }: {
  name: string;
  synced: boolean;
  onDone: () => void;
  journal?: { productId: string; entryId: string };
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <section className="grid justify-items-start gap-[var(--space-2)]">
      <div role="status">
        <h2 ref={heading} tabIndex={-1} className={TYPOGRAPHY_CLASSES.h2}>
          {synced ? 'Saved to your journal' : 'Saved on this device'}
        </h2>
      </div>
      <p className={TYPOGRAPHY_CLASSES.bodyLight}>{name}</p>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <button type="button" onClick={onDone} className={journal ? 'btn-quiet' : 'btn-primary'}>Done</button>
        {journal && (
          <Link to={`/account/journal?${new URLSearchParams({ tea: journal.productId, entry: journal.entryId })}`} className="btn-primary">
            View journal
          </Link>
        )}
      </div>
    </section>
  );
}
