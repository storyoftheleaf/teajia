/**
 * Tea Wisdom pilot: the pages and claims the grade page and the article review
 * flag read. Contract: docs/_notes/tea-wisdom-claims.md, "Page visibility and
 * generated modules".
 *
 * A production build sees the public registry and GENERATED_CLAIMS only. In DEV
 * or the tea-reference-preview build, the draft module and the pilot fixtures
 * are loaded through dynamic imports inside a constant-folded branch, so neither
 * reaches a production bundle. A page the draft module already carries wins
 * over its fixture, so the fixtures retire themselves as real pages land.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { applyRevisionOverrides, revisionOverrideStore } from '../preview/wisdomPilot/revisionOverride';
import type { DraftClaim, DraftReferencePage, PublicClaim, PublicTeaReferenceSource } from '../../wisdom/reference/claims';
import { GENERATED_CLAIMS } from '../../wisdom/reference/generatedClaims';
import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../wisdom/reference/generatedPages';

export const WISDOM_PILOT_PREVIEW = import.meta.env.DEV || import.meta.env.MODE === 'tea-reference-preview';

/**
 * Preview only: show draft and pending claims as if approved, so the sandbox can
 * be reviewed end to end. A draft gets rev = (last revision + 1) and its Markdown
 * text; `previewDraft` marks it. Production never runs this.
 */
export function promoteDraftsForPreview(claims: readonly (DraftClaim | PublicClaim)[]): (DraftClaim | PublicClaim)[] {
  return claims.map(claim => {
    if ((claim.reviewState !== 'draft' && claim.reviewState !== 'pending') || !claim.pendingText) return claim;
    const nextRev = (claim.previousRevisions?.length ?? 0) + 1;
    return {
      ...claim,
      reviewState: 'approved',
      rev: nextRev,
      text: claim.pendingText,
      scope: claim.scope,
      previousRevisions: [
        ...(claim.previousRevisions ?? []),
        { rev: nextRev, origin: 'approved', scope: claim.scope, text: claim.pendingText, approvedAt: 'preview', reason: 'Draft shown in the pilot preview', evidenceIds: [] },
      ],
      previewDraft: true,
    } as DraftClaim & { previewDraft: true };
  });
}

export interface WisdomPilotData {
  pages: readonly DraftReferencePage[];
  claims: readonly (DraftClaim | PublicClaim)[];
  sources: readonly PublicTeaReferenceSource[];
  /** True when any fixture stood in for a page the draft module does not carry yet. */
  usesFixtures: boolean;
}

function publicData(): WisdomPilotData {
  return {
    pages: GENERATED_TEA_REFERENCE_REGISTRY.pages.map(page => ({ ...page, visibility: 'public' as const })),
    claims: GENERATED_CLAIMS,
    sources: GENERATED_TEA_REFERENCE_REGISTRY.sources,
    usesFixtures: false,
  };
}

let pending: Promise<WisdomPilotData> | null = null;

export function loadWisdomPilotData(): Promise<WisdomPilotData> {
  if (pending) return pending;
  if (WISDOM_PILOT_PREVIEW) {
    pending = Promise.all([
      import('../../wisdom/reference/generatedDraftClaims'),
      import('./gradePilotFixtures'),
    ]).then(([draft, fixtures]) => {
      const draftPageIds = new Set(draft.GENERATED_DRAFT_PAGES.map(page => page.id));
      const fixturePages = fixtures.GRADE_PILOT_PAGES.filter(page => !draftPageIds.has(page.id));
      const fixtureIds = new Set(fixturePages.map(page => page.id));
      const sourceIds = new Set(draft.GENERATED_DRAFT_SOURCES.map(source => source.sourceId));
      return {
        pages: [...draft.GENERATED_DRAFT_PAGES, ...fixturePages],
        claims: promoteDraftsForPreview([
          ...draft.GENERATED_DRAFT_CLAIMS,
          ...fixtures.gradePilotClaims(2).filter(claim => fixtureIds.has(claim.pageId)),
        ]),
        sources: [
          ...draft.GENERATED_DRAFT_SOURCES,
          ...fixtures.GRADE_PILOT_SOURCES.filter(source => !sourceIds.has(source.sourceId)),
        ],
        usesFixtures: fixturePages.length > 0,
      };
    });
    return pending;
  }
  pending = Promise.resolve(publicData());
  return pending;
}

export function useWisdomPilotData(): WisdomPilotData | null {
  const [data, setData] = useState<WisdomPilotData | null>(null);
  useEffect(() => {
    let live = true;
    loadWisdomPilotData().then(result => { if (live) setData(result); });
    return () => { live = false; };
  }, []);
  // The pilot panel's revision switch (an in-memory override, never an approval)
  // drives every pilot surface: listings, the grade page and the article flag.
  const overrides = useSyncExternalStore(revisionOverrideStore.subscribe, revisionOverrideStore.get);
  return useMemo(() => {
    if (!data || !WISDOM_PILOT_PREVIEW) return data;
    return { ...data, claims: applyRevisionOverrides(data.claims, overrides) };
  }, [data, overrides]);
}
