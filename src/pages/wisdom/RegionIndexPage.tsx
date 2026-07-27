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
 * Anhua and asks the reader to hold the map themselves.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { REGIONS, type Region } from '../../wisdom';
import {
  AuthorshipNote,
  FACT,
  GroupHead,
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

type View = 'country' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'country', label: 'By country' },
  { id: 'alphabetical', label: 'A to Z' },
];

/** A province name runs to about 18 characters; an altitude never past "1000-2300m". */
const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 148px 96px',
  nameLabel: 'Place',
  labels: ['Province', 'Altitude'],
};

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(region: Region, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [region.name, region.province, region.country]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const RegionRow: React.FC<{ region: Region }> = ({ region }) => (
  <HoldingRow
    to={`/wisdom/region/${region.id}`}
    name={region.name}
    cells={[region.province, region.altitude]}
  />
);

const Group: React.FC<{ label: string; rows: Region[] }> = ({ label, rows }) => {
  if (rows.length === 0) return null;
  return (
    <section>
      <GroupHead label={label} count={rows.length} />
      <ul className="list-none m-0 p-0">
        {rows.map(region => (
          <RegionRow key={region.id} region={region} />
        ))}
      </ul>
    </section>
  );
};

const RegionIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('country');
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () => REGIONS.filter(region => matches(region, query)).sort((left, right) => left.name.localeCompare(right.name)),
    [query],
  );

  const byCountry = useMemo(() => {
    const map = new Map<string, Region[]>();
    for (const region of visible) map.set(region.country, [...(map.get(region.country) ?? []), region]);
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length);
  }, [visible]);

  const byLetter = useMemo(() => {
    const map = new Map<string, Region[]>();
    for (const region of visible) {
      const letter = (region.name[0] ?? '#').toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), region]);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visible]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tea Growing Regions',
    description: 'Growing places held once: country, province, altitude and climate, and the plants recorded from each.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: REGIONS.length,
      itemListElement: REGIONS.map((region, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: region.name,
        url: `/wisdom/region/${region.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>Growing Regions · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${REGIONS.length} tea growing places: country, province, altitude and climate, and the plants recorded from each.`}
        />
        <meta property="og:title" content="Growing Regions · Teajia" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="regions" />

      <div className="mt-4 mb-2">
        <PageHead title="Growing Regions" note="The ground itself: how high, how wet, and what grows there." />
      </div>

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search places"
        searchLabel="Search growing places by name, province or country"
        visible={visible.length}
        total={REGIONS.length}
        noun="places"
      >
        <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the places" />
      </WisdomToolbar>

      {visible.length === 0 && <NoMatch noun="place" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          {view === 'country' && byCountry.map(([country, rows]) => <Group key={country} label={country} rows={rows} />)}
          {view === 'alphabetical' && byLetter.map(([letter, rows]) => <Group key={letter} label={letter} rows={rows} />)}
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          Two lists merged here. The researched origins name a county and carry altitude and climate; the working list
          names the area a vendor actually writes on an invoice, and carries neither. Both are kept, because a record
          that says &ldquo;Anxi&rdquo; and a record that says &ldquo;Anxi County, Fujian&rdquo; are both real, and
          collapsing one into the other would quietly change what a grower wrote.
        </p>
        <AuthorshipNote className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A growing place that is missing" />
    </article>
  );
};

export default RegionIndexPage;
