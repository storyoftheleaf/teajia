/**
 * /wisdom/marks. The index of recipe numbers, seals and labels.
 *
 * Eight of the fifteen are tied to a producer the base holds, and that is the
 * fact worth ordering by: it is the difference between a mark that belongs to
 * one factory and a grading term half the trade uses. Era would have been the
 * obvious second axis and is not one, because only two records carry it.
 *
 * This holding and Producers describe one relation from its two ends, and the
 * reason they use different devices for it is written out once, at the top of
 * ProducerIndexPage. Both open grouped; neither groups by the other.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { MARKS, findProducerById, type Mark } from '../../wisdom';
import {
  AXIS_INDENT,
  FACT,
  GroupHead,
  HoldingAuthorship,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  NoMatch,
  PAGE,
  PageHead,
  RULE_FULL,
  RunningHead,
  SPACE,
  SearchEverywhere,
  ViewSwitch,
  WisdomSubNav,
  WisdomToolbar,
} from './wisdomShared';

type View = 'producer' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'producer', label: 'By producer' },
  { id: 'alphabetical', label: 'A to Z' },
];

/** Three words. A mark nobody is recorded as owning is a fact, not a blank. */
const NO_PRODUCER = 'No producer recorded';

const anchorId = (label: string) =>
  `mark-${label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

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
  <IndexList>
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
  </IndexList>
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

  const groups = useMemo(
    () => byProducer.map(([label, rows]) => ({ id: anchorId(label), label, count: rows.length })),
    [byProducer],
  );

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
    <article className={PAGE}>
      <Helmet>
        <title>Tea Marks · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${MARKS.length} recipe numbers, seals and labels: what a product line is called, and who made it.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="marks" />

      <div className="mt-7">
        <PageHead kind="Holding" title="Marks" note="Recipe numbers, seals and labels a product line carries." />
      </div>

      <div className={SPACE.section}>
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search marks"
          searchLabel="Search marks by name, Chinese name or era"
          visible={visible.length}
          total={MARKS.length}
          noun="marks"
        >
          <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the marks" />
        </WisdomToolbar>

        {visible.length === 0 && <NoMatch noun="mark" query={query} />}

        {visible.length > 0 && (
          <>
            {view === 'producer' && <RunningHead groups={groups} />}
            {view === 'alphabetical' && <MarkRows rows={visible} />}
            {view === 'producer' &&
              byProducer.map(([producer, rows]) => (
                <section key={producer}>
                  <GroupHead id={anchorId(producer)} label={producer} count={rows.length} />
                  <MarkRows rows={rows} />
                </section>
              ))}
          </>
        )}
      </div>

      <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
        <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>
          A mark is a recipe number, seal or label rather than a plant or a place: 7572 is Menghai Tea Factory&rsquo;s
          benchmark shou recipe, encoded in its own digits. Eight of these are tied to a producer we hold. The rest are
          grading terms and labels used across the trade, or seen on a tea whose factory the record never named, which
          is why their producer reads as not recorded rather than as nothing at all.
        </p>
        <HoldingAuthorship noun="marks" className={`${MEASURE} ${AXIS_INDENT} mt-5`} />
        <SearchEverywhere query={query} className={`${AXIS_INDENT} mt-2`} />
      </div>

      <Invitation subject="A mark that is missing" />
    </article>
  );
};

export default MarkIndexPage;
