/**
 * /wisdom and /wisdom/cultivars. The index of tea plants.
 *
 * An editorial contents page, not a data table: three ways in (origin, tea
 * type, alphabetical), a quiet filter, and one line of record per plant. The
 * origin and alphabetical views read the lean index and are instant. The tea
 * type view waits on the prose corpus, because type is a property of the teas a
 * plant is made into, not of the plant.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CULTIVARS, TEA_TYPES, type Cultivar, type TeaType } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import {
  AuthorshipNote,
  CountLine,
  EYEBROW,
  Invitation,
  SectionHead,
  WisdomSearchBox,
  WisdomSubNav,
  useCultivarTypes,
} from './wisdomShared';

type View = 'origin' | 'type' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'origin', label: 'By origin' },
  { id: 'type', label: 'By tea type' },
  { id: 'alphabetical', label: 'A to Z' },
];

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
  <li className="border-t border-tea-border first:border-t-0">
    <Link
      to={`/wisdom/cultivar/${cultivar.id}`}
      className="group block py-3 min-h-[52px] hover:bg-tea-gold/6 transition-colors -mx-2 px-2 rounded-md"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 justify-between">
        <span className="inline-flex items-baseline gap-2.5 flex-wrap min-w-0">
          <span className="font-display text-ui-17 leading-snug text-tea-text group-hover:text-tea-gold-lt transition-colors">
            {cultivar.name}
          </span>
          {cultivar.chineseName && (
            <span className="font-display text-ui-13 text-tea-text-dim">{cultivar.chineseName}</span>
          )}
        </span>
        <span className={`${EYEBROW} text-right shrink-0`}>
          {[cultivar.originRegion, cultivar.developedYear ? String(cultivar.developedYear) : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {(cultivar.altNames.length > 0 || cultivar.parentage) && (
        <p className={`${EYEBROW} mt-0.5 truncate`}>
          {cultivar.altNames.length > 0 && <span>{cultivar.altNames.join(', ')}</span>}
          {cultivar.altNames.length > 0 && cultivar.parentage && <span aria-hidden> · </span>}
          {cultivar.parentage && <span>{cultivar.parentage}</span>}
        </p>
      )}
    </Link>
  </li>
);

const Group: React.FC<{ label: string; rows: Cultivar[] }> = ({ label, rows }) => {
  if (rows.length === 0) return null;
  return (
    <section className="mt-12 first:mt-0">
      <SectionHead glyph="§" label={label} count={rows.length} />
      <ul className="list-none m-0 p-0">
        {rows.map(cultivar => (
          <CultivarRow key={cultivar.id} cultivar={cultivar} />
        ))}
      </ul>
    </section>
  );
};

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
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
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

      <header>
        <p className={EYEBROW}>The wisdom base · The plants</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>The Tea Plants</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-4 max-w-[52ch]`}>
          {CULTIVARS.length} cultivars, their breeding, and the ground they came from.
        </p>
      </header>

      <nav aria-label="Browse the plants" className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-tea-border pb-3">
        {VIEWS.map(option => {
          const active = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              aria-current={active ? 'true' : undefined}
              className={`min-h-[44px] inline-flex items-center font-display text-ui-16 tracking-[0.02em] transition-colors ${
                active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </nav>

      <WisdomSearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name, region or country" />
      <CountLine visible={visible.length} total={CULTIVARS.length} noun="cultivars" />

      <div className="mt-6">
        {visible.length === 0 && (
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec py-16 text-center`}>
            No plant here answers to that name. If it should, send it and it will be added.
          </p>
        )}

        {visible.length > 0 && view === 'origin' && byCountry.map(([country, rows]) => (
          <Group key={country} label={country} rows={rows} />
        ))}

        {visible.length > 0 && view === 'alphabetical' && byLetter.map(([letter, rows]) => (
          <Group key={letter} label={letter} rows={rows} />
        ))}

        {visible.length > 0 && view === 'type' && typesLoading && (
          <p className={`${EYEBROW} py-16 text-center`}>Reading the record</p>
        )}

        {visible.length > 0 && view === 'type' && !typesLoading &&
          byType.map(([type, rows]) => <Group key={type} label={type} rows={rows} />)}

        {view === 'type' && !typesLoading && (
          <p className={`${EYEBROW} mt-10 leading-relaxed max-w-[60ch]`}>
            A plant can sit under more than one type. The same bush is picked for a green in April and a red in June,
            and the record follows the tea, not the leaf.
          </p>
        )}
      </div>

      <div className="mt-14 pt-8 border-t border-tea-border">
        <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>
          A cultivar is a tea plant someone chose and kept. One bush behaved differently on one hillside, a cutting
          was taken, and a whole garden ended up carrying its habits. It is the half of a tea nobody prints on the
          label, which is why two gardens on the same slope can taste like different countries. What follows is the
          breeding record as we hold it, with the crosses named where they are known and left blank where they are
          not.
        </p>
        <AuthorshipNote className="max-w-[60ch] mt-8" />
      </div>

      <Invitation subject="Tea plants" />
    </article>
  );
};

export default CultivarIndexPage;
