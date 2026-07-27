/**
 * /wisdom/named. The index of teas known by the name they were given.
 *
 * Grouped by tradition, per docs/TEA_WISDOM_BASE.md "On teas that arrive
 * already named": a collector stores a sheng for years and names it Courage,
 * the mountain and often the vintage never recorded, and that is the nature
 * of the record rather than a gap in it. The index leads with that framing so
 * a thin entry reads as the record it is, not as a broken one, then gets out
 * of the way for the list.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { NAMED_TEAS, NAMING_TRADITIONS, namedTeasInTradition, type NamedTea } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, CountLine, EYEBROW, HoldingRow, Invitation, SectionHead, WisdomSearchBox, WisdomSubNav } from './wisdomShared';

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(tea: NamedTea, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [tea.name, tea.chineseName, tea.region, tea.type, tea.tradition, ...tea.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const NamedTeaIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visibleIds = useMemo(
    () => new Set(NAMED_TEAS.filter(tea => matches(tea, query)).map(tea => tea.id)),
    [query],
  );
  const visibleCount = visibleIds.size;

  const groups = useMemo(
    () => NAMING_TRADITIONS.map(tradition => [tradition, namedTeasInTradition(tradition).filter(tea => visibleIds.has(tea.id))] as const)
      .filter(([, rows]) => rows.length > 0),
    [visibleIds],
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Named Teas',
    description: 'Teas known by the name they were given, where the composition is not disclosed.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: NAMED_TEAS.length,
      itemListElement: NAMED_TEAS.map((tea, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tea.name,
        url: `/wisdom/named/${tea.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>Named Teas · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${NAMED_TEAS.length} teas known by the name they were given, where the composition was never disclosed.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="named" />

      <header>
        <p className={EYEBROW}>The wisdom base · Named teas</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>Named Teas</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-4 max-w-[56ch]`}>
          Teas that arrived already named, where the composition was never disclosed.
        </p>
      </header>

      <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec mt-6 max-w-[64ch]`}>
        A collector stores a sheng for years and names it Courage. The mountain is rarely recorded and the vintage
        often is not either, and the tea moves on carrying only that word. That is not a gap in the record. It is the
        nature of the record, and holding it plainly beats not holding it at all.
      </p>

      <WisdomSearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name, type or tradition" />
      <CountLine visible={visibleCount} total={NAMED_TEAS.length} noun="named teas" />

      <div className="mt-2">
        {groups.map(([tradition, rows]) => (
          <section key={tradition} className="mt-12 first:mt-6">
            <SectionHead glyph="◊" label={tradition} count={rows.length} />
            <ul className="list-none m-0 p-0">
              {rows.map(tea => (
                <HoldingRow
                  key={tea.id}
                  to={`/wisdom/named/${tea.id}`}
                  name={tea.name}
                  chineseName={tea.chineseName}
                  meta={tea.region}
                  aside={tea.type}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {visibleCount === 0 && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec py-16 text-center`}>
          No named tea here answers to that name. If it should, send it and it will be added.
        </p>
      )}

      <div className="mt-10 pt-8 border-t border-tea-border">
        <AuthorshipNote className="max-w-[60ch]" />
      </div>

      <Invitation subject="A named tea that is missing" />
    </article>
  );
};

export default NamedTeaIndexPage;
