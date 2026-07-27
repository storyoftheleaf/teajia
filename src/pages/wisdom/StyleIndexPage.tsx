/**
 * /wisdom/styles. The index of ways a tea is made or pressed.
 *
 * Neither a plant variety nor a basic form: Xiao Qing Gan is shou stuffed in a
 * green mandarin, Tie Bing is a cake pressed in a stone-weighted iron mould.
 *
 * Ten rows, and until now one fixed order with an empty half toolbar. The axis
 * that actually separates them is what they are done to: five of the ten are
 * dark-tea practices, three are pu-erh pressings and storages, one is an oolong
 * finish. A style can sit under more than one type, exactly as a plant can.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { STYLES, TEA_TYPES, type Style, type TeaType } from '../../wisdom';
import {
  FACT,
  GroupHead,
  HoldingAuthorship,
  HoldingRow,
  IndexPanel,
  IndexTable,
  Invitation,
  NoMatch,
  PageHead,
  SearchEverywhere,
  ViewSwitch,
  WisdomSubNav,
  WisdomToolbar,
  type IndexColumns,
} from './wisdomShared';

type View = 'type' | 'alphabetical';

const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'type', label: 'By tea type' },
  { id: 'alphabetical', label: 'A to Z' },
];

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.1fr)',
  nameLabel: 'Style',
  labels: ['Applies to', 'Region'],
};

/** Three words, so the group head stays inside the micro-caps rule. */
const NO_TYPE = 'Type not stated';

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(style: Style, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [style.name, style.chineseName, style.region, ...style.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Style, right: Style) => left.name.localeCompare(right.name);

const StyleRows: React.FC<{ rows: Style[] }> = ({ rows }) => (
  <ul className="list-none m-0 p-0">
    {rows.map(style => (
      <HoldingRow
        key={style.id}
        to={`/wisdom/style/${style.id}`}
        name={style.name}
        chineseName={style.chineseName}
        cells={[
          style.appliesToTypes.join(', ') || { absent: 'Not stated' },
          style.region || { absent: 'Not recorded' },
        ]}
      />
    ))}
  </ul>
);

const StyleIndexPage: React.FC = () => {
  const [view, setView] = useState<View>('type');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => STYLES.filter(style => matches(style, query)).sort(byName), [query]);

  const byType = useMemo(() => {
    const groups: Array<[string, Style[]]> = TEA_TYPES.map(
      (type: TeaType) => [type, visible.filter(style => style.appliesToTypes.includes(type))] as [string, Style[]],
    );
    const unstated = visible.filter(style => style.appliesToTypes.length === 0);
    return [...groups.filter(([, rows]) => rows.length > 0), [NO_TYPE, unstated] as [string, Style[]]].filter(
      ([, rows]) => rows.length > 0,
    );
  }, [visible]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tea Styles',
    description: 'Recognised ways a tea is made or pressed that are neither a plant variety nor one of the basic forms.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: STYLES.length,
      itemListElement: STYLES.map((style, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: style.name,
        url: `/wisdom/style/${style.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>Tea Styles · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${STYLES.length} ways a tea is made or pressed that are neither a plant variety nor a basic form.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="styles" />

      <div className="mt-4 mb-2">
        <PageHead title="Styles" note="Ways of making or pressing that are neither plant nor form." />
      </div>

      <IndexPanel className="mt-5">
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search styles"
          searchLabel="Search styles by name, Chinese name or region"
          visible={visible.length}
          total={STYLES.length}
          noun="styles"
        >
          <ViewSwitch options={VIEWS} value={view} onChange={next => setView(next)} label="Browse the styles" />
        </WisdomToolbar>

        {visible.length === 0 && <NoMatch noun="style" query={query} />}

        {visible.length > 0 && (
          <IndexTable columns={COLUMNS}>
            {view === 'alphabetical' && <StyleRows rows={visible} />}
            {view === 'type' &&
              byType.map(([type, rows]) => (
                <section key={type}>
                  <GroupHead label={type} count={rows.length} />
                  <StyleRows rows={rows} />
                </section>
              ))}
          </IndexTable>
        )}
      </IndexPanel>

      <div className="mt-14">
        <p className={`${FACT} max-w-[68ch]`}>
          A style is neither the plant nor the basic form a tea is pressed into. It is a recognised way of making or
          pressing, the kind of fact a write-up states about a tea without it being a place, a plant, or a maker. One
          style can apply to more than one type, so a name can appear under two headings above.
        </p>
        <HoldingAuthorship noun="styles" className="max-w-[64ch] mt-6" />
        <SearchEverywhere query={query} className="mt-2" />
      </div>

      <Invitation subject="A style that is missing" />
    </article>
  );
};

export default StyleIndexPage;
