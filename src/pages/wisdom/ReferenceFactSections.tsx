import React from 'react';
import type { PublicProduct } from '../../types';
import type { PublicReferenceStatement } from '../../wisdom/receiving/previewImporter';
import type { PublicTeaReferenceSource } from '../../wisdom/reference/types';
import {
  AXIS_INDENT,
  CELL_CLASS,
  FACT,
  FACT_CLASS,
  FOOTNOTE,
  GROUND,
  HoldingRow,
  IndexList,
  MEASURE,
  QUIET_LINK,
  RULE_FULL,
  SPACE,
  SectionHead,
  mailtoWisdom,
} from './wisdomShared';

interface FactGroup {
  label: string;
  facts: PublicReferenceStatement[];
}

function canonicalReferenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return null;
  }
}

function sourceForFact(
  fact: PublicReferenceStatement,
  sources: readonly PublicTeaReferenceSource[],
): PublicTeaReferenceSource | undefined {
  const citationUrl = canonicalReferenceUrl(fact.citation.url);
  if (!citationUrl) return undefined;
  return sources.find(source => canonicalReferenceUrl(source.url) === citationUrl);
}

function groupedFacts(facts: readonly PublicReferenceStatement[]): FactGroup[] {
  const common = facts.filter(fact => fact.label === 'Common characteristics');
  const potential = facts.filter(fact => fact.label === 'Potential characteristics');
  const general = facts.filter(fact => !common.includes(fact) && !potential.includes(fact));
  return [
    { label: 'Common characteristics', facts: common },
    { label: 'Cultivar potential', facts: potential },
    { label: 'General reference', facts: general },
  ].filter(group => group.facts.length > 0);
}

const FactStatement: React.FC<{
  fact: PublicReferenceStatement;
  sources: readonly PublicTeaReferenceSource[];
}> = ({ fact, sources }) => {
  const source = sourceForFact(fact, sources);
  return (
    <li className={`${RULE_FULL} first:border-t-0 py-4`}>
      <p className={`${FACT} ${MEASURE}`}>{fact.text}</p>
      {fact.excerpt && (
        <blockquote className={`${FOOTNOTE} ${MEASURE} mt-2 border-l-2 border-tea-border pl-3`}>
          &ldquo;{fact.excerpt}&rdquo;
        </blockquote>
      )}
      <p className={`${CELL_CLASS} text-tea-text-dim mt-2`}>Source:{' '}
        <a
          href={source?.url ?? fact.citation.url}
          target="_blank"
          rel="noreferrer"
          className={`${QUIET_LINK} tap-target`}
        >
          {source ? `${source.publisher} · ${source.title}` : fact.citation.label}
        </a>
      </p>
      {source && (source.author || source.publishedDate) && (
        <p className={`${CELL_CLASS} text-tea-text-dim mt-1`}>
          {[source.author, source.publishedDate].filter(Boolean).join(' · ')}
        </p>
      )}
    </li>
  );
};

export const ReferenceFactSections: React.FC<{
  facts: readonly PublicReferenceStatement[];
  sources: readonly PublicTeaReferenceSource[];
  products: readonly PublicProduct[];
  reportIdentity: string;
}> = ({ facts, sources, products, reportIdentity }) => (
  <>
    {groupedFacts(facts).map(group => (
      <section key={group.label} className={`${SPACE.section} ${GROUND} py-6`}>
        <SectionHead label={group.label} count={group.facts.length} />
        <ul className={`list-none m-0 p-0 ${AXIS_INDENT}`}>
          {group.facts.map(fact => <FactStatement key={fact.id} fact={fact} sources={sources} />)}
        </ul>
      </section>
    ))}

    <section className={SPACE.section}>
      <SectionHead label="Available teas" count={products.length || undefined} />
      {products.length > 0 ? (
        <IndexList>
          {products.map(product => (
            <HoldingRow
              key={product.id}
              to={`/shop/product/${encodeURIComponent(product.id)}`}
              name={product.givenName || product.productName}
              chineseName={product.chineseName}
              cells={[product.type, product.originRegion, product.status === 'Sold Out' ? 'Sold out' : undefined]}
            />
          ))}
        </IndexList>
      ) : (
        <p className={`${FACT_CLASS} text-tea-text-dim ${MEASURE} ${AXIS_INDENT}`}>
          No matching tea is available in the public shop right now.
        </p>
      )}
    </section>

    <aside className={`${SPACE.section} pt-6 ${RULE_FULL} ${AXIS_INDENT}`}>
      <a
        href={mailtoWisdom(`Report an inaccuracy: ${reportIdentity}`)}
        className={`${QUIET_LINK} tap-target ${FACT_CLASS}`}
      >
        Report an inaccuracy
      </a>
    </aside>
  </>
);

export default ReferenceFactSections;
