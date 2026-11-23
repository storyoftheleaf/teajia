import { lazy, Suspense, useState } from 'react';
import { useJournalHydration } from '../../hooks/useJournalHydration';
import { Button } from '../shared/Button';

const TastingSession = lazy(() => import('../tasting/TastingSession').then(module => ({ default: module.TastingSession })));

export function SitTeaTasting({ id, name, teaType, productId }: {
  id: string; name: string; teaType?: string | null; productId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { canRead } = useJournalHydration(open);
  const journalId = 'member-tea:recap:' + id;
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}
        aria-label={`Taste this tea: ${name}`}>Taste this tea</Button>
      {open && (
        <Suspense fallback={<p role="status" className="text-ui-13 text-tea-text-sec">Opening tasting…</p>}>
          <TastingSession key={String(canRead)} item={{
            id: journalId,
            name,
            type: teaType ?? undefined,
            photoProductId: productId ?? undefined,
            sourceType: 'memberTea',
            collectionUnavailable: true,
          }} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
