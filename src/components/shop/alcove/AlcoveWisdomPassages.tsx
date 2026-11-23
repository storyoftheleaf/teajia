import React, { createContext, useContext, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  ListingFacts,
  ListingPassages,
  PublicClaim,
} from '../../../wisdom/reference/claims';
import { passageAnchorId } from '../../../wisdom/reference/listingPassages';
import type { ComposedEntry } from '../../../wisdom/reference/composedEntry';
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
  /** The tea's one written entry. When present it replaces the stacked passages and style references. */
  composed?: ComposedEntry;
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
          {/* Scope is an editing note for the Wisdom record, never shown to customers. */}
          {/* Trade knowledge is written in our own words and carries no citation. */}
          {claim.sourceIds.length > 0 && (
            <p className={`${BODY} m-0 mt-1 text-tea-text-dim`} data-citation-line>
              Sources are listed in Wisdom.
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
