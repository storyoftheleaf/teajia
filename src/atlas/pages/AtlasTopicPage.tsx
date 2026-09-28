import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState, countLabel } from '../AtlasFrame';
import { useAtlasJson } from '../useAtlas';
import type { AtlasTopicPage as TopicData } from '../types';

type TopicArticle = TopicData['articles'][number];

// A topic is the Atlas's main way in, and some topics hold 250 articles, so
// the page is set as a ledger to run the eye down: one line per article with
// the title, author, month and pages in their own columns, grouped under the
// year, and a filter that narrows it to what is being looked for.

/** Articles grouped under the year of their issue, in the order given (oldest first). */
function byYear(articles: TopicArticle[]): Array<[string, TopicArticle[]]> {
  const groups = new Map<string, TopicArticle[]>();
  for (const a of articles) {
    const year = /^(\d{4})/.exec(a.issue)?.[1] ?? 'Other';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(a);
  }
  return [...groups];
}

/** "February 2012" under the heading 2012 reads as "February". */
function withoutYear(label: string, year: string): string {
  return label.replace(new RegExp(`\\s*${year}\\s*$`), '') || label;
}

/** Lowercase with accents dropped, so "puer" finds "Pu’er" and "Pú". */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const LEDGER_COLS = 'md:grid-cols-[minmax(0,1fr)_11rem_6.5rem_3.5rem]';

const Row: React.FC<{ a: TopicArticle; year: string }> = ({ a, year }) => {
  const month = withoutYear(a.issueLabel, year);
  const pages = a.pages && a.pages !== '0' ? a.pages : '';
  return (
    <li className="border-b border-tea-border last:border-b-0">
      <Link
        to={`${ATLAS_ROOT}/read/${a.id}`}
        className={`group grid grid-cols-[minmax(0,1fr)_auto] ${LEDGER_COLS} items-baseline gap-x-5 py-2.5`}
      >
        <span className="min-w-0">
          <span className="block font-body text-ui-15 md:text-ui-16 leading-[1.4] text-tea-text group-hover:text-tea-gold-lt transition-colors">
            {a.title}
          </span>
          {/* On a phone the author and month sit under the title. */}
          <span className="md:hidden block font-body text-ui-13 text-tea-text-sec mt-0.5">
            {[a.author, month].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="hidden md:block font-body text-ui-14 text-tea-text-sec truncate">{a.author}</span>
        <span className="hidden md:block font-body text-ui-14 text-tea-text-dim">{month}</span>
        <span className="font-body text-ui-13 text-tea-text-dim tabular-nums text-right whitespace-nowrap">
          {pages && <><span className="sr-only">Pages </span>{pages}</>}
        </span>
      </Link>
    </li>
  );
};

export default function AtlasTopicPage() {
  const { topicId = '' } = useParams();
  const load = useAtlasJson<TopicData>(`topics/${topicId}.json`);
  const ready = load.state === 'ready' ? load.data : null;
  const [filter, setFilter] = useState('');

  const shown = useMemo(() => {
    if (!ready) return [];
    // The typed words as one phrase, so "wu de" finds Wu De and not every
    // title with "Wuzhou" and "decade" in it.
    const phrase = fold(filter).trim().replace(/\s+/g, ' ');
    if (!phrase) return ready.articles;
    return ready.articles.filter(a =>
      fold(a.title).replace(/\s+/g, ' ').includes(phrase) || fold(a.author).replace(/\s+/g, ' ').includes(phrase));
  }, [ready, filter]);

  return (
    <AtlasFrame
      title={ready?.topic.name}
      trail={ready ? [{ label: ready.topic.category }] : []}
      measure="wide"
      here={{ topic: topicId }}
    >
      <AtlasLoadState load={load}>
        {({ topic, articles }) => {
          const years = byYear(shown);
          const allYears = byYear(articles).map(([y]) => y);
          const filtering = filter.trim().length > 0;
          return (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
                <div>
                  <h1 className="font-display text-[34px] md:text-[42px] leading-[1.1] text-tea-text">{topic.name}</h1>
                  <p className="font-body text-ui-15 text-tea-text-sec mt-2" aria-live="polite">
                    {filtering
                      ? `${shown.length.toLocaleString()} of ${articles.length.toLocaleString()} articles`
                      : `${countLabel(articles.length, 'article', 'articles')}, oldest first`}
                  </p>
                </div>
                {articles.length > 8 && (
                  <div className="w-full sm:w-72">
                    <label htmlFor="atlas-topic-filter" className="sr-only">Filter these articles by title or author</label>
                    <input
                      id="atlas-topic-filter"
                      type="search"
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      placeholder="Filter by title or author"
                      className="w-full bg-transparent rounded-none border-0 border-b border-tea-border px-0 py-2 font-body text-ui-15 text-tea-text placeholder:text-tea-text-dim transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-tea-gold focus:!shadow-[0_1px_0_0_rgb(var(--tea-gold-rgb))] focus:!animate-none"
                    />
                  </div>
                )}
              </div>

              {allYears.length > 1 && (
                // Straight to a year, without scrolling through the ones before it.
                <nav aria-label="Jump to a year" className="flex flex-wrap gap-x-4 gap-y-1 mt-5 mb-8">
                  {allYears.map(year => {
                    const has = years.some(([y]) => y === year);
                    return has ? (
                      <a
                        key={year}
                        href={`#year-${year}`}
                        onClick={e => {
                          e.preventDefault();
                          document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="font-body text-ui-14 tabular-nums text-tea-text-sec hover:text-tea-text transition-colors"
                      >
                        {year}
                      </a>
                    ) : (
                      <span key={year} className="font-body text-ui-14 tabular-nums text-tea-text-dim opacity-60">{year}</span>
                    );
                  })}
                </nav>
              )}

              {/* Column heads for the ledger, wide screens only. */}
              <div aria-hidden className="hidden md:grid md:grid-cols-[5.5rem_minmax(0,1fr)] md:gap-x-8 border-b border-tea-border pb-2">
                <span />
                <div className={`grid ${LEDGER_COLS} gap-x-5 font-body text-ui-13 text-tea-text-dim`}>
                  <span>Title</span><span>Author</span><span>Month</span><span className="text-right">Pages</span>
                </div>
              </div>

              {years.length === 0 && (
                <p className="font-body text-ui-15 italic text-tea-text-sec mt-6">Nothing on this topic matches “{filter.trim()}”.</p>
              )}

              {years.map(([year, list]) => (
                <section
                  key={year}
                  id={`year-${year}`}
                  aria-labelledby={`year-${year}-label`}
                  className="md:grid md:grid-cols-[5.5rem_minmax(0,1fr)] md:gap-x-8 border-b border-tea-border pt-4 md:pt-0 scroll-mt-6"
                >
                  <h2
                    id={`year-${year}-label`}
                    className="font-display text-ui-20 leading-none text-tea-text-sec tabular-nums md:pt-3 md:sticky md:top-6 md:self-start"
                  >
                    {year}
                  </h2>
                  <ol className="pb-2">
                    {list.map(a => <Row key={a.id} a={a} year={year} />)}
                  </ol>
                </section>
              ))}
            </>
          );
        }}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
