import React from 'react';
import { useParams } from 'react-router-dom';
import { AtlasFrame, AtlasLoadState, countLabel } from '../AtlasFrame';
import { AtlasArticleRow } from '../AtlasArticleRow';
import { useAtlasJson } from '../useAtlas';
import type { AtlasTopicPage as TopicData } from '../types';

type TopicArticle = TopicData['articles'][number];

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

export default function AtlasTopicPage() {
  const { topicId = '' } = useParams();
  const load = useAtlasJson<TopicData>(`topics/${topicId}.json`);
  const ready = load.state === 'ready' ? load.data : null;
  return (
    <AtlasFrame
      title={ready?.topic.name}
      trail={ready ? [{ label: ready.topic.category }] : []}
      measure="list"
      here={{ topic: topicId }}
    >
      <AtlasLoadState load={load}>
        {({ topic, articles }) => {
          const years = byYear(articles);
          return (
            <>
              <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] text-tea-text">{topic.name}</h1>
              <p className="font-body text-ui-15 text-tea-text-sec mt-3">
                {countLabel(articles.length, 'article', 'articles')}, oldest first.
              </p>
              {years.length > 1 && (
                // Straight to a year, without scrolling through the ones before it.
                <nav aria-label="Jump to a year" className="flex flex-wrap gap-x-4 gap-y-1 mt-3 mb-8 md:mb-10">
                  {years.map(([year]) => (
                    <a
                      key={year}
                      href={`#year-${year}`}
                      onClick={e => {
                        e.preventDefault();
                        document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="font-body text-ui-14 text-tea-text-sec tabular-nums hover:text-tea-text transition-colors"
                    >
                      {year}
                    </a>
                  ))}
                </nav>
              )}
              {years.map(([year, list]) => (
                <section
                  key={year}
                  id={`year-${year}`}
                  aria-labelledby={`year-${year}-label`}
                  className="md:grid md:grid-cols-[88px_minmax(0,1fr)] md:gap-x-8 border-t border-tea-border pt-3 md:pt-0 mb-8 md:mb-10 scroll-mt-6"
                >
                  <h2
                    id={`year-${year}-label`}
                    className="font-display text-ui-26 leading-none text-tea-text-sec tabular-nums md:pt-4 md:sticky md:top-8 md:self-start"
                  >
                    {year}
                  </h2>
                  <ol>
                    {list.map(a => (
                      <AtlasArticleRow
                        key={a.id}
                        id={a.id}
                        title={a.title}
                        author={a.author}
                        pages={a.pages}
                        issueLabel={withoutYear(a.issueLabel, year)}
                      />
                    ))}
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
