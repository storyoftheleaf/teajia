/**
 * /wisdom/marks. The index of recipe numbers, seals and labels.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { MARKS, findProducerById, type Mark } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, CountLine, EYEBROW, HoldingRow, Invitation, WisdomSearchBox, WisdomSubNav } from './wisdomShared';

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(mark: Mark, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [mark.name, mark.chineseName, mark.era, ...mark.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Mark, right: Mark) => left.name.localeCompare(right.name);

const MarkIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => MARKS.filter(mark => matches(mark, query)).sort(byName), [query]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tea Marks',
    description: 'Recipe numbers, seals and labels identifying a tea product line, most tied to a producer and an era.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: MARKS.length,
      itemListElement: MARKS.map((mark, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: mark.name,
        url: `/wisdom/mark/${mark.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>Tea Marks · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${MARKS.length} recipe numbers, seals and labels: what a product line is called, and who made it.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="marks" />

      <header>
        <p className={EYEBROW}>The wisdom base · Marks</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>Marks</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-4 max-w-[56ch]`}>
          Recipe numbers, seals and labels a product line carries.
        </p>
      </header>

      <WisdomSearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name or era" />
      <CountLine visible={visible.length} total={MARKS.length} noun="marks" />

      <ul className="list-none m-0 p-0 mt-2">
        {visible.map(mark => {
          const producer = findProducerById(mark.producerId);
          return (
            <HoldingRow
              key={mark.id}
              to={`/wisdom/mark/${mark.id}`}
              name={mark.name}
              chineseName={mark.chineseName}
              meta={mark.appliesToTypes.join(', ') || undefined}
              aside={[mark.era, producer?.name].filter(Boolean).join(' · ') || undefined}
            />
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec py-16 text-center`}>
          No mark here answers to that name. If it should, send it and it will be added.
        </p>
      )}

      <div className="mt-14 pt-8 border-t border-tea-border">
        <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>
          A mark is a recipe number, seal or label rather than a plant or a place: 7572 is Menghai Tea Factory&rsquo;s
          benchmark shou recipe, encoded in its own digits. Eight of these are tied to a producer we hold; the rest
          are named in a producer&rsquo;s own record without a page of their own yet.
        </p>
      </div>

      <div className="mt-10 pt-8 border-t border-tea-border">
        <AuthorshipNote className="max-w-[60ch]" />
      </div>

      <Invitation subject="A mark that is missing" />
    </article>
  );
};

export default MarkIndexPage;
