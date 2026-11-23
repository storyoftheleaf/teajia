import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { GENERATED_CLAIMS } from '../../wisdom/reference/generatedClaims';
import type { PublicProduct } from '../../types';
import type { PublicReferenceStatement } from '../../wisdom/receiving/previewImporter';
import type { PublicTeaReferenceSource } from '../../wisdom/reference/types';
import type { TeaReferenceFlagPage } from '../../wisdom/reference/issues';
import FlagReferenceIssueSheet from './FlagReferenceIssueSheet';
import {
  AXIS_INDENT,
  FACT,
  FACT_CLASS,
  GROUND,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  FOOTNOTE,
  QUIET_LINK,
  RULE_FULL,
  SPACE,
  SectionHead,
} from './wisdomShared';
import { buildPublicProductHref } from '../../lib/publicProductNavigation';

interface FactGroup {
  label: string;
  facts: PublicReferenceStatement[];
}

function groupedFacts(facts: readonly PublicReferenceStatement[]): FactGroup[] {
  const common = facts.filter(fact => fact.label === 'Common characteristics');
  const potential = facts.filter(fact => fact.label === 'Potential characteristics');
  const exactLot = facts.filter(fact => fact.label === 'Exact lot source description');
  const general = facts.filter(fact => (
    !common.includes(fact) && !potential.includes(fact) && !exactLot.includes(fact)
  ));
  const namedGeneral = new Map<string, PublicReferenceStatement[]>();
  for (const fact of general) {
    const label = fact.label.trim() || 'General reference';
    namedGeneral.set(label, [...(namedGeneral.get(label) ?? []), fact]);
  }
  return [
    { label: 'Common characteristics', facts: common },
    { label: 'Cultivar potential', facts: potential },
    { label: 'Exact lot source description', facts: exactLot },
    ...[...namedGeneral].map(([label, grouped]) => ({ label, facts: grouped })),
  ].filter(group => group.facts.length > 0);
}

const GENERIC_REFERENCE_TEXT = [
  /^The cited source discusses\b/i,
  /^The cited source records\b/i,
];

function isUsefulFact(fact: PublicReferenceStatement): boolean {
  return !GENERIC_REFERENCE_TEXT.some(pattern => pattern.test(fact.text.trim()));
}

const citedListingClaims = new Set(GENERATED_CLAIMS.filter(claim => claim.listingEligible && claim.sourceIds.length).map(claim => claim.claimId));

const FactStatement: React.FC<{
  fact: PublicReferenceStatement;
  detail?: React.ReactNode;
}> = ({ fact, detail }) => {
  const anchor = /^[a-z0-9-]+:([a-z0-9-]+)$/.exec(fact.id)?.[1];
  const row = useRef<HTMLLIElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (anchor && hash === '#' + anchor) row.current?.scrollIntoView?.({ block: 'center' });
  }, [anchor, hash]);
  return (
    <li ref={row} id={anchor} className={`${RULE_FULL} first:border-t-0 py-4 min-w-0`}>
      <p className={`${FACT} ${MEASURE} min-w-0 break-words`}>{fact.text}</p>
      {detail}
      {!detail && citedListingClaims.has(fact.id) && (fact.citations ?? [fact.citation]).map(source => (
        <a key={source.sourceId} href={source.url} className={`${FOOTNOTE} ${QUIET_LINK} tap-target mt-2 inline-flex`}>{source.label}</a>
      ))}
    </li>
  );
};

export const ReferenceFactSections: React.FC<{
  facts: readonly PublicReferenceStatement[];
  sources: readonly PublicTeaReferenceSource[];
  products: readonly PublicProduct[];
  reportIdentity: string;
  referencePage?: TeaReferenceFlagPage;
  /** Optional lines under a statement, e.g. a claim's scope and its Chinese terms. */
  factDetail?: (fact: PublicReferenceStatement) => React.ReactNode;
}> = ({ facts, products, reportIdentity, referencePage, factDetail }) => {
  const groups = groupedFacts(facts.filter(isUsefulFact));
  const availableProducts = products.filter(product => product.status !== 'Sold Out');
  const previouslyOfferedProducts = products.filter(product => product.status === 'Sold Out');
  const productRows = (matchingProducts: readonly PublicProduct[]) => (
    <IndexList>
      {matchingProducts.map(product => (
        <HoldingRow
          key={product.id}
          to={buildPublicProductHref({ id: product.id, slug: product.slug })}
          name={product.givenName || product.productName}
          chineseName={product.chineseName}
          cells={[
            product.type,
            product.originRegion,
            product.year ? String(product.year) : undefined,
            product.status === 'Sold Out' ? 'Sold out' : undefined,
          ]}
        />
      ))}
    </IndexList>
  );

  return (
    <>
      {groups.map(group => {
        const sectionId = `reference-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return (
          <section key={group.label} aria-labelledby={sectionId} className={`${SPACE.section} ${GROUND} py-6`}>
            <SectionHead id={sectionId} label={group.label} count={group.facts.length} />
            <ul className={`list-none m-0 p-0 ${AXIS_INDENT}`}>
              {group.facts.map(fact => <FactStatement key={fact.id} fact={fact} detail={factDetail?.(fact)} />)}
            </ul>
          </section>
        );
      })}

      {referencePage && (
        <div className={`${AXIS_INDENT} ${SPACE.section}`}>
          <FlagReferenceIssueSheet page={referencePage} />
        </div>
      )}

      {(availableProducts.length > 0 || previouslyOfferedProducts.length === 0) && (
        <div className={SPACE.section}>
          <SectionHead label="Available teas" count={availableProducts.length || undefined} />
          {availableProducts.length > 0 ? (
            productRows(availableProducts)
          ) : (
            <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
              No matching tea is available in the public shop right now.
            </p>
          )}
        </div>
      )}

      {previouslyOfferedProducts.length > 0 && (
        <div className={SPACE.section}>
          <SectionHead label="Previously offered" count={previouslyOfferedProducts.length} />
          {productRows(previouslyOfferedProducts)}
        </div>
      )}

      <Invitation subject={`Report an inaccuracy: ${reportIdentity}`} />
    </>
  );
};

export default ReferenceFactSections;
