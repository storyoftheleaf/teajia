/**
 * /wisdom/cultivars. The index of tea plants.
 *
 * An editorial contents page with real columns, not a data table: three ways in
 * (origin, tea type, alphabetical), one toolbar line carrying the search and the
 * count, and one line of record per plant under a labelled header. The origin
 * and alphabetical views read the lean index and are instant. The tea type view
 * waits on the prose corpus, because type is a property of the teas a plant is
 * made into, not of the plant.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { CULTIVARS, TEA_TYPES, type Cultivar, type TeaType } from '../../wisdom';
import {
  FACT,
  GroupHead,
  GroupJump,
  HoldingAuthorship,
  HoldingRow,
  IndexTable,
  Invitation,
  NoMatch,
  PageHead,
  ViewSwitch,
  WisdomSubNav,
  WisdomToolbar,
  useCultivarTypes,
  type IndexColumns,
} from './wisdomShared';

type View = 'origin' | 'type' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'origin', label: 'By origin' },
  { id: 'type', label: 'By tea type' },
  { id: 'alphabetical', label: 'A to Z' },
];

/** Origin runs to 32 characters ("High Mountains (Lishan, Alishan)"); the year never exceeds four. */
const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 196px 72px',
  nameLabel: 'Plant',
  labels: ['Origin', 'Developed'],
};

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(cultivar: Cultivar, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [cultivar.name, cultivar.chineseName, cultivar.originRegion, cultivar.originCountry, ...cultivar.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Cultivar, right: Cultivar) => left.name.localeCompare(right.name);

// ─── One line of record ──────────────────────────────────────────────────────

const CultivarRow: React.FC<{ cultivar: Cultivar }> = ({ cultivar }) => (
  <HoldingRow
    to={`/wisdom/cultivar/${cultivar.id}`}
    name={cultivar.name}
    chineseName={cultivar.chineseName}
    cells={[cultivar.originRegion, cultivar.developedYear ? String(cultivar.developedYear) : undefined]}
  />
);

const anchorId = (label: string) =>
  `plant-${label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const Group: React.FC<{ label: string; rows: Cultivar[] }> = ({ label, rows }) => {
  if (rows.length === 0) return null;
  return (
    <section>
      <GroupHead id={anchorId(label)} label={label} count={rows.length} />
      <ul className="list-none m-0 p-0">
        {rows.map(cultivar => (
          <CultivarRow key={cultivar.id} cultivar={cultivar} />
        ))}
      </ul>
    </section>
  );
};

/** The groups on screen right now, as somewhere to jump to. */
const jumpFrom = (groups: Array<[string, Cultivar[]]>) =>
  groups
    .filter(([, rows]) => rows.length > 0)
    .map(([label, rows]) => ({ id: anchorId(label), label, count: rows.length }));

// ─── Page ────────────────────────────────────────────────────────────────────

const CultivarIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('origin');
  const [query, setQuery] = useState('');
  const { byId: typesById, loading: typesLoading } = useCultivarTypes();

  const visible = useMemo(() => CULTIVARS.filter(cultivar => matches(cultivar, query)).sort(byName), [query]);

  const byCountry = useMemo(() => {
    const map = new Map<string, Cultivar[]>();
    for (const cultivar of visible) {
      const country = cultivar.originCountry || 'Origin not recorded';
      map.set(country, [...(map.get(country) ?? []), cultivar]);
    }
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length);
  }, [visible]);

  const byLetter = useMemo(() => {
    const map = new Map<string, Cultivar[]>();
    for (const cultivar of visible) {
      const letter = (cultivar.name[0] ?? '#').toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), cultivar]);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visible]);

  const byType = useMemo(() => {
    if (!typesById) return [];
    const groups: Array<[string, Cultivar[]]> = TEA_TYPES.map(
      (type: TeaType) => [type, visible.filter(cultivar => typesById.get(cultivar.id)?.includes(type))] as [string, Cultivar[]],
    );
    const unrecorded = visible.filter(cultivar => (typesById.get(cultivar.id)?.length ?? 0) === 0);
    return [...groups.filter(([, rows]) => rows.length > 0), ['Type not recorded', unrecorded] as [string, Cultivar[]]];
  }, [visible, typesById]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Tea Plants',
    description:
      'A public reference of tea cultivars: breeding lineage, growing region, and the teas made from each plant.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: CULTIVARS.length,
      itemListElement: CULTIVARS.map((cultivar, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: cultivar.name,
        url: `/wisdom/cultivar/${cultivar.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>The Tea Plants · Teajia</title>
        <meta
          name="description"
          content={`A public reference of ${CULTIVARS.length} tea cultivars: breeding lineage, where each plant grows, and the teas made from it.`}
        />
        <meta property="og:title" content="The Tea Plants · Teajia" />
        <meta
          property="og:description"
          content="Breeding lineage, growing region, and sensory record for the tea plants behind the leaf."
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="cultivars" />

      <div className="mt-4 mb-2">
        <PageHead title="The Tea Plants" note="Their breeding, and the ground they came from." />
      </div>

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search plants"
        searchLabel="Search plants by name, Chinese name, region or country"
        visible={visible.length}
        total={CULTIVARS.length}
        noun="cultivars"
        everywhere
      >
        <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the plants" />
        {/* Silent at 79 plants: the threshold lives in GroupJump, so this
            appears on its own the day the holding outgrows a plain scroll. */}
        <GroupJump
          groups={jumpFrom(view === 'origin' ? byCountry : view === 'type' ? byType : byLetter)}
          rows={visible.length}
          label="Jump to a group of plants"
        />
      </WisdomToolbar>

      {visible.length === 0 && <NoMatch noun="plant" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          {view === 'origin' && byCountry.map(([country, rows]) => <Group key={country} label={country} rows={rows} />)}

          {view === 'alphabetical' && byLetter.map(([letter, rows]) => <Group key={letter} label={letter} rows={rows} />)}

          {view === 'type' && typesLoading && <p className={`${FACT} py-14 text-center`}>Reading the record.</p>}

          {view === 'type' && !typesLoading && byType.map(([type, rows]) => <Group key={type} label={type} rows={rows} />)}
        </IndexTable>
      )}

      {view === 'type' && !typesLoading && (
        <p className={`${FACT} mt-8 max-w-[64ch]`}>
          A plant can sit under more than one type. The same bush is picked for a green in April and a red in June, and
          the record follows the tea, not the leaf.
        </p>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A cultivar is a tea plant someone chose and kept. One bush behaved differently on one hillside, a cutting was
          taken, and a whole garden ended up carrying its habits. It is the half of a tea nobody prints on the label,
          which is why two gardens on the same slope can taste like different countries. What follows is the breeding
          record as we hold it, with the crosses named where they are known and left blank where they are not.
        </p>
        <HoldingAuthorship noun="plants" className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="Tea plants" />
    </article>
  );
};

export default CultivarIndexPage;
