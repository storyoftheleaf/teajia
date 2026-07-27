/**
 * /wisdom/producers. The index of who made a tea.
 *
 * Ten factories, houses and brands. Small enough to hold in one list; a search
 * field and a count still apply, because a name written in Chinese or an alias
 * is still a name a reader might type.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PRODUCERS, type Producer } from '../../wisdom';
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

const KIND_LABEL: Record<Producer['kind'], string> = {
  factory: 'Factory',
  house: 'House',
  brand: 'Brand',
  cooperative: 'Cooperative',
  unknown: 'Not recorded',
};

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 188px 116px',
  nameLabel: 'Producer',
  labels: ['Operates in', 'Kind'],
};

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(producer: Producer, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [producer.name, producer.chineseName, producer.region, producer.country, ...producer.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Producer, right: Producer) => left.name.localeCompare(right.name);

const ProducerIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => PRODUCERS.filter(producer => matches(producer, query)).sort(byName), [query]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tea Producers',
    description: 'Factories, houses and brands read out of Adrian’s own write-ups: who made a tea, not who sold it.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: PRODUCERS.length,
      itemListElement: PRODUCERS.map((producer, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: producer.name,
        url: `/wisdom/producer/${producer.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>Tea Producers · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${PRODUCERS.length} factories, houses and brands: who made a tea, held apart from who a shop bought it from.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="producers" />

      <div className="mt-4 mb-2">
        <PageHead title="Producers" note="Who made the tea, not who a shop bought it from." />
      </div>

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search producers"
        searchLabel="Search producers by name, Chinese name or alias"
        visible={visible.length}
        total={PRODUCERS.length}
        noun="producers"
      />

      {visible.length === 0 && <NoMatch noun="producer" />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          <ul className="list-none m-0 p-0">
            {visible.map(producer => (
              <HoldingRow
                key={producer.id}
                to={`/wisdom/producer/${producer.id}`}
                name={producer.name}
                chineseName={producer.chineseName}
                cells={[[producer.region, producer.country].filter(Boolean).join(', '), KIND_LABEL[producer.kind]]}
              />
            ))}
          </ul>
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A house (号) is a pre-1950 family firm. A factory (茶厂) is state or industrial. Neither is the vendor a shop
          bought from, which is account-scoped and stays in the shop&rsquo;s own records. A producer is true for
          everyone: a 7572 was made by Menghai Tea Factory no matter whose shelf it sits on.
        </p>
        <AuthorshipNote className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A producer that is missing" />
    </article>
  );
};

export default ProducerIndexPage;
