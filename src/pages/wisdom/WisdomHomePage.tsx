/**
 * /wisdom. The front door to the public tea reference.
 *
 * Names every holding the wisdom base carries, with a count and a link, and
 * carries the one search that reaches across all of them. A reader who knows
 * "Rou Gui" but not that it is a plant should not have to guess a holding
 * before the reference will let them look; the hit says which holding it came
 * out of, so the guess is answered rather than demanded.
 *
 * This is the one index whose rows carry a sentence, because six rows each
 * need saying what they hold. It is set as prose in sentence case, not as the
 * 10px caps the reference used to run under every row on every page.
 */
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CULTIVARS, MARKS, NAMED_TEAS, PRODUCERS, REGIONS, STYLES } from '../../wisdom';
import {
  TEA_REFERENCE_PREVIEW_ENABLED,
  useTeaReferenceCatalogue,
} from '../../wisdom/reference/client';
import type { TeaReferenceCatalogue } from '../../wisdom/reference/types';
import { DATASET_BUILT, DATASET_PAGES, DATASET_RECORDS, DATASET_VERSION } from './datasetStamp';
import {
  AXIS_INDENT,
  FACT,
  FOOTNOTE,
  HoldingAuthorship,
  HoldingRow,
  IndexList,
  Invitation,
  MEASURE,
  PAGE,
  NoMatch,
  PageHead,
  QUIET_LINK,
  RULE_FULL,
  SPACE,
  ScopeNote,
  SectionHead,
  WisdomSubNav,
  WisdomToolbar,
  searchHoldings,
} from './wisdomShared';

interface Holding {
  label: string;
  to: string;
  count: number;
  description: string;
}

