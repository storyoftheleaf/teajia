/**
 * /wisdom/marks. The index of recipe numbers, seals and labels.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { MARKS, findProducerById, type Mark } from '../../wisdom';
import {
  AuthorshipNote,
  FACT,
  HoldingRow,
  IndexTable,
  Invitation,
  NoMatch,
  PageHead,
  WisdomSubNav,
  WisdomToolbar,
  type IndexColumns,
} from './wisdomShared';

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 88px 200px',
  nameLabel: 'Mark',
  labels: ['Era', 'Producer'],
};

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
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>Tea Marks · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${MARKS.length} recipe numbers, seals and labels: what a product line is called, and who made it.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="marks" />

      <div className="mt-4 mb-2">
        <PageHead title="Marks" note="Recipe numbers, seals and labels a product line carries." />
      </div>

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search marks"
        searchLabel="Search marks by name, Chinese name or era"
        visible={visible.length}
        total={MARKS.length}
        noun="marks"
      />

      {visible.length === 0 && <NoMatch noun="mark" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          <ul className="list-none m-0 p-0">
            {visible.map(mark => {
              // The producer column is a real relation, so it is a real link.
              // A mark whose producer the base does not hold keeps a plain
              // cell rather than a link that goes nowhere.
              const producer = findProducerById(mark.producerId);
              return (
                <HoldingRow
                  key={mark.id}
                  to={`/wisdom/mark/${mark.id}`}
                  name={mark.name}
                  chineseName={mark.chineseName}
                  cells={[
                    mark.era,
                    producer ? { text: producer.name, to: `/wisdom/producer/${producer.id}` } : undefined,
                  ]}
                />
              );
            })}
          </ul>
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A mark is a recipe number, seal or label rather than a plant or a place: 7572 is Menghai Tea Factory&rsquo;s
          benchmark shou recipe, encoded in its own digits. Eight of these are tied to a producer we hold; the rest are
          named in a producer&rsquo;s own record without a page of their own yet.
        </p>
        <AuthorshipNote className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A mark that is missing" />
    </article>
  );
};

export default MarkIndexPage;
