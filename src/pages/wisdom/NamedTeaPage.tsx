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
  EntryAuthorship,
  CELL,
  FACT,
  FACT_CLASS,
  Fact,
  HoldingNotFound,
  Invitation,
  LABEL,
  PageHead,
  WisdomSubNav,
} from './wisdomShared';

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
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>{`${tea.name} · Named Teas · Teajia`}</title>
        <meta
          name="description"
          content={(tea.description || `${tea.name}, a tea known by the name it was given.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="named" />

      <div className="mt-4">
        <PageHead
          title={tea.name}
          chineseName={tea.chineseName}
          note={tea.altNames.length > 0 ? `Also written ${tea.altNames.join(', ')}` : undefined}
        />
        {tea.tradition && <p className={`${CELL} mt-2 max-w-[56ch]`}>{tea.tradition}</p>}
      </div>

      <div className="mt-6">
        <Fact label="Type">{tea.type}</Fact>
        <Fact label="Form">{tea.form}</Fact>
        <Fact label="Country">{tea.country}</Fact>
        <Fact label="Province">{tea.region}</Fact>
        <Fact label="Collection">{tea.collection}</Fact>
        <Fact label="Source">{tea.vendor}</Fact>
      </div>

      <p className={`${FACT_CLASS} text-tea-text mt-6 max-w-[68ch]`}>{provenanceStatement(tea.provenance)}</p>

      {tea.description && (
        <section className="mt-10">
          <p className={`${LABEL} mb-1.5`}>Record</p>
          <p className={`${FACT} max-w-[68ch]`}>{tea.description}</p>
        </section>
      )}

      <EntryAuthorship id={tea.id} />

      <Invitation subject={`Named tea: ${tea.name}`} />
    </article>
  );
};

export default NamedTeaPage;
