/**
 * /wisdom/regions. The index of growing places.
 *
 * 182 places were already in the base, already carrying altitude and climate,
 * and already leaving in the public download. They had no page and were not in
 * the nav, which meant the one holding a reader is most likely to arrive
 * knowing ("where does Wuyi tea come from") was the one holding the site did
 * not admit to having.
 *
 * Grouped by country, because a place list read A to Z puts Alishan next to
 * Anhua and asks the reader to hold the map themselves. China is 98 of the 182,
 * which is a scroll no country heading survives, so a country that large is
 * split again by province and both headings stick.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { REGIONS, regionElevationPresentation, type Region } from '../../wisdom';
import {
  AXIS_INDENT,
  FACT,
  FOOTNOTE,
  GroupHead,
  GroupJump,
  HoldingAuthorship,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  NoMatch,
  PAGE,
  PREVIEW_PAGE,
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

type View = 'country' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'country', label: 'By country' },
  { id: 'alphabetical', label: 'A to Z' },
];

const PreviewOriginIndexSection = import.meta.env.MODE === 'tea-reference-preview'
  ? React.lazy(() => import('./PreviewOriginIndexSection'))
  : null;
const REGION_INDEX_PAGE = import.meta.env.MODE === 'tea-reference-preview' ? PREVIEW_PAGE : PAGE;

/**
 * What the two run-in facts are actually reporting.
 *
 * Ninety-four of the 182 places carry no altitude and eighty-four no province,
 * because they are not that kind of record: the working list holds the area a
 * vendor writes on an invoice, a name and a country and nothing else, by
 * construction. The device this reference uses for a missing value ("Not
 * recorded", in the dim tone) is right for a scarce absence and wrong here.
 * Ninety-four repetitions of a phrase is not absence made legible, it is a
 * column of the word "not", and it would be the loudest thing on the page.
 *
 * So a researched place is marked by carrying the values, a working-list place
 * shows neither, and the difference between a full row and a bare one is stated
 * once, in a line above the list, instead of ninety-four times inside it.
 * Nothing is hidden: the entry page for a bare place already says in a sentence
 * that only its name and country are held.
 *
 * Both figures are counted, never typed. The day a place is researched the line
 * above the list moves on its own.
 */
/**
 * Above this many rows a country stops being a group and becomes a list again.
 * China is the only one over it today, at 98.
 */
const SPLIT_ABOVE = 40;

/** Three words, so it stays inside the micro-caps rule the group heads enforce. */
const NO_PROVINCE = 'Province not recorded';

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

