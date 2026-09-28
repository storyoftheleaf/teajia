import React from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState, AtlasSearchBox } from '../AtlasFrame';
import { AtlasImage } from '../AtlasImage';
import { useAtlasJson } from '../useAtlas';
import type { AtlasHome, AtlasTopic } from '../types';

function byCategory(topics: AtlasTopic[]): Array<[string, AtlasTopic[]]> {
  const groups = new Map<string, AtlasTopic[]>();
  for (const t of topics) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category)!.push(t);
  }
  return [...groups];
}

export default function AtlasHomePage() {
  const load = useAtlasJson<AtlasHome>('home.json');
  return (
    <AtlasFrame measure="wide" hideSearch>
      <AtlasLoadState load={load}>
        {home => (
          <>
            <section className="max-w-[720px] mb-16 md:mb-20">
              <h1 className="font-display text-[40px] md:text-[56px] font-normal leading-[1.05] text-tea-text">A private reading library</h1>
              <p className="font-body text-ui-15 md:text-ui-17 text-tea-text-sec mt-4 mb-8 md:mb-10">
                {home.totals.articles.toLocaleString()} articles from {home.totals.issues} issues, searchable to the word.
              </p>
              <AtlasSearchBox large autoFocus />
            </section>

            <section className="mb-16 md:mb-20" aria-labelledby="atlas-sources">
              <h2 id="atlas-sources" className="font-display text-ui-28 text-tea-text mb-5">Sources</h2>
              <ul className="border-t border-tea-border">
                {home.sources.map(s => (
                  <li key={s.id} className="border-b border-tea-border">
                    <Link to={`${ATLAS_ROOT}/source/${s.id}`} className="group flex gap-5 md:gap-8 items-center py-5">
                      {s.cover && (
                        <AtlasImage src={s.cover} alt="" eager fit="cover" className="w-20 md:w-24 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-display text-ui-26 leading-[1.15] text-tea-text group-hover:text-tea-gold-lt transition-colors">{s.name}</div>
                        {s.subtitle && <div className="font-body italic text-ui-15 text-tea-text-sec mt-1">{s.subtitle}</div>}
                        <div className="font-body text-ui-14 text-tea-text-sec mt-3">
                          {s.issueCount} issues · {s.articleCount.toLocaleString()} articles
                          {s.first && <span className="text-tea-text-dim"> · {s.first} to {s.last}</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="atlas-topics">
              <h2 id="atlas-topics" className="font-display text-ui-28 text-tea-text mb-6">Topics</h2>
              {/* Columns rather than a grid, so short and long categories pack
                  without leaving holes under the short ones. */}
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-12">
                {byCategory(home.topics).map(([category, topics]) => (
                  <div key={category} className="break-inside-avoid mb-10">
                    <h3 className="font-display text-ui-20 text-tea-text pb-2 border-b border-tea-border">{category}</h3>
                    <ul>
                      {topics.map(t => (
                        <li key={t.id}>
                          <Link
                            to={`${ATLAS_ROOT}/topic/${t.id}`}
                            className="group flex items-baseline justify-between gap-4 py-1.5 font-body text-ui-15 text-tea-text-sec hover:text-tea-text transition-colors"
                          >
                            <span>{t.name}</span>
                            <span className="text-ui-13 text-tea-text-dim tabular-nums group-hover:text-tea-text-sec transition-colors">
                              <span className="sr-only">, </span>{t.count}<span className="sr-only"> articles</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </AtlasLoadState>
    </AtlasFrame>
  );
}
