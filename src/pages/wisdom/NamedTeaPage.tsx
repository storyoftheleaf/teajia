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
import {
  AXIS_INDENT,
  catalogueNumber,
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

function provenanceStatement(provenance: 'undisclosed' | 'partial' | 'stated'): string {
  switch (provenance) {
    case 'undisclosed':
      return 'The mountain, the village and the vintage are unrecorded. That is the nature of this record, not a gap in it: the name is what the tea carries forward, and the rest was never written down.';
    case 'partial':
      return 'Part of the origin is stated below. The exact garden and vintage were not recorded beyond it.';
    case 'stated':
    default:
      return 'The origin is recorded in full below.';
  }
}

const NamedTeaPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tea = findNamedTeaById(id);

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
          number={catalogueNumber('named', tea.id)}
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

      {/* The tradition is a sixteen-word sentence, and it once ran at the label
          size, 11px, directly under the title. It is prose, so it takes the
          device the reference has for prose: the label hung in the margin, the
          sentence on the value axis at body size. Below the facts, not above
          them, because a reader wants to know what type of tea it is before
          they want to know how its name was arrived at. */}
      <section className={`${SPACE.section} ${GROUND} py-6`}>
        <SectionHead label="How it was named" />
        <Passage label="Naming tradition" text={tea.tradition} />
        <p className={`${FACT_CLASS} text-tea-text ${MEASURE} ${AXIS_INDENT} mt-5`}>
          {provenanceStatement(tea.provenance)}
        </p>
      </section>

      {tea.description && (
        <section className={`${SPACE.section} ${GROUND} py-6`}>
          <SectionHead label="Record" />
          <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>{tea.description}</p>
        </section>
      )}

      <EntryResearchSection entryKind="namedTea" entryId={tea.id} entry={tea} />

      <EntryAuthorship id={tea.id} />

      <Invitation subject={`Named tea: ${tea.name}`} />
    </article>
  );
};

export default NamedTeaPage;