const HOLDINGS: Holding[] = [
  {
    label: 'The Tea Plants',
    to: '/wisdom/cultivars',
    count: CULTIVARS.length,
    description: 'Cultivars: breeding lineage, origin, and the teas made from each plant.',
  },
  {
    label: 'Growing Regions',
    to: '/wisdom/regions',
    count: REGIONS.length,
    description: 'The ground itself: country, province, altitude and climate, and what grows there.',
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

export function wisdomHomeHoldings(
  previewEnabled: boolean,
  catalogue: TeaReferenceCatalogue | null = null,
): Holding[] {
  if (!previewEnabled) return HOLDINGS;
  const typeCount = (catalogue?.families.length ?? 0) + (catalogue?.types.length ?? 0);
  return HOLDINGS.flatMap(holding => {
    const current = holding.to === '/wisdom/regions'
      ? {
          ...holding,
          label: 'Origins',
          description: 'Tea places, from broad growing regions toward the areas and localities the reference can establish.',
        }
      : holding;
    if (holding.to !== '/wisdom/cultivars') return [current];
    return [
      current,
      {
        label: 'Tea Types',
        to: '/wisdom/types',
        count: typeCount,
        description: 'Tea families and the sellable identities they contain, connected to teas in the public shop.',
      },
    ];
  });
}

/**
 * The entries that have a page here. Exported so a test can hold it against
 * DATASET_PAGES: the two are printed within a few lines of each other on this
 * page, and they must never again be allowed to say different things.
 */
export const TOTAL_ENTRIES = HOLDINGS.reduce((sum, holding) => sum + holding.count, 0);

/** Enough to answer a name and the records around it, short enough that the list is still readable. */
const HIT_LIMIT = 40;

/** "2026-07-27" as "27 July 2026". Parsed by hand: `new Date` on a bare date reads it as UTC. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function readableDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

const WisdomHomeContent: React.FC<{
  previewEnabled?: boolean;
  previewCatalogue?: TeaReferenceCatalogue | null;
  previewUnavailable?: boolean;
}> = ({ previewEnabled = false, previewCatalogue = null, previewUnavailable = false }) => {
  // Every index carries a line across to this search, and it carries the words
  // already typed. Arriving here with the field empty would have made the trip
  // cost the reader their own question.
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const searching = query.trim().length > 0;
  const hits = useMemo(() => searchHoldings(query, HIT_LIMIT), [query]);
  const holdings = useMemo(
    () => wisdomHomeHoldings(previewEnabled, previewCatalogue),
    [previewEnabled, previewCatalogue],
  );
  const totalEntries = holdings.reduce((sum, holding) => sum + holding.count, 0);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Tea Wisdom Base',
    description: "A public reference of what a tea is, held once and true for everyone: plants, growing regions, producers, marks, styles, and teas known only by name.",
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    hasPart: holdings.map(holding => ({
      '@type': 'CollectionPage',
      name: holding.label,
      url: holding.to,
    })),
  };

  return (
    <article className={PAGE}>
      <Helmet>
        <title>The Tea Wisdom Base · Teajia</title>
        <meta
          name="description"
          content="A public reference of what a tea is: tea plants, growing regions, producers, marks, styles, and teas known only by the name they were given."
        />
        <meta property="og:title" content="The Tea Wisdom Base · Teajia" />
        <meta
          property="og:description"
          content="Plants, places, producers, marks, styles, and named teas, held once and true for everyone who reads them."
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="overview" />

      <div className="mt-7">
        <PageHead
          kind="The reference"
          title="The Tea Wisdom Base"
          note="What a tea is, held once, true regardless of who stocks it. Not a product catalog."
        />
      </div>

      <div className={SPACE.section}>
        <WisdomToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search every holding"
          searchLabel="Search every holding by name, Chinese name, alias, or the place and maker a record names"
          visible={searching ? hits.length : totalEntries}
          total={totalEntries}
          noun="entries"
        />

        {!searching && (
          <IndexList>
            {holdings.map(holding => (
              <HoldingRow
                key={holding.to}
                to={holding.to}
                name={holding.label}
                cells={[`${holding.count} entries`]}
                note={holding.description}
              />
            ))}
          </IndexList>
        )}

        {previewUnavailable && !searching && (
          <p role="status" className={`${FOOTNOTE} ${MEASURE} ${AXIS_INDENT} mt-4`}>
            The local cited preview is unavailable. The established Wisdom holdings remain ready to browse.
          </p>
        )}

        {searching && hits.length === 0 && <NoMatch noun="entry" query={query} />}

        {searching && hits.length > 0 && (
          <IndexList>
            {hits.map(hit => (
              <HoldingRow
                key={hit.to}
                to={hit.to}
                name={hit.name}
                chineseName={hit.chineseName}
                cells={[hit.holding, hit.where]}
              />
            ))}
          </IndexList>
        )}
      </div>

      {searching && hits.length === HIT_LIMIT && (
        <p className={`${FOOTNOTE} ${AXIS_INDENT} mt-4`}>
          The closest {HIT_LIMIT} records. Narrow the search, or open the holding itself.
        </p>
      )}

      <section className={SPACE.section}>
        <SectionHead label="The open dataset" />
        <p className={`${FACT} ${MEASURE} ${AXIS_INDENT}`}>
          Everything above is also exported as a downloadable public good: a single{' '}
          <a href="/wisdom/tea-wisdom.json" className={QUIET_LINK}>
            tea-wisdom.json
          </a>{' '}
          carrying every holding, flat CSVs per entity, a README and a licence, all served from the{' '}
          <code className="text-tea-text-sec">/wisdom/</code> folder. CC BY 4.0, minus Adrian&rsquo;s own tea write-ups
          and tasting notes, which remain his.
        </p>
        {/* What it is, as of when. A reference that asks to be cited has to be
            able to be cited: a version, a date, and a count, read from the
            export itself rather than typed here and left to rot.

            Two counts, and they used to sit beside each other unnamed. The
            table above totals 313, the download totals 629, and a reader was
            left to decide which of the two the reference was lying about. They
            are both true and they count different things: the download also
            carries 316 tea variety names, which are romanisations and nothing
            more and have never had a page. So each number now says what it
            counts, in the same sentence, and the difference between them is
            stated rather than left as an apparent contradiction. */}
        <p className={`${FOOTNOTE} ${MEASURE} ${AXIS_INDENT} figures-tab mt-3`}>
          Version {DATASET_VERSION}, built {readableDate(DATASET_BUILT)}. {DATASET_RECORDS} records in all:{' '}
          {DATASET_PAGES} entries with a page above, plus {DATASET_RECORDS - DATASET_PAGES} tea variety names carried as
          data only. Cite it as: Teajia Tea Wisdom Base (teajia.com), version {DATASET_VERSION},{' '}
          {readableDate(DATASET_BUILT)}, CC BY 4.0.
        </p>
      </section>

      <div className={`${SPACE.section} pt-6 ${RULE_FULL}`}>
        <HoldingAuthorship noun="entries" className={`${MEASURE} ${AXIS_INDENT}`} />
        <ScopeNote className={`${MEASURE} ${AXIS_INDENT} mt-1`} />
      </div>

      <Invitation subject="The wisdom base" />
    </article>
  );
};

const PreviewWisdomHomePage: React.FC = () => {
  const { catalogue, isError } = useTeaReferenceCatalogue();
  return (
    <WisdomHomeContent
      previewEnabled
      previewCatalogue={catalogue}
      previewUnavailable={isError && !catalogue}
    />
  );
};

const WisdomHomePage: React.FC = () => (
  TEA_REFERENCE_PREVIEW_ENABLED ? <PreviewWisdomHomePage /> : <WisdomHomeContent />
);

export default WisdomHomePage;
