// In-memory "which revision counts as current" override for the pilot demo
// panel. Not an approval: the real approval stays the claims:approve commit.
import type { PublicClaim } from '../../../wisdom/reference/claims';

export type RevisionChoice = number | 'withdrawn';
export type RevisionOverrides = Readonly<Record<string, RevisionChoice>>;

export function applyRevisionOverrides(
  claims: readonly PublicClaim[],
  overrides: RevisionOverrides,
): PublicClaim[] {
  return claims.map(claim => {
    const choice = overrides[claim.claimId];
    if (choice === undefined) return claim;
    if (choice === 'withdrawn') {
      return {
        ...claim,
        reviewState: 'withdrawn',
        withdrawn: { at: 'preview', reason: 'Withdrawn in the pilot preview panel' },
      };
    }
    const revision = claim.previousRevisions?.find(candidate => candidate.rev === choice);
    if (!revision) return claim;
    const { withdrawn: _withdrawn, ...rest } = claim;
    return {
      ...rest,
      rev: revision.rev,
      scope: revision.scope,
      text: revision.text,
      reviewState: 'approved',
    };
  });
}

/** Revisions a claim can be switched between on the panel. */
export function revisionChoices(claim: PublicClaim): RevisionChoice[] {
  const revs = (claim.previousRevisions ?? []).map(revision => revision.rev);
  return [...(revs.length ? revs : claim.rev !== null ? [claim.rev] : []), 'withdrawn'];
}

// The app re-mounts a route's element on every navigation (AnimatedRoutes),
// so the panel's choice lives here, in memory, for the life of the tab.
let currentOverrides: RevisionOverrides = {};
const listeners = new Set<() => void>();

export const revisionOverrideStore = {
  get: (): RevisionOverrides => currentOverrides,
  set(next: RevisionOverrides) {
    currentOverrides = next;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
