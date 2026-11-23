/**
 * /wisdom/named/:id. One tea known by the name it was given, in public.
 *
 * Per docs/TEA_WISDOM_BASE.md "On teas that arrive already named": the
 * province is shown when the record states it, and what is not known (usually
 * the mountain and the vintage) is said plainly rather than left to read as a
 * blank. That is the nature of this kind of record, not a deficiency in it.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { findNamedTeaById } from '../../wisdom';
import { usePublicProducts } from '../../hooks/usePublicProducts';
import { buildGeneratedTeaReferenceFacts } from '../../wisdom/reference/catalogue';
import { GENERATED_TEA_REFERENCE_REGISTRY } from '../../wisdom/reference/generatedPages';
import { namedTeaIdForLot } from '../../wisdom/reference/namedTeaLots';
import type { PublicTeaReferencePage } from '../../wisdom/reference/types';
import { ReferenceFactSections } from './ReferenceFactSections';
import {
  AXIS_INDENT,
  EntryAuthorship,
  FACT,
  Fact,
  FACT_CLASS,
  GROUND,
  HoldingNotFound,
  Invitation,
  MEASURE,
  PAGE,
  PageHead,
  Passage,
  SectionHead,
  SPACE,
  WisdomSubNav,
} from './wisdomShared';
import { EntryResearchSection } from './EntryResearchSection';
import { WisdomPublicStateGate, WisdomRelatedMaterial } from './WisdomRelatedMaterial';

function provenanceStatement(provenance: 'undisclosed' | 'partial' | 'stated'): string {
  switch (provenance) {
    case 'undisclosed':
      return 'The mountain, the village and the vintage are unrecorded. That is the nature of this record, not a gap in it: the name is what the tea carries forward, and the rest was never written down.';
    case 'partial':
      return 'The record identifies part of this tea’s origin.';
    case 'stated':
    default:
      return 'The origin is recorded in full below.';
  }
}

const NamedTeaHistory: React.FC<{ page: PublicTeaReferencePage }> = ({ page }) => {
  const { data: products = [] } = usePublicProducts();
  return (
    <ReferenceFactSections
      facts={buildGeneratedTeaReferenceFacts(page)}
      sources={GENERATED_TEA_REFERENCE_REGISTRY.sources}
      products={products.filter(product => namedTeaIdForLot(product.id) === page.id)}
      referencePage={page}
      reportIdentity={page.label}
    />
  );
};

const NamedTeaPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tea = findNamedTeaById(id);
  const history = GENERATED_TEA_REFERENCE_REGISTRY.pages.find(page => page.kind === 'named_tea' && page.id === id);

  const structuredData = useMemo(() => {
    if (!tea) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const pageUrl = `${origin}/wisdom/named/${tea.id}`;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Thing',
          '@id': `${pageUrl}#tea`,
          name: tea.name,
          alternateName: [tea.chineseName, ...tea.altNames].filter(Boolean),
          ...(tea.description ? { description: tea.description } : {}),
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl,
          url: pageUrl,
          name: `${tea.name} · Named tea reference`,
          inLanguage: 'en',
          about: { '@id': `${pageUrl}#tea` },
          isPartOf: { '@type': 'CollectionPage', name: 'Named Teas', url: `${origin}/wisdom/named` },
        },
      ],
    };
  }, [tea]);

  if (!tea) {
    return (
      <HoldingNotFound
        section="named"
        heading="Not a named tea we hold"
        backTo="/wisdom/named"
        backLabel="All named teas"
        subject="A named tea that is missing"
      />
    );
  }

  return (
    <WisdomPublicStateGate identity={{ nodeType: 'named_tea', nodeId: tea.id }}>
    <article className={PAGE}>
      <Helmet>
        <title>{`${tea.name} · Named Teas · Teajia`}</title>
        <meta
          name="description"
          content={(tea.description || `${tea.name}, a tea known by the name it was given.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="named" />

      <div className="mt-7">
        <PageHead
          kind="Named tea"
          title={tea.name}
          chineseName={tea.chineseName}
          aka={tea.altNames.length > 0 ? `Also written ${tea.altNames.join(', ')}` : undefined}
          rungFor={tea.id}
        />
      </div>

      <div className="mt-8">
        <Fact label="Type">{tea.type}</Fact>
        <Fact label="Form">{tea.form}</Fact>
        <Fact label="Country">{tea.country}</Fact>
        <Fact label="Province">{tea.region}</Fact>
        <Fact label="Collection">{tea.collection}</Fact>
        <Fact label="Source">{tea.vendor}</Fact>
      </div>

      {history ? <NamedTeaHistory page={history} /> : (
        <section className={`${SPACE.section} ${GROUND} py-6`}>
          <SectionHead label="How it was named" />
          <Passage label="Naming tradition" text={tea.tradition} />
          <p className={`${FACT_CLASS} text-tea-text ${MEASURE} ${AXIS_INDENT} mt-5`}>
            {provenanceStatement(tea.provenance)}
          </p>
        </section>
      )}

      {tea.description && (
        <section className={`${SPACE.section} ${GROUND} py-6`}>
          <SectionHead label="Record" />
          <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>{tea.description}</p>
        </section>
      )}

      <EntryResearchSection entryKind="namedTea" entryId={tea.id} entry={tea} />

      <WisdomRelatedMaterial identity={{ nodeType: 'named_tea', nodeId: tea.id }} />
      <EntryAuthorship id={tea.id} />

      {!history && <Invitation subject={`Named tea: ${tea.name}`} />}
    </article>
    </WisdomPublicStateGate>
  );
};

export default NamedTeaPage;
