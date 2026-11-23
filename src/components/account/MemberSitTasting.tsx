import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useJournalHydration } from '../../hooks/useJournalHydration';
import { useAppStore } from '../../lib/store';
import type { SitTea } from '../../lib/memberPrivateSits';
import { Button } from '../shared/Button';
import { TastingSession } from '../tasting/TastingSession';

export function MemberSitTasting({ sitId, tea, photographs }: {
  sitId: string;
  tea: SitTea;
  photographs?: ReactNode;
}) {
  // A sit has its own Journal record so starting another sit with the same tea
  // never edits this one's memory. The sit carries the canonical tea reference.
  const productId = `member-sit:${sitId}`;
  const { canRead } = useJournalHydration();
  const entry = useAppStore(state => state.tastingJournal.find(item => !item.archived && item.productId === productId));
  const [open, setOpen] = useState(false);
  const tasting = entry?.tastings.at(-1);
  const editorLabel = tasting && canRead ? 'Edit your tasting' : 'Record a tasting';
  return (
    <>
      <Button type="button" variant="quiet" size="sm" disabled={!canRead} onClick={() => setOpen(true)}>{editorLabel}</Button>
      {entry && tasting && canRead && (
        <Link to={`/account/journal?${new URLSearchParams({ tea: productId, entry: entry.id, tasting: tasting.id })}`}
          className="btn-quiet btn-sm">View in Journal</Link>
      )}
      {open && canRead && (
        <TastingSession
          item={{
            id: productId,
            name: tea.name,
            sourceType: 'memberTea',
            journalRecord: tasting ?? {
              id: productId, createdAt: new Date().toISOString(), sourceType: 'memberTea', tasting: {},
            },
            collectionUnavailable: true,
          }}
          privatePhotographs={photographs}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
