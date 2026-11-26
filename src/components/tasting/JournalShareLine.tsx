import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { familyApi } from '../../lib/familyApi';
import type { FamilyShareState } from '../../lib/familyContract';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { TastingShareStep } from './TastingShareStep';
import { Button } from '../shared/Button';

/**
 * Your Table, decision 4 (todo/plans/your-table.md): one plain line on each
 * tasting in the journal saying where it is, and a tap that opens the one
 * Share step. No counts, nothing that asks. Shown only while
 * YOUR_TABLE_PAGE_OPEN is on; the journal decides that.
 */

export const TASTING_SHARES_QUERY_KEY = ['family', 'tasting-shares'] as const;

/** The line, in the words the Share step itself uses. */
export function shareLineWords(state: FamilyShareState, onTeaTable = false): string {
  if (state === 'private') return 'Private';
  const audience = onTeaTable ? 'On your page and the Tea Table' : 'On your page';
  return state === 'offered' ? `${audience}, photographs offered to Teajia` : audience;
}

/** Only a shop tea can be shared; a tea from the person's own chest cannot yet. */
export function canShareFromJournal(productId: string | null | undefined): productId is string {
  return !!productId && !productId.startsWith('member-tea:');
}

/** Every own tasting's share choice in one read. Absent means private. */
export function useTastingShares(enabled: boolean) {
  return useQuery({
    queryKey: TASTING_SHARES_QUERY_KEY,
    queryFn: () => familyApi.tastingShares(),
    enabled,
    staleTime: 1000 * 60,
    retry: false,
    select: data => new Map(data.shares.map(row => [row.product_id, row.share_state] as const)),
  });
}

export function JournalShareLine({ productName, state, onTeaTable, onOpen }: {
  productName: string;
  /** null while the read has not answered: the line says nothing rather than guess. */
  state: FamilyShareState | null;
  onTeaTable: boolean;
  onOpen: () => void;
}) {
  if (state == null) return null;
  const words = shareLineWords(state, onTeaTable);
  return (
    <div className="px-3.5 pb-2 -mt-1">
      <Button
        variant="plain"
        type="button"
        onClick={onOpen}
        data-testid="journal-share-line"
        aria-label={`${productName}: ${words}. Change where this tasting goes`}
        className={`${TYPOGRAPHY_CLASSES.accountMeta} tap-target inline-flex items-center text-left text-tea-text-sec hover:text-tea-text transition-colors`}
      >
        {words}
      </Button>
    </div>
  );
}

/**
 * The existing Share step, opened from the journal. It needs to know whether
 * this tea has photographs (that is what offers them to Teajia), so the
 * member's own view of the tea is read once, when the step opens.
 */
export function JournalShareSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mine = useQuery({
    queryKey: ['family', 'my-tea', productId],
    queryFn: () => familyApi.myTea(productId),
    staleTime: 1000 * 30,
    retry: false,
  });
  const close = () => {
    void queryClient.invalidateQueries({ queryKey: TASTING_SHARES_QUERY_KEY });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-modal" data-testid="journal-share-sheet">
      <Button variant="plain" type="button" aria-label="Close sharing" tabIndex={-1} className="absolute inset-0 w-full h-full bg-tea-bg/70" onClick={close} />
      {/* The step sets itself at the foot of what holds it; this keeps that
          foot above the phone's bar. */}
      <div className="absolute inset-x-0 top-0 bottom-nav pointer-events-none [&>*]:pointer-events-auto">
        {mine.isSuccess || mine.isError ? (
          <TastingShareStep
            productId={productId}
            photographCount={mine.data?.photographs.length ?? 0}
            onClose={close}
          />
        ) : null}
      </div>
    </div>
  );
}
