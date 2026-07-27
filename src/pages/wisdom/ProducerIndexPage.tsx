/**
 * /wisdom/producers. The index of who made a tea.
 *
 * Ten factories, houses and brands. Small enough to hold in one list; a search
 * field and a count still apply, because a name written in Chinese or an alias
 * is still a name a reader might type.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PRODUCERS, marksOf, type Producer } from '../../wisdom';
import {
  FACT,
  GroupHead,
  HoldingAuthorship,
  HoldingRow,
  IndexTable,
  Invitation,
  NoMatch,
  PageHead,
  ViewSwitch,
  WisdomSubNav,
  WisdomToolbar,
  type IndexColumns,
} from './wisdomShared';

type View = 'kind' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'kind', label: 'By kind' },
  { id: 'alphabetical', label: 'A to Z' },
];

const KIND_LABEL: Record<Producer['kind'], string> = {
  factory: 'Factory',
  house: 'House',
  brand: 'Brand',
  cooperative: 'Cooperative',
  unknown: 'Not recorded',
};

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 172px 96px 60px',
  nameLabel: 'Producer',
  labels: ['Operates in', 'Kind', 'Marks'],
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

const ProducerRows: React.FC<{ rows: Producer[] }> = ({ rows }) => (
  <ul className="list-none m-0 p-0">
    {rows.map(producer => {
      // How many marks the base holds for this producer. The row opens the
      // producer, whose record lists them and links each one. A producer we
      // hold no mark for says so, rather than leaving the column blank.
      const held = marksOf(producer).length;
      return (
        <HoldingRow
          key={producer.id}
          to={`/wisdom/producer/${producer.id}`}
          name={producer.name}
          chineseName={producer.chineseName}
          cells={[
            [producer.region, producer.country].filter(Boolean).join(', ') || { absent: 'Not recorded' },
            KIND_LABEL[producer.kind],
            held > 0 ? String(held) : { absent: 'None' },
          ]}
        />
      );
    })}
  </ul>
);

const ProducerIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('alphabetical');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => PRODUCERS.filter(producer => matches(producer, query)).sort(byName), [query]);

  /** Factories, then houses, then brands: the order the record's own note reads in. */
  const byKind = useMemo(() => {
    const map = new Map<string, Producer[]>();
    for (const producer of visible) {
      const label = KIND_LABEL[producer.kind];
      map.set(label, [...(map.get(label) ?? []), producer]);
    }
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  }, [visible]);

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
        everywhere
      >
        <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the producers" />
      </WisdomToolbar>

      {visible.length === 0 && <NoMatch noun="producer" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          {view === 'alphabetical' && <ProducerRows rows={visible} />}
          {view === 'kind' &&
            byKind.map(([kind, rows]) => (
              <section key={kind}>
                <GroupHead label={kind} count={rows.length} />
                <ProducerRows rows={rows} />
              </section>
            ))}
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A house (号) is a pre-1950 family firm. A factory (茶厂) is state or industrial. Neither is the vendor a shop
          bought from, which is account-scoped and stays in the shop&rsquo;s own records. A producer is true for
          everyone: a 7572 was made by Menghai Tea Factory no matter whose shelf it sits on.
        </p>
        <HoldingAuthorship noun="producers" className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A producer that is missing" />
    </article>
  );
};

export default ProducerIndexPage;
