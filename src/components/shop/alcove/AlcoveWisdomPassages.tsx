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
import { passageAnchorId } from '../../../wisdom/reference/listingPassages';
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
          <h3 className={`${LABEL} ${FIELD_GAP} m-0 text-tea-text-dim`}>{claim.label}</h3>
          <p className={`${BODY} m-0 text-tea-text [overflow-wrap:anywhere]`}>{claim.text}</p>
          <TermsLine claim={claim} />
          {claim.axis === 'grade' && claim.scope && (
            <p className={`${BODY} m-0 mt-2 text-tea-text-sec`}>
              <span className="text-tea-text-dim">Scope: </span>{claim.scope}
            </p>
          )}
          <Link to={wisdomHref} className={`${BODY} ${LINK} tap-target mt-1 inline-flex items-center text-tea-text-sec`}>
            Read more in Wisdom
          </Link>
        </article>
      ))}
    </section>
  );
};

/**
 * "What people often notice": one sentence per style or grade, in our own
 * words, naming no seller or study. Always last, always about the style or
 * grade, never offered as the taste of this lot. Renders nothing when empty.
 */
export const AlcoveWisdomStyleReferences: React.FC<{ listing: ListingPassages }> = ({ listing }) => {
  if (listing.styleReferences.length === 0) return null;
  return (
    <section
      className="mx-4 mt-8 grid gap-3 border-t border-tea-border py-4"
      aria-labelledby="wisdom-style-reference-title"
      data-wisdom-style-references
    >
      <h2 id="wisdom-style-reference-title" className={`${LABEL} m-0 text-tea-text-dim`}>What people often notice</h2>
      {listing.styleReferences.map(claim => (
        <p key={claim.claimId} className={`${BODY} m-0 text-tea-text-sec [overflow-wrap:anywhere]`} data-claim-id={claim.claimId}>
          {claim.text}
        </p>
      ))}
      <p className={`${BODY} m-0 text-tea-text-dim`}>About the style in general, not a tasting of this tea.</p>
    </section>
  );
};
