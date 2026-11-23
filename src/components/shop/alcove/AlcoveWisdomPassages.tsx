import React, { createContext, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  ListingFacts,
  ListingPassages,
  PublicClaim,
} from '../../../wisdom/reference/claims';
import type { PublicTeaReferencePage } from '../../../wisdom/reference/types';
import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../../wisdom/reference/generatedPages';
import { GENERATED_CLAIMS } from '../../../wisdom/reference/generatedClaims';
import { wisdomPageHref } from '../../../pages/wisdom/articleClaimUses';
import { passageAnchorId } from '../../../wisdom/reference/listingPassages';
import type { ComposedEntry } from '../../../wisdom/reference/composedEntry';
import { BODY, FIELD_GAP, LABEL, LINK } from '../../shared/typeRoles';

/**
 * The claim set a listing reads, and the pilot preview's view switches.
 *
 * The production default is generated from approved revisions on public pages.
 * Only the local pilot supplies draft previews or explicit fixture facts.
 */
export interface WisdomListingContextValue {
  claims: readonly PublicClaim[];
  publicPages?: readonly PublicTeaReferencePage[];
  /** Replaces the facts built from the product (the type-only fixture). */
  facts?: ListingFacts;
  /** The tea's one written entry. When present it replaces the stacked passages and style references. */
  composed?: ComposedEntry;
  pilot?: {
    /** External reference example: no price, order, Taste, Collect or sign-in. */
    externalReference?: boolean;
  };
}

const WisdomListingContext = createContext<WisdomListingContextValue>({
  claims: GENERATED_CLAIMS, publicPages: GENERATED_TEA_REFERENCE_REGISTRY.pages,
});

export const WisdomListingProvider = WisdomListingContext.Provider;

export function useWisdomListing(): WisdomListingContextValue {
  return useContext(WisdomListingContext);
}

/** Brings a passage into view when its grid row's link sets the hash. */
function useScrollToPassage(ids: readonly string[]) {
  const location = useLocation();
  const key = ids.join(' ');
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id || !key.split(' ').includes(id)) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, key]);
}

function TermsLine({ claim }: { claim: PublicClaim }) {
  if (!claim.terms.length) return null;
  return (
    <p className={`${BODY} m-0 mt-2 text-tea-text-dim`}>
      {claim.terms.map((term, index) => (
        <React.Fragment key={term.original}>
          {index > 0 && ' · '}
          <span lang="zh-Hans">{term.original}</span>{' '}
          <span className="italic">{term.pinyin}</span>, {term.gloss}
        </React.Fragment>
      ))}
    </p>
  );
}

/**
 * Wisdom passages under the Provenance grid. Each states its text, its scope
 * and where to read more. Renders nothing when no claim applies.
 */
export const AlcoveWisdomPassages: React.FC<{ listing: ListingPassages }> = ({ listing }) => {
  useScrollToPassage(listing.passages.map(passage => passageAnchorId(passage.claim.claimId)));
  if (listing.passages.length === 0) return null;
  return (
    <section
      className="mx-4 mt-6 grid gap-6 border-t border-tea-border py-4"
      aria-label="From Tea Wisdom"
      data-wisdom-passages
    >
      {listing.passages.map(({ claim, wisdomHref }) => (
        <article
          key={claim.claimId}
          id={passageAnchorId(claim.claimId)}
          className="min-w-0 scroll-mt-24"
          data-claim-id={claim.claimId}
          data-claim-rev={claim.rev ?? undefined}
        >
          <h3 className={`${LABEL} ${FIELD_GAP} m-0 text-tea-text-dim`}>
            {claim.axis === 'named_tea_history'
              ? <Link to={wisdomHref} className={`${LINK} tap-target`} aria-label={`${claim.label} in Tea Wisdom`}>{claim.label}</Link>
              : claim.label}
          </h3>
          <p className={`${BODY} m-0 whitespace-pre-line text-tea-text [overflow-wrap:anywhere]`}>{claim.text}</p>
          <TermsLine claim={claim} />
          {/* Scope is an editing note for the Wisdom record, never shown to customers (Adrian, 2026-11-23). */}
          {/* Trade knowledge is written in our own words and carries no citation. */}
          {claim.sourceIds.length > 0 && (
            <p className={`${BODY} m-0 mt-1 text-tea-text-dim`} data-citation-line>
              Sources are listed in Wisdom.
            </p>
          )}
          {claim.axis !== 'named_tea_history' && <Link to={wisdomHref} className={`${BODY} ${LINK} tap-target mt-1 inline-flex items-center text-tea-text-sec`}>
            Read more in Wisdom
          </Link>}
        </article>
      ))}
    </section>
  );
};

/** The resolver selects a single style-level reference. Its evidence lives with its Wisdom entry. */
export const AlcoveWisdomStyleReferences: React.FC<{ listing: ListingPassages }> = ({ listing }) => {
  const { publicPages } = useWisdomListing();
  const [claim] = listing.styleReferences;
  if (!claim) return null;
  const page = publicPages?.find(entry => entry.id === claim.pageId);
  const path = page ? wisdomPageHref(page.id, page.kind)
    : !publicPages ? wisdomPageHref(claim.pageId, claim.appliesWhen.grade ? 'leaf_grade' : 'tea_type') : null;
  return (
    <section className="mx-4 mt-8 grid gap-3 border-t border-tea-border py-4"
      aria-labelledby="wisdom-style-reference-title" data-wisdom-style-references>
      <h2 id="wisdom-style-reference-title" className={`${LABEL} m-0 text-tea-text-dim`}>{claim.label}</h2>
      <p className={`${BODY} m-0 text-tea-text-sec [overflow-wrap:anywhere]`} data-claim-id={claim.claimId}>{claim.text}</p>
      {claim.scope && <p className={`${BODY} m-0 text-tea-text-sec`}>{claim.scope}</p>}
      {path && <Link to={path + '#' + encodeURIComponent(claim.sectionKey)} className={`${LINK} tap-target`}>Read more in Wisdom</Link>}
    </section>
  );
};
