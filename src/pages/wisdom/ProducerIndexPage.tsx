/**
 * /wisdom/producers. The index of who made a tea.
 *
 * Ten factories, houses and brands. Small enough to hold in one list; a search
 * field and a count line still apply, because a name written in Chinese or an
 * alias is still a name a reader might type.
 */
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PRODUCERS, type Producer } from '../../wisdom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { AuthorshipNote, CountLine, EYEBROW, HoldingRow, Invitation, WisdomSearchBox, WisdomSubNav } from './wisdomShared';

const KIND_LABEL: Record<Producer['kind'], string> = {
  factory: 'Factory',
  house: 'House',
  brand: 'Brand',
  cooperative: 'Cooperative',
  unknown: 'Kind not recorded',
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

const ProducerIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => PRODUCERS.filter(producer => matches(producer, query)).sort(byName), [query]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tea Producers',
    description: 'Factories, houses and brands read out of Adrian’s own write-ups: who made a tea, not who sold it.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: PRODUCERS.length,
      itemListElement: PRODUCERS.map((producer, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: producer.name,
        url: `/wisdom/producer/${producer.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-10 pb-nav">
      <Helmet>
        <title>Tea Producers · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${PRODUCERS.length} factories, houses and brands: who made a tea, held apart from who a shop bought it from.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="producers" />

      <header>
        <p className={EYEBROW}>The wisdom base · Producers</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mt-3`}>Producers</h1>
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec mt-4 max-w-[56ch]`}>
          Who made the tea, not who a shop bought it from.
        </p>
      </header>

      <WisdomSearchBox value={query} onChange={setQuery} placeholder="Search by name, Chinese name or alias" />
      <CountLine visible={visible.length} total={PRODUCERS.length} noun="producers" />

      <ul className="list-none m-0 p-0 mt-2">
        {visible.map(producer => (
          <HoldingRow
            key={producer.id}
            to={`/wisdom/producer/${producer.id}`}
            name={producer.name}
            chineseName={producer.chineseName}
            meta={[producer.region, producer.country].filter(Boolean).join(', ')}
            aside={KIND_LABEL[producer.kind]}
          />
        ))}
      </ul>

      {visible.length === 0 && (
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec py-16 text-center`}>
          No producer here answers to that name. If it should, send it and it will be added.
        </p>
      )}

      <div className="mt-14 pt-8 border-t border-tea-border">
        <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec max-w-[64ch]`}>
          A house (号) is a pre-1950 family firm. A factory (茶厂) is state or industrial. Neither is the vendor a
          shop bought from, which is account-scoped and stays in the shop&rsquo;s own records. A producer is true for
          everyone: a 7572 was made by Menghai Tea Factory no matter whose shelf it sits on.
        </p>
      </div>

      <div className="mt-10 pt-8 border-t border-tea-border">
        <AuthorshipNote className="max-w-[60ch]" />
      </div>

      <Invitation subject="A producer that is missing" />
    </article>
  );
};

export default ProducerIndexPage;
