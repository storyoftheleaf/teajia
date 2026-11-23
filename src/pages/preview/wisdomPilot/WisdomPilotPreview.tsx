// Dev-only Tea Wisdom listing pilot: /preview/wisdom-pilot/*.
// Mounted from App.tsx inside the import.meta.env.DEV block only.
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlcoveCard } from '../../../components/shop/AlcoveCard';
import { WisdomListingProvider } from '../../../components/shop/alcove/AlcoveWisdomPassages';
import { Button } from '../../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import type { PublicClaim } from '../../../wisdom/reference/claims';
import { resolveListingPassages } from '../../../wisdom/reference/listingPassages';
import { PILOT_FIXTURE_CLAIMS } from './fixtureClaims';
import { loadWisdomPilotData } from '../../wisdom/wisdomPilotData';
import { PILOT_FIXTURES, type PilotFixture } from './fixtureProducts';
import { applyRevisionOverrides, revisionChoices, revisionOverrideStore, type RevisionChoice, type RevisionOverrides } from './revisionOverride';
import { installPilotApiStub, stubbedCalls } from './stubApi';
import { COMPOSED_FIXTURES, type ComposedFixture } from './composedFixtures';
import { DRAFT_ENTRIES, draftItem, type DraftEntryFile } from './draftEntries';

installPilotApiStub();

const BASE = '/preview/wisdom-pilot';
const ORDER: PilotFixture['slug'][] = ['naka', 'gong-ting-external', 'type-only'];

function choiceLabel(choice: RevisionChoice): string {
  return choice === 'withdrawn' ? 'Withdrawn' : `Rev ${choice}`;
}

function currentChoice(claim: PublicClaim, overrides: RevisionOverrides): RevisionChoice {
  return overrides[claim.claimId] ?? (claim.reviewState === 'withdrawn' ? 'withdrawn' : claim.rev ?? 'withdrawn');
}

const PreviewStrip: React.FC<{ fixture: PilotFixture }> = ({ fixture }) => (
  <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-tea-border pb-3">
    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-sec`}>
      {fixture.banner
        ? <strong className="font-medium text-tea-text" data-pilot-banner>{fixture.banner}</strong>
        : <>Tea Wisdom pilot preview · {fixture.title}</>}
    </p>
    <Link to={BASE} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>All pilot pages</Link>
  </div>
);

const claimsFor = (fixture: PilotFixture, claims: readonly PublicClaim[]) =>
  fixture.omitStyleReferences ? claims.filter(claim => claim.axis !== 'sensory_observation') : claims;

const ListingPage: React.FC<{ fixture: PilotFixture; claims: readonly PublicClaim[] }> = ({ fixture, claims: allClaims }) => {
  const claims = claimsFor(fixture, allClaims);
  return (
  <div className="min-w-0 pb-nav" data-pilot-fixture={fixture.slug}>
    <PreviewStrip fixture={fixture} />
    <WisdomListingProvider value={{ claims, facts: fixture.facts, pilot: { externalReference: fixture.externalReference } }}>
      <AlcoveCard item={fixture.item} layout="page" />
    </WisdomListingProvider>
  </div>
  );
};

const COMPOSED_ORDER: ComposedFixture['slug'][] = ['naka', 'ripe-brick'];

/** Phase 1 target: one written entry in place of the stacked passages. */
const ComposedPage: React.FC<{ fixture: ComposedFixture; claims: readonly PublicClaim[] }> = ({ fixture, claims }) => (
  <div className="min-w-0 pb-nav" data-composed-fixture={fixture.slug}>
    <div className="mx-4 mt-4 grid gap-1 border-b border-tea-border pb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-sec`}>Composed entry preview · {fixture.title}</p>
        <Link to={BASE} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>All pilot pages</Link>
      </div>
      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-dim`} data-builder-only>
        For you, not customers · would make it richer: {fixture.entry.missing.join(' · ')}
      </p>
    </div>
    <WisdomListingProvider value={{ claims, composed: fixture.entry }}>
      <AlcoveCard item={fixture.item} layout="page" />
    </WisdomListingProvider>
  </div>
);

/** Phase 2: a draft the composer wrote, with its review flags for the builder. */
const DraftPage: React.FC<{ file: DraftEntryFile; claims: readonly PublicClaim[] }> = ({ file, claims }) => {
  const flags = [...file.problems.map(p => `${p.where}: ${p.problem}`), ...file.unsupported.map(u => `“${u.sentence}” ${u.why}`)];
  return (
    <div className="min-w-0 pb-nav" data-draft-entry={file.record.id} data-draft-status={file.status}>
      <div className="mx-4 mt-4 grid gap-1 border-b border-tea-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-sec`}>
            Composed draft · {file.record.name} · {file.status === 'draft' ? 'passed both checks' : `${flags.length} flag(s) to review`}
          </p>
          <Link to={BASE} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>All pilot pages</Link>
        </div>
        {flags.map(flag => <p key={flag} className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-sec [overflow-wrap:anywhere]`} data-draft-flag>{flag}</p>)}
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 text-tea-text-dim`} data-builder-only>
          For you, not customers · would make it richer: {file.entry.missing.join(' · ')}
        </p>
      </div>
      <WisdomListingProvider value={{ claims, composed: file.entry }}>
        <AlcoveCard item={draftItem(file)} layout="page" />
      </WisdomListingProvider>
    </div>
  );
};

