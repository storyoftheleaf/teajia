/**
 * /wisdom/marks. The index of recipe numbers, seals and labels.
 *
 * Eight of the fifteen are tied to a producer the base holds, and that is the
 * fact worth ordering by: it is the difference between a mark that belongs to
 * one factory and a grading term half the trade uses. Era would have been the
 * obvious second axis and is not one, because only two records carry it.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { MARKS, findProducerById, type Mark } from '../../wisdom';
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

type View = 'producer' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'producer', label: 'By producer' },
  { id: 'alphabetical', label: 'A to Z' },
];

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 88px 200px',
  nameLabel: 'Mark',
  labels: ['Era', 'Producer'],
};

/** Three words. A mark nobody is recorded as owning is a fact, not a blank. */
const NO_PRODUCER = 'No producer recorded';

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(mark: Mark, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [mark.name, mark.chineseName, mark.era, ...mark.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Mark, right: Mark) => left.name.localeCompare(right.name);

const MarkRows: React.FC<{ rows: Mark[] }> = ({ rows }) => (
  <ul className="list-none m-0 p-0">
    {rows.map(mark => {
      // The producer column is a real relation, so it is a real link. A mark
      // whose producer the base does not hold says so: an empty cell reads as
      // a rendering fault, and the entry page has always said "Not recorded"
      // in the same position.
      const producer = findProducerById(mark.producerId);
      return (
        <HoldingRow
          key={mark.id}
          to={`/wisdom/mark/${mark.id}`}
          name={mark.name}
          chineseName={mark.chineseName}
          cells={[
            mark.era || { absent: 'Not dated' },
            producer ? { text: producer.name, to: `/wisdom/producer/${producer.id}` } : { absent: 'Not recorded' },
          ]}
        />
      );
    })}
  </ul>
);

const MarkIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('producer');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => MARKS.filter(mark => matches(mark, query)).sort(byName), [query]);

  /** Producers first, biggest first, then everything nobody is recorded as owning. */
  const byProducer = useMemo(() => {
    const map = new Map<string, Mark[]>();
    for (const mark of visible) {
      const producer = findProducerById(mark.producerId);
      const label = producer?.name ?? NO_PRODUCER;
      map.set(label, [...(map.get(label) ?? []), mark]);
    }
    const unheld = map.get(NO_PRODUCER) ?? [];
    map.delete(NO_PRODUCER);
    return [
      ...[...map.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0])),
      ...(unheld.length ? ([[NO_PRODUCER, unheld]] as Array<[string, Mark[]]>) : []),
    ];
  }, [visible]);

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
        everywhere
      >
        <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the marks" />
      </WisdomToolbar>

      {visible.length === 0 && <NoMatch noun="mark" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          {view === 'alphabetical' && <MarkRows rows={visible} />}
          {view === 'producer' &&
            byProducer.map(([producer, rows]) => (
              <section key={producer}>
                <GroupHead label={producer} count={rows.length} />
                <MarkRows rows={rows} />
              </section>
            ))}
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A mark is a recipe number, seal or label rather than a plant or a place: 7572 is Menghai Tea Factory&rsquo;s
          benchmark shou recipe, encoded in its own digits. Eight of these are tied to a producer we hold. The rest are
          grading terms and labels used across the trade, or seen on a tea whose factory the record never named, which
          is why their producer reads as not recorded rather than as blank.
        </p>
        <HoldingAuthorship noun="marks" className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A mark that is missing" />
    </article>
  );
};

export default MarkIndexPage;
