import React from 'react';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { ATLAS_ROOT, AtlasFrame, AtlasLoadState, AtlasSearchBox } from '../AtlasFrame';
import { AtlasImage } from '../AtlasImage';
import { AtlasAddSourceLink } from '../AtlasAddSourceLink';
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
    <AtlasFrame wide hideSearch>
      <AtlasLoadState load={load}>
        {home => (
          <>
            <section className="mb-12">
              <h1 className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text mb-2`}>Tea Atlas</h1>
              <p className="text-tea-text-sec text-ui-15 mb-6">
                A private reading library. {home.totals.articles.toLocaleString()} articles in {home.totals.issues} issues.
              </p>
              <AtlasSearchBox large autoFocus />
              <AtlasAddSourceLink className="inline-block mt-4" />
            </section>

            <section className="mb-12" aria-labelledby="atlas-sources">
              <h2 id="atlas-sources" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-4`}>Sources</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {home.sources.map(s => (
                  <li key={s.id}>
                    <Link to={`${ATLAS_ROOT}/source/${s.id}`} className="group flex gap-4 items-start">
                      {s.cover && (
                        <AtlasImage src={s.cover} alt="" eager className="w-24 shrink-0 rounded-[2px] overflow-hidden" />
                      )}
                      <div className="min-w-0">
                        <div className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text group-hover:text-tea-gold transition-colors`}>{s.name}</div>
                        {s.subtitle && <div className="text-ui-13 text-tea-text-sec mt-0.5">{s.subtitle}</div>}
                        <div className="text-ui-13 text-tea-text-sec mt-2">
                          {s.issueCount} issues · {s.articleCount.toLocaleString()} articles
                        </div>
                        {s.first && <div className="text-ui-12 text-tea-text-dim mt-0.5">{s.first} to {s.last}</div>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="atlas-topics">
              <h2 id="atlas-topics" className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim mb-4`}>Topics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                {byCategory(home.topics).map(([category, topics]) => (
                  <div key={category}>
                    <h3 className="font-display text-ui-17 text-tea-text mb-2">{category}</h3>
                    <ul>
                      {topics.map(t => (
                        <li key={t.id}>
                          <Link
                            to={`${ATLAS_ROOT}/topic/${t.id}`}
                            className="flex items-baseline justify-between gap-3 py-1 text-ui-14 text-tea-text-sec hover:text-tea-text transition-colors"
                          >
                            <span>{t.name}</span>
                            <span className="text-ui-12 text-tea-text-dim tabular-nums">{t.count}</span>
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
