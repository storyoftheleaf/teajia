import React from 'react';
import type { PublicProduct } from '../../types';
import type { PublicReferenceStatement } from '../../wisdom/receiving/previewImporter';
import type { PublicTeaReferenceSource } from '../../wisdom/reference/types';
import type { TeaReferenceFlagPage } from '../../wisdom/reference/issues';
import FlagReferenceIssueSheet from './FlagReferenceIssueSheet';
import {
  AXIS_INDENT,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  FOOTNOTE,
  GROUND,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  QUIET_LINK,
  RULE_FULL,
  SPACE,
  SectionHead,
} from './wisdomShared';

interface FactGroup {
  label: string;
  facts: PublicReferenceStatement[];
}

type PublicReferenceCitation = PublicReferenceStatement['citation'];

function citationsForFact(fact: PublicReferenceStatement): readonly PublicReferenceCitation[] {
  const citations = (fact as PublicReferenceStatement & {
    citations?: readonly PublicReferenceCitation[];
  }).citations;
  return citations?.length ? citations : [fact.citation];
}

function sourceForCitation(
  citation: PublicReferenceCitation,
  sources: readonly PublicTeaReferenceSource[],
): PublicTeaReferenceSource | undefined {
  return sources.find(source => source.sourceId === citation.sourceId);
}

function groupedFacts(facts: readonly PublicReferenceStatement[]): FactGroup[] {
  const common = facts.filter(fact => fact.label === 'Common characteristics');
  const potential = facts.filter(fact => fact.label === 'Potential characteristics');
  const exactLot = facts.filter(fact => fact.label === 'Exact lot source description');
  const general = facts.filter(fact => (
    !common.includes(fact) && !potential.includes(fact) && !exactLot.includes(fact)
  ));
  return [
    { label: 'Common characteristics', facts: common },
    { label: 'Cultivar potential', facts: potential },
    { label: 'Exact lot source description', facts: exactLot },
    { label: 'General reference', facts: general },
  ].filter(group => group.facts.length > 0);
}

const GENERIC_REFERENCE_TEXT = [
  /^The cited source discusses\b/i,
  /^The cited source records\b/i,
];

function isUsefulFact(fact: PublicReferenceStatement): boolean {
  return !GENERIC_REFERENCE_TEXT.some(pattern => pattern.test(fact.text.trim()));
}

function readableReferenceDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function compactMetadata(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength - 1).replace(/\s+\S*$/, '').trimEnd();
  return `${clipped || normalized.slice(0, maxLength - 1)}…`;
}

const FactStatement: React.FC<{
  fact: PublicReferenceStatement;
  sources: readonly PublicTeaReferenceSource[];
  visibleCitations: readonly PublicReferenceCitation[];
}> = ({ fact, sources, visibleCitations }) => {
  return (
    <li className={`${RULE_FULL} first:border-t-0 py-4 min-w-0`}>
      <p className={`${FACT} ${MEASURE} min-w-0 break-words`}>{fact.text}</p>
      {fact.excerpt && (
        <blockquote className={`${FOOTNOTE} ${MEASURE} mt-2 border-l-2 border-tea-border pl-3 min-w-0 break-words`}>
          &ldquo;{fact.excerpt}&rdquo;
        </blockquote>
      )}
      {visibleCitations.map((citation, citationIndex) => {
        const source = sourceForCitation(citation, sources);
        return (
          <p key={`${citation.sourceId}-${citationIndex}`} className={`${CELL_CLASS} text-tea-text-dim mt-2 min-w-0 break-words`}>
            {citationIndex === 0 ? 'Source: ' : 'Also: '}
            <a
              href={source?.url ?? citation.url}
              target="_blank"
              rel="noreferrer"
              className={`${QUIET_LINK} tap-target min-w-0 break-words`}
            >
              {source
                ? `${compactMetadata(source.publisher, 48)} · ${compactMetadata(source.title, 80)}`
                : compactMetadata(citation.label, 120)}
            </a>
            {source && [
              compactMetadata(source.author, 64),
              readableReferenceDate(source.publishedDate),
            ].filter(Boolean).map((detail, index) => (
              <React.Fragment key={`${detail}-${index}`}>
                <span aria-hidden="true"> · </span>
                <span>{detail}</span>
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </li>
  );
};

export const ReferenceFactSections: React.FC<{
  facts: readonly PublicReferenceStatement[];
  sources: readonly PublicTeaReferenceSource[];
  products: readonly PublicProduct[];
  reportIdentity: string;
  referencePage?: TeaReferenceFlagPage;
}> = ({ facts, sources, products, reportIdentity, referencePage }) => {
  const groups = groupedFacts(facts.filter(isUsefulFact));
  const availableProducts = products.filter(product => product.status !== 'Sold Out');
  const previouslyOfferedProducts = products.filter(product => product.status === 'Sold Out');
  const productRows = (matchingProducts: readonly PublicProduct[]) => (
    <IndexList>
      {matchingProducts.map(product => (
        <HoldingRow
          key={product.id}
          to={`/shop/product/${encodeURIComponent(product.id)}`}
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
        const seenSources = new Set<string>();
        return (
          <section key={group.label} aria-labelledby={sectionId} className={`${SPACE.section} ${GROUND} py-6`}>
            <SectionHead id={sectionId} label={group.label} count={group.facts.length} />
            <ul className={`list-none m-0 p-0 ${AXIS_INDENT}`}>
              {group.facts.map(fact => {
                const visibleCitations = citationsForFact(fact).filter(citation => {
                  const source = sourceForCitation(citation, sources);
                  const sourceKey = source?.url || citation.url;
                  if (seenSources.has(sourceKey)) return false;
                  seenSources.add(sourceKey);
                  return true;
                });
                return (
                  <FactStatement
                    key={fact.id}
                    fact={fact}
                    sources={sources}
                    visibleCitations={visibleCitations}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

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

      {referencePage && (
        <div className={`${AXIS_INDENT} ${SPACE.section}`}>
          <FlagReferenceIssueSheet page={referencePage} />
        </div>
      )}
      <Invitation subject={`Report an inaccuracy: ${reportIdentity}`} />
    </>
  );
};

export default ReferenceFactSections;
