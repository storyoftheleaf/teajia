/**
 * /wisdom/styles. The index of ways a tea is made or pressed.
 *
 * Neither a plant variety nor a basic form: Xiao Qing Gan is shou stuffed in a
 * green mandarin, Tie Bing is a cake pressed in a stone-weighted iron mould.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { STYLES, type Style } from '../../wisdom';
import {
  AuthorshipNote,
  FACT,
  HoldingRow,
  IndexTable,
  Invitation,
  NoMatch,
  PageHead,
  WisdomSubNav,
  WisdomToolbar,
  type IndexColumns,
} from './wisdomShared';

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 132px 168px',
  nameLabel: 'Style',
  labels: ['Applies to', 'Region'],
};

const matchKey = (value: string) => value.normalize('NFKD').toLowerCase();

function matches(style: Style, query: string): boolean {
  if (!query.trim()) return true;
  const needle = matchKey(query.trim());
  return [style.name, style.chineseName, style.region, ...style.altNames]
    .filter(Boolean)
    .some(field => matchKey(field as string).includes(needle));
}

const byName = (left: Style, right: Style) => left.name.localeCompare(right.name);

const StyleIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => STYLES.filter(style => matches(style, query)).sort(byName), [query]);

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

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search styles"
        searchLabel="Search styles by name, Chinese name or region"
        visible={visible.length}
        total={STYLES.length}
        noun="styles"
      />

      {visible.length === 0 && <NoMatch noun="style" query={query} />}

      {visible.length > 0 && (
        <IndexTable columns={COLUMNS} className="mt-3">
          <ul className="list-none m-0 p-0">
            {visible.map(style => (
              <HoldingRow
                key={style.id}
                to={`/wisdom/style/${style.id}`}
                name={style.name}
                chineseName={style.chineseName}
                cells={[style.appliesToTypes.join(', ') || undefined, style.region]}
              />
            ))}
          </ul>
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A style is neither the plant nor the basic form a tea is pressed into. It is a recognised way of making or
          pressing, the kind of fact a write-up states about a tea without it being a place, a plant, or a maker.
        </p>
        <AuthorshipNote className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A style that is missing" />
    </article>
  );
};

export default StyleIndexPage;
