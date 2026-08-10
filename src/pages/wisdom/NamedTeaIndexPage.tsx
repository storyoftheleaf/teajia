/**
 * /wisdom/named. The index of teas known by the name they were given.
 *
 * Grouped by tradition, per docs/TEA_WISDOM_BASE.md "On teas that arrive
 * already named": a collector stores a sheng for years and names it Courage,
 * the mountain and often the vintage never recorded, and that is the nature
 * of the record rather than a gap in it. The framing sits under the list, not
 * above it, so the list itself is what the first screen carries.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { NAMED_TEAS, NAMING_TRADITIONS, namedTeasInTradition, type NamedTea } from '../../wisdom';
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

const anchorId = (label: string) =>
  `named-${label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * A tradition is written in the base as an explanation, not as a label:
 * "Chinese poetic tea-naming (named for the feeling of origin rather than a
 * technical specification)" is sixteen words. Sixteen words cannot head a
 * group. Three things come off, none of which carry any distinguishing weight:
 *
 *   the parenthetical  an explanation, which belongs on the entry, not the head
 *   "Chinese"          true of nearly every group, so it separates nothing
 *   "naming"           true of every group without exception, it IS the axis
 *
 * What is left is the word the tradition actually turns on: Poetic, Proverbial,
 * Private-collection. Hyphens are kept as the source wrote them, which is part
 * of what holds a label inside the three-word micro-caps rule.
 *
 * Anything still over three words is cut from the front, not the back, because
 * the specific part of an English noun phrase is at its end: "undocumented
 * export or trade-route" is distinguished by the export, not by the fact that
 * it is undocumented. Three words is a hard ceiling, so the rule cannot be
 * broken by a tradition somebody adds later. The full sentence is still shown,
 * once, on the tea's own page.
 */
export function traditionLabel(tradition: string): string {
  const head = (tradition.split('(')[0] ?? tradition).trim();
  const cleaned = head
    .split(',')
    .map(clause =>
      clause
        .replace(/^\s*chinese\s+/i, '')
        .replace(/\b(tea-)?naming\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join(', ');
  if (!cleaned) return tradition;
  const words = cleaned.split(/\s+/);
  const label = words.length > 3 ? words.slice(-3).join(' ') : cleaned;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(tea: NamedTea, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [tea.name, tea.chineseName, tea.region, tea.type, tea.tradition, ...tea.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

type View = 'tradition' | 'type' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'tradition', label: 'By tradition' },
  { id: 'type', label: 'By tea type' },
  { id: 'alphabetical', label: 'A to Z' },
];

/** Three words. A named tea whose type the record never stated is still a tea. */
const NO_TYPE = 'Type not stated';

const NamedTeaRows: React.FC<{ rows: NamedTea[] }> = ({ rows }) => (
  <IndexList>
    {rows.map(tea => (
      <HoldingRow
        key={tea.id}
        to={`/wisdom/named/${tea.id}`}
        name={tea.name}
        chineseName={tea.chineseName}
        cells={[tea.type || { absent: 'Not stated' }, tea.form || { absent: 'Not stated' }]}
      />
    ))}
  </IndexList>
);

const NamedTeaIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('tradition');
  const [query, setQuery] = useState('');
  const publicState = usePublicWisdomEntries('named_tea', NAMED_TEAS);
  const visible = useMemo(() => publicState.entries.filter(tea => matches(tea, query)), [publicState.entries, query]);
  const visibleIds = useMemo(() => new Set(visible.map(tea => tea.id)), [visible]);
  const visibleCount = visibleIds.size;

  const groups = useMemo(
    () => NAMING_TRADITIONS.map(tradition => [tradition, namedTeasInTradition(tradition).filter(tea => visibleIds.has(tea.id))] as const)
      .filter(([, rows]) => rows.length > 0),
    [visibleIds],
  );

  const byType = useMemo(() => {
    const map = new Map<string, NamedTea[]>();
    for (const tea of visible) {
      const label = tea.type || NO_TYPE;
      map.set(label, [...(map.get(label) ?? []), tea]);
    }
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  }, [visible]);

  const alphabetical = useMemo(() => [...visible].sort((left, right) => left.name.localeCompare(right.name)), [visible]);

  const runningGroups = useMemo(() => {
    const source: Array<[string, NamedTea[]]> =
      view === 'tradition'
        ? groups.map(([tradition, rows]) => [traditionLabel(tradition), rows])
        : view === 'type'
          ? byType
          : [];
    return source.map(([label, rows]) => ({ id: anchorId(label), label, count: rows.length }));
  }, [view, groups, byType]);

  const structuredData = buildWisdomCollectionData({
    name: 'Named Teas',
    description: 'Teas known by the name they were given, where the composition is not disclosed.',
    entries: publicState.entries,
    pathFor: tea => `/wisdom/named/${tea.id}`,
  });

  if (publicState.status !== 'ready') {
    return <WisdomIndexVisibilityNotice status={publicState.status} onRetry={publicState.retry} />;
  }

  return (
    <article className={PAGE}>
      <Helmet>
        <title>Named Teas · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${publicState.entries.length} teas known by the name they were given, where the composition was never disclosed.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="named" />

      <div className="mt-7">
        <PageHead kind="Holding" title="Named Teas" note="Where the composition was never disclosed." />
      </div>

      <div className={SPACE.section}>
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search named teas"
          searchLabel="Search named teas by name, Chinese name, type or tradition"
          visible={visibleCount}
          total={publicState.entries.length}
          noun="named teas"
        >
          <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the named teas" />
        </WisdomToolbar>

        {visibleCount === 0 && <NoMatch noun="named tea" query={query} />}

        {visibleCount > 0 && (
          <>
            <RunningHead groups={runningGroups} />
            {view === 'tradition' &&
              groups.map(([tradition, rows]) => (
                <section key={tradition}>
                  <GroupHead
                    id={anchorId(traditionLabel(tradition))}
                    label={traditionLabel(tradition)}
                    count={rows.length}
                  />
                  <NamedTeaRows rows={rows} />
                </section>
              ))}
            {view === 'type' &&
              byType.map(([type, rows]) => (
                <section key={type}>
                  <GroupHead id={anchorId(type)} label={type} count={rows.length} />
                  <NamedTeaRows rows={rows} />
                </section>
              ))}
            {view === 'alphabetical' && <NamedTeaRows rows={alphabetical} />}
          </>
        )}
      </div>

      <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
        <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>
          A collector stores a sheng for years and names it Courage. The mountain is rarely recorded and the vintage
          often is not either, and the tea moves on carrying only that word. That is not a gap in the record. It is the
          nature of the record, and holding it plainly beats not holding it at all.
        </p>
        {/* The line about the grouping used to print between the toolbar and
            the first tea, directly under a second dim line reaching the
            cross-holding search: two footnotes before a single record. The view
            switch above already says "By tradition", so what is left worth
            saying is where the full sentence lives, and it says it here with
            the rest of the notes about the holding. */}
        {view === 'tradition' && (
          <p className={`${FACT} ${MEASURE} ${AXIS_INDENT} mt-4`}>
            The groups above are how each tea came by its name. Every entry states its tradition in full on its own
            page.
          </p>
        )}
        <HoldingAuthorship noun="teas" className={`${MEASURE} ${AXIS_INDENT} mt-5`} />
        <SearchEverywhere query={query} className={`${AXIS_INDENT} mt-2`} />
      </div>

      <Invitation subject="A named tea that is missing" />
    </article>
  );
};

export default NamedTeaIndexPage;