const IndexPage: React.FC<{
  claims: readonly PublicClaim[];
  baseClaims: readonly PublicClaim[];
  overrides: RevisionOverrides;
  onChoose: (claimId: string, choice: RevisionChoice) => void;
  onReset: () => void;
}> = ({ claims, baseClaims, overrides, onChoose, onReset }) => {
  const switchable = baseClaims.filter(claim => (claim.previousRevisions?.length ?? 0) > 1);
  return (
    <div className="mx-auto w-full max-w-screen-md min-w-0 px-4 pb-nav pt-6">
      <h1 className={`${TYPOGRAPHY_CLASSES.h1} m-0 text-tea-text`}>Tea Wisdom listing pilot</h1>
      <p className={`${TYPOGRAPHY_CLASSES.body} mt-3 text-tea-text-sec`}>
        Development preview. Every API call on these pages is answered locally ({stubbedCalls().length} so far), and nothing is written.
      </p>

      <section className="mt-8" aria-labelledby="pilot-revisions">
        <h2 id="pilot-revisions" className={`${TYPOGRAPHY_CLASSES.h2} m-0 text-tea-text`}>Which revision counts as current</h2>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>
          An in-memory override for this tab only. It is not an approval; that stays the claims:approve commit.
        </p>
        {switchable.map(claim => {
          const active = currentChoice(claim, overrides);
          return (
            <div key={claim.claimId} className="mt-4 min-w-0" data-revision-switch={claim.claimId}>
              <p className={`${TYPOGRAPHY_CLASSES.label} m-0 text-tea-text-dim`}>{claim.claimId}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Current revision of ${claim.claimId}`}>
                {revisionChoices(claim).map(choice => (
                  <Button
                    key={String(choice)}
                    variant="chip"
                    size="sm"
                    aria-pressed={active === choice}
                    onClick={() => onChoose(claim.claimId, choice)}
                  >
                    {choiceLabel(choice)}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
        <Button variant="quiet" size="sm" className="mt-4" onClick={onReset}>Reset to the fixture</Button>
      </section>

      <section className="mt-10" aria-labelledby="pilot-composed">
        <h2 id="pilot-composed" className={`${TYPOGRAPHY_CLASSES.h2} m-0 text-tea-text`}>Composed entries (phase 1)</h2>
        <ul className="m-0 mt-2 list-none p-0">
          {DRAFT_ENTRIES.map(file => (
          <Route key={`draft-${file.record.id}`} path={`drafts/${file.record.id}`} element={<DraftPage file={file} claims={claims} />} />
        ))}
        {COMPOSED_ORDER.map(slug => (
            <li key={slug} className="mt-6 min-w-0 border-t border-tea-border pt-4">
              <Link to={`${BASE}/composed/${slug}`} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>{COMPOSED_FIXTURES[slug].title}</Link>
              <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 mt-1 text-tea-text-sec`}>{COMPOSED_FIXTURES[slug].note}</p>
            </li>
          ))}
        </ul>
      </section>

      {DRAFT_ENTRIES.length > 0 && (
        <section className="mt-10" aria-labelledby="pilot-drafts">
          <h2 id="pilot-drafts" className={`${TYPOGRAPHY_CLASSES.h2} m-0 text-tea-text`}>Composed drafts (phase 2)</h2>
          <ul className="m-0 mt-2 list-none p-0">
            {DRAFT_ENTRIES.map(file => (
              <li key={file.record.id} className="mt-4 min-w-0 border-t border-tea-border pt-3">
                <Link to={`${BASE}/drafts/${file.record.id}`} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>{file.record.name}</Link>
                <span className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim`}> · {file.status === 'draft' ? 'passed both checks' : 'needs review'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="pilot-pages">
        <h2 id="pilot-pages" className={`${TYPOGRAPHY_CLASSES.h2} m-0 text-tea-text`}>Listings</h2>
        <ul className="m-0 mt-2 list-none p-0">
          {ORDER.map(slug => {
            const fixture = PILOT_FIXTURES[slug];
            const listing = resolveListingPassages(fixture.facts, claimsFor(fixture, claims));
            return (
              <li key={slug} className="mt-6 min-w-0 border-t border-tea-border pt-4" data-pilot-index-row={slug}>
                <Link to={`${BASE}/${slug}`} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>{fixture.title}</Link>
                <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 mt-1 text-tea-text-sec`}>{fixture.note}</p>
                <p className={`${TYPOGRAPHY_CLASSES.bodyLight} m-0 mt-2 text-tea-text-sec [overflow-wrap:anywhere]`}>
                  <span className="text-tea-text-dim">Passages: </span>
                  {listing.passages.length
                    ? listing.passages.map(passage => `${passage.claim.claimId} rev ${passage.claim.rev}`).join(' · ')
                    : 'none'}
                  <span className="text-tea-text-dim"> · Style references: </span>
                  {listing.styleReferences.length ? listing.styleReferences.map(claim => claim.claimId).join(' · ') : 'none'}
                </p>
                {fixture.withheld.length > 0 && (
                  <ul className="m-0 mt-2 list-none p-0">
                    {fixture.withheld.map(entry => (
                      <li key={entry.field} className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 text-tea-text-dim [overflow-wrap:anywhere]`}>
                        Hidden here · {entry.field}: “{entry.text}” ({entry.reason})
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

/**
 * `claims` defaults to the pilot fixture; the integration thread passes
 * GENERATED_DRAFT_CLAIMS (through its preview-only dynamic import) instead.
 */
export const WisdomPilotPreview: React.FC<{ claims?: readonly PublicClaim[] }> = ({ claims: claimsProp }) => {
  // The real claims: the generated draft module, drafts promoted for preview.
  // The fixture only fills in while that module loads.
  const [rawPilotClaims, setRawPilotClaims] = useState<readonly PublicClaim[] | null>(null);
  useEffect(() => { loadWisdomPilotData().then(result => setRawPilotClaims(result.claims)); }, []);
  const baseClaims = claimsProp ?? rawPilotClaims ?? PILOT_FIXTURE_CLAIMS;
  // A private cache: nothing from the live shop's persisted cache reaches these pages.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  }));
  const overrides = useSyncExternalStore(revisionOverrideStore.subscribe, revisionOverrideStore.get);
  const setOverrides = (update: (current: RevisionOverrides) => RevisionOverrides) =>
    revisionOverrideStore.set(update(revisionOverrideStore.get()));
  const claims = useMemo(() => applyRevisionOverrides(baseClaims, overrides), [baseClaims, overrides]);

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route
          index
          element={(
            <IndexPage
              claims={claims}
              baseClaims={baseClaims}
              overrides={overrides}
              onChoose={(claimId, choice) => setOverrides(current => ({ ...current, [claimId]: choice }))}
              onReset={() => setOverrides(() => ({}))}
            />
          )}
        />
        {ORDER.map(slug => (
          <Route key={slug} path={slug} element={<ListingPage fixture={PILOT_FIXTURES[slug]} claims={claims} />} />
        ))}
        {DRAFT_ENTRIES.map(file => (
          <Route key={`draft-${file.record.id}`} path={`drafts/${file.record.id}`} element={<DraftPage file={file} claims={claims} />} />
        ))}
        {COMPOSED_ORDER.map(slug => (
          <Route key={`composed-${slug}`} path={`composed/${slug}`} element={<ComposedPage fixture={COMPOSED_FIXTURES[slug]} claims={claims} />} />
        ))}
      </Routes>
    </QueryClientProvider>
  );
};

export default WisdomPilotPreview;
