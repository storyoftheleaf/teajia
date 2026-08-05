import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

// Stock spine step 4, location-owner placement review (the owner-facing half
// of "the move"). A member requested that their personal, location-less tea be
// placed into THIS location's shop. The owner approves, landing it as held
// stock owned by the member (is_public=0, shown_in_shop=0), which the owner
// then lists and shows via the normal step-2 controls: or declines, returning
// it to the member's private cellar. Human-approved, never a silent write.
//
// Renders nothing when there are no pending requests, so it stays out of the
// way until a member actually asks.

export const PlacementRequests: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cellar-placements', accountId],
    queryFn: () => api.cellar.listPlacements(),
    staleTime: 1000 * 30,
  });
  const requests = data?.requests ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cellar-placements'] });
    // Approve creates a held product in this account, refresh the inventory.
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => api.cellar.approvePlacement(id),
    onSuccess: () => { showToast('Placed, now held stock you can list and show.', 'success'); invalidate(); },
    onError: (e: any) => showToast(e?.message || 'Failed to approve placement', 'error'),
  });
  const declineMut = useMutation({
    mutationFn: (id: string) => api.cellar.declinePlacement(id),
    onSuccess: () => { showToast("Declined, returned to the member's cellar.", 'success'); invalidate(); },
    onError: (e: any) => showToast(e?.message || 'Failed to decline placement', 'error'),
  });

  // Silent until a member actually requests placement here.
  if (isLoading || requests.length === 0) return null;

  const busyId = approveMut.isPending ? approveMut.variables
    : declineMut.isPending ? declineMut.variables
    : null;

  return (
    <section className="mb-10">
      <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>Placement requests</h2>
      <p className="text-tea-text-sec text-ui-13 mb-4 leading-[1.5]">
        A member asked to place their own tea in this shop. Approving lands it as held
        stock owned by them, you then list and show it like any other tea.
      </p>
      <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
        {requests.map(r => {
          const busy = busyId === r.id;
          return (
            <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-[160px] flex-1">
                <div className="text-ui-14 text-tea-text">
                  {r.name}{r.year ? <span className="text-tea-text-dim"> · {r.year}</span> : null}
                </div>
                <div className="text-ui-12 text-tea-text-dim mt-0.5">
                  {[r.type, r.origin].filter(Boolean).join(' · ') || '—'} · {Math.round(r.grams)}g
                </div>
                <div className="text-ui-12 text-tea-text-sec mt-0.5">
                  {r.ownerName || r.ownerEmail || 'A member'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => declineMut.mutate(r.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50"
                >
                  <X size={13} /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => approveMut.mutate(r.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 cta-solid rounded-md px-3 py-1.5 text-ui-13 font-medium disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
