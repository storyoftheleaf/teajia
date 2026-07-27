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
  AuthorshipNote,
  FACT,
  FOOTNOTE,
  GroupHead,
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
  template: 'minmax(0,1fr) 104px 132px',
  nameLabel: 'Tea',
  labels: ['Type', 'Form'],
};

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

const NamedTeaIndexPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const visibleIds = useMemo(
    () => new Set(NAMED_TEAS.filter(tea => matches(tea, query)).map(tea => tea.id)),
    [query],
  );
  const visibleCount = visibleIds.size;

  const groups = useMemo(
    () => NAMING_TRADITIONS.map(tradition => [tradition, namedTeasInTradition(tradition).filter(tea => visibleIds.has(tea.id))] as const)
      .filter(([, rows]) => rows.length > 0),
    [visibleIds],
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Named Teas',
    description: 'Teas known by the name they were given, where the composition is not disclosed.',
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Teajia' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: NAMED_TEAS.length,
      itemListElement: NAMED_TEAS.map((tea, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tea.name,
        url: `/wisdom/named/${tea.id}`,
      })),
    },
  };

  return (
    <article className="w-full max-w-3xl mx-auto pt-4 pb-nav">
      <Helmet>
        <title>Named Teas · The Wisdom Base · Teajia</title>
        <meta
          name="description"
          content={`${NAMED_TEAS.length} teas known by the name they were given, where the composition was never disclosed.`}
        />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <WisdomSubNav active="named" />

      <div className="mt-4 mb-2">
        <PageHead title="Named Teas" note="Where the composition was never disclosed." />
      </div>

      <WisdomToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search named teas"
        searchLabel="Search named teas by name, Chinese name, type or tradition"
        visible={visibleCount}
        total={NAMED_TEAS.length}
        noun="named teas"
      />

      {visibleCount === 0 && <NoMatch noun="named tea" query={query} />}

      {/* The one line the group heads no longer have to carry. Said here once,
          in place of a naming tradition written out in full above every group. */}
      {visibleCount > 0 && (
        <p className={`${FOOTNOTE} mt-3`}>
          Grouped by how the tea came by its name. Each entry states its tradition in full.
        </p>
      )}

      {visibleCount > 0 && (
        <IndexTable columns={COLUMNS} className="mt-1">
          {groups.map(([tradition, rows]) => (
            <section key={tradition}>
              <GroupHead label={traditionLabel(tradition)} count={rows.length} />
              <ul className="list-none m-0 p-0">
                {rows.map(tea => (
                  <HoldingRow
                    key={tea.id}
                    to={`/wisdom/named/${tea.id}`}
                    name={tea.name}
                    chineseName={tea.chineseName}
                    cells={[tea.type, tea.form]}
                  />
                ))}
              </ul>
            </section>
          ))}
        </IndexTable>
      )}

      <div className="mt-12 pt-8 border-t border-tea-border">
        <p className={`${FACT} max-w-[68ch]`}>
          A collector stores a sheng for years and names it Courage. The mountain is rarely recorded and the vintage
          often is not either, and the tea moves on carrying only that word. That is not a gap in the record. It is the
          nature of the record, and holding it plainly beats not holding it at all.
        </p>
        <AuthorshipNote className="max-w-[64ch] mt-6" />
      </div>

      <Invitation subject="A named tea that is missing" />
    </article>
  );
};

export default NamedTeaIndexPage;