const anchorId = (...parts: string[]) =>
  `place-${parts.join('-').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

function matches(region: Region, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [region.name, region.province, region.country]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

interface Group {
  id: string;
  label: string;
  rows: Region[];
  /** Present only where the group was too long to read as one list. */
  parts?: Group[];
}

/** Biggest group first: a reader looking for a place is likeliest to want China. */
const bySize = (left: Group, right: Group) => right.rows.length - left.rows.length;

function groupBy(rows: Region[], key: (region: Region) => string, prefix: string[]): Group[] {
  const map = new Map<string, Region[]>();
  for (const region of rows) map.set(key(region), [...(map.get(key(region)) ?? []), region]);
  return [...map.entries()].map(([label, group]) => ({ id: anchorId(...prefix, label), label, rows: group }));
}

const RegionRow: React.FC<{ region: Region }> = ({ region }) => (
  <HoldingRow
    to={`/wisdom/region/${region.id}`}
    name={region.name}
    cells={[region.province, regionElevationPresentation(region)?.value]}
  />
);

const RegionRows: React.FC<{ rows: Region[] }> = ({ rows }) => (
  <IndexList>
    {rows.map(region => (
      <RegionRow key={region.id} region={region} />
    ))}
  </IndexList>
);

const GroupSection: React.FC<{ group: Group }> = ({ group }) => (
  <section>
    <GroupHead id={group.id} label={group.label} count={group.rows.length} />
    {group.parts ? (
      group.parts.map(part => (
        <section key={part.id}>
          <GroupHead id={part.id} label={part.label} count={part.rows.length} sub />
          <RegionRows rows={part.rows} />
        </section>
      ))
    ) : (
      <RegionRows rows={group.rows} />
    )}
  </section>
);

const RegionIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('country');
  const [query, setQuery] = useState('');
  const publicState = usePublicWisdomEntries('region', REGIONS);

  const visible = useMemo(
    () => publicState.entries.filter(region => matches(region, query)).sort((left, right) => left.name.localeCompare(right.name)),
    [publicState.entries, query],
  );
  const recordedElevation = useMemo(
    () => publicState.entries.filter(region => regionElevationPresentation(region)).length,
    [publicState.entries],
  );
  const recordedProvince = useMemo(() => publicState.entries.filter(region => region.province).length, [publicState.entries]);

  const byCountry = useMemo(
    () =>
      groupBy(visible, region => region.country, [])
        .sort(bySize)
        .map(group =>
          group.rows.length > SPLIT_ABOVE
            ? {
                ...group,
                parts: groupBy(group.rows, region => region.province || NO_PROVINCE, [group.label]).sort(bySize),
              }
            : group,
        ),
    [visible],
  );

  const byLetter = useMemo(
    () => groupBy(visible, region => (region.name[0] ?? '#').toUpperCase(), ['letter']).sort((left, right) => left.label.localeCompare(right.label)),
    [visible],
  );

  const groups = view === 'country' ? byCountry : byLetter;

  /** A subdivided country puts its provinces in the jump too, or China is one stop. */
  const jumpTo = useMemo(
    () =>
      groups.flatMap(group => [
        { id: group.id, label: group.label, count: group.rows.length },
        ...(group.parts ?? []).map(part => ({
          id: part.id,
          label: `${group.label} · ${part.label}`,
          count: part.rows.length,
        })),
      ]),
    [groups],
  );

  const structuredData = buildWisdomCollectionData({
    name: 'Tea Growing Regions',
    description: 'Growing places held once: country, province, altitude and climate, and the plants recorded from each.',
    entries: publicState.entries,
    pathFor: region => `/wisdom/region/${region.id}`,
  });

  if (publicState.status !== 'ready') {
    return <WisdomIndexVisibilityNotice status={publicState.status} onRetry={publicState.retry} />;
  }

  return (
    <article className={REGION_INDEX_PAGE}>
      <Helmet>
        <title>Growing Regions · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${publicState.entries.length} tea growing places: country, province, altitude and climate, and the plants recorded from each.`}
        />
        <meta property="og:title" content="Growing Regions · Teajia" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="regions" />

      <div className="mt-7">
        <PageHead
          kind="Holding"
          title="Growing Regions"
          note="The ground itself: how high, how wet, and what grows there."
        />
      </div>

      {PreviewOriginIndexSection && (
        <React.Suspense fallback={null}>
          <PreviewOriginIndexSection />
        </React.Suspense>
      )}

      {/* What a bare entry means, said once, and now the only dim line standing
          between the toolbar and the first place. The cross-holding escape line
          used to print above it, so a reader met two footnotes before they met
          a single record; that one moved to the foot. This one stays, because
          it is about the facts directly beneath it. */}
      {visible.length > 0 && (
        <p className={`${FOOTNOTE} ${MEASURE} ${AXIS_INDENT} figures-tab mt-8`}>
          An elevation is recorded for {recordedElevation} of these places and a province for {recordedProvince}. The
          remaining entries keep only the location details the reference can currently support; a missing fact means
          it has not been established here, not that it is inapplicable.
        </p>
      )}

      <div className="mt-4">
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search places"
          searchLabel="Search growing places by name, province or country"
          visible={visible.length}
          total={publicState.entries.length}
          noun="places"
        >
          <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the places" />
          <GroupJump groups={jumpTo} rows={visible.length} label="Jump to a group of places" />
        </WisdomToolbar>

        {visible.length === 0 && <NoMatch noun="place" query={query} />}

        {visible.length > 0 && (
          <>
            <RunningHead groups={jumpTo} />
            {groups.map(group => (
              <GroupSection key={group.id} group={group} />
            ))}
          </>
        )}
      </div>

      <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
        <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>
          Specific places and broader areas remain separate when their relationship has not been established. For
          example, &ldquo;Anxi&rdquo; and &ldquo;Anxi County, Fujian&rdquo; are not silently combined.
        </p>
        <HoldingAuthorship noun="places" className={`${MEASURE} ${AXIS_INDENT} mt-5`} />
        <SearchEverywhere query={query} className={`${AXIS_INDENT} mt-2`} />
      </div>

      <Invitation subject="A growing place that is missing" />
    </article>
  );
};

export default RegionIndexPage;
