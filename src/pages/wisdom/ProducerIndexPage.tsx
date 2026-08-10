/**
 * /wisdom/producers. The index of who made a tea.
 *
 * Ten factories, houses and brands. Small enough to hold in one list; a search
 * field and a count still apply, because a name written in Chinese or an alias
 * is still a name a reader might type.
 *
 * On this holding and Marks, which describe the same relation from both ends.
 *
 * A mark has exactly one producer, so the Marks index groups by it: fifteen
 * rows fall into eight named piles and the pile heading is worth more than the
 * cell would be. A producer has many marks, so this index cannot group by them
 * at all, and carries the count instead, with the marks themselves listed and
 * linked on the producer's own page.
 *
 * That much is forced by the shape of the relation. What was not forced, and
 * read as carelessness, was that this index opened flat while Marks opened
 * grouped: the pair looked like one holding had been finished and the other had
 * not. So both now open grouped, each by the axis that actually separates its
 * own rows. Marks by producer, producers by kind. Neither is grouped by the
 * relation to the other, because the relation only groups in one direction, and
 * pretending otherwise would be a device with nothing under it.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PRODUCERS, marksOf, type Producer } from '../../wisdom';
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
import { buildWisdomCollectionData, usePublicWisdomEntries, WisdomIndexVisibilityNotice } from './publicIndexVisibility';

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

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(producer: Producer, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [producer.name, producer.chineseName, producer.region, producer.country, ...producer.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Producer, right: Producer) => left.name.localeCompare(right.name);

const anchorId = (label: string) =>
  `producer-${label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const ProducerRows: React.FC<{ rows: Producer[] }> = ({ rows }) => (
  <IndexList>
    {rows.map(producer => {
      // How many marks the base holds for this producer. The row opens the
      // producer, whose record lists them and links each one. "Marks held", not
      // "marks": the count is what the base holds, not what the factory made.
      // A producer we hold no mark for says so, rather than saying nothing.
      const held = marksOf(producer).length;
      return (
        <HoldingRow
          key={producer.id}
          to={`/wisdom/producer/${producer.id}`}
          name={producer.name}
          chineseName={producer.chineseName}
          cells={[
            [producer.region, producer.country].filter(Boolean).join(', ') || { absent: 'Place not recorded' },
            KIND_LABEL[producer.kind],
            held > 0 ? `${held} mark${held === 1 ? '' : 's'} held` : { absent: 'No marks held' },
          ]}
        />
      );
    })}
  </IndexList>
);

const ProducerIndexPage: React.FC = () => {
  // Grouped by default, the same as Marks. See the note at the top of the file.
  const [view, setView] = useState<View>('kind');
  const [query, setQuery] = useState('');
  const publicState = usePublicWisdomEntries('producer', PRODUCERS);
  const visible = useMemo(
    () => publicState.entries.filter(producer => matches(producer, query)).sort(byName),
    [publicState.entries, query],
  );

  /** Factories, then houses, then brands: the order the record's own note reads in. */
  const byKind = useMemo(() => {
    const map = new Map<string, Producer[]>();
    for (const producer of visible) {
      const label = KIND_LABEL[producer.kind];
      map.set(label, [...(map.get(label) ?? []), producer]);
    }
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  }, [visible]);

  const groups = useMemo(
    () => byKind.map(([kind, rows]) => ({ id: anchorId(kind), label: kind, count: rows.length })),
    [byKind],
  );

  const structuredData = buildWisdomCollectionData({
    name: 'Tea Producers',
    description: 'Factories, houses and brands read out of Adrian’s own write-ups: who made a tea, not who sold it.',
    entries: publicState.entries,
    pathFor: producer => `/wisdom/producer/${producer.id}`,
  });

  if (publicState.status !== 'ready') {
    return <WisdomIndexVisibilityNotice status={publicState.status} onRetry={publicState.retry} />;
  }

  return (
    <article className={PAGE}>
      <Helmet>
        <title>Tea Producers · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${publicState.entries.length} factories, houses and brands: who made a tea, held apart from who a shop bought it from.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="producers" />

      <div className="mt-7">
        <PageHead kind="Holding" title="Producers" note="Who made the tea, not who a shop bought it from." />
      </div>

      <div className={SPACE.section}>
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search producers"
          searchLabel="Search producers by name, Chinese name or alias"
          visible={visible.length}
          total={publicState.entries.length}
          noun="producers"
        >
          <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the producers" />
        </WisdomToolbar>

        {visible.length === 0 && <NoMatch noun="producer" query={query} />}

        {visible.length > 0 && (
          <>
            {view === 'kind' && <RunningHead groups={groups} />}
            {view === 'alphabetical' && <ProducerRows rows={visible} />}
            {view === 'kind' &&
              byKind.map(([kind, rows]) => (
                <section key={kind}>
                  <GroupHead id={anchorId(kind)} label={kind} count={rows.length} />
                  <ProducerRows rows={rows} />
                </section>
              ))}
          </>
        )}
      </div>

      <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
        <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>
          A house (号) is a pre-1950 family firm. A factory (茶厂) is state or industrial. Neither is the vendor a shop
          bought from, which is account-scoped and stays in the shop&rsquo;s own records. A producer is true for
          everyone: a 7572 was made by Menghai Tea Factory no matter whose shelf it sits on.
        </p>
        <HoldingAuthorship noun="producers" className={`${MEASURE} ${AXIS_INDENT} mt-5`} />
        <SearchEverywhere query={query} className={`${AXIS_INDENT} mt-2`} />
      </div>

      <Invitation subject="A producer that is missing" />
    </article>
  );
};

export default ProducerIndexPage;
