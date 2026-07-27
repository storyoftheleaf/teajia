/**
 * /wisdom. The front door to the public tea reference.
 *
 * Names every holding the wisdom base carries, with a count and a link. The
 * cultivar-specific intro ("what is a cultivar") stays on /wisdom/cultivars;
 * this page only says what the reference as a whole is.
 *
 * This is the one index whose rows carry a sentence, because five rows each
 * need saying what they hold. It is set as prose in sentence case, not as the
 * 10px caps the reference used to run under every row on every page.
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { CULTIVARS, MARKS, NAMED_TEAS, PRODUCERS, STYLES } from '../../wisdom';
import {
  AuthorshipNote,
  FACT,
  HoldingRow,
  IndexTable,
  Invitation,
  LABEL,
  PageHead,
  QUIET_LINK,
  WisdomSubNav,
  type IndexColumns,
} from './wisdomShared';

interface Holding {
  label: string;
  to: string;
  count: number;
  description: string;
}

const COLUMNS: IndexColumns = {
  template: 'minmax(0,1fr) 88px',
  nameLabel: 'Holding',
  labels: ['Entries'],
};

const HOLDINGS: Holding[] = [
  {
    label: 'The Tea Plants',
    to: '/wisdom/cultivars',
    count: CULTIVARS.length,
    description: 'Cultivars: breeding lineage, origin, and the teas made from each plant.',
  },
  {
    label: 'Producers',
    to: '/wisdom/producers',
    count: PRODUCERS.length,
    description: 'Factories, houses and brands. Who made the tea, not who a shop bought it from.',
  },
  {
    label: 'Marks',
    to: '/wisdom/marks',
    count: MARKS.length,
    description: 'Recipe numbers, seals and labels, most tied to a producer and an era.',
  },
  {
    label: 'Styles',
    to: '/wisdom/styles',
    count: STYLES.length,
    description: 'Ways of making or pressing that are neither a plant variety nor a basic form.',
  },
  {
    label: 'Named Teas',
    to: '/wisdom/named',
    count: NAMED_TEAS.length,
    description: 'Teas that arrived already named, where the composition was never disclosed.',
  },
];

const WisdomHomePage: React.FC = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Tea Wisdom Base',
    description: "A public reference of what a tea is, held once and true for everyone: plants, producers, marks, styles, and teas known only by name.",
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    hasPart: HOLDINGS.map(holding => ({
      '@type': 'CollectionPage',
      name: holding.label,
      url: holding.to,
    })),
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>The Tea Wisdom Base · Teajia</title>
        <meta
          name="description"
          content="A public reference of what a tea is: tea plants, producers, marks, styles, and teas known only by the name they were given."
        />
        <meta property="og:title" content="The Tea Wisdom Base · Teajia" />
        <meta
          property="og:description"
          content="Plants, producers, marks, styles, and named teas, held once and true for everyone who reads them."
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="overview" />

      <div className="mt-4">
        <PageHead
          title="The Tea Wisdom Base"
          note="What a tea is, held once, true regardless of who stocks it. Not a product catalog."
        />
      </div>

      <IndexTable columns={COLUMNS} className="mt-5">
        <ul className="list-none m-0 p-0">
          {HOLDINGS.map(holding => (
            <HoldingRow
              key={holding.to}
              to={holding.to}
              name={holding.label}
              cells={[String(holding.count)]}
              note={holding.description}
            />
          ))}
        </ul>
      </IndexTable>

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={LABEL}>The open dataset</p>
        <p className={`${FACT} mt-2 max-w-[68ch]`}>
          Everything above is also exported as a downloadable public good: a single{' '}
          <a href="/wisdom/tea-wisdom.json" className={QUIET_LINK}>
            tea-wisdom.json
          </a>{' '}
          carrying every holding, flat CSVs per entity, a README and a licence, all served from the{' '}
          <code className="text-tea-text-sec">/wisdom/</code> folder. CC BY 4.0, minus Adrian&rsquo;s own tea write-ups
          and tasting notes, which remain his.
        </p>
      </div>

      <div className="mt-8 pt-8 border-t border-tea-border">
        <AuthorshipNote className="max-w-[64ch]" />
      </div>

      <Invitation subject="The wisdom base" />
    </article>
  );
};

export default WisdomHomePage;
