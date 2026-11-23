import React, { createContext, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  ClaimSourceRole,
  ListingFacts,
  ListingPassages,
  PublicClaim,
} from '../../../wisdom/reference/claims';
import { passageAnchorId } from '../../../wisdom/reference/listingPassages';
import { BODY, FIELD_GAP, LABEL, LINK } from '../../shared/typeRoles';

/**
 * The claim set a listing reads, and the pilot preview's view switches.
 *
 * Production has no provider, so it reads the default: an empty claim set
 * until the integration thread swaps in GENERATED_CLAIMS, which means the
 * shop renders no passage and nothing else on the page changes. Only the
 * dev-only /preview/wisdom-pilot/* pages provide `pilot`.
 */
export interface WisdomListingContextValue {
  claims: readonly PublicClaim[];
  /** Replaces the facts built from the product (the type-only fixture). */
  facts?: ListingFacts;
  pilot?: {
    /** External reference example: no price, order, Taste, Collect or sign-in. */
    externalReference?: boolean;
  };
}

/** Swapped for GENERATED_CLAIMS by the integration thread once it exists. */
export const PRODUCTION_LISTING_CLAIMS: readonly PublicClaim[] = [];

const WisdomListingContext = createContext<WisdomListingContextValue>({ claims: PRODUCTION_LISTING_CLAIMS });

export const WisdomListingProvider = WisdomListingContext.Provider;

export function useWisdomListing(): WisdomListingContextValue {
  return useContext(WisdomListingContext);
}

/** A passage whose grid row exists gets this href on that row. */
export function passageHref(claimId: string): string {
  return `#${passageAnchorId(claimId)}`;
}

/** Brings a passage into view when its grid row's link sets the hash. */
function useScrollToPassage(ids: readonly string[]) {
  const location = useLocation();
  const key = ids.join(' ');
  useEffect(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
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
          <p className={`${BODY} m-0 mt-2 text-tea-text-sec`}>
            <span className="text-tea-text-dim">Scope: </span>{claim.scope}
          </p>
          <Link to={wisdomHref} className={`${BODY} ${LINK} tap-target mt-1 inline-flex items-center text-tea-text-sec`}>
            Read more in Wisdom
          </Link>
        </article>
      ))}
    </section>
  );
};

const ROLE_WORDS: Record<ClaimSourceRole, string> = {
  standard: 'a published standard',
  producer: 'the producer',
  seller_own_batch: 'the seller, describing its own batch',
  study: 'a published study',
  specialist_editorial: 'a specialist writer',
  taster: 'a named taster',
};

/** "Reported by …, about …": the attribution sentence for one observation. */
export function attributionSentence(claim: PublicClaim): string {
  const attribution = claim.attribution;
  if (!attribution) return '';
  return `Reported by ${ROLE_WORDS[attribution.sourceRole]}, about ${attribution.sample}. It describes that sample, not this tea.`;
}

/**
 * "Style reference": attributed sensory observations, after About. Each one
 * is a separate account with its own attribution sentence, and none of them
 * describes this lot. Renders nothing when there are none.
 */
export const AlcoveWisdomStyleReferences: React.FC<{ listing: ListingPassages }> = ({ listing }) => {
  const observations = listing.styleReferences.filter(claim => claim.attribution);
  if (observations.length === 0) return null;
  return (
    <section
      className="mx-4 mt-8 grid gap-4 border-t border-tea-border py-4"
      aria-labelledby="wisdom-style-reference-title"
      data-wisdom-style-references
    >
      <h2 id="wisdom-style-reference-title" className={`${LABEL} m-0 text-tea-text-dim`}>Style reference</h2>
      {observations.map(claim => (
        <div key={claim.claimId} className="min-w-0" data-claim-id={claim.claimId}>
          <p className={`${BODY} m-0 text-tea-text-sec [overflow-wrap:anywhere]`}>{claim.text}</p>
          <p className={`${BODY} m-0 mt-1 text-tea-text-dim [overflow-wrap:anywhere]`}>{attributionSentence(claim)}</p>
        </div>
      ))}
    </section>
  );
};
