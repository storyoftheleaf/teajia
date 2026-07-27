/**
 * /wisdom/styles. The index of ways a tea is made or pressed.
 *
 * Neither a plant variety nor a basic form: Xiao Qing Gan is shou stuffed in a
 * green mandarin, Tie Bing is a cake pressed in a stone-weighted iron mould.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { STYLES, type Style } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, CountLine, EYEBROW, HoldingRow, Invitation, WisdomSearchBox, WisdomSubNav } from './wisdomShared';

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
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>Tea Styles · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${STYLES.length} ways a tea is made or pressed that are neither a plant variety nor a basic form.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="styles" />

      <header>
        <p className={EYEBROW}>The wisdom base · Styles</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>Styles</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-4 max-w-[56ch]`}>
          Ways of making or pressing that are neither plant nor form.
        </p>
      </header>

      <WisdomSearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name or region" />
      <CountLine visible={visible.length} total={STYLES.length} noun="styles" />

      <ul className="list-none m-0 p-0 mt-2">
        {visible.map(style => (
          <HoldingRow
            key={style.id}
            to={`/wisdom/style/${style.id}`}
            name={style.name}
            chineseName={style.chineseName}
            meta={style.appliesToTypes.join(', ') || undefined}
            aside={style.region}
          />
        ))}
      </ul>

      {visible.length === 0 && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec py-16 text-center`}>
          No style here answers to that name. If it should, send it and it will be added.
        </p>
      )}

      <div className="mt-14 pt-8 border-t border-tea-border">
        <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>
          A style is neither the plant nor the basic form a tea is pressed into. It is a recognised way of making or
          pressing, the kind of fact a write-up states about a tea without it being a place, a plant, or a maker.
        </p>
      </div>

      <div className="mt-10 pt-8 border-t border-tea-border">
        <AuthorshipNote className="max-w-[60ch]" />
      </div>

      <Invitation subject="A style that is missing" />
    </article>
  );
};

export default StyleIndexPage;
