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
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, BackLink, EYEBROW, Fact, HoldingNotFound, Invitation, WisdomSubNav } from './wisdomShared';

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
        heading="Not a named tea we hold"
        backTo="/wisdom/named"
        backLabel="All named teas"
        subject="A named tea that is missing"
      />
    );
  }

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>{`${tea.name} · Named Teas · Teajia`}</title>
        <meta
          name="description"
          content={(tea.description || `${tea.name}, a tea known by the name it was given.`).slice(0, 160)}
        />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>

      <WisdomSubNav active="named" />

      <BackLink to="/wisdom/named" label="All named teas" />

      <header className="mt-6">
        <p className={EYEBROW}>The wisdom base · Named tea</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mt-3">
          <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>{tea.name}</h1>
          {tea.chineseName && (
            <span className="font-display text-[clamp(22px,3vw,30px)] text-tea-text-sec">{tea.chineseName}</span>
          )}
        </div>
        {tea.altNames.length > 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-3 max-w-[56ch]`}>
            Also written {tea.altNames.join(', ')}
          </p>
        )}
        {tea.tradition && <p className={`${EYEBROW} mt-4`}>{tea.tradition}</p>}
      </header>

      <div className="mt-10">
        <Fact label="Type">{tea.type}</Fact>
        <Fact label="Form">{tea.form}</Fact>
        <Fact label="Country">{tea.country}</Fact>
        <Fact label="Province">{tea.region}</Fact>
        <Fact label="Collection">{tea.collection}</Fact>
        <Fact label="Source">{tea.vendor}</Fact>
      </div>

      <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text mt-8 max-w-[64ch]`}>
        {provenanceStatement(tea.provenance)}
      </p>

      {tea.description && (
        <section className="mt-12">
          <p className={`${EYEBROW} mb-2`}>Record</p>
          <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>{tea.description}</p>
        </section>
      )}

      <div className="mt-16 pt-8 border-t border-tea-border">
        <AuthorshipNote id={tea.id} className="max-w-[60ch]" />
        <p className={`${EYEBROW} mt-2`}>
          Nothing on this page is account scoped. It is true of the tea as named, not of any shop.
        </p>
      </div>

      <Invitation subject={`Named tea: ${tea.name}`} />
    </article>
  );
};

export default NamedTeaPage;
